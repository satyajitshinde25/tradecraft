"""
Market Sprint — FastAPI Application

Main entry point. Mounts all routers and configures CORS.
"""
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

app = FastAPI(
    title="Market Sprint API",
    description="Backend for Market Sprint: Fictional Markets Edition — a live stock trading simulation",
    version="1.0.0",
)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
