"""
Market Sprint — Authentication Module

JWT creation, password verification, and FastAPI dependencies.
"""
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.hash import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models import Team, TeamCredential

settings = get_settings()
security = HTTPBearer()


# ── Password helpers ───────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return bcrypt.hash(password)


# ── JWT helpers ────────────────────────────────────────────────────

def create_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


# ── FastAPI Dependencies ──────────────────────────────────────────

def get_current_team(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Team:
    """
    Extract authenticated team from JWT.
    This is the ONLY way to determine team identity — never trust client input.
    """
    payload = decode_token(credentials.credentials)
    team_id = payload.get("team_id")
    role = payload.get("role", "team")

    if not team_id or role != "team":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    team = db.query(Team).filter(Team.id == team_id).first()
    if not team or not team.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Team not found or inactive",
        )

    return team


def get_admin_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Validate admin JWT. Returns the decoded payload.
    """
    payload = decode_token(credentials.credentials)
    role = payload.get("role")

    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return payload
