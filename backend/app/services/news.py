from __future__ import annotations
"""
Market Sprint — News Service (MongoDB)

Releases scheduled and surprise news events at their designated ticks.
Ensures reserve events are only released manually by authorized organizers.
Guarantees unreleased surprise headlines and future secret effects are never exposed.
"""
from datetime import datetime, timezone
from pymongo.database import Database
from ..models import to_doc


def get_released_news(db: Database, game, current_tick: int):
    """Get all news events that have been released up to the current tick."""
    # Only auto-release non-reserve events whose designated tick has arrived
    db.news_events.update_many(
        {
            "game_id": game.id,
            "event_type": {"$ne": "RESERVE"},
            "release_tick": {"$gte": 0, "$lte": current_tick},
            "released": False,
        },
        {
            "$set": {
                "released": True,
                "released_at": datetime.now(timezone.utc),
            }
        }
    )

    # Return all released events sorted by release tick descending
    docs = db.news_events.find(
        {"game_id": game.id, "released": True}
    ).sort([("release_tick", -1), ("event_number", -1)])

    return [to_doc(d) for d in docs]


def get_upcoming_scheduled_events(db: Database, game, current_tick: int):
    """
    Get scheduled events that haven't been released yet.
    Only exposes the calendar title and forecast, NOT the secret result headline.
    """
    docs = db.news_events.find({
        "game_id": game.id,
        "is_scheduled": True,
        "released": False,
        "release_tick": {"$gt": current_tick},
    }).sort("release_tick", 1)

    return [to_doc(d) for d in docs]


def reset_news_for_restart(db: Database, game):
    """Reset all news events to unreleased state for game restart."""
    # Reset standard events
    db.news_events.update_many(
        {"game_id": game.id, "event_type": {"$ne": "RESERVE"}},
        {"$set": {"released": False, "released_at": None}}
    )

    # Reset reserve events and restore their release_tick to -1
    db.news_events.update_many(
        {"game_id": game.id, "event_type": "RESERVE"},
        {"$set": {"released": False, "released_at": None, "release_tick": -1}}
    )
