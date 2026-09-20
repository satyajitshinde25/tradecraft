"""
Market Sprint — News Service

Releases scheduled and surprise news events at their designated ticks.
Ensures reserve events are only released manually by authorized organizers.
Guarantees unreleased surprise headlines and future secret effects are never exposed.
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..models import NewsEvent, Game


def get_released_news(db: Session, game: Game, current_tick: int) -> list[NewsEvent]:
    """Get all news events that have been released up to the current tick."""
    # Only auto-release non-reserve events whose designated tick has arrived
    unreleased = (
        db.query(NewsEvent)
        .filter(
            NewsEvent.game_id == game.id,
            NewsEvent.event_type != "RESERVE",
            NewsEvent.release_tick >= 0,
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

    # Return all released events sorted by release tick descending
    return (
        db.query(NewsEvent)
        .filter(
            NewsEvent.game_id == game.id,
            NewsEvent.released == True,
        )
        .order_by(NewsEvent.release_tick.desc(), NewsEvent.event_number.desc())
        .all()
    )


def get_upcoming_scheduled_events(db: Session, game: Game, current_tick: int) -> list[NewsEvent]:
    """
    Get scheduled events that haven't been released yet.
    Only exposes the calendar title and forecast, NOT the secret result headline.
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
    # Reset standard events
    db.query(NewsEvent).filter(
        NewsEvent.game_id == game.id,
        NewsEvent.event_type != "RESERVE",
    ).update({
        "released": False,
        "released_at": None,
    })

    # Reset reserve events and restore their release_tick to -1
    db.query(NewsEvent).filter(
        NewsEvent.game_id == game.id,
        NewsEvent.event_type == "RESERVE",
    ).update({
        "released": False,
        "released_at": None,
        "release_tick": -1,
    })

    db.commit()
