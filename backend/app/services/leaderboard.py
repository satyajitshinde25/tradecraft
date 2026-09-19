"""
Market Sprint — Leaderboard Service (Admin-Only)

Ranking, eligibility check, and leaderboard snapshots.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import Team, TeamWallet, Holding, Order, OrderStatus, Game, LeaderboardSnapshot
from ..services.market import get_price_at_tick


def calculate_leaderboard(db: Session, game: Game, current_tick: int) -> list[dict]:
    """
    Calculate full leaderboard for all teams.
    Returns sorted list by portfolio value descending.
    """
    teams = db.query(Team).filter(Team.game_id == game.id, Team.is_active == True).all()
    entries = []

    for team in teams:
        wallet = db.query(TeamWallet).filter(TeamWallet.team_id == team.id).first()
        cash = wallet.cash_balance if wallet else 0.0
        starting = wallet.starting_balance if wallet else 10000.0

        # Holdings value
        holdings = db.query(Holding).filter(Holding.team_id == team.id).all()
        holdings_value = 0.0
        for h in holdings:
            if h.quantity > 0:
                price = get_price_at_tick(db, game, h.company_id, current_tick)
                if price:
                    holdings_value += h.quantity * price

        portfolio_value = round(cash + holdings_value, 2)
        profit_loss = round(portfolio_value - starting, 2)
        profit_loss_pct = round((profit_loss / starting) * 100, 2) if starting > 0 else 0

        # Trade stats
        trade_count = (
            db.query(func.count(Order.id))
            .filter(
                Order.team_id == team.id,
                Order.game_id == game.id,
                Order.status == OrderStatus.FILLED.value,
            )
            .scalar() or 0
        )

        companies_traded = (
            db.query(func.count(func.distinct(Order.company_id)))
            .filter(
                Order.team_id == team.id,
                Order.game_id == game.id,
                Order.status == OrderStatus.FILLED.value,
            )
            .scalar() or 0
        )

        is_eligible = trade_count >= 6 and companies_traded >= 3

        # Last order time
        last_order = (
            db.query(Order.submitted_at)
            .filter(Order.team_id == team.id, Order.game_id == game.id)
            .order_by(Order.submitted_at.desc())
            .first()
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
            "last_order_at": last_order[0].isoformat() if last_order and last_order[0] else None,
        })

    # Sort by portfolio value descending
    entries.sort(key=lambda x: x["portfolio_value"], reverse=True)

    # Assign ranks
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1

    return entries
