from __future__ import annotations
"""
Market Sprint — Market Service (MongoDB)

Price retrieval, candle data, and market snapshots.
All prices come from the locked database records.
"""
from typing import Optional, List, Dict
from pymongo.database import Database
from ..models import to_doc


def get_all_prices_at_tick(db: Database, game, tick: int) -> List[Dict]:
    """Get all company prices at a specific tick."""
    companies = list(db.companies.find({"game_id": game.id, "is_active": True}))

    prices = []
    for company_doc in companies:
        company = to_doc(company_doc)
        mp = db.market_prices.find_one({
            "game_id": game.id,
            "company_id": company.id,
            "tick": tick,
        })

        if mp:
            change = round(mp["price"] - company.start_price, 2)
            change_pct = round((change / company.start_price) * 100, 2) if company.start_price else 0

            prices.append({
                "ticker": company.ticker,
                "name": company.name,
                "sector": company.sector,
                "price": mp["price"],
                "change": change,
                "change_percent": change_pct,
                "start_price": company.start_price,
                "company_id": company.id,
            })

    return prices


def get_price_at_tick(db: Database, game, company_id: str, tick: int) -> Optional[float]:
    """Get a single company's price at a specific tick."""
    mp = db.market_prices.find_one({
        "game_id": game.id,
        "company_id": company_id,
        "tick": tick,
    })
    return mp["price"] if mp else None


def get_candles(db: Database, game, ticker: str, up_to_tick: int) -> List[Dict]:
    """Get candle data up to the current tick for a company."""
    company = db.companies.find_one({"game_id": game.id, "ticker": ticker})
    if not company:
        return []

    company = to_doc(company)
    candles = db.market_candles.find({
        "game_id": game.id,
        "company_id": company.id,
        "tick": {"$lte": up_to_tick},
    }).sort("tick", 1)

    return [
        {
            "tick": c["tick"],
            "open": c["open_price"],
            "high": c["high_price"],
            "low": c["low_price"],
            "close": c["close_price"],
        }
        for c in candles
    ]


def get_company_by_ticker(db: Database, game, ticker: str):
    """Look up a company by ticker. Returns a DotDict or None."""
    doc = db.companies.find_one({"game_id": game.id, "ticker": ticker})
    return to_doc(doc) if doc else None
