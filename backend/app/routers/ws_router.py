"""
Market Sprint — WebSocket Router

WS /ws/market  — broadcasts market + portfolio updates
"""
import asyncio
import json
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..database import SessionLocal
from ..services.game_clock import get_game, get_current_tick, get_tick_timing
from ..services.market import get_all_prices_at_tick

router = APIRouter(tags=["WebSocket"])

# Simple connection manager
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
    Sends market state every 5 seconds.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Get current market state
            db = SessionLocal()
            try:
                game = get_game(db)
                current_tick = get_current_tick(game)
                timing = get_tick_timing(game, current_tick)
                prices = get_all_prices_at_tick(db, game, current_tick)

                message = {
                    "type": "market_update",
                    "tick": current_tick,
                    "status": game.status,
                    "server_time": datetime.now(timezone.utc).isoformat(),
                    "tick_started_at": timing.get("tick_started_at"),
                    "next_tick_at": timing.get("next_tick_at"),
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
            finally:
                db.close()

            await asyncio.sleep(5)  # Update every 5 seconds

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
