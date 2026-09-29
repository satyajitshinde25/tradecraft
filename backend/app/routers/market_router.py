"""
Market Sprint — Market Router

GET /market/overview
GET /market/{ticker}
GET /market/{ticker}/candles
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_team
from ..models import Team
from ..schemas import MarketOverviewResponse, CompanyPrice, CandlesResponse, CandleData, LeaderboardResponse, LeaderboardEntry
from ..services.game_clock import get_game, get_current_tick
from ..services.market import get_all_prices_at_tick, get_candles, get_company_by_ticker
from ..services.leaderboard import calculate_leaderboard

router = APIRouter(prefix="/market", tags=["Market"])


@router.get("/overview", response_model=MarketOverviewResponse)
def market_overview(
    team: Team = Depends(get_current_team),
    db: Session = Depends(get_db),
):
    """Get all company prices at the current tick."""
    game = get_game(db)
    current_tick = get_current_tick(game)

    prices_data = get_all_prices_at_tick(db, game, current_tick)

    return MarketOverviewResponse(
        tick=current_tick,
        timestamp=datetime.now(timezone.utc).isoformat(),
        prices=[
            CompanyPrice(
                ticker=p["ticker"],
                name=p["name"],
                sector=p["sector"],
                price=p["price"],
                change=p["change"],
                change_percent=p["change_percent"],
                start_price=p["start_price"],
            )
            for p in prices_data
        ],
    )


@router.get("/{ticker}/candles", response_model=CandlesResponse)
def company_candles(
    ticker: str,
    team: Team = Depends(get_current_team),
    db: Session = Depends(get_db),
):
    """Get candle data for a company up to the current tick."""
    game = get_game(db)
    current_tick = get_current_tick(game)

    company = get_company_by_ticker(db, game, ticker.upper())
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    candles = get_candles(db, game, ticker.upper(), current_tick)

    return CandlesResponse(
        ticker=company.ticker,
        name=company.name,
        candles=[
            CandleData(
                tick=c["tick"],
                open=c["open"],
                high=c["high"],
                low=c["low"],
                close=c["close"],
            )
            for c in candles
        ],
    )


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_market_leaderboard(
    team: Team = Depends(get_current_team),
    db: Session = Depends(get_db),
):
    """Get the current live trading floor leaderboard."""
    game = get_game(db)
    current_tick = get_current_tick(game)
    entries = calculate_leaderboard(db, game, current_tick)
    return LeaderboardResponse(
        tick=current_tick,
        entries=[LeaderboardEntry(**e) for e in entries]
    )

