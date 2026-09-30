from __future__ import annotations
"""
Market Sprint — Portfolio Service (MongoDB)

Portfolio valuation, P/L calculation, and holdings summary.
"""
from pymongo.database import Database
from ..models import to_doc, OrderStatus
from ..services.market import get_price_at_tick


def get_portfolio(db: Database, game, team, current_tick: int) -> dict:
    """
    Calculate complete portfolio state for a team.
    """
    wallet = to_doc(db.team_wallets.find_one({"team_id": team.id}))
    cash = wallet.cash_balance if wallet else 0.0
    starting = wallet.starting_balance if wallet else 10000.0

    # Calculate holdings value
    holdings_list = []
    total_holdings_value = 0.0

    holdings = list(db.holdings.find({"team_id": team.id}))
    for h_doc in holdings:
        h = to_doc(h_doc)
        if h.quantity > 0:
            company = to_doc(db.companies.find_one({"_id": h.company_id}))
            if not company:
                continue

            current_price = get_price_at_tick(db, game, company.id, current_tick) or 0
            market_value = round(h.quantity * current_price, 2)
            cost_basis = round(h.quantity * h.average_cost, 2)
            unrealized = round(market_value - cost_basis, 2)
            unrealized_pct = round((unrealized / cost_basis) * 100, 2) if cost_basis > 0 else 0

            holdings_list.append({
                "ticker": company.ticker,
                "company_name": company.name,
                "quantity": h.quantity,
                "average_cost": h.average_cost,
                "current_price": current_price,
                "market_value": market_value,
                "unrealized_pl": unrealized,
                "unrealized_pl_percent": unrealized_pct,
            })
            total_holdings_value += market_value

    # Pending orders: include reserved cash for pending buys so portfolio value remains continuous
    pending_buys = list(db.orders.find({
        "team_id": team.id,
        "game_id": game.id,
        "status": OrderStatus.PENDING.value,
        "side": "BUY",
    }))
    pending_buy_value = sum(o.get("gross_value", 0.0) or 0.0 for o in pending_buys)

    portfolio_value = round(cash + total_holdings_value + pending_buy_value, 2)
    profit_loss = round(portfolio_value - starting, 2)
    profit_loss_pct = round((profit_loss / starting) * 100, 2) if starting > 0 else 0

    # Trade stats
    trade_count = db.orders.count_documents({
        "team_id": team.id,
        "game_id": game.id,
        "status": OrderStatus.FILLED.value,
    })

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
