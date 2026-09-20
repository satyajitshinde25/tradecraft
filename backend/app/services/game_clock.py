"""
Market Sprint — Game Clock Service

Derives current tick from persisted game_start_time.
Never uses an in-memory counter.
"""
from datetime import datetime, timezone
from math import floor
from sqlalchemy.orm import Session
from ..models import Game, GameStatus


def get_current_tick(game: Game) -> int:
    """
    Calculate current tick from server time and game start_time.
    Returns 0..96 bounded.
    """
    if game.status == GameStatus.DRAFT.value or game.status == GameStatus.READY.value:
        return 0

    if game.start_time is None:
        return 0

    end_time = datetime.now(timezone.utc)
    if game.status == GameStatus.PAUSED.value and game.paused_at:
        end_time = game.paused_at
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)

    start = game.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    elapsed = (end_time - start).total_seconds()
    
    tick_secs = 1 if game.is_test_mode else game.tick_seconds
    tick = floor(elapsed / tick_secs)

    # Bound to valid range
    tick = max(0, min(96, tick))

    return tick


def get_tick_timing(game: Game, current_tick: int) -> dict:
    """
    Calculate tick start/end times for countdown display.
    """
    if game.start_time is None:
        return {
            "tick_started_at": None,
            "next_tick_at": None,
        }

    start = game.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    from datetime import timedelta

    tick_secs = 1 if game.is_test_mode else game.tick_seconds
    tick_start = start + timedelta(seconds=current_tick * tick_secs)
    next_tick = start + timedelta(seconds=(current_tick + 1) * tick_secs)

    if game.status == GameStatus.PAUSED.value:
        return {
            "tick_started_at": tick_start.isoformat(),
            "next_tick_at": None,
        }

    return {
        "tick_started_at": tick_start.isoformat(),
        "next_tick_at": next_tick.isoformat() if current_tick < 96 else None,
    }


def get_game(db: Session) -> Game:
    """Get the active game (there's only one)."""
    game = db.query(Game).first()
    if not game:
        raise ValueError("No game found in database")
    return game
