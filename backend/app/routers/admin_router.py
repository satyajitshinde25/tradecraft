from __future__ import annotations
"""
Market Sprint — Admin Router (MongoDB)

Admin-only endpoints for game control, leaderboard, and monitoring.
Supports START and RESTART (restart resets all teams to starting balance).
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from ..database import get_db
from ..auth import get_admin_user
from ..models import GameStatus, OrderStatus, to_doc
from ..schemas import (
    GameStateResponse, LeaderboardResponse, LeaderboardEntry,
    AdminTeamStatus, AdminOrderResponse, AuditLogResponse
)
from ..services.game_clock import get_game, get_current_tick, get_tick_timing
from ..services.leaderboard import calculate_leaderboard
from ..services.news import reset_news_for_restart
from ..services.audit import log_event
from ..services.orders import process_pending_orders

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/game")
def admin_game_state(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
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
    db: Database = Depends(get_db),
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

    now = datetime.now(timezone.utc)
    db.games.update_one(
        {"_id": game.id},
        {"$set": {"status": GameStatus.RUNNING.value, "start_time": now, "updated_at": now}}
    )

    log_event(db, "GAME_STARTED", game_id=game.id, tick=0, message="Game started by admin")

    return {"message": "Game started", "start_time": now.isoformat()}


@router.post("/game/restart")
def restart_game(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """
    Restart the simulation.
    Resets ALL teams to starting balance, clears orders/holdings/snapshots.
    Used when running events in batches (e.g., first 25, then next 25).
    """
    game = get_game(db)

    # Clear all order fills for this game's orders
    order_ids = [o["_id"] for o in db.orders.find({"game_id": game.id}, {"_id": 1})]
    if order_ids:
        db.order_fills.delete_many({"order_id": {"$in": order_ids}})

    # Clear all orders
    db.orders.delete_many({"game_id": game.id})

    # Get team ids
    team_ids = [t["_id"] for t in db.teams.find({"game_id": game.id}, {"_id": 1})]

    # Reset all holdings
    if team_ids:
        db.holdings.delete_many({"team_id": {"$in": team_ids}})

    # Reset all wallets to starting balance
    for wallet_doc in db.team_wallets.find({"team_id": {"$in": team_ids}}):
        db.team_wallets.update_one(
            {"_id": wallet_doc["_id"]},
            {"$set": {
                "cash_balance": wallet_doc["starting_balance"],
                "updated_at": datetime.now(timezone.utc),
            }}
        )

    # Clear snapshots
    db.portfolio_snapshots.delete_many({"game_id": game.id})
    db.leaderboard_snapshots.delete_many({"game_id": game.id})

    # Reset news events
    reset_news_for_restart(db, game)

    # Reset game state
    now = datetime.now(timezone.utc)
    db.games.update_one(
        {"_id": game.id},
        {"$set": {
            "status": GameStatus.RUNNING.value,
            "start_time": now,
            "end_time": None,
            "updated_at": now,
        }}
    )

    log_event(
        db, "GAME_RESTARTED",
        game_id=game.id,
        tick=0,
        message="Game restarted by admin. All teams reset to starting balance.",
    )

    return {
        "message": "Game restarted. All teams reset to starting balance.",
        "start_time": now.isoformat(),
    }


@router.post("/game/pause")
def pause_game(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Pause the simulation clock."""
    game = get_game(db)
    if game.status != GameStatus.RUNNING.value:
        raise HTTPException(status_code=400, detail="Game is not running")

    now = datetime.now(timezone.utc)
    db.games.update_one(
        {"_id": game.id},
        {"$set": {"status": GameStatus.PAUSED.value, "paused_at": now, "updated_at": now}}
    )

    log_event(db, "GAME_PAUSED", game_id=game.id, tick=get_current_tick(game), message="Game paused by admin")
    return {"message": "Game paused"}


@router.post("/game/resume")
def resume_game(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
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
    new_start = start + timedelta(seconds=pause_duration)

    db.games.update_one(
        {"_id": game.id},
        {"$set": {
            "start_time": new_start,
            "status": GameStatus.RUNNING.value,
            "paused_at": None,
            "updated_at": now,
        }}
    )

    # Re-fetch for tick calc
    game = get_game(db)
    log_event(db, "GAME_RESUMED", game_id=game.id, tick=get_current_tick(game), message="Game resumed by admin")
    return {"message": "Game resumed"}


@router.post("/game/test-mode")
def toggle_test_mode(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Toggle 1 second/tick mode."""
    game = get_game(db)
    if game.status not in (GameStatus.DRAFT.value, GameStatus.READY.value):
        raise HTTPException(status_code=400, detail="Can only toggle test mode before starting")

    new_mode = not game.is_test_mode
    db.games.update_one(
        {"_id": game.id},
        {"$set": {"is_test_mode": new_mode, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"message": f"Test mode is now {'ON' if new_mode else 'OFF'}"}


@router.get("/news-script")
def get_news_script(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Get the full news script (armed, released, scheduled, reserve)."""
    game = get_game(db)
    events = list(
        db.news_events.find({"game_id": game.id})
        .sort([("release_tick", 1), ("event_number", 1)])
    )

    return {
        "events": [
            {
                "id": str(e["_id"]),
                "event_number": e["event_number"],
                "release_tick": e["release_tick"],
                "event_type": e["event_type"],
                "headline": e["headline"],
                "calendar_title": e.get("calendar_title"),
                "time_offset": e.get("time_offset"),
                "forecast": e.get("forecast"),
                "is_scheduled": e["is_scheduled"],
                "released": e["released"],
                "released_at": e["released_at"].isoformat() if e.get("released_at") else None,
            } for e in events
        ]
    }


@router.get("/news-generator/candidates")
def get_candidate_headlines(
    category: str = "all",
    admin: dict = Depends(get_admin_user),
):
    """
    Prep-time fictional news candidate generator (Organizer authoring tool).
    Provides factual, non-predictive Meridia headline templates across Macro, Company, and Policy.
    """
    templates = [
        # Macro
        {"category": "MACRO", "title": "MRB Neutral Stance", "headline": "MRB releases quarterly statement; benchmark rates maintained at current target.", "suggested_drivers": "RATES: 0, DEMAND: +1", "profile": "STEP"},
        {"category": "MACRO", "title": "Retail Sales Expansion", "headline": "Meridian retail spending expands 1.4% month-on-month, beating expectations.", "suggested_drivers": "DEMAND: +2, SENTIMENT: +1", "profile": "SLOW-BURN"},
        {"category": "MACRO", "title": "Freight Cost Reduction", "headline": "Shipping import price index declines as maritime freight bottlenecks clear.", "suggested_drivers": "OIL: -1, DEMAND: +1", "profile": "STEP"},
        {"category": "MACRO", "title": "Manufacturing Expansion", "headline": "Meridia industrial output climbs to multi-quarter high on supply resilience.", "suggested_drivers": "DEMAND: +2", "profile": "SLOW-BURN"},
        # Company-specific
        {"category": "COMPANY", "ticker": "TAVR", "title": "TAVR Exploration Well", "headline": "Tavorin Energy reports commercial hydrocarbon discovery in Northern Basin.", "suggested_drivers": "OIL: +2 (direct: TAVR +3.5%)", "profile": "STEP"},
        {"category": "COMPANY", "ticker": "AERV", "title": "AERV Fleet Optimization", "headline": "Aerovia Airlines completes domestic fleet modernization, lowering fuel burn.", "suggested_drivers": "direct: AERV +3.0%", "profile": "STEP"},
        {"category": "COMPANY", "ticker": "VLTN", "title": "VLTN Commercial Lending", "headline": "Vaultline Bank reports 4.2% expansion in institutional credit portfolio.", "suggested_drivers": "direct: VLTN +2.5%", "profile": "SLOW-BURN"},
        {"category": "COMPANY", "ticker": "BRKW", "title": "BRKW Project Approval", "headline": "Brickwell Developers receives municipal green light for Harborfront mixed-use hub.", "suggested_drivers": "direct: BRKW +4.0%", "profile": "SPIKE-AND-FADE"},
        {"category": "COMPANY", "ticker": "LMRA", "title": "LMRA Sovereign Cloud Deal", "headline": "Lumora Labs selected to deploy secure sovereign cloud infrastructure for state agencies.", "suggested_drivers": "direct: LMRA +5.0%", "profile": "STEP"},
        {"category": "COMPANY", "ticker": "GRFD", "title": "GRFD Retail Contract", "headline": "Greenfield Foods signs nationwide supply agreement with leading grocery conglomerate.", "suggested_drivers": "direct: GRFD +3.0%", "profile": "STEP"},
        # Policy
        {"category": "POLICY", "title": "Commercial Subsidies", "headline": "Ministry of Development launches regional commercial infrastructure development grant.", "suggested_drivers": "DEMAND: +1, BRKW: +2", "profile": "SLOW-BURN"},
        {"category": "POLICY", "title": "Aviation Safety Guidelines", "headline": "Civil Aviation Authority issues updated scheduled maintenance compliance directive.", "suggested_drivers": "AERV: -1.5%", "profile": "STEP"},
        {"category": "POLICY", "title": "Financial Buffer Framework", "headline": "Banking supervisory committee proposes countercyclical capital buffer calibration.", "suggested_drivers": "VLTN: -1.0%", "profile": "SLOW-BURN"},
    ]

    if category.upper() in ["MACRO", "COMPANY", "POLICY"]:
        filtered = [t for t in templates if t["category"] == category.upper()]
        return {"candidates": filtered}
    return {"candidates": templates}


@router.post("/game/fire-reserve/{event_id}")
def fire_reserve(
    event_id: str,
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Manually fire a reserve headline immediately."""
    game = get_game(db)
    if game.status != GameStatus.RUNNING.value:
        raise HTTPException(status_code=400, detail="Game must be running to fire reserve news")

    event = to_doc(db.news_events.find_one({"_id": event_id, "game_id": game.id}))
    if not event:
        raise HTTPException(status_code=404, detail="News event not found")

    if event.event_type != "RESERVE":
        raise HTTPException(status_code=400, detail="Can only manually fire reserve events")

    if event.released:
        raise HTTPException(status_code=400, detail="Event already released")

    current_tick = get_current_tick(game)
    db.news_events.update_one(
        {"_id": event_id},
        {"$set": {
            "released": True,
            "released_at": datetime.now(timezone.utc),
            "release_tick": current_tick,
        }}
    )

    log_event(db, "RESERVE_NEWS_FIRED", game_id=game.id, tick=current_tick, message=f"Fired reserve news: {event.headline}")

    return {"message": f"Reserve news fired successfully at Tick {current_tick}"}


@router.get("/leaderboard")
def admin_leaderboard(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Get full leaderboard (admin-only)."""
    game = get_game(db)
    current_tick = get_current_tick(game)
    process_pending_orders(db, game, current_tick)
    entries = calculate_leaderboard(db, game, current_tick)

    return {
        "tick": current_tick,
        "entries": entries,
    }


@router.get("/teams")
def admin_teams(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Get detailed status for all 25 teams."""
    game = get_game(db)
    current_tick = get_current_tick(game)
    process_pending_orders(db, game, current_tick)
    entries = calculate_leaderboard(db, game, current_tick)

    return {"teams": entries}


@router.get("/orders")
def admin_orders(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Get all orders across all teams."""
    game = get_game(db)
    current_tick = get_current_tick(game)
    process_pending_orders(db, game, current_tick)

    orders = list(
        db.orders.find({"game_id": game.id})
        .sort("submitted_at", -1)
        .limit(200)
    )

    result = []
    for order_doc in orders:
        order = to_doc(order_doc)
        team = to_doc(db.teams.find_one({"_id": order.team_id}))
        company = to_doc(db.companies.find_one({"_id": order.company_id}))
        result.append({
            "order_id": order.id,
            "team_code": team.team_code if team else "???",
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


@router.get("/logged-in-teams")
def logged_in_teams(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Get all teams that have logged in (have an active session token) and full teams status."""
    game = get_game(db)
    teams = list(db.teams.find({"game_id": game.id}).sort("team_code", 1))

    logged_in = []
    all_teams_list = []
    for team_doc in teams:
        team = to_doc(team_doc)
        cred = to_doc(db.team_credentials.find_one({"team_id": team.id}))
        is_active = bool(cred and cred.active_session_token)
        last_login = cred.last_login_at.isoformat() if (cred and cred.last_login_at) else None

        info = {
            "team_id": team.id,
            "team_code": team.team_code,
            "display_name": team.display_name,
            "is_logged_in": is_active,
            "last_login_at": last_login,
        }
        all_teams_list.append(info)
        if is_active:
            logged_in.append(info)

    return {
        "logged_in_count": len(logged_in),
        "total_teams": len(teams),
        "teams": logged_in,
        "all_teams": all_teams_list,
    }


@router.get("/audit")
def admin_audit(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Get recent audit logs."""
    game = get_game(db)

    logs = list(
        db.audit_logs.find({"game_id": game.id})
        .sort("created_at", -1)
        .limit(200)
    )

    result = []
    for log_doc in logs:
        log = to_doc(log_doc)
        team_code = None
        if log.team_id:
            team = to_doc(db.teams.find_one({"_id": log.team_id}))
            team_code = team.team_code if team else None

        result.append({
            "id": log.id,
            "event_type": log.event_type,
            "team_code": team_code,
            "tick": log.tick,
            "message": log.message,
            "created_at": log.created_at.isoformat() if log.created_at else "",
        })

    return {"logs": result}


@router.delete("/audit/clear")
def clear_audit(
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Clear all audit logs for the current game."""
    game = get_game(db)
    result = db.audit_logs.delete_many({"game_id": game.id})
    log_event(db, "AUDIT_CLEARED", game_id=game.id, message=f"Admin cleared {result.deleted_count} audit log entries")
    return {"message": f"Cleared {result.deleted_count} audit log entries"}
