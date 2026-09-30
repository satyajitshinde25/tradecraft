from __future__ import annotations
"""
Market Sprint — Order Router (MongoDB)

POST /orders/buy: Submit a BUY order (enters PENDING, executes at next tick)
POST /orders/sell: Submit a SELL order (enters PENDING, executes at next tick)
GET  /orders: Get all orders for the team, automatically reconciling completed pending fills
"""
from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from ..database import get_db
from ..auth import get_current_team
from ..models import to_doc, OrderStatus
from ..schemas import OrderRequest, OrderResponse, OrderListResponse
from ..services.game_clock import get_game, get_current_tick
from ..services.market import get_company_by_ticker
from ..services.orders import (
    validate_and_execute_buy, validate_and_execute_sell,
    process_pending_orders, TradingError
)
from ..services.audit import log_event

router = APIRouter(prefix="/orders", tags=["Orders"])


def _order_to_response(order, db: Database) -> OrderResponse:
    company = to_doc(db.companies.find_one({"_id": order.company_id}))
    return OrderResponse(
        order_id=order.id,
        status=order.status,
        side=order.side,
        ticker=company.ticker if company else "???",
        quantity=order.quantity,
        submitted_tick=order.submitted_tick,
        requested_price=order.requested_price,
        fill_tick=order.fill_tick,
        fill_price=order.fill_price,
        fee=order.fee,
        gross_value=order.gross_value,
        net_value=order.net_value,
        rejection_reason=order.rejection_reason,
        submitted_at=order.submitted_at.isoformat() if order.submitted_at else "",
    )


@router.post("/buy", response_model=OrderResponse)
def buy_order(
    request: OrderRequest,
    team=Depends(get_current_team),
    db: Database = Depends(get_db),
):
    """Submit a BUY order. Enters PENDING state and fills at the next tick's price."""
    game = get_game(db)
    company = get_company_by_ticker(db, game, request.ticker.upper())

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        order = validate_and_execute_buy(db, game, team, company, request.quantity)

        log_event(
            db, "ORDER_SUBMITTED",
            game_id=game.id,
            team_id=team.id,
            tick=order.submitted_tick,
            order_id=order.id,
            message=f"BUY {request.quantity} {request.ticker} submitted at Tick {order.submitted_tick} (pending fill at Tick {order.fill_tick})",
        )

        return _order_to_response(order, db)

    except TradingError as e:
        log_event(
            db, "ORDER_REJECTED",
            game_id=game.id,
            team_id=team.id,
            tick=get_current_tick(game),
            message=f"BUY {request.quantity} {request.ticker} rejected: {e.message}",
        )
        raise HTTPException(status_code=400, detail=e.message)


@router.post("/sell", response_model=OrderResponse)
def sell_order(
    request: OrderRequest,
    team=Depends(get_current_team),
    db: Database = Depends(get_db),
):
    """Submit a SELL order. Enters PENDING state and fills at the next tick's price."""
    game = get_game(db)
    company = get_company_by_ticker(db, game, request.ticker.upper())

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    try:
        order = validate_and_execute_sell(db, game, team, company, request.quantity)

        log_event(
            db, "ORDER_SUBMITTED",
            game_id=game.id,
            team_id=team.id,
            tick=order.submitted_tick,
            order_id=order.id,
            message=f"SELL {request.quantity} {request.ticker} submitted at Tick {order.submitted_tick} (pending fill at Tick {order.fill_tick})",
        )

        return _order_to_response(order, db)

    except TradingError as e:
        log_event(
            db, "ORDER_REJECTED",
            game_id=game.id,
            team_id=team.id,
            tick=get_current_tick(game),
            message=f"SELL {request.quantity} {request.ticker} rejected: {e.message}",
        )
        raise HTTPException(status_code=400, detail=e.message)


@router.get("", response_model=OrderListResponse)
def get_orders(
    team=Depends(get_current_team),
    db: Database = Depends(get_db),
):
    """Get all orders for the authenticated team, processing any overdue pending fills."""
    game = get_game(db)
    current_tick = get_current_tick(game)

    # Process pending orders whose fill tick has arrived
    process_pending_orders(db, game, current_tick)

    orders = [
        to_doc(o) for o in
        db.orders.find(
            {"team_id": team.id, "game_id": game.id}
        ).sort("submitted_at", -1)
    ]

    trade_count = db.orders.count_documents({
        "team_id": team.id,
        "game_id": game.id,
        "status": OrderStatus.FILLED.value,
    })

    return OrderListResponse(
        orders=[_order_to_response(o, db) for o in orders],
        trade_count=trade_count,
        max_trades=game.max_trades,
    )
