from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import (
    auth_router,
    game_router,
    market_router,
    news_router,
    order_router,
    portfolio_router,
    admin_router,
    ws_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    On startup, ensure database indexes exist, data is seeded if empty,
    resume simulation clock accurately if recovering from a crash/restart,
    and start the centralized broadcast ticker.
    """
    from datetime import datetime, timezone, timedelta
    from .database import get_db, ensure_indexes
    from .seed import seed_database
    from .models import GameStatus, to_doc
    from .services.game_clock import get_current_tick
    from .services.audit import log_event
    from .routers.ws_router import start_ticker, stop_ticker

    try:
        db = get_db()
        ensure_indexes()
        game_doc = db.games.find_one()
        teams_count = db.teams.count_documents({})
        if not game_doc or teams_count == 0:
            print("[Startup] Database unseeded or missing teams. Running automatic seed...")
            seed_database()
            print("[Startup] Automatic database seed completed successfully.")
            game_doc = db.games.find_one()

        # Crash / restart recovery: If game was RUNNING, freeze the clock during downtime
        if game_doc:
            game = to_doc(game_doc)
            if (
                game.status == GameStatus.RUNNING.value
                and game.start_time
                and game.get("last_heartbeat_at")
            ):
                now = datetime.now(timezone.utc)
                last_hb = game.last_heartbeat_at
                if last_hb.tzinfo is None:
                    last_hb = last_hb.replace(tzinfo=timezone.utc)

                downtime = (now - last_hb).total_seconds()
                if downtime > 2.0:
                    start = game.start_time
                    if start.tzinfo is None:
                        start = start.replace(tzinfo=timezone.utc)
                    new_start = start + timedelta(seconds=downtime)

                    db.games.update_one(
                        {"_id": game.id},
                        {"$set": {
                            "start_time": new_start,
                            "last_heartbeat_at": now,
                            "updated_at": now,
                        }}
                    )

                    recovered_game = to_doc(db.games.find_one({"_id": game.id}))
                    recovered_tick = get_current_tick(recovered_game)
                    log_event(
                        db, "SERVER_CRASH_RECOVERY",
                        game_id=game.id,
                        tick=recovered_tick,
                        message=f"Server recovered after {round(downtime, 1)}s downtime. Resumed clock at exact Tick {recovered_tick}.",
                    )
                    print(f"[Crash Recovery] Resumed simulation at exact Tick {recovered_tick} (compensated for {round(downtime, 1)}s downtime).")

        # Start the background market ticker
        start_ticker()

    except Exception as e:
        print(f"[Startup] Warning during startup database check: {e}")

    yield

    # Clean shutdown
    try:
        stop_ticker()
        db = get_db()
        db.games.update_one(
            {"status": "RUNNING"},
            {"$set": {"last_heartbeat_at": datetime.now(timezone.utc)}}
        )
    except Exception:
        pass


app = FastAPI(
    title="Market Sprint API",
    description="Backend for Market Sprint: Fictional Markets Edition — a live stock trading simulation",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: Allow configured origins, plus regex matching any HTTP/HTTPS origin for seamless deployments
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Mount routers
app.include_router(auth_router.router)
app.include_router(game_router.router)
app.include_router(market_router.router)
app.include_router(news_router.router)
app.include_router(order_router.router)
app.include_router(portfolio_router.router)
app.include_router(admin_router.router)
app.include_router(ws_router.router)


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/api")
def api_info():
    return {
        "name": "Market Sprint API",
        "version": "1.0.0",
        "status": "online",
    }


# Frontend static files and Single Page Application fallback
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))

if os.path.isdir(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        return {"name": "Market Sprint API", "status": "online"}
else:
    @app.get("/")
    def root():
        return {
            "name": "Market Sprint API",
            "version": "1.0.0",
            "status": "online",
        }
