from __future__ import annotations
"""
Market Sprint — Database engine (MongoDB via PyMongo)

Provides a synchronous PyMongo client and database handle.
All routers/services use `get_db()` as a FastAPI dependency.
"""
from pymongo import MongoClient
from pymongo.database import Database
from .config import get_settings

settings = get_settings()

# Synchronous PyMongo client
client: MongoClient = MongoClient(settings.MONGODB_URI)
database: Database = client[settings.MONGODB_DB]


def get_db() -> Database:
    """FastAPI dependency that returns the MongoDB database handle."""
    return database


def ensure_indexes():
    """Create indexes for performance. Idempotent — safe to call on every startup."""
    db = database

    # teams
    db.teams.create_index("team_code", unique=True)
    db.teams.create_index("game_id")

    # team_credentials
    db.team_credentials.create_index("team_id", unique=True)

    # team_wallets
    db.team_wallets.create_index("team_id", unique=True)

    # companies
    db.companies.create_index([("game_id", 1), ("ticker", 1)], unique=True)

    # market_prices — composite key
    db.market_prices.create_index(
        [("game_id", 1), ("company_id", 1), ("tick", 1)], unique=True
    )

    # market_candles
    db.market_candles.create_index(
        [("game_id", 1), ("company_id", 1), ("tick", 1)], unique=True
    )

    # news_events
    db.news_events.create_index([("game_id", 1), ("release_tick", 1)])

    # orders
    db.orders.create_index([("game_id", 1), ("team_id", 1), ("submitted_at", -1)])
    db.orders.create_index([("game_id", 1), ("status", 1)])

    # holdings
    db.holdings.create_index([("team_id", 1), ("company_id", 1)], unique=True)

    # portfolio_snapshots
    db.portfolio_snapshots.create_index([("game_id", 1), ("tick", 1)])

    # leaderboard_snapshots
    db.leaderboard_snapshots.create_index([("game_id", 1), ("tick", 1), ("rank", 1)])

    # audit_logs
    db.audit_logs.create_index([("game_id", 1), ("created_at", -1)])

    # connections
    db.connections.create_index("team_id")
