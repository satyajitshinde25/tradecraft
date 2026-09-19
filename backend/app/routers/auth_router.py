"""
Market Sprint — Auth Router

POST /auth/login
POST /auth/logout
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import verify_password, create_token, get_current_team
from ..config import get_settings
from ..models import Team, TeamCredential
from ..schemas import LoginRequest, LoginResponse
from ..services.audit import log_event
from ..services.game_clock import get_game

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a team or admin.
    Returns a JWT token on success.
    """
    # Check for admin login
    if request.team_id.upper() == "ADMIN":
        if request.password == settings.ADMIN_PASSWORD:
            token = create_token({"role": "admin", "sub": "ADMIN"})

            try:
                game = get_game(db)
                log_event(db, "LOGIN_SUCCESS", game_id=game.id, message="Admin login")
                db.commit()
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

    # Team login
    team = (
        db.query(Team)
        .filter(Team.team_code == request.team_id.upper())
        .first()
    )

    if not team:
        # Generic error — don't reveal whether team exists
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    credential = (
        db.query(TeamCredential)
        .filter(TeamCredential.team_id == team.id)
        .first()
    )

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
            credential.locked_until = None
            credential.failed_attempts = 0

    # Verify password
    if not verify_password(request.password, credential.password_hash):
        credential.failed_attempts += 1

        # Lock after 5 failures
        if credential.failed_attempts >= 5:
            from datetime import timedelta
            credential.locked_until = datetime.now(timezone.utc) + timedelta(minutes=5)

        log_event(
            db, "LOGIN_FAILURE",
            game_id=team.game_id,
            team_id=team.id,
            message=f"Failed login attempt #{credential.failed_attempts}",
        )
        db.commit()

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
    credential.failed_attempts = 0
    credential.locked_until = None
    credential.last_login_at = datetime.now(timezone.utc)

    token = create_token({
        "team_id": team.id,
        "team_code": team.team_code,
        "role": "team",
        "sub": team.team_code,
    })

    log_event(
        db, "LOGIN_SUCCESS",
        game_id=team.game_id,
        team_id=team.id,
        message=f"{team.team_code} logged in",
    )
    db.commit()

    return LoginResponse(
        token=token,
        team_code=team.team_code,
        display_name=team.display_name,
        role="team",
    )


@router.post("/logout")
def logout(
    team: Team = Depends(get_current_team),
    db: Session = Depends(get_db),
):
    """Log out (mostly for audit trail — JWT is stateless)."""
    log_event(
        db, "LOGOUT",
        game_id=team.game_id,
        team_id=team.id,
        message=f"{team.team_code} logged out",
    )
    db.commit()
    return {"message": "Logged out"}
