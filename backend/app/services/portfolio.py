"""
Market Sprint — Portfolio Service

Portfolio valuation, P/L calculation, and holdings summary.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import Team, TeamWallet, Holding, Company, Order, OrderStatus, Game
from ..services.market import get_price_at_tick


def get_portfolio(db: Session, game: Game, team: Team, current_tick: int) -> dict:
    """
    Calculate complete portfolio state for a team.
    """
    wallet = db.query(TeamWallet).filter(TeamWallet.team_id == team.id).first()
    cash = wallet.cash_balance if wallet else 0.0
    starting = wallet.starting_balance if wallet else 10000.0

    # Calculate holdings value
    holdings = (
        db.query(Holding, Company)
        .join(Company, Company.id == Holding.company_id)
        .filter(Holding.team_id == team.id)
        .all()
    )

    holdings_list = []
    total_holdings_value = 0.0

    for holding, company in holdings:
        if holding.quantity > 0:
            current_price = get_price_at_tick(db, game, company.id, current_tick) or 0
            market_value = round(holding.quantity * current_price, 2)
            cost_basis = round(holding.quantity * holding.average_cost, 2)
            unrealized = round(market_value - cost_basis, 2)
            unrealized_pct = round((unrealized / cost_basis) * 100, 2) if cost_basis > 0 else 0

            holdings_list.append({
                "ticker": company.ticker,
                "company_name": company.name,
                "quantity": holding.quantity,
                "average_cost": holding.average_cost,
                "current_price": current_price,
                "market_value": market_value,
                "unrealized_pl": unrealized,
                "unrealized_pl_percent": unrealized_pct,
            })
            total_holdings_value += market_value

    # Pending orders: include reserved cash for pending buys so portfolio value remains continuous
    pending_buys = (
        db.query(Order)
        .filter(
            Order.team_id == team.id,
            Order.game_id == game.id,
            Order.status == OrderStatus.PENDING.value,
            Order.side == "BUY",
        )
        .all()
    )
    pending_buy_value = sum(o.gross_value or 0.0 for o in pending_buys)

    portfolio_value = round(cash + total_holdings_value + pending_buy_value, 2)
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

    return {
        "team_code": team.team_code,
        "display_name": team.display_name,
        "cash": cash,
        "holdings_value": round(total_holdings_value, 2),
        "portfolio_value": portfolio_value,
        "starting_balance": starting,
        "profit_loss": profit_loss,
        "profit_loss_percent": profit_loss_pct,
        "trades_used": trade_count,
        "max_trades": game.max_trades,
        "companies_traded": companies_traded,
        "is_eligible": is_eligible,
        "holdings": holdings_list,
    }
