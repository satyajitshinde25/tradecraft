from __future__ import annotations
"""
Market Sprint — Document Models (MongoDB)

Pydantic models that define document shapes for each MongoDB collection.
These replace the old SQLAlchemy ORM models.
"""
import uuid
import enum
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any


def utcnow():
    return datetime.now(timezone.utc)


def new_id():
    return str(uuid.uuid4())


# ── Enums ──────────────────────────────────────────────────────────

class GameStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    READY = "READY"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    CLOSING = "CLOSING"
    FINISHED = "FINISHED"


class OrderSide(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    FILLED = "FILLED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


# ── Helper: attribute-style access on dicts ─────────────────────────

class DotDict(dict):
    """
    A dict subclass that allows attribute-style access.
    Used so that code like `game.status` or `team.id` works
    without rewriting every attribute access to `game['status']`.
    """
    def __getattr__(self, key):
        try:
            return self[key]
        except KeyError:
            raise AttributeError(f"'DotDict' has no attribute '{key}'")

    def __setattr__(self, key, value):
        self[key] = value

    def __delattr__(self, key):
        try:
            del self[key]
        except KeyError:
            raise AttributeError(f"'DotDict' has no attribute '{key}'")


def to_doc(d: dict) -> DotDict:
    """Convert a MongoDB document (dict) to a DotDict for attribute-style access."""
    if d is None:
        return None
    result = DotDict(d)
    # Map MongoDB _id to id for backward compatibility
    if "_id" in result and "id" not in result:
        result["id"] = str(result["_id"])
    return result


# ── Document factory helpers ────────────────────────────────────────

def make_game(**kwargs) -> dict:
    doc = {
        "_id": kwargs.get("id", new_id()),
        "name": kwargs.get("name", "Market Sprint"),
        "status": kwargs.get("status", GameStatus.DRAFT.value),
        "start_time": kwargs.get("start_time", None),
        "end_time": kwargs.get("end_time", None),
        "paused_at": kwargs.get("paused_at", None),
        "admin_session_token": kwargs.get("admin_session_token", None),
        "is_test_mode": kwargs.get("is_test_mode", False),
        "tick_seconds": kwargs.get("tick_seconds", 37.5),
        "starting_balance": kwargs.get("starting_balance", 10000.00),
        "max_trades": kwargs.get("max_trades", 22),
        "buy_limit_percent": kwargs.get("buy_limit_percent", 35.0),
        "concentration_limit": kwargs.get("concentration_limit", 60.0),
        "trade_fee_percent": kwargs.get("trade_fee_percent", 0.4),
        "cooldown_seconds": kwargs.get("cooldown_seconds", 7),
        "created_at": kwargs.get("created_at", utcnow()),
        "updated_at": kwargs.get("updated_at", utcnow()),
    }
    return doc


def make_team(**kwargs) -> dict:
    return {
        "_id": kwargs.get("id", new_id()),
        "game_id": kwargs["game_id"],
        "team_code": kwargs["team_code"],
        "display_name": kwargs["display_name"],
        "is_active": kwargs.get("is_active", True),
        "created_at": kwargs.get("created_at", utcnow()),
    }


def make_team_credential(**kwargs) -> dict:
    return {
        "team_id": kwargs["team_id"],
        "password_hash": kwargs["password_hash"],
        "failed_attempts": kwargs.get("failed_attempts", 0),
        "locked_until": kwargs.get("locked_until", None),
        "last_login_at": kwargs.get("last_login_at", None),
        "active_session_token": kwargs.get("active_session_token", None),
        "created_at": kwargs.get("created_at", utcnow()),
        "updated_at": kwargs.get("updated_at", utcnow()),
    }


def make_company(**kwargs) -> dict:
    return {
        "_id": kwargs.get("id", new_id()),
        "game_id": kwargs["game_id"],
        "ticker": kwargs["ticker"],
        "name": kwargs["name"],
        "sector": kwargs["sector"],
        "start_price": kwargs["start_price"],
        "description": kwargs.get("description", None),
        "is_active": kwargs.get("is_active", True),
        "created_at": kwargs.get("created_at", utcnow()),
    }


def make_market_price(**kwargs) -> dict:
    return {
        "game_id": kwargs["game_id"],
        "company_id": kwargs["company_id"],
        "tick": kwargs["tick"],
        "price": kwargs["price"],
        "created_at": kwargs.get("created_at", utcnow()),
    }


def make_market_candle(**kwargs) -> dict:
    return {
        "game_id": kwargs["game_id"],
        "company_id": kwargs["company_id"],
        "tick": kwargs["tick"],
        "open_price": kwargs["open_price"],
        "high_price": kwargs["high_price"],
        "low_price": kwargs["low_price"],
        "close_price": kwargs["close_price"],
        "created_at": kwargs.get("created_at", utcnow()),
    }


def make_news_event(**kwargs) -> dict:
    return {
        "_id": kwargs.get("id", new_id()),
        "game_id": kwargs["game_id"],
        "event_number": kwargs["event_number"],
        "release_tick": kwargs["release_tick"],
        "event_type": kwargs["event_type"],
        "headline": kwargs["headline"],
        "description": kwargs.get("description", None),
        "calendar_title": kwargs.get("calendar_title", None),
        "time_offset": kwargs.get("time_offset", None),
        "forecast": kwargs.get("forecast", None),
        "affected_tickers": kwargs.get("affected_tickers", None),
        "is_scheduled": kwargs.get("is_scheduled", False),
        "released": kwargs.get("released", False),
        "released_at": kwargs.get("released_at", None),
        "created_at": kwargs.get("created_at", utcnow()),
    }


def make_order(**kwargs) -> dict:
    return {
        "_id": kwargs.get("id", new_id()),
        "game_id": kwargs["game_id"],
        "team_id": kwargs["team_id"],
        "company_id": kwargs["company_id"],
        "side": kwargs["side"],
        "quantity": kwargs["quantity"],
        "submitted_tick": kwargs["submitted_tick"],
        "submitted_at": kwargs.get("submitted_at", utcnow()),
        "status": kwargs.get("status", OrderStatus.PENDING.value),
        "requested_price": kwargs.get("requested_price", None),
        "fill_tick": kwargs.get("fill_tick", None),
        "fill_price": kwargs.get("fill_price", None),
        "fee": kwargs.get("fee", 0.0),
        "gross_value": kwargs.get("gross_value", None),
        "net_value": kwargs.get("net_value", None),
        "rejection_reason": kwargs.get("rejection_reason", None),
        "created_at": kwargs.get("created_at", utcnow()),
    }


def make_order_fill(**kwargs) -> dict:
    return {
        "_id": kwargs.get("id", new_id()),
        "order_id": kwargs["order_id"],
        "fill_tick": kwargs["fill_tick"],
        "fill_price": kwargs["fill_price"],
        "quantity": kwargs["quantity"],
        "fee": kwargs.get("fee", 0.0),
        "filled_at": kwargs.get("filled_at", utcnow()),
    }


def make_holding(**kwargs) -> dict:
    return {
        "team_id": kwargs["team_id"],
        "company_id": kwargs["company_id"],
        "quantity": kwargs.get("quantity", 0),
        "average_cost": kwargs.get("average_cost", 0.0),
        "updated_at": kwargs.get("updated_at", utcnow()),
    }


def make_team_wallet(**kwargs) -> dict:
    return {
        "team_id": kwargs["team_id"],
        "cash_balance": kwargs.get("cash_balance", 10000.00),
        "starting_balance": kwargs.get("starting_balance", 10000.00),
        "updated_at": kwargs.get("updated_at", utcnow()),
    }


def make_portfolio_snapshot(**kwargs) -> dict:
    return {
        "_id": kwargs.get("id", new_id()),
        "game_id": kwargs["game_id"],
        "team_id": kwargs["team_id"],
        "tick": kwargs["tick"],
        "cash": kwargs["cash"],
        "holdings_value": kwargs["holdings_value"],
        "portfolio_value": kwargs["portfolio_value"],
        "profit_loss": kwargs["profit_loss"],
        "profit_loss_percent": kwargs["profit_loss_percent"],
        "created_at": kwargs.get("created_at", utcnow()),
    }


def make_leaderboard_snapshot(**kwargs) -> dict:
    return {
        "_id": kwargs.get("id", new_id()),
        "game_id": kwargs["game_id"],
        "team_id": kwargs["team_id"],
        "tick": kwargs["tick"],
        "rank": kwargs["rank"],
        "portfolio_value": kwargs["portfolio_value"],
        "profit_loss": kwargs["profit_loss"],
        "profit_loss_percent": kwargs["profit_loss_percent"],
        "trade_count": kwargs.get("trade_count", 0),
        "companies_traded": kwargs.get("companies_traded", 0),
        "is_eligible": kwargs.get("is_eligible", False),
        "created_at": kwargs.get("created_at", utcnow()),
    }


def make_audit_log(**kwargs) -> dict:
    return {
        "_id": kwargs.get("id", new_id()),
        "game_id": kwargs.get("game_id", None),
        "team_id": kwargs.get("team_id", None),
        "event_type": kwargs["event_type"],
        "tick": kwargs.get("tick", None),
        "order_id": kwargs.get("order_id", None),
        "message": kwargs.get("message", None),
        "metadata_json": kwargs.get("metadata_json", None),
        "created_at": kwargs.get("created_at", utcnow()),
    }


def make_connection(**kwargs) -> dict:
    return {
        "_id": kwargs.get("id", new_id()),
        "team_id": kwargs["team_id"],
        "connected_at": kwargs.get("connected_at", utcnow()),
        "last_seen_at": kwargs.get("last_seen_at", utcnow()),
        "disconnected_at": kwargs.get("disconnected_at", None),
    }
