"""
Market Sprint — Portfolio Router

GET /portfolio: Get full portfolio summary for the authenticated team
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_team
from ..models import Team
from ..schemas import PortfolioResponse, HoldingResponse
from ..services.game_clock import get_game, get_current_tick
from ..services.portfolio import get_portfolio
from ..services.orders import process_pending_orders

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


@router.get("", response_model=PortfolioResponse)
def portfolio(
    team: Team = Depends(get_current_team),
    db: Session = Depends(get_db),
):
    """Get full portfolio summary for the authenticated team."""
    game = get_game(db)
    current_tick = get_current_tick(game)

    # Process pending orders whose fill tick has arrived
    process_pending_orders(db, game, current_tick)

    data = get_portfolio(db, game, team, current_tick)

    return PortfolioResponse(
        team_code=data["team_code"],
        display_name=data["display_name"],
        cash=data["cash"],
        holdings_value=data["holdings_value"],
        portfolio_value=data["portfolio_value"],
        starting_balance=data["starting_balance"],
        profit_loss=data["profit_loss"],
        profit_loss_percent=data["profit_loss_percent"],
        trades_used=data["trades_used"],
        max_trades=data["max_trades"],
        companies_traded=data["companies_traded"],
        is_eligible=data["is_eligible"],
        holdings=[HoldingResponse(**h) for h in data["holdings"]],
    )
