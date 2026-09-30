from __future__ import annotations
"""
Market Sprint — Database Seeding Script (MongoDB)

Seeds the database with:
- 1 game
- 25 teams with bcrypt-hashed passwords
- 6 fictional companies
- 582 locked market prices (97 ticks × 6 companies)
- 582 candle records derived from prices
- 14 news events
- 25 team wallets at 10,000 V-Coins
"""
import sys
import os

# Ensure the backend directory is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db, ensure_indexes
from app.models import (
    make_game, make_team, make_team_credential, make_company,
    make_market_price, make_market_candle, make_news_event,
    make_team_wallet, GameStatus
)
from app.price_generator import generate_price_series, NEWS_EVENTS_DATA, CANONICAL_COMPANIES
from passlib.hash import bcrypt

COMPANIES = CANONICAL_COMPANIES

# ── Team passwords ─────────────────────────────────────────────────
# Format: TEAM-XX password is "sprint" + XX (e.g., TEAM-01 → "sprint01")
# These are fixed by the organizer and printed on team cards.

def get_team_password(team_number: int) -> str:
    return f"sprint{team_number:02d}"


def seed_database():
    """Run the full seed process."""
    print("=" * 60)
    print("Market Sprint -- Database Seeder (MongoDB)")
    print("=" * 60)

    db = get_db()

    # Drop all collections for a clean start
    print("\n[1/7] Dropping existing collections...")
    for col_name in db.list_collection_names():
        db.drop_collection(col_name)
    print("  [OK] All collections dropped")

    # Create indexes
    print("\n[1.5/7] Creating indexes...")
    ensure_indexes()
    print("  [OK] Indexes created")

    try:
        # ── 1. Create game ──────────────────────────────────────
        print("\n[2/7] Creating game...")
        game = make_game(
            name="Market Sprint: Fictional Markets Edition",
            status=GameStatus.DRAFT.value,
            tick_seconds=37.5,
            starting_balance=10000.00,
            max_trades=22,
            buy_limit_percent=35.0,
            concentration_limit=60.0,
            trade_fee_percent=0.4,
            cooldown_seconds=7,
        )
        db.games.insert_one(game)
        game_id = game["_id"]
        print(f"  [OK] Game created: {game_id}")

        # ── 2. Create 25 teams ──────────────────────────────────
        print("\n[3/7] Creating 25 teams with hashed passwords...")
        team_docs = []
        credential_docs = []
        wallet_docs = []

        for i in range(1, 26):
            team_code = f"TEAM-{i:02d}"
            team = make_team(
                game_id=game_id,
                team_code=team_code,
                display_name=f"Team {i:02d}",
                is_active=True,
            )
            team_docs.append(team)

            # Create credential with bcrypt hash
            password = get_team_password(i)
            credential = make_team_credential(
                team_id=team["_id"],
                password_hash=bcrypt.hash(password),
            )
            credential_docs.append(credential)

            # Create wallet
            wallet = make_team_wallet(
                team_id=team["_id"],
                cash_balance=10000.00,
                starting_balance=10000.00,
            )
            wallet_docs.append(wallet)

            print(f"  [OK] {team_code} (password: {password})")

        db.teams.insert_many(team_docs)
        db.team_credentials.insert_many(credential_docs)
        db.team_wallets.insert_many(wallet_docs)

        # ── 3. Create 6 companies ───────────────────────────────
        print("\n[4/7] Creating 6 companies...")
        company_objects = {}
        company_docs = []
        for c in COMPANIES:
            company = make_company(
                game_id=game_id,
                ticker=c["ticker"],
                name=c["name"],
                sector=c["sector"],
                start_price=c["start_price"],
                description=c["description"],
            )
            company_docs.append(company)
            company_objects[c["ticker"]] = company
            print(f"  [OK] {c['ticker']} - {c['name']} ({c['start_price']} V-Coins)")

        db.companies.insert_many(company_docs)

        # ── 4. Generate & insert 582 prices ─────────────────────
        print("\n[5/7] Generating 582 market prices...")
        price_docs = []
        candle_docs = []

        for ticker, company in company_objects.items():
            start_price = next(c["start_price"] for c in COMPANIES if c["ticker"] == ticker)
            prices = generate_price_series(ticker, start_price, num_ticks=97, seed=42)

            for tick, price in enumerate(prices):
                mp = make_market_price(
                    game_id=game_id,
                    company_id=company["_id"],
                    tick=tick,
                    price=price,
                )
                price_docs.append(mp)

                # Generate candle data
                if tick == 0:
                    open_p = price
                else:
                    open_p = prices[tick - 1]
                close_p = price
                high_p = max(open_p, close_p)
                low_p = min(open_p, close_p)

                candle = make_market_candle(
                    game_id=game_id,
                    company_id=company["_id"],
                    tick=tick,
                    open_price=round(open_p, 2),
                    high_price=round(high_p, 2),
                    low_price=round(low_p, 2),
                    close_price=round(close_p, 2),
                )
                candle_docs.append(candle)

            print(f"  [OK] {ticker}: {len(prices)} prices ({prices[0]} -> {prices[-1]})")

        db.market_prices.insert_many(price_docs)
        db.market_candles.insert_many(candle_docs)
        print(f"  Total: {len(price_docs)} prices, {len(candle_docs)} candles")

        # ── 5. Create 14 news events + 2 reserve ─────────────────
        print("\n[6/7] Creating 16 news events...")
        news_docs = []
        for evt_data in NEWS_EVENTS_DATA:
            evt = make_news_event(
                game_id=game_id,
                event_number=evt_data["event_number"],
                release_tick=evt_data["release_tick"],
                event_type=evt_data["event_type"],
                headline=evt_data["headline"],
                calendar_title=evt_data.get("calendar_title"),
                time_offset=evt_data.get("time_offset"),
                description=evt_data["description"],
                forecast=evt_data.get("forecast"),
                affected_tickers=evt_data.get("affected_tickers"),
                is_scheduled=evt_data["is_scheduled"],
                released=False,
            )
            news_docs.append(evt)
            label = "SCHEDULED" if evt_data["is_scheduled"] else ("RESERVE" if evt_data["event_type"] == "RESERVE" else "SURPRISE")
            tick_str = f"tick {evt_data['release_tick']:2d}" if evt_data['release_tick'] >= 0 else "reserve"
            print(f"  [OK] Event {evt_data['event_number']:2d} ({tick_str}) [{label}] {evt_data['headline'][:50]}...")

        db.news_events.insert_many(news_docs)

        # ── Summary ─────────────────────────────────────────────
        print("\n[7/7] Done!")
        print("\n" + "=" * 60)
        print("SEED SUMMARY")
        print("=" * 60)
        print(f"  Game:      1")
        print(f"  Teams:     25")
        print(f"  Companies: 6")
        print(f"  Prices:    {len(price_docs)}")
        print(f"  Candles:   {len(candle_docs)}")
        print(f"  News:      {len(NEWS_EVENTS_DATA)}")
        print(f"  Wallets:   25")
        print(f"\n  Passwords: TEAM-XX -> sprint+XX (e.g., TEAM-01 -> sprint01)")
        print(f"  Admin:     ADMIN -> admin123")
        print("=" * 60)

    except Exception as e:
        print(f"\n  [ERROR] {e}")
        raise


if __name__ == "__main__":
    seed_database()
