from __future__ import annotations
"""
Market Sprint — Leaderboard Service (MongoDB, Admin-Only)

Ranking, eligibility check, and leaderboard snapshots.
"""
from pymongo.database import Database
from ..models import to_doc, OrderStatus
from ..services.market import get_price_at_tick


def calculate_leaderboard(db: Database, game, current_tick: int) -> list[dict]:
    """
    Calculate full leaderboard for all teams.
    Returns sorted list by portfolio value descending.
    """
    teams = list(db.teams.find({"game_id": game.id, "is_active": True}))
    entries = []

    for team_doc in teams:
        team = to_doc(team_doc)
        wallet = to_doc(db.team_wallets.find_one({"team_id": team.id}))
        cash = wallet.cash_balance if wallet else 0.0
        starting = wallet.starting_balance if wallet else 10000.0

        # Holdings value
        holdings = list(db.holdings.find({"team_id": team.id}))
        holdings_value = 0.0
        for h in holdings:
            if h["quantity"] > 0:
                price = get_price_at_tick(db, game, h["company_id"], current_tick)
                if price:
                    holdings_value += h["quantity"] * price

        portfolio_value = round(cash + holdings_value, 2)
        profit_loss = round(portfolio_value - starting, 2)
        profit_loss_pct = round((profit_loss / starting) * 100, 2) if starting > 0 else 0

        # Trade stats
        trade_count = db.orders.count_documents({
            "team_id": team.id,
            "game_id": game.id,
            "status": OrderStatus.FILLED.value,
        })

        # Companies traded (distinct company_ids in filled orders)
        pipeline = [
            {"$match": {
                "team_id": team.id,
                "game_id": game.id,
                "status": OrderStatus.FILLED.value,
            }},
            {"$group": {"_id": "$company_id"}},
            {"$count": "count"},
        ]
        agg_result = list(db.orders.aggregate(pipeline))
        companies_traded = agg_result[0]["count"] if agg_result else 0

        is_eligible = trade_count >= 6 and companies_traded >= 3

        # Last order time
        last_order = db.orders.find_one(
            {"team_id": team.id, "game_id": game.id},
            sort=[("submitted_at", -1)]
        )

        entries.append({
            "team_code": team.team_code,
            "display_name": team.display_name,
            "is_active": team.is_active,
            "cash": cash,
            "holdings_value": round(holdings_value, 2),
            "portfolio_value": portfolio_value,
            "profit_loss": profit_loss,
            "profit_loss_percent": profit_loss_pct,
            "trade_count": trade_count,
            "companies_traded": companies_traded,
            "is_eligible": is_eligible,
            "last_order_at": last_order["submitted_at"].isoformat() if last_order and last_order.get("submitted_at") else None,
        })

    # Sort by portfolio value descending
    entries.sort(key=lambda x: x["portfolio_value"], reverse=True)

    # Assign ranks
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1

    return entries
