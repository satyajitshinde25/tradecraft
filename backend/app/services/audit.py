from __future__ import annotations
"""
Market Sprint — Audit Service (MongoDB)

Logs all significant events for accountability.
"""
from datetime import datetime, timezone
from typing import Optional
from pymongo.database import Database
from ..models import make_audit_log


def log_event(
    db: Database,
    event_type: str,
    game_id: Optional[str] = None,
    team_id: Optional[str] = None,
    tick: Optional[int] = None,
    order_id: Optional[str] = None,
    message: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """Record an audit event."""
    entry = make_audit_log(
        game_id=game_id,
        team_id=team_id,
        event_type=event_type,
        tick=tick,
        order_id=order_id,
        message=message,
        metadata_json=metadata,
    )
    db.audit_logs.insert_one(entry)
