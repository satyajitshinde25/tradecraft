"""
Market Sprint — Admin Router

Admin-only endpoints for game control, leaderboard, and monitoring.
Supports START and RESTART (restart resets all teams to starting balance).
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..auth import get_admin_user
from ..models import (
    Game, GameStatus, Team, TeamWallet, Holding, Order, OrderFill,
    PortfolioSnapshot, LeaderboardSnapshot, AuditLog, NewsEvent, OrderStatus
)
from ..schemas import (
    GameStateResponse, LeaderboardResponse, LeaderboardEntry,
    AdminTeamStatus, AdminOrderResponse, AuditLogResponse
)
from ..services.game_clock import get_game, get_current_tick, get_tick_timing
from ..services.leaderboard import calculate_leaderboard
from ..services.news import reset_news_for_restart
from ..services.audit import log_event

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/game")
def admin_game_state(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get full game state for admin dashboard."""
    game = get_game(db)
    current_tick = get_current_tick(game)
    timing = get_tick_timing(game, current_tick)

    return {
        "game_id": game.id,
        "game_name": game.name,
        "status": game.status,
        "current_tick": current_tick,
        "max_tick": 96,
        "tick_seconds": game.tick_seconds,
        "server_time": datetime.now(timezone.utc).isoformat(),
        "tick_started_at": timing.get("tick_started_at"),
        "next_tick_at": timing.get("next_tick_at"),
        "starting_balance": game.starting_balance,
        "max_trades": game.max_trades,
        "buy_limit_percent": game.buy_limit_percent,
        "concentration_limit": game.concentration_limit,
        "trade_fee_percent": game.trade_fee_percent,
        "cooldown_seconds": game.cooldown_seconds,
    }


@router.post("/game/start")
def start_game(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Start the simulation. Sets game_start_time to now."""
    game = get_game(db)

    if game.status == GameStatus.RUNNING.value:
        raise HTTPException(status_code=400, detail="Game is already running")

    if game.status == GameStatus.FINISHED.value:
        raise HTTPException(
            status_code=400,
            detail="Game has finished. Use restart to begin a new session."
        )

    game.status = GameStatus.RUNNING.value
    game.start_time = datetime.now(timezone.utc)

    log_event(db, "GAME_STARTED", game_id=game.id, tick=0, message="Game started by admin")
    db.commit()

    return {"message": "Game started", "start_time": game.start_time.isoformat()}


@router.post("/game/restart")
def restart_game(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """
    Restart the simulation.
    Resets ALL teams to starting balance, clears orders/holdings/snapshots.
    Used when running events in batches (e.g., first 25, then next 25).
    """
    game = get_game(db)

    # Clear all trading data
    db.query(OrderFill).filter(
        OrderFill.order_id.in_(
            db.query(Order.id).filter(Order.game_id == game.id)
        )
    ).delete(synchronize_session=False)

    db.query(Order).filter(Order.game_id == game.id).delete(synchronize_session=False)

    # Reset all holdings to 0
    team_ids = [t.id for t in db.query(Team).filter(Team.game_id == game.id).all()]
    db.query(Holding).filter(Holding.team_id.in_(team_ids)).delete(synchronize_session=False)

    # Reset all wallets to starting balance
    for wallet in db.query(TeamWallet).filter(TeamWallet.team_id.in_(team_ids)).all():
        wallet.cash_balance = wallet.starting_balance

    # Clear snapshots
    db.query(PortfolioSnapshot).filter(PortfolioSnapshot.game_id == game.id).delete(synchronize_session=False)
    db.query(LeaderboardSnapshot).filter(LeaderboardSnapshot.game_id == game.id).delete(synchronize_session=False)

    # Reset news events
    reset_news_for_restart(db, game)

    # Reset game state
    game.status = GameStatus.RUNNING.value
    game.start_time = datetime.now(timezone.utc)
    game.end_time = None

    log_event(
        db, "GAME_RESTARTED",
        game_id=game.id,
        tick=0,
        message="Game restarted by admin. All teams reset to starting balance.",
    )
    db.commit()

    return {
        "message": "Game restarted. All teams reset to starting balance.",
        "start_time": game.start_time.isoformat(),
    }


@router.post("/game/pause")
def pause_game(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Pause the simulation clock."""
    game = get_game(db)
    if game.status != GameStatus.RUNNING.value:
        raise HTTPException(status_code=400, detail="Game is not running")

    game.status = GameStatus.PAUSED.value
    game.paused_at = datetime.now(timezone.utc)
    
    log_event(db, "GAME_PAUSED", game_id=game.id, tick=get_current_tick(game), message="Game paused by admin")
    db.commit()
    return {"message": "Game paused"}


@router.post("/game/resume")
def resume_game(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Resume the simulation clock by shifting start_time."""
    game = get_game(db)
    if game.status != GameStatus.PAUSED.value:
        raise HTTPException(status_code=400, detail="Game is not paused")

    now = datetime.now(timezone.utc)
    paused_at = game.paused_at
    if paused_at.tzinfo is None:
        paused_at = paused_at.replace(tzinfo=timezone.utc)
        
    pause_duration = (now - paused_at).total_seconds()
    
    start = game.start_time
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
        
    from datetime import timedelta
    game.start_time = start + timedelta(seconds=pause_duration)
    game.status = GameStatus.RUNNING.value
    game.paused_at = None
    
    log_event(db, "GAME_RESUMED", game_id=game.id, tick=get_current_tick(game), message="Game resumed by admin")
    db.commit()
    return {"message": "Game resumed"}


@router.post("/game/test-mode")
def toggle_test_mode(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Toggle 1 second/tick mode."""
    game = get_game(db)
    if game.status not in (GameStatus.DRAFT.value, GameStatus.READY.value):
        raise HTTPException(status_code=400, detail="Can only toggle test mode before starting")
        
    game.is_test_mode = not game.is_test_mode
    db.commit()
    return {"message": f"Test mode is now {'ON' if game.is_test_mode else 'OFF'}"}


@router.get("/news-script")
def get_news_script(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get the full news script (armed, released, scheduled, reserve)."""
    game = get_game(db)
    events = db.query(NewsEvent).filter(NewsEvent.game_id == game.id).order_by(NewsEvent.release_tick, NewsEvent.event_number).all()
    
    return {
        "events": [
            {
                "id": e.id,
                "event_number": e.event_number,
                "release_tick": e.release_tick,
                "event_type": e.event_type,
                "headline": e.headline,
                "is_scheduled": e.is_scheduled,
                "released": e.released,
                "released_at": e.released_at.isoformat() if e.released_at else None,
            } for e in events
        ]
    }


@router.post("/game/fire-reserve/{event_id}")
def fire_reserve(
    event_id: str,
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Manually fire a reserve headline immediately."""
    game = get_game(db)
    if game.status != GameStatus.RUNNING.value:
        raise HTTPException(status_code=400, detail="Game must be running to fire reserve news")
        
    event = db.query(NewsEvent).filter(NewsEvent.id == event_id, NewsEvent.game_id == game.id).first()
    if not event:
        raise HTTPException(status_code=404, detail="News event not found")
        
    if event.event_type != "RESERVE":
        raise HTTPException(status_code=400, detail="Can only manually fire reserve events")
        
    if event.released:
        raise HTTPException(status_code=400, detail="Event already released")
        
    current_tick = get_current_tick(game)
    event.released = True
    event.released_at = datetime.now(timezone.utc)
    event.release_tick = current_tick
    
    log_event(db, "RESERVE_NEWS_FIRED", game_id=game.id, tick=current_tick, message=f"Fired reserve news: {event.headline[:20]}")
    db.commit()
    
    return {"message": "Reserve news fired successfully"}


@router.get("/leaderboard")
def admin_leaderboard(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get full leaderboard (admin-only)."""
    game = get_game(db)
    current_tick = get_current_tick(game)
    entries = calculate_leaderboard(db, game, current_tick)

    return {
        "tick": current_tick,
        "entries": entries,
    }


@router.get("/teams")
def admin_teams(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get detailed status for all 25 teams."""
    game = get_game(db)
    current_tick = get_current_tick(game)
    entries = calculate_leaderboard(db, game, current_tick)

    return {"teams": entries}


@router.get("/orders")
def admin_orders(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get all orders across all teams."""
    game = get_game(db)

    orders = (
        db.query(Order, Team.team_code, Game)
        .join(Team, Team.id == Order.team_id)
        .join(Game, Game.id == Order.game_id)
        .filter(Order.game_id == game.id)
        .order_by(Order.submitted_at.desc())
        .limit(200)
        .all()
    )

    from ..models import Company
    result = []
    for order, team_code, g in orders:
        company = db.query(Company).filter(Company.id == order.company_id).first()
        result.append({
            "order_id": order.id,
            "team_code": team_code,
            "ticker": company.ticker if company else "???",
            "side": order.side,
            "quantity": order.quantity,
            "status": order.status,
            "submitted_tick": order.submitted_tick,
            "fill_tick": order.fill_tick,
            "fill_price": order.fill_price,
            "fee": order.fee,
            "rejection_reason": order.rejection_reason,
            "submitted_at": order.submitted_at.isoformat() if order.submitted_at else "",
        })

    return {"orders": result}


@router.get("/audit")
def admin_audit(
    admin: dict = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get recent audit logs."""
    game = get_game(db)

    logs = (
        db.query(AuditLog, Team.team_code)
        .outerjoin(Team, Team.id == AuditLog.team_id)
        .filter(AuditLog.game_id == game.id)
        .order_by(AuditLog.created_at.desc())
        .limit(200)
        .all()
    )

    return {
        "logs": [
            {
                "id": log.id,
                "event_type": log.event_type,
                "team_code": team_code,
                "tick": log.tick,
                "message": log.message,
                "created_at": log.created_at.isoformat() if log.created_at else "",
            }
            for log, team_code in logs
        ]
    }
