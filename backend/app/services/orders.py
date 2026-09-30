from __future__ import annotations
"""
Market Sprint — Order Service / Trading Engine (MongoDB)

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
from pymongo.database import Database

from ..models import (
    GameStatus, OrderStatus, to_doc,
    make_order, make_order_fill, make_holding,
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
from collections import defaultdict

_order_process_lock = threading.Lock()
_team_locks = defaultdict(threading.Lock)
_team_lock_mutex = threading.Lock()


def get_team_lock(team_id: str) -> threading.Lock:
    with _team_lock_mutex:
        return _team_locks[team_id]


def process_pending_orders(db: Database, game, current_tick: int) -> int:
    """
    Process any PENDING orders whose fill_tick has arrived (fill_tick <= current_tick).
    Executes fills at the official precomputed price of the fill tick.
    Returns the count of orders processed.
    """
    with _order_process_lock:
        pending_orders = list(
            db.orders.find({
                "game_id": game.id,
                "status": OrderStatus.PENDING.value,
                "fill_tick": {"$lte": current_tick},
            }).sort("submitted_at", 1)
        )

        if not pending_orders:
            return 0

        processed_count = 0

        for order_doc in pending_orders:
            order = to_doc(order_doc)

            # Skip if already filled by another call
            if order.status != OrderStatus.PENDING.value:
                continue

            company = to_doc(db.companies.find_one({"_id": order.company_id}))
            wallet = to_doc(db.team_wallets.find_one({"team_id": order.team_id}))

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
                    new_cash = round(max(0.0, wallet.cash_balance + cash_adjustment), 2)
                    db.team_wallets.update_one(
                        {"team_id": order.team_id},
                        {"$set": {"cash_balance": new_cash, "updated_at": datetime.now(timezone.utc)}}
                    )

                # Update or create holding
                holding = to_doc(db.holdings.find_one({
                    "team_id": order.team_id,
                    "company_id": order.company_id,
                }))

                if holding:
                    old_total = holding.average_cost * holding.quantity
                    new_qty = holding.quantity + order.quantity
                    new_total = old_total + actual_gross
                    new_avg = round(new_total / new_qty, 2) if new_qty > 0 else fill_price
                    db.holdings.update_one(
                        {"team_id": order.team_id, "company_id": order.company_id},
                        {"$set": {"quantity": new_qty, "average_cost": new_avg, "updated_at": datetime.now(timezone.utc)}}
                    )
                else:
                    db.holdings.insert_one(make_holding(
                        team_id=order.team_id,
                        company_id=order.company_id,
                        quantity=order.quantity,
                        average_cost=fill_price,
                    ))

                # Update order
                db.orders.update_one(
                    {"_id": order.id},
                    {"$set": {
                        "status": OrderStatus.FILLED.value,
                        "fill_price": fill_price,
                        "gross_value": actual_gross,
                        "fee": actual_fee,
                        "net_value": actual_total,
                    }}
                )

            elif order.side == "SELL":
                actual_proceeds = round(actual_gross - actual_fee, 2)
                if wallet:
                    new_cash = round(wallet.cash_balance + actual_proceeds, 2)
                    db.team_wallets.update_one(
                        {"team_id": order.team_id},
                        {"$set": {"cash_balance": new_cash, "updated_at": datetime.now(timezone.utc)}}
                    )

                holding = to_doc(db.holdings.find_one({
                    "team_id": order.team_id,
                    "company_id": order.company_id,
                }))
                if holding:
                    new_qty = max(0, holding.quantity - order.quantity)
                    new_avg = 0.0 if new_qty == 0 else holding.average_cost
                    db.holdings.update_one(
                        {"team_id": order.team_id, "company_id": order.company_id},
                        {"$set": {"quantity": new_qty, "average_cost": new_avg, "updated_at": datetime.now(timezone.utc)}}
                    )

                # Update order
                db.orders.update_one(
                    {"_id": order.id},
                    {"$set": {
                        "status": OrderStatus.FILLED.value,
                        "fill_price": fill_price,
                        "gross_value": actual_gross,
                        "fee": actual_fee,
                        "net_value": actual_proceeds,
                    }}
                )

            # Create fill record
            fill = make_order_fill(
                order_id=order.id,
                fill_tick=order.fill_tick,
                fill_price=fill_price,
                quantity=order.quantity,
                fee=actual_fee,
                filled_at=datetime.now(timezone.utc),
            )
            db.order_fills.insert_one(fill)

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

        return processed_count


def validate_and_execute_buy(
    db: Database, game, team, company, quantity: int
):
    """
    Validate and place a BUY order.
    Executes in PENDING state to fill at tick T+1.
    Returns a DotDict order document.
    Serialized per team to prevent race conditions during heavy traffic.
    """
    with get_team_lock(team.id):
        current_tick = get_current_tick(game)

        # 1. Game must be RUNNING and before close
        if game.status != GameStatus.RUNNING.value:
            raise TradingError("Market is not open for trading", "MARKET_CLOSED")

        if current_tick >= 96:
            raise TradingError("Market has closed (tick 96 reached)", "MARKET_CLOSED")

        # Process any overdue pending orders before calculating limits
        process_pending_orders(db, game, current_tick)

        # 2. Get wallet
        wallet = to_doc(db.team_wallets.find_one({"team_id": team.id}))
        if not wallet:
            raise TradingError("Wallet not found", "WALLET_ERROR")

        # 3. Check cooldown (7 seconds)
        last_order_doc = db.orders.find_one(
            {
                "team_id": team.id,
                "game_id": game.id,
                "status": {"$ne": OrderStatus.REJECTED.value},
            },
            sort=[("submitted_at", -1)]
        )

        if last_order_doc and last_order_doc.get("submitted_at"):
            submitted = last_order_doc["submitted_at"]
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
        trade_count = db.orders.count_documents({
            "team_id": team.id,
            "game_id": game.id,
            "status": {"$in": [OrderStatus.FILLED.value, OrderStatus.PENDING.value]},
        })

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
        current_holding = to_doc(db.holdings.find_one({
            "team_id": team.id, "company_id": company.id
        }))
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
        new_cash = round(wallet.cash_balance - estimated_total, 2)
        db.team_wallets.update_one(
            {"team_id": team.id},
            {"$set": {"cash_balance": new_cash, "updated_at": datetime.now(timezone.utc)}}
        )

        order = make_order(
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
        db.orders.insert_one(order)

        return to_doc(order)


def validate_and_execute_sell(
    db: Database, game, team, company, quantity: int
):
    """
    Validate and place a SELL order.
    Executes in PENDING state to fill at tick T+1.
    Returns a DotDict order document.
    Serialized per team to prevent race conditions during heavy traffic.
    """
    with get_team_lock(team.id):
        current_tick = get_current_tick(game)

        # 1. Game must be RUNNING and before close
        if game.status != GameStatus.RUNNING.value:
            raise TradingError("Market is not open for trading", "MARKET_CLOSED")

        if current_tick >= 96:
            raise TradingError("Market has closed (tick 96 reached)", "MARKET_CLOSED")

        process_pending_orders(db, game, current_tick)

        # 2. Get wallet
        wallet = to_doc(db.team_wallets.find_one({"team_id": team.id}))
        if not wallet:
            raise TradingError("Wallet not found", "WALLET_ERROR")

        # 3. Check cooldown
        last_order_doc = db.orders.find_one(
            {
                "team_id": team.id,
                "game_id": game.id,
                "status": {"$ne": OrderStatus.REJECTED.value},
            },
            sort=[("submitted_at", -1)]
        )

        if last_order_doc and last_order_doc.get("submitted_at"):
            submitted = last_order_doc["submitted_at"]
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
        trade_count = db.orders.count_documents({
            "team_id": team.id,
            "game_id": game.id,
            "status": {"$in": [OrderStatus.FILLED.value, OrderStatus.PENDING.value]},
        })

        if trade_count >= game.max_trades:
            raise TradingError(
                f"Maximum trade limit reached ({game.max_trades})",
                "TRADE_LIMIT"
            )

        # 5. Check sufficient holdings
        holding = to_doc(db.holdings.find_one({
            "team_id": team.id, "company_id": company.id
        }))

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
        new_qty = holding.quantity - quantity
        db.holdings.update_one(
            {"team_id": team.id, "company_id": company.id},
            {"$set": {"quantity": new_qty, "updated_at": datetime.now(timezone.utc)}}
        )

        order = make_order(
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
        db.orders.insert_one(order)

        return to_doc(order)



def _calculate_portfolio_value(db: Database, game, team, tick: int) -> float:
    """Calculate total portfolio value (cash + holdings + pending order values)."""
    wallet = to_doc(db.team_wallets.find_one({"team_id": team.id}))
    cash = wallet.cash_balance if wallet else 0.0

    holdings = list(db.holdings.find({"team_id": team.id}))
    holdings_value = 0.0
    for h in holdings:
        if h["quantity"] > 0:
            price = get_price_at_tick(db, game, h["company_id"], tick)
            if price:
                holdings_value += h["quantity"] * price

    # Include reserved assets from pending orders so portfolio doesn't artificially dip
    pending_buys = list(db.orders.find({
        "team_id": team.id,
        "game_id": game.id,
        "status": OrderStatus.PENDING.value,
        "side": "BUY",
    }))
    pending_buy_value = sum(o.get("gross_value", 0.0) or 0.0 for o in pending_buys)

    return round(cash + holdings_value + pending_buy_value, 2)
