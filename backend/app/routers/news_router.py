"""
Market Sprint — News Router

GET /news: Retrieves all officially released news events and upcoming scheduled events
(with calendar titles and forecasts only; secret surprise headlines remain hidden).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_team
from ..models import Team
from ..schemas import NewsResponse, NewsEventResponse, UpcomingScheduledEvent
from ..services.game_clock import get_game, get_current_tick
from ..services.news import get_released_news, get_upcoming_scheduled_events

router = APIRouter(prefix="/news", tags=["News"])


@router.get("", response_model=NewsResponse)
def get_news(
    team: Team = Depends(get_current_team),
    db: Session = Depends(get_db),
):
    """Get released news and upcoming scheduled events (sanitized, no leak of results)."""
    game = get_game(db)
    current_tick = get_current_tick(game)

    released = get_released_news(db, game, current_tick)
    upcoming = get_upcoming_scheduled_events(db, game, current_tick)

    return NewsResponse(
        released_events=[
            NewsEventResponse(
                event_number=evt.event_number,
                release_tick=evt.release_tick,
                event_type=evt.event_type,
                headline=evt.headline,
                calendar_title=evt.calendar_title,
                time_offset=evt.time_offset,
                description=evt.description,
                forecast=evt.forecast,
                is_scheduled=evt.is_scheduled,
                released_at=evt.released_at.isoformat() if evt.released_at else None,
            )
            for evt in released
        ],
        upcoming_scheduled=[],
    )
