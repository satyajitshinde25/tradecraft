"""
Market Sprint — Audit Service

Logs all significant events for accountability.
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..models import AuditLog


def log_event(
    db: Session,
    event_type: str,
    game_id: str | None = None,
    team_id: str | None = None,
    tick: int | None = None,
    order_id: str | None = None,
    message: str | None = None,
    metadata: dict | None = None,
):
    """Record an audit event."""
    entry = AuditLog(
        game_id=game_id,
        team_id=team_id,
        event_type=event_type,
        tick=tick,
        order_id=order_id,
        message=message,
        metadata_json=metadata,
    )
    db.add(entry)
    # Don't commit here — let the caller manage the transaction
