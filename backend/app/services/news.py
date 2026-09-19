"""
Market Sprint — News Service

Releases news events at their designated ticks.
Never exposes unreleased events to participants.
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..models import NewsEvent, Game


def get_released_news(db: Session, game: Game, current_tick: int) -> list[NewsEvent]:
    """Get all news events that have been released up to the current tick."""
    # First, mark any unreleased events that should now be released
    unreleased = (
        db.query(NewsEvent)
        .filter(
            NewsEvent.game_id == game.id,
            NewsEvent.release_tick <= current_tick,
            NewsEvent.released == False,
        )
        .all()
    )

    for evt in unreleased:
        evt.released = True
        evt.released_at = datetime.now(timezone.utc)

    if unreleased:
        db.commit()

    # Return all released events
    return (
        db.query(NewsEvent)
        .filter(
            NewsEvent.game_id == game.id,
            NewsEvent.released == True,
        )
        .order_by(NewsEvent.release_tick.desc())
        .all()
    )


def get_upcoming_scheduled_events(db: Session, game: Game, current_tick: int) -> list[NewsEvent]:
    """
    Get scheduled events that haven't been released yet.
    Only shows the calendar/forecast, NOT the actual result.
    """
    return (
        db.query(NewsEvent)
        .filter(
            NewsEvent.game_id == game.id,
            NewsEvent.is_scheduled == True,
            NewsEvent.released == False,
            NewsEvent.release_tick > current_tick,
        )
        .order_by(NewsEvent.release_tick)
        .all()
    )


def reset_news_for_restart(db: Session, game: Game):
    """Reset all news events to unreleased state for game restart."""
    db.query(NewsEvent).filter(
        NewsEvent.game_id == game.id
    ).update({
        "released": False,
        "released_at": None,
    })
    db.commit()
