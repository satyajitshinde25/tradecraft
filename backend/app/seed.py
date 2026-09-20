"""
Market Sprint — Database Seeding Script

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

from app.database import engine, SessionLocal
from app.models import (
    Base, Game, Team, TeamCredential, Company, MarketPrice, MarketCandle,
    NewsEvent, TeamWallet, GameStatus
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
    print("Market Sprint -- Database Seeder")
    print("=" * 60)

    # Create all tables
    print("\n[1/7] Creating tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("  [OK] All tables created")

    db = SessionLocal()

    try:
        # ── 1. Create game ──────────────────────────────────────
        print("\n[2/7] Creating game...")
        game = Game(
            name="Market Sprint: Fictional Markets Edition",
            status=GameStatus.DRAFT.value,
            tick_seconds=75,
            starting_balance=10000.00,
            max_trades=22,
            buy_limit_percent=35.0,
            concentration_limit=60.0,
            trade_fee_percent=0.4,
            cooldown_seconds=7,
        )
        db.add(game)
        db.flush()
        print(f"  [OK] Game created: {game.id}")

        # ── 2. Create 25 teams ──────────────────────────────────
        print("\n[3/7] Creating 25 teams with hashed passwords...")
        teams = []
        for i in range(1, 26):
            team_code = f"TEAM-{i:02d}"
            team = Team(
                game_id=game.id,
                team_code=team_code,
                display_name=f"Team {i:02d}",
                is_active=True,
            )
            db.add(team)
            db.flush()

            # Create credential with bcrypt hash
            password = get_team_password(i)
            credential = TeamCredential(
                team_id=team.id,
                password_hash=bcrypt.hash(password),
            )
            db.add(credential)

            # Create wallet
            wallet = TeamWallet(
                team_id=team.id,
                cash_balance=10000.00,
                starting_balance=10000.00,
            )
            db.add(wallet)

            teams.append(team)
            print(f"  [OK] {team_code} (password: {password})")

        db.flush()

        # ── 3. Create 6 companies ───────────────────────────────
        print("\n[4/7] Creating 6 companies...")
        company_objects = {}
        for c in COMPANIES:
            company = Company(
                game_id=game.id,
                ticker=c["ticker"],
                name=c["name"],
                sector=c["sector"],
                start_price=c["start_price"],
                description=c["description"],
            )
            db.add(company)
            db.flush()
            company_objects[c["ticker"]] = company
            print(f"  [OK] {c['ticker']} - {c['name']} ({c['start_price']} V-Coins)")

        # ── 4. Generate & insert 582 prices ─────────────────────
        print("\n[5/7] Generating 582 market prices...")
        price_count = 0
        candle_count = 0

        for ticker, company in company_objects.items():
            start_price = next(c["start_price"] for c in COMPANIES if c["ticker"] == ticker)
            prices = generate_price_series(ticker, start_price, num_ticks=97, seed=42)

            for tick, price in enumerate(prices):
                mp = MarketPrice(
                    game_id=game.id,
                    company_id=company.id,
                    tick=tick,
                    price=price,
                )
                db.add(mp)
                price_count += 1

                # Generate candle data
                if tick == 0:
                    open_p = price
                else:
                    open_p = prices[tick - 1]
                close_p = price
                high_p = max(open_p, close_p)
                low_p = min(open_p, close_p)

                candle = MarketCandle(
                    game_id=game.id,
                    company_id=company.id,
                    tick=tick,
                    open_price=round(open_p, 2),
                    high_price=round(high_p, 2),
                    low_price=round(low_p, 2),
                    close_price=round(close_p, 2),
                )
                db.add(candle)
                candle_count += 1

            print(f"  [OK] {ticker}: {len(prices)} prices ({prices[0]} -> {prices[-1]})")

        print(f"  Total: {price_count} prices, {candle_count} candles")

        # ── 5. Create 14 news events + 2 reserve ─────────────────
        print("\n[6/7] Creating 16 news events...")
        for evt_data in NEWS_EVENTS_DATA:
            evt = NewsEvent(
                game_id=game.id,
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
            db.add(evt)
            label = "SCHEDULED" if evt_data["is_scheduled"] else ("RESERVE" if evt_data["event_type"] == "RESERVE" else "SURPRISE")
            tick_str = f"tick {evt_data['release_tick']:2d}" if evt_data['release_tick'] >= 0 else "reserve"
            print(f"  [OK] Event {evt_data['event_number']:2d} ({tick_str}) [{label}] {evt_data['headline'][:50]}...")

        # ── 6. Commit ───────────────────────────────────────────
        print("\n[7/7] Committing to database...")
        db.commit()
        print("  [OK] Database seeded successfully!")

        # ── Summary ─────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("SEED SUMMARY")
        print("=" * 60)
        print(f"  Game:      1")
        print(f"  Teams:     25")
        print(f"  Companies: 6")
        print(f"  Prices:    {price_count}")
        print(f"  Candles:   {candle_count}")
        print(f"  News:      {len(NEWS_EVENTS_DATA)}")
        print(f"  Wallets:   25")
        print(f"\n  Passwords: TEAM-XX -> sprint+XX (e.g., TEAM-01 -> sprint01)")
        print(f"  Admin:     ADMIN -> admin123")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\n  [ERROR] {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
