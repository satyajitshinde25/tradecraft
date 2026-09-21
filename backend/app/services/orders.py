"""
Market Sprint — Order Service (Trading Engine)

Core trading logic with strict validation chain and True Next-Tick Execution:
1. Game is RUNNING and tick < 96
2. Valid company
3. 7-second cooldown between orders
4. Trade count <= 22
5. Minimum order value >= 100 V-Coins
6. 35% portfolio allocation limit (BUY)
7. 60% concentration limit (BUY)
8. Sufficient cash (BUY) / sufficient holdings (SELL)
9. Orders enter PENDING state and fill at tick T+1 with Tick T+1 price
10. Future prices are never leaked to participants ahead of fill tick
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    Order, OrderFill, Holding, TeamWallet, Team, Company,
    Game, GameStatus, OrderStatus, MarketPrice, AuditLog
)
from ..services.game_clock import get_current_tick
from ..services.market import get_price_at_tick
from ..services.audit import log_event


class TradingError(Exception):
    """Raised when a trading rule is violated."""
    def __init__(self, message: str, code: str = "TRADING_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


import threading

_order_process_lock = threading.Lock()


def process_pending_orders(db: Session, game: Game, current_tick: int) -> int:
    """
    Process any PENDING orders whose fill_tick has arrived (fill_tick <= current_tick).
    Executes fills at the official precomputed price of the fill tick.
    Returns the count of orders processed.
    """
    with _order_process_lock:
        pending_orders = (
            db.query(Order)
            .filter(
                Order.game_id == game.id,
                Order.status == OrderStatus.PENDING.value,
                Order.fill_tick <= current_tick,
            )
            .order_by(Order.submitted_at)
            .all()
        )

        if not pending_orders:
            return 0

        processed_count = 0
        holdings_cache: dict[tuple[str, str], Holding] = {}

        for order in pending_orders:
            # Skip if already filled by another call
            if order.status != OrderStatus.PENDING.value:
                continue

            company = db.query(Company).filter(Company.id == order.company_id).first()
            wallet = db.query(TeamWallet).filter(TeamWallet.team_id == order.team_id).first()

            cache_key = (order.team_id, order.company_id)
            if cache_key in holdings_cache:
                holding = holdings_cache[cache_key]
            else:
                holding = (
                    db.query(Holding)
                    .filter(Holding.team_id == order.team_id, Holding.company_id == order.company_id)
                    .first()
                )

            fill_price = get_price_at_tick(db, game, order.company_id, order.fill_tick)
            if fill_price is None:
                continue

            actual_gross = round(fill_price * order.quantity, 2)
            actual_fee = round(actual_gross * (game.trade_fee_percent / 100), 2)

            if order.side == "BUY":
                actual_total = round(actual_gross + actual_fee, 2)
                # Cash was reserved at estimated total cost upon submission
                # Reconcile difference with actual fill price
                reserved_total = order.net_value or actual_total
                cash_adjustment = reserved_total - actual_total
                if wallet:
                    wallet.cash_balance = round(max(0.0, wallet.cash_balance + cash_adjustment), 2)

                # Update or create holding
                if holding:
                    old_total = holding.average_cost * holding.quantity
                    new_qty = holding.quantity + order.quantity
                    new_total = old_total + actual_gross
                    holding.quantity = new_qty
                    holding.average_cost = round(new_total / new_qty, 2) if new_qty > 0 else fill_price
                else:
                    holding = Holding(
                        team_id=order.team_id,
                        company_id=order.company_id,
                        quantity=order.quantity,
                        average_cost=fill_price,
                    )
                    db.add(holding)
                    db.flush()

                holdings_cache[cache_key] = holding
                order.net_value = actual_total

            elif order.side == "SELL":
                actual_proceeds = round(actual_gross - actual_fee, 2)
                if wallet:
                    wallet.cash_balance = round(wallet.cash_balance + actual_proceeds, 2)

                if holding:
                    holding.quantity = max(0, holding.quantity - order.quantity)
                    if holding.quantity == 0:
                        holding.average_cost = 0.0
                    holdings_cache[cache_key] = holding

                order.net_value = actual_proceeds

            order.status = OrderStatus.FILLED.value
            order.fill_price = fill_price
            order.gross_value = actual_gross
            order.fee = actual_fee

            fill = OrderFill(
                order_id=order.id,
                fill_tick=order.fill_tick,
                fill_price=fill_price,
                quantity=order.quantity,
                fee=actual_fee,
                filled_at=datetime.now(timezone.utc),
            )
            db.add(fill)

            ticker = company.ticker if company else "STOCK"
            log_event(
                db, "ORDER_FILLED",
                game_id=game.id,
                team_id=order.team_id,
                tick=order.fill_tick,
                order_id=order.id,
                message=f"{order.side} {order.quantity} {ticker} filled at Tick {order.fill_tick} @ {fill_price:.2f} V-Coins",
            )
            processed_count += 1

        if processed_count > 0:
            try:
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"[Orders] Error committing pending order fills: {e}")
                raise

        return processed_count


def validate_and_execute_buy(
    db: Session, game: Game, team: Team, company: Company, quantity: int
) -> Order:
    """
    Validate and place a BUY order.
    Executes in PENDING state to fill at tick T+1.
    """
    current_tick = get_current_tick(game)

    # 1. Game must be RUNNING and before close
    if game.status != GameStatus.RUNNING.value:
        raise TradingError("Market is not open for trading", "MARKET_CLOSED")

    if current_tick >= 96:
        raise TradingError("Market has closed (tick 96 reached)", "MARKET_CLOSED")

    # Process any overdue pending orders before calculating limits
    process_pending_orders(db, game, current_tick)

    # 2. Get wallet
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
        now = datetime.now(timezone.utc)
        if now < cooldown_end:
            remaining = (cooldown_end - now).total_seconds()
            raise TradingError(
                f"Cooldown active. Wait {remaining:.1f} more seconds.",
                "COOLDOWN"
            )

    # 4. Check trade count <= 22
    trade_count = (
        db.query(func.count(Order.id))
        .filter(
            Order.team_id == team.id,
            Order.game_id == game.id,
            Order.status.in_([OrderStatus.FILLED.value, OrderStatus.PENDING.value]),
        )
        .scalar() or 0
    )

    if trade_count >= game.max_trades:
        raise TradingError(
            f"Maximum trade limit reached ({game.max_trades})",
            "TRADE_LIMIT"
        )

    # 5. Check order size at current price
    current_price = get_price_at_tick(db, game, company.id, current_tick)
    if current_price is None:
        raise TradingError("Current market price not available", "PRICE_ERROR")

    estimated_gross = round(current_price * quantity, 2)

    # Rule: 100 V-Coins minimum order
    if estimated_gross < 100.0:
        raise TradingError("Minimum order value is 100 V-Coins", "MIN_ORDER_SIZE")

    fee = round(estimated_gross * (game.trade_fee_percent / 100), 2)
    estimated_total = round(estimated_gross + fee, 2)

    # 6. Check sufficient cash
    if wallet.cash_balance < estimated_total:
        raise TradingError(
            f"Insufficient cash. Need {estimated_total:.2f} V-Coins, have {wallet.cash_balance:.2f} V-Coins",
            "INSUFFICIENT_CASH"
        )

    # 7. Check 35% buy limit (max 35% of portfolio value per buy)
    portfolio_value = _calculate_portfolio_value(db, game, team, current_tick)
    max_buy_value = portfolio_value * (game.buy_limit_percent / 100)
    if estimated_gross > max_buy_value:
        raise TradingError(
            f"Buy exceeds {game.buy_limit_percent}% limit. Max {max_buy_value:.2f} V-Coins, order is {estimated_gross:.2f} V-Coins",
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
    new_holding_value = new_qty * current_price
    max_concentration = portfolio_value * (game.concentration_limit / 100)

    if new_holding_value > max_concentration:
        raise TradingError(
            f"Would exceed {game.concentration_limit}% concentration limit for {company.ticker}",
            "CONCENTRATION_LIMIT"
        )

    # 9. Reserve funds and create PENDING order
    fill_tick = min(current_tick + 1, 96)

    # Deduct reserved cash from wallet so it cannot be double-spent
    wallet.cash_balance = round(wallet.cash_balance - estimated_total, 2)

    order = Order(
        game_id=game.id,
        team_id=team.id,
        company_id=company.id,
        side="BUY",
        quantity=quantity,
        submitted_tick=current_tick,
        submitted_at=datetime.now(timezone.utc),
        status=OrderStatus.PENDING.value,
        requested_price=current_price,
        fill_tick=fill_tick,
        fill_price=None,  # Hidden until filled at tick T+1
        fee=fee,
        gross_value=estimated_gross,
        net_value=estimated_total,
    )
    db.add(order)
    db.commit()

    return order


def validate_and_execute_sell(
    db: Session, game: Game, team: Team, company: Company, quantity: int
) -> Order:
    """
    Validate and place a SELL order.
    Executes in PENDING state to fill at tick T+1.
    """
    current_tick = get_current_tick(game)

    # 1. Game must be RUNNING and before close
    if game.status != GameStatus.RUNNING.value:
        raise TradingError("Market is not open for trading", "MARKET_CLOSED")

    if current_tick >= 96:
        raise TradingError("Market has closed (tick 96 reached)", "MARKET_CLOSED")

    process_pending_orders(db, game, current_tick)

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
        now = datetime.now(timezone.utc)
        if now < cooldown_end:
            remaining = (cooldown_end - now).total_seconds()
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
        .scalar() or 0
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
        .with_for_update()
        .first()
    )

    if not holding or holding.quantity < quantity:
        available = holding.quantity if holding else 0
        raise TradingError(
            f"Insufficient holdings. Have {available} shares, trying to sell {quantity}",
            "INSUFFICIENT_HOLDINGS"
        )

    # 6. Check order size at current price
    current_price = get_price_at_tick(db, game, company.id, current_tick)
    if current_price is None:
        raise TradingError("Current market price not available", "PRICE_ERROR")

    estimated_gross = round(current_price * quantity, 2)

    # Rule: 100 V-Coins minimum order
    if estimated_gross < 100.0:
        raise TradingError("Minimum order value is 100 V-Coins", "MIN_ORDER_SIZE")

    fee = round(estimated_gross * (game.trade_fee_percent / 100), 2)
    estimated_proceeds = round(estimated_gross - fee, 2)

    # 7. Reserve shares and create PENDING order
    fill_tick = min(current_tick + 1, 96)

    # Deduct shares immediately from holding so they cannot be double-sold
    holding.quantity -= quantity

    order = Order(
        game_id=game.id,
        team_id=team.id,
        company_id=company.id,
        side="SELL",
        quantity=quantity,
        submitted_tick=current_tick,
        submitted_at=datetime.now(timezone.utc),
        status=OrderStatus.PENDING.value,
        requested_price=current_price,
        fill_tick=fill_tick,
        fill_price=None,  # Hidden until filled at tick T+1
        fee=fee,
        gross_value=estimated_gross,
        net_value=estimated_proceeds,
    )
    db.add(order)
    db.commit()

    return order


def _calculate_portfolio_value(db: Session, game: Game, team: Team, tick: int) -> float:
    """Calculate total portfolio value (cash + holdings + pending order values)."""
    wallet = db.query(TeamWallet).filter(TeamWallet.team_id == team.id).first()
    cash = wallet.cash_balance if wallet else 0.0

    holdings = db.query(Holding).filter(Holding.team_id == team.id).all()
    holdings_value = 0.0
    for h in holdings:
        if h.quantity > 0:
            price = get_price_at_tick(db, game, h.company_id, tick)
            if price:
                holdings_value += h.quantity * price

    # Include reserved assets from pending orders so portfolio doesn't artificially dip
    pending_buys = (
        db.query(Order)
        .filter(
            Order.team_id == team.id,
            Order.game_id == game.id,
            Order.status == OrderStatus.PENDING.value,
            Order.side == "BUY",
        )
        .all()
    )
    pending_buy_value = sum(o.gross_value or 0.0 for o in pending_buys)

    return round(cash + holdings_value + pending_buy_value, 2)
