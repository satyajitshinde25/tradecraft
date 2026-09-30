from __future__ import annotations
"""
Market Sprint — WebSocket Router (MongoDB)

WS /ws/market — broadcasts market updates, prices, breaking news,
economic calendar countdowns, and triggers pending order processing.
Uses a centralized server-side ticker task to serve all connected
participants with minimal laptop CPU & MongoDB overhead.
"""
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..database import get_db
from ..models import GameStatus, to_doc
from ..services.game_clock import get_game, get_current_tick, get_tick_timing
from ..services.market import get_all_prices_at_tick
from ..services.news import get_released_news, get_upcoming_scheduled_events
from ..services.orders import process_pending_orders

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    def has_listeners(self) -> bool:
        return len(self.active_connections) > 0

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()
_ticker_task: asyncio.Task | None = None


def build_market_snapshot(db, game, current_tick: int, now: datetime) -> dict:
    """Build the standard real-time market payload."""
    timing = get_tick_timing(game, current_tick)
    prices = get_all_prices_at_tick(db, game, current_tick)
    released = get_released_news(db, game, current_tick)
    latest_evt = released[0] if released else None

    return {
        "type": "market_update",
        "tick": current_tick,
        "status": game.status,
        "is_test_mode": game.is_test_mode,
        "server_time": now.isoformat(),
        "tick_started_at": timing.get("tick_started_at"),
        "next_tick_at": timing.get("next_tick_at"),
        "latest_news": {
            "event_number": latest_evt.event_number,
            "release_tick": latest_evt.release_tick,
            "event_type": latest_evt.event_type,
            "headline": latest_evt.headline,
            "calendar_title": latest_evt.calendar_title,
            "time_offset": latest_evt.time_offset,
            "is_scheduled": latest_evt.is_scheduled,
            "released_at": latest_evt.released_at.isoformat() if latest_evt.released_at else None,
        } if latest_evt else None,
        "upcoming_scheduled": [],
        "prices": [
            {
                "ticker": p["ticker"],
                "name": p["name"],
                "price": p["price"],
                "change": p["change"],
                "change_percent": p["change_percent"],
            }
            for p in prices
        ],
    }


async def run_market_ticker():
    """
    Centralized broadcast loop for market data.
    Runs once for the entire server instead of per-websocket.
    Updates server heartbeat so if the server crashes, downtime is compensated.
    """
    print("[Ticker] Background market ticker started.")
    try:
        while True:
            sleep_duration = 1.5
            try:
                db = get_db()
                game = get_game(db)
                current_tick = get_current_tick(game)

                # Process pending fills
                process_pending_orders(db, game, current_tick)

                now = datetime.now(timezone.utc)
                # Update heartbeat if running
                if game.status == GameStatus.RUNNING.value:
                    db.games.update_one(
                        {"_id": game.id},
                        {"$set": {"last_heartbeat_at": now}}
                    )

                if manager.has_listeners():
                    message = build_market_snapshot(db, game, current_tick, now)
                    await manager.broadcast(message)

                sleep_duration = 1.0 if game.is_test_mode else 1.5
            except Exception as e:
                sleep_duration = 2.0

            await asyncio.sleep(sleep_duration)
    except asyncio.CancelledError:
        print("[Ticker] Background market ticker stopped.")


def start_ticker():
    global _ticker_task
    if _ticker_task is None or _ticker_task.done():
        _ticker_task = asyncio.create_task(run_market_ticker())


def stop_ticker():
    global _ticker_task
    if _ticker_task and not _ticker_task.done():
        _ticker_task.cancel()


@router.websocket("/ws/market")
async def market_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time market updates.
    Sends instant snapshot on connect, then relies on centralized broadcaster.
    """
    await manager.connect(websocket)

    # Send initial snapshot immediately so client does not wait
    try:
        db = get_db()
        game = get_game(db)
        current_tick = get_current_tick(game)
        now = datetime.now(timezone.utc)
        initial_msg = build_market_snapshot(db, game, current_tick, now)
        await websocket.send_json(initial_msg)
    except Exception:
        pass

    try:
        while True:
            # Keep connection open and alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
