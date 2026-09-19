"""
Market Sprint — Market Service

Price retrieval, candle data, and market snapshots.
All prices come from the locked database records.
"""
from sqlalchemy.orm import Session
from ..models import Company, MarketPrice, MarketCandle, Game


def get_all_prices_at_tick(db: Session, game: Game, tick: int) -> list[dict]:
    """Get all company prices at a specific tick."""
    results = (
        db.query(Company, MarketPrice)
        .join(MarketPrice, MarketPrice.company_id == Company.id)
        .filter(
            MarketPrice.game_id == game.id,
            MarketPrice.tick == tick,
            Company.game_id == game.id,
            Company.is_active == True,
        )
        .all()
    )

    prices = []
    for company, mp in results:
        change = round(mp.price - company.start_price, 2)
        change_pct = round((change / company.start_price) * 100, 2) if company.start_price else 0

        prices.append({
            "ticker": company.ticker,
            "name": company.name,
            "sector": company.sector,
            "price": mp.price,
            "change": change,
            "change_percent": change_pct,
            "start_price": company.start_price,
            "company_id": company.id,
        })

    return prices


def get_price_at_tick(db: Session, game: Game, company_id: str, tick: int) -> float | None:
    """Get a single company's price at a specific tick."""
    mp = (
        db.query(MarketPrice)
        .filter(
            MarketPrice.game_id == game.id,
            MarketPrice.company_id == company_id,
            MarketPrice.tick == tick,
        )
        .first()
    )
    return mp.price if mp else None


def get_candles(db: Session, game: Game, ticker: str, up_to_tick: int) -> list[dict]:
    """Get candle data up to the current tick for a company."""
    company = (
        db.query(Company)
        .filter(Company.game_id == game.id, Company.ticker == ticker)
        .first()
    )
    if not company:
        return []

    candles = (
        db.query(MarketCandle)
        .filter(
            MarketCandle.game_id == game.id,
            MarketCandle.company_id == company.id,
            MarketCandle.tick <= up_to_tick,
        )
        .order_by(MarketCandle.tick)
        .all()
    )

    return [
        {
            "tick": c.tick,
            "open": c.open_price,
            "high": c.high_price,
            "low": c.low_price,
            "close": c.close_price,
        }
        for c in candles
    ]


def get_company_by_ticker(db: Session, game: Game, ticker: str) -> Company | None:
    """Look up a company by ticker."""
    return (
        db.query(Company)
        .filter(Company.game_id == game.id, Company.ticker == ticker)
        .first()
    )
