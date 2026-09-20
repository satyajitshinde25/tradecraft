"""
Market Sprint — Pydantic Schemas

Request/response models for the API.
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ── Auth ───────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    team_id: str = Field(..., description="Team code, e.g. TEAM-01")
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    token: str
    team_code: str
    display_name: str
    role: str = "team"


# ── Game State ─────────────────────────────────────────────────────

class GameStateResponse(BaseModel):
    game_id: str
    game_name: str
    status: str
    current_tick: int
    max_tick: int = 96
    tick_seconds: int
    server_time: str
    tick_started_at: Optional[str] = None
    next_tick_at: Optional[str] = None
    starting_balance: float
    max_trades: int
    buy_limit_percent: float
    concentration_limit: float
    trade_fee_percent: float
    cooldown_seconds: int


# ── Market ─────────────────────────────────────────────────────────

class CompanyPrice(BaseModel):
    ticker: str
    name: str
    sector: str
    price: float
    change: float  # absolute change from opening
    change_percent: float
    start_price: float


class MarketOverviewResponse(BaseModel):
    tick: int
    timestamp: str
    prices: list[CompanyPrice]


class CandleData(BaseModel):
    tick: int
    open: float
    high: float
    low: float
    close: float


class CandlesResponse(BaseModel):
    ticker: str
    name: str
    candles: list[CandleData]


# ── News ───────────────────────────────────────────────────────────

class NewsEventResponse(BaseModel):
    event_number: int
    release_tick: int
    event_type: str
    headline: str
    calendar_title: Optional[str] = None
    time_offset: Optional[str] = None
    description: Optional[str] = None
    forecast: Optional[str] = None
    is_scheduled: bool
    released_at: Optional[str] = None


class UpcomingScheduledEvent(BaseModel):
    event_number: int
    release_tick: int
    calendar_title: str
    headline: str
    time_offset: Optional[str] = None
    forecast: Optional[str] = None


class NewsResponse(BaseModel):
    released_events: list[NewsEventResponse]
    upcoming_scheduled: list[UpcomingScheduledEvent]


# ── Trading ────────────────────────────────────────────────────────

class OrderRequest(BaseModel):
    ticker: str = Field(..., description="Company ticker, e.g. TAVR")
    quantity: int = Field(..., gt=0, description="Number of shares")


class OrderResponse(BaseModel):
    order_id: str
    status: str
    side: str
    ticker: str
    quantity: int
    submitted_tick: int
    requested_price: Optional[float] = None
    fill_tick: Optional[int] = None
    fill_price: Optional[float] = None
    fee: float = 0.0
    gross_value: Optional[float] = None
    net_value: Optional[float] = None
    rejection_reason: Optional[str] = None
    submitted_at: str


class OrderListResponse(BaseModel):
    orders: list[OrderResponse]
    trade_count: int
    max_trades: int


# ── Portfolio ──────────────────────────────────────────────────────

class HoldingResponse(BaseModel):
    ticker: str
    company_name: str
    quantity: int
    average_cost: float
    current_price: float
    market_value: float
    unrealized_pl: float
    unrealized_pl_percent: float


class PortfolioResponse(BaseModel):
    team_code: str
    display_name: str
    cash: float
    holdings_value: float
    portfolio_value: float
    starting_balance: float
    profit_loss: float
    profit_loss_percent: float
    trades_used: int
    max_trades: int
    companies_traded: int
    is_eligible: bool
    holdings: list[HoldingResponse]


# ── Leaderboard (admin-only) ───────────────────────────────────────

class LeaderboardEntry(BaseModel):
    rank: int
    team_code: str
    display_name: str
    portfolio_value: float
    profit_loss: float
    profit_loss_percent: float
    trade_count: int
    companies_traded: int
    is_eligible: bool
    cash: float
    holdings_value: float


class LeaderboardResponse(BaseModel):
    tick: int
    entries: list[LeaderboardEntry]


# ── Admin ──────────────────────────────────────────────────────────

class AdminTeamStatus(BaseModel):
    team_code: str
    display_name: str
    is_active: bool
    cash: float
    holdings_value: float
    portfolio_value: float
    profit_loss: float
    profit_loss_percent: float
    trade_count: int
    companies_traded: int
    is_eligible: bool
    last_order_at: Optional[str] = None


class AdminGameResponse(BaseModel):
    game: GameStateResponse
    teams: list[AdminTeamStatus]
    leaderboard: LeaderboardResponse


class AdminOrderResponse(BaseModel):
    order_id: str
    team_code: str
    ticker: str
    side: str
    quantity: int
    status: str
    submitted_tick: int
    fill_tick: Optional[int] = None
    fill_price: Optional[float] = None
    fee: float
    rejection_reason: Optional[str] = None
    submitted_at: str


class AuditLogResponse(BaseModel):
    id: str
    event_type: str
    team_code: Optional[str] = None
    tick: Optional[int] = None
    message: Optional[str] = None
    created_at: str
