"""
Market Sprint — Order Service (Trading Engine)

Core trading logic with full validation chain:
1. Game is RUNNING
2. Valid company
3. 7-second cooldown
4. Trade count ≤ 22
5. 35% portfolio allocation limit (buy)
6. 60% concentration limit
7. Sufficient cash (buy) / sufficient holdings (sell)
8. Create PENDING order
9. Immediately fill at next tick price (simplified: fill at current tick price
   since orders in real-time would wait for next tick)

All operations use database transactions to prevent double-spending.
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    Order, OrderFill, Holding, TeamWallet, Team, Company,
    Game, GameStatus, OrderStatus, MarketPrice
)
from ..services.game_clock import get_current_tick
from ..services.market import get_price_at_tick, get_all_prices_at_tick


class TradingError(Exception):
    """Raised when a trading rule is violated."""
    def __init__(self, message: str, code: str = "TRADING_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


def validate_and_execute_buy(
    db: Session, game: Game, team: Team, company: Company, quantity: int
) -> Order:
    """
    Validate and execute a BUY order.
    Uses a transaction to prevent double-spending.
    """
    current_tick = get_current_tick(game)

    # 1. Game must be RUNNING
    if game.status != GameStatus.RUNNING.value:
        raise TradingError("Market is not open for trading", "MARKET_CLOSED")

    if current_tick >= 96:
        raise TradingError("Market has closed (tick 96 reached)", "MARKET_CLOSED")

    # 2. Get wallet (lock row for transaction safety)
    wallet = db.query(TeamWallet).filter(TeamWallet.team_id == team.id).with_for_update().first()
    if not wallet:
        raise TradingError("Wallet not found", "WALLET_ERROR")

    # 3. Check cooldown (7 seconds)
    last_order = (
        db.query(Order)
        .filter(
            Order.team_id == team.id,
            Order.game_id == game.id,
            Order.status != OrderStatus.REJECTED.value,
        )
        .order_by(Order.submitted_at.desc())
        .first()
    )

    if last_order and last_order.submitted_at:
        submitted = last_order.submitted_at
        if submitted.tzinfo is None:
            submitted = submitted.replace(tzinfo=timezone.utc)
        cooldown_end = submitted + timedelta(seconds=game.cooldown_seconds)
        if datetime.now(timezone.utc) < cooldown_end:
            remaining = (cooldown_end - datetime.now(timezone.utc)).total_seconds()
            raise TradingError(
                f"Cooldown active. Wait {remaining:.1f} more seconds.",
                "COOLDOWN"
            )

    # 4. Check trade count ≤ 22
    trade_count = (
        db.query(func.count(Order.id))
        .filter(
            Order.team_id == team.id,
            Order.game_id == game.id,
            Order.status.in_([OrderStatus.FILLED.value, OrderStatus.PENDING.value]),
        )
        .scalar()
    )

    if trade_count >= game.max_trades:
        raise TradingError(
            f"Maximum trade limit reached ({game.max_trades})",
            "TRADE_LIMIT"
        )

    # 5. Get fill price (next tick price, or current if at boundary)
    fill_tick = min(current_tick + 1, 96)
    fill_price = get_price_at_tick(db, game, company.id, fill_tick)
    if fill_price is None:
        raise TradingError("Price not available for fill tick", "PRICE_ERROR")

    # Calculate order value
    gross_value = round(fill_price * quantity, 2)
    fee = round(gross_value * (game.trade_fee_percent / 100), 2)
    total_cost = round(gross_value + fee, 2)

    # 6. Check sufficient cash
    if wallet.cash_balance < total_cost:
        raise TradingError(
            f"Insufficient cash. Need ₡{total_cost:.2f}, have ₡{wallet.cash_balance:.2f}",
            "INSUFFICIENT_CASH"
        )

    # 7. Check 35% buy limit (max 35% of portfolio value per buy)
    portfolio_value = _calculate_portfolio_value(db, game, team, current_tick)
    max_buy_value = portfolio_value * (game.buy_limit_percent / 100)
    if gross_value > max_buy_value:
        raise TradingError(
            f"Buy exceeds {game.buy_limit_percent}% limit. Max ₡{max_buy_value:.2f}, order is ₡{gross_value:.2f}",
            "BUY_LIMIT"
        )

    # 8. Check 60% concentration limit
    current_holding = (
        db.query(Holding)
        .filter(Holding.team_id == team.id, Holding.company_id == company.id)
        .first()
    )
    current_qty = current_holding.quantity if current_holding else 0
    new_qty = current_qty + quantity
    new_holding_value = new_qty * fill_price
    max_concentration = portfolio_value * (game.concentration_limit / 100)

    if new_holding_value > max_concentration:
        raise TradingError(
            f"Would exceed {game.concentration_limit}% concentration limit",
            "CONCENTRATION_LIMIT"
        )

    # 9. Execute the order
    current_price = get_price_at_tick(db, game, company.id, current_tick)

    order = Order(
        game_id=game.id,
        team_id=team.id,
        company_id=company.id,
        side="BUY",
        quantity=quantity,
        submitted_tick=current_tick,
        submitted_at=datetime.now(timezone.utc),
        status=OrderStatus.FILLED.value,
        requested_price=current_price,
        fill_tick=fill_tick,
        fill_price=fill_price,
        fee=fee,
        gross_value=gross_value,
        net_value=total_cost,
    )
    db.add(order)
    db.flush()

    # Create fill record
    fill = OrderFill(
        order_id=order.id,
        fill_tick=fill_tick,
        fill_price=fill_price,
        quantity=quantity,
        fee=fee,
        filled_at=datetime.now(timezone.utc),
    )
    db.add(fill)

    # Update wallet
    wallet.cash_balance = round(wallet.cash_balance - total_cost, 2)

    # Update holding
    if current_holding:
        # Recalculate average cost
        old_total = current_holding.average_cost * current_holding.quantity
        new_total = old_total + gross_value
        current_holding.quantity = new_qty
        current_holding.average_cost = round(new_total / new_qty, 2)
    else:
        holding = Holding(
            team_id=team.id,
            company_id=company.id,
            quantity=quantity,
            average_cost=fill_price,
        )
        db.add(holding)

    db.commit()
    return order


def validate_and_execute_sell(
    db: Session, game: Game, team: Team, company: Company, quantity: int
) -> Order:
    """
    Validate and execute a SELL order.
    """
    current_tick = get_current_tick(game)

    # 1. Game must be RUNNING
    if game.status != GameStatus.RUNNING.value:
        raise TradingError("Market is not open for trading", "MARKET_CLOSED")

    if current_tick >= 96:
        raise TradingError("Market has closed (tick 96 reached)", "MARKET_CLOSED")

    # 2. Get wallet
    wallet = db.query(TeamWallet).filter(TeamWallet.team_id == team.id).with_for_update().first()
    if not wallet:
        raise TradingError("Wallet not found", "WALLET_ERROR")

    # 3. Check cooldown
    last_order = (
        db.query(Order)
        .filter(
            Order.team_id == team.id,
            Order.game_id == game.id,
            Order.status != OrderStatus.REJECTED.value,
        )
        .order_by(Order.submitted_at.desc())
        .first()
    )

    if last_order and last_order.submitted_at:
        submitted = last_order.submitted_at
        if submitted.tzinfo is None:
            submitted = submitted.replace(tzinfo=timezone.utc)
        cooldown_end = submitted + timedelta(seconds=game.cooldown_seconds)
        if datetime.now(timezone.utc) < cooldown_end:
            remaining = (cooldown_end - datetime.now(timezone.utc)).total_seconds()
            raise TradingError(
                f"Cooldown active. Wait {remaining:.1f} more seconds.",
                "COOLDOWN"
            )

    # 4. Check trade count
    trade_count = (
        db.query(func.count(Order.id))
        .filter(
            Order.team_id == team.id,
            Order.game_id == game.id,
            Order.status.in_([OrderStatus.FILLED.value, OrderStatus.PENDING.value]),
        )
        .scalar()
    )

    if trade_count >= game.max_trades:
        raise TradingError(
            f"Maximum trade limit reached ({game.max_trades})",
            "TRADE_LIMIT"
        )

    # 5. Check sufficient holdings
    holding = (
        db.query(Holding)
        .filter(Holding.team_id == team.id, Holding.company_id == company.id)
        .first()
    )

    if not holding or holding.quantity < quantity:
        available = holding.quantity if holding else 0
        raise TradingError(
            f"Insufficient holdings. Have {available}, trying to sell {quantity}",
            "INSUFFICIENT_HOLDINGS"
        )

    # 6. Get fill price
    fill_tick = min(current_tick + 1, 96)
    fill_price = get_price_at_tick(db, game, company.id, fill_tick)
    if fill_price is None:
        raise TradingError("Price not available for fill tick", "PRICE_ERROR")

    gross_value = round(fill_price * quantity, 2)
    fee = round(gross_value * (game.trade_fee_percent / 100), 2)
    net_proceeds = round(gross_value - fee, 2)

    # 7. Execute
    current_price = get_price_at_tick(db, game, company.id, current_tick)

    order = Order(
        game_id=game.id,
        team_id=team.id,
        company_id=company.id,
        side="SELL",
        quantity=quantity,
        submitted_tick=current_tick,
        submitted_at=datetime.now(timezone.utc),
        status=OrderStatus.FILLED.value,
        requested_price=current_price,
        fill_tick=fill_tick,
        fill_price=fill_price,
        fee=fee,
        gross_value=gross_value,
        net_value=net_proceeds,
    )
    db.add(order)
    db.flush()

    fill = OrderFill(
        order_id=order.id,
        fill_tick=fill_tick,
        fill_price=fill_price,
        quantity=quantity,
        fee=fee,
        filled_at=datetime.now(timezone.utc),
    )
    db.add(fill)

    # Update wallet (add proceeds)
    wallet.cash_balance = round(wallet.cash_balance + net_proceeds, 2)

    # Update holding
    holding.quantity -= quantity
    if holding.quantity == 0:
        holding.average_cost = 0.0

    db.commit()
    return order


def _calculate_portfolio_value(db: Session, game: Game, team: Team, tick: int) -> float:
    """Calculate total portfolio value (cash + holdings at current prices)."""
    wallet = db.query(TeamWallet).filter(TeamWallet.team_id == team.id).first()
    cash = wallet.cash_balance if wallet else 0.0

    holdings = db.query(Holding).filter(Holding.team_id == team.id).all()
    holdings_value = 0.0
    for h in holdings:
        if h.quantity > 0:
            price = get_price_at_tick(db, game, h.company_id, tick)
            if price:
                holdings_value += h.quantity * price

    return round(cash + holdings_value, 2)
