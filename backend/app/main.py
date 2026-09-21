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
    On startup, ensure database tables exist and data is seeded if database is empty.
    Allows zero-configuration deployment on Render, Docker, or fresh environments.
    """
    from .database import engine, SessionLocal
    from .models import Base, Game, Team
    from .seed import seed_database

    try:
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            game = db.query(Game).first()
            teams_count = db.query(Team).count()
            if not game or teams_count == 0:
                print("[Startup] Database unseeded or missing teams. Running automatic seed...")
                seed_database()
                print("[Startup] Automatic database seed completed successfully.")
    except Exception as e:
        print(f"[Startup] Warning during startup database check: {e}")
    yield


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

# Mount routers
app.include_router(auth_router.router)
app.include_router(game_router.router)
app.include_router(market_router.router)
app.include_router(news_router.router)
app.include_router(order_router.router)
app.include_router(portfolio_router.router)
app.include_router(admin_router.router)
app.include_router(ws_router.router)


@app.get("/")
def root():
    return {
        "name": "Market Sprint API",
        "version": "1.0.0",
        "status": "online",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
