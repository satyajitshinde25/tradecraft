from __future__ import annotations
"""
Market Sprint — Game Router (MongoDB)

GET /game/state
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pymongo.database import Database

from ..database import get_db
from ..auth import get_current_team
from ..schemas import GameStateResponse
from ..services.game_clock import get_game, get_current_tick, get_tick_timing

router = APIRouter(prefix="/game", tags=["Game"])


@router.get("/state", response_model=GameStateResponse)
def game_state(
    team=Depends(get_current_team),
    db: Database = Depends(get_db),
):
    """Get current game state including tick and timing."""
    game = get_game(db)
    current_tick = get_current_tick(game)
    timing = get_tick_timing(game, current_tick)

    return GameStateResponse(
        game_id=game.id,
        game_name=game.name,
        status=game.status,
        current_tick=current_tick,
        max_tick=96,
        tick_seconds=game.tick_seconds,
        server_time=datetime.now(timezone.utc).isoformat(),
        tick_started_at=timing.get("tick_started_at"),
        next_tick_at=timing.get("next_tick_at"),
        starting_balance=game.starting_balance,
        max_trades=game.max_trades,
        buy_limit_percent=game.buy_limit_percent,
        concentration_limit=game.concentration_limit,
        trade_fee_percent=game.trade_fee_percent,
        cooldown_seconds=game.cooldown_seconds,
    )
