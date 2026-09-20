"""
Market Sprint — WebSocket Router

WS /ws/market — broadcasts market updates, prices, breaking news,
economic calendar countdowns, and triggers pending order processing.
"""
import asyncio
import json
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..database import SessionLocal
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

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


@router.websocket("/ws/market")
async def market_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time market updates.
    Updates every 1s in test mode, every 2s in live mode.
    Reconciles pending fills and publishes latest news & calendar events.
    """
    await manager.connect(websocket)
    try:
        while True:
            db = SessionLocal()
            try:
                game = get_game(db)
                current_tick = get_current_tick(game)

                # Process any pending orders whose fill tick has arrived
                process_pending_orders(db, game, current_tick)

                timing = get_tick_timing(game, current_tick)
                prices = get_all_prices_at_tick(db, game, current_tick)
                released = get_released_news(db, game, current_tick)
                upcoming = get_upcoming_scheduled_events(db, game, current_tick)

                latest_evt = released[0] if released else None

                message = {
                    "type": "market_update",
                    "tick": current_tick,
                    "status": game.status,
                    "is_test_mode": game.is_test_mode,
                    "server_time": datetime.now(timezone.utc).isoformat(),
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
                    "upcoming_scheduled": [
                        {
                            "event_number": evt.event_number,
                            "release_tick": evt.release_tick,
                            "calendar_title": evt.calendar_title or f"Scheduled Event {evt.event_number}",
                            "time_offset": evt.time_offset,
                            "forecast": evt.forecast,
                        }
                        for evt in upcoming
                    ],
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

                await websocket.send_json(message)
                sleep_duration = 1.0 if game.is_test_mode else 2.0
            finally:
                db.close()

            await asyncio.sleep(sleep_duration)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
