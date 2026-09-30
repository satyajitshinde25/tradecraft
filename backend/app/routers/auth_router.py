from __future__ import annotations
"""
Market Sprint — Auth Router (MongoDB)

POST /auth/login
POST /auth/logout
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

from ..database import get_db
from ..auth import verify_password, create_token, get_current_team
from ..config import get_settings
from ..models import to_doc
from ..schemas import LoginRequest, LoginResponse
from ..services.audit import log_event
from ..services.game_clock import get_game

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Database = Depends(get_db)):
    """
    Authenticate a team or admin.
    Returns a JWT token on success.
    """
    cleaned_id = request.team_id.strip()
    cleaned_password = request.password.strip()

    # Check for admin login (case-insensitive)
    if cleaned_id.upper() == "ADMIN":
        if request.password == settings.ADMIN_PASSWORD or cleaned_password == settings.ADMIN_PASSWORD:
            import uuid
            new_token = str(uuid.uuid4())
            token = create_token({"role": "admin", "sub": "ADMIN", "session": new_token})

            try:
                game = get_game(db)
                db.games.update_one(
                    {"_id": game.id},
                    {"$set": {"admin_session_token": new_token}}
                )
                log_event(db, "LOGIN_SUCCESS", game_id=game.id, message="Admin login")
            except Exception:
                pass

            return LoginResponse(
                token=token,
                team_code="ADMIN",
                display_name="Administrator",
                role="admin",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

    # Team login with flexible formatting (e.g. "team-1", "team 1", "team1", "TEAM-01")
    import re
    team_code = cleaned_id.upper()
    match = re.match(r"^TEAM[-_\s]?(\d+)$", team_code)
    if match:
        num = int(match.group(1))
        team_code = f"TEAM-{num:02d}"

    team = to_doc(db.teams.find_one({"team_code": team_code}))

    if not team:
        # Generic error — don't reveal whether team exists
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    credential = to_doc(db.team_credentials.find_one({"team_id": team.id}))

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Check lockout
    if credential.locked_until:
        locked = credential.locked_until
        if locked.tzinfo is None:
            locked = locked.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) < locked:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Account temporarily locked. Try again later.",
            )
        else:
            # Lockout expired, reset
            db.team_credentials.update_one(
                {"team_id": team.id},
                {"$set": {"locked_until": None, "failed_attempts": 0}}
            )

    # Verify password (test both raw and trimmed)
    password_ok = verify_password(request.password, credential.password_hash) or \
                  verify_password(cleaned_password, credential.password_hash)
    if not password_ok:
        new_attempts = credential.failed_attempts + 1
        update_fields = {"failed_attempts": new_attempts}

        # Lock after 5 failures
        if new_attempts >= 5:
            from datetime import timedelta
            update_fields["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=5)

        db.team_credentials.update_one(
            {"team_id": team.id},
            {"$set": update_fields}
        )

        log_event(
            db, "LOGIN_FAILURE",
            game_id=team.game_id,
            team_id=team.id,
            message=f"Failed login attempt #{new_attempts}",
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not team.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team is not active",
        )

    # Success — reset failures, create token
    import uuid
    new_token = str(uuid.uuid4())
    db.team_credentials.update_one(
        {"team_id": team.id},
        {"$set": {
            "failed_attempts": 0,
            "locked_until": None,
            "last_login_at": datetime.now(timezone.utc),
            "active_session_token": new_token,
            "updated_at": datetime.now(timezone.utc),
        }}
    )

    token = create_token({
        "team_id": team.id,
        "team_code": team.team_code,
        "role": "team",
        "sub": team.team_code,
        "session": new_token,
    })

    log_event(
        db, "LOGIN_SUCCESS",
        game_id=team.game_id,
        team_id=team.id,
        message=f"{team.team_code} logged in",
    )

    return LoginResponse(
        token=token,
        team_code=team.team_code,
        display_name=team.display_name,
        role="team",
    )


@router.post("/logout")
def logout(
    team=Depends(get_current_team),
    db: Database = Depends(get_db),
):
    """Log out (mostly for audit trail — JWT is stateless)."""
    log_event(
        db, "LOGOUT",
        game_id=team.game_id,
        team_id=team.id,
        message=f"{team.team_code} logged out",
    )

    # Clear active session
    db.team_credentials.update_one(
        {"team_id": team.id},
        {"$set": {"active_session_token": None}}
    )
    return {"message": "Logged out"}
