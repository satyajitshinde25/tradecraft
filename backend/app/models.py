"""
Market Sprint — SQLAlchemy ORM Models

All tables for the Market Sprint simulation.
"""
import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, Enum, CheckConstraint, UniqueConstraint, Index, JSON
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


# ── Enums ──────────────────────────────────────────────────────────

class GameStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    READY = "READY"
    RUNNING = "RUNNING"
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


# ── Games ──────────────────────────────────────────────────────────

class Game(Base):
    __tablename__ = "games"

    id = Column(String, primary_key=True, default=new_uuid)
    name = Column(String, nullable=False, default="Market Sprint")
    status = Column(String, nullable=False, default=GameStatus.DRAFT.value)
    start_time = Column(DateTime(timezone=True), nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    tick_seconds = Column(Integer, nullable=False, default=75)
    starting_balance = Column(Float, nullable=False, default=10000.00)
    max_trades = Column(Integer, nullable=False, default=22)
    buy_limit_percent = Column(Float, nullable=False, default=35.0)
    concentration_limit = Column(Float, nullable=False, default=60.0)
    trade_fee_percent = Column(Float, nullable=False, default=0.4)
    cooldown_seconds = Column(Integer, nullable=False, default=7)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    teams = relationship("Team", back_populates="game")
    companies = relationship("Company", back_populates="game")
    market_prices = relationship("MarketPrice", back_populates="game")
    market_candles = relationship("MarketCandle", back_populates="game")
    news_events = relationship("NewsEvent", back_populates="game")
    orders = relationship("Order", back_populates="game")
    portfolio_snapshots = relationship("PortfolioSnapshot", back_populates="game")
    leaderboard_snapshots = relationship("LeaderboardSnapshot", back_populates="game")
    audit_logs = relationship("AuditLog", back_populates="game")


# ── Teams ──────────────────────────────────────────────────────────

class Team(Base):
    __tablename__ = "teams"

    id = Column(String, primary_key=True, default=new_uuid)
    game_id = Column(String, ForeignKey("games.id"), nullable=False)
    team_code = Column(String, unique=True, nullable=False)  # TEAM-01..TEAM-25
    display_name = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    game = relationship("Game", back_populates="teams")
    credential = relationship("TeamCredential", back_populates="team", uselist=False)
    wallet = relationship("TeamWallet", back_populates="team", uselist=False)
    holdings = relationship("Holding", back_populates="team")
    orders = relationship("Order", back_populates="team")
    portfolio_snapshots = relationship("PortfolioSnapshot", back_populates="team")
    leaderboard_snapshots = relationship("LeaderboardSnapshot", back_populates="team")
    audit_logs = relationship("AuditLog", back_populates="team")
    connections = relationship("Connection", back_populates="team")


# ── Team Credentials ──────────────────────────────────────────────

class TeamCredential(Base):
    __tablename__ = "team_credentials"

    team_id = Column(String, ForeignKey("teams.id"), primary_key=True)
    password_hash = Column(String, nullable=False)
    failed_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    team = relationship("Team", back_populates="credential")


# ── Companies ──────────────────────────────────────────────────────

class Company(Base):
    __tablename__ = "companies"

    id = Column(String, primary_key=True, default=new_uuid)
    game_id = Column(String, ForeignKey("games.id"), nullable=False)
    ticker = Column(String, nullable=False)
    name = Column(String, nullable=False)
    sector = Column(String, nullable=False)
    start_price = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        UniqueConstraint("game_id", "ticker", name="uq_company_ticker"),
    )

    # Relationships
    game = relationship("Game", back_populates="companies")
    market_prices = relationship("MarketPrice", back_populates="company")
    market_candles = relationship("MarketCandle", back_populates="company")
    holdings = relationship("Holding", back_populates="company")
    orders = relationship("Order", back_populates="company")


# ── Market Prices ──────────────────────────────────────────────────

class MarketPrice(Base):
    __tablename__ = "market_prices"

    game_id = Column(String, ForeignKey("games.id"), primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), primary_key=True)
    tick = Column(Integer, primary_key=True)
    price = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint("tick >= 0 AND tick <= 96", name="ck_price_tick_range"),
        CheckConstraint("price > 0", name="ck_price_positive"),
    )

    game = relationship("Game", back_populates="market_prices")
    company = relationship("Company", back_populates="market_prices")


# ── Market Candles ─────────────────────────────────────────────────

class MarketCandle(Base):
    __tablename__ = "market_candles"

    game_id = Column(String, ForeignKey("games.id"), primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), primary_key=True)
    tick = Column(Integer, primary_key=True)
    open_price = Column(Float, nullable=False)
    high_price = Column(Float, nullable=False)
    low_price = Column(Float, nullable=False)
    close_price = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint("tick >= 0 AND tick <= 96", name="ck_candle_tick_range"),
    )

    game = relationship("Game", back_populates="market_candles")
    company = relationship("Company", back_populates="market_candles")


# ── News Events ────────────────────────────────────────────────────

class NewsEvent(Base):
    __tablename__ = "news_events"

    id = Column(String, primary_key=True, default=new_uuid)
    game_id = Column(String, ForeignKey("games.id"), nullable=False)
    event_number = Column(Integer, nullable=False)
    release_tick = Column(Integer, nullable=False)
    event_type = Column(String, nullable=False)  # SURPRISE, SCHEDULED
    headline = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    forecast = Column(Text, nullable=True)  # for scheduled events
    affected_tickers = Column(String, nullable=True)  # comma-separated
    is_scheduled = Column(Boolean, nullable=False, default=False)
    released = Column(Boolean, nullable=False, default=False)
    released_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint("release_tick >= 0 AND release_tick <= 96", name="ck_news_tick_range"),
        Index("ix_news_game_tick", "game_id", "release_tick"),
    )

    game = relationship("Game", back_populates="news_events")


# ── Orders ─────────────────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=new_uuid)
    game_id = Column(String, ForeignKey("games.id"), nullable=False)
    team_id = Column(String, ForeignKey("teams.id"), nullable=False)
    company_id = Column(String, ForeignKey("companies.id"), nullable=False)
    side = Column(String, nullable=False)  # BUY / SELL
    quantity = Column(Integer, nullable=False)
    submitted_tick = Column(Integer, nullable=False)
    submitted_at = Column(DateTime(timezone=True), default=utcnow)
    status = Column(String, nullable=False, default=OrderStatus.PENDING.value)
    requested_price = Column(Float, nullable=True)  # price shown at submission
    fill_tick = Column(Integer, nullable=True)
    fill_price = Column(Float, nullable=True)
    fee = Column(Float, nullable=False, default=0.0)
    gross_value = Column(Float, nullable=True)
    net_value = Column(Float, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_qty_positive"),
        CheckConstraint("side IN ('BUY', 'SELL')", name="ck_order_side"),
        Index("ix_orders_team", "game_id", "team_id", "submitted_at"),
        Index("ix_orders_status", "game_id", "status"),
    )

    game = relationship("Game", back_populates="orders")
    team = relationship("Team", back_populates="orders")
    company = relationship("Company", back_populates="orders")
    fill = relationship("OrderFill", back_populates="order", uselist=False)


# ── Order Fills ────────────────────────────────────────────────────

class OrderFill(Base):
    __tablename__ = "order_fills"

    id = Column(String, primary_key=True, default=new_uuid)
    order_id = Column(String, ForeignKey("orders.id"), nullable=False)
    fill_tick = Column(Integer, nullable=False)
    fill_price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    fee = Column(Float, nullable=False, default=0.0)
    filled_at = Column(DateTime(timezone=True), default=utcnow)

    order = relationship("Order", back_populates="fill")


# ── Holdings ───────────────────────────────────────────────────────

class Holding(Base):
    __tablename__ = "holdings"

    team_id = Column(String, ForeignKey("teams.id"), primary_key=True)
    company_id = Column(String, ForeignKey("companies.id"), primary_key=True)
    quantity = Column(Integer, nullable=False, default=0)
    average_cost = Column(Float, nullable=False, default=0.0)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_holding_qty"),
    )

    team = relationship("Team", back_populates="holdings")
    company = relationship("Company", back_populates="holdings")


# ── Team Wallets ───────────────────────────────────────────────────

class TeamWallet(Base):
    __tablename__ = "team_wallets"

    team_id = Column(String, ForeignKey("teams.id"), primary_key=True)
    cash_balance = Column(Float, nullable=False, default=10000.00)
    starting_balance = Column(Float, nullable=False, default=10000.00)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        CheckConstraint("cash_balance >= 0", name="ck_wallet_cash"),
    )

    team = relationship("Team", back_populates="wallet")


# ── Portfolio Snapshots ────────────────────────────────────────────

class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id = Column(String, primary_key=True, default=new_uuid)
    game_id = Column(String, ForeignKey("games.id"), nullable=False)
    team_id = Column(String, ForeignKey("teams.id"), nullable=False)
    tick = Column(Integer, nullable=False)
    cash = Column(Float, nullable=False)
    holdings_value = Column(Float, nullable=False)
    portfolio_value = Column(Float, nullable=False)
    profit_loss = Column(Float, nullable=False)
    profit_loss_percent = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index("ix_portfolio_game_tick", "game_id", "tick"),
    )

    game = relationship("Game", back_populates="portfolio_snapshots")
    team = relationship("Team", back_populates="portfolio_snapshots")


# ── Leaderboard Snapshots ──────────────────────────────────────────

class LeaderboardSnapshot(Base):
    __tablename__ = "leaderboard_snapshots"

    id = Column(String, primary_key=True, default=new_uuid)
    game_id = Column(String, ForeignKey("games.id"), nullable=False)
    team_id = Column(String, ForeignKey("teams.id"), nullable=False)
    tick = Column(Integer, nullable=False)
    rank = Column(Integer, nullable=False)
    portfolio_value = Column(Float, nullable=False)
    profit_loss = Column(Float, nullable=False)
    profit_loss_percent = Column(Float, nullable=False)
    trade_count = Column(Integer, nullable=False, default=0)
    companies_traded = Column(Integer, nullable=False, default=0)
    is_eligible = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index("ix_leaderboard_game_tick", "game_id", "tick", "rank"),
    )

    game = relationship("Game", back_populates="leaderboard_snapshots")
    team = relationship("Team", back_populates="leaderboard_snapshots")


# ── Audit Logs ─────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=new_uuid)
    game_id = Column(String, ForeignKey("games.id"), nullable=True)
    team_id = Column(String, ForeignKey("teams.id"), nullable=True)
    event_type = Column(String, nullable=False)
    tick = Column(Integer, nullable=True)
    order_id = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index("ix_audit_game_time", "game_id", "created_at"),
    )

    game = relationship("Game", back_populates="audit_logs")
    team = relationship("Team", back_populates="audit_logs")


# ── Connections (organizer monitoring) ─────────────────────────────

class Connection(Base):
    __tablename__ = "connections"

    id = Column(String, primary_key=True, default=new_uuid)
    team_id = Column(String, ForeignKey("teams.id"), nullable=False)
    connected_at = Column(DateTime(timezone=True), default=utcnow)
    last_seen_at = Column(DateTime(timezone=True), default=utcnow)
    disconnected_at = Column(DateTime(timezone=True), nullable=True)

    team = relationship("Team", back_populates="connections")
