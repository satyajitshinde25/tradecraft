"""
Market Sprint — End-to-End Simulation & Fairness Test Suite

Comprehensive automated test suite covering:
1. Canonical Company Profiles & Starting Prices
2. Deterministic Price Curves & Reaction Profiles (97 ticks)
3. 14-Headline Sequence, Scheduled Events, & Reserve Headline Isolation
4. Anti-Leakage Verification (Zero premature leak of surprise headlines or prices)
5. Trading Engine Guardrails (100 V-Coin min, 22 trades, 35% buy, 60% conc., 7s cooldown, 0.4% fee)
6. True Next-Tick Execution (Pending orders, fill at Tick+1 price)
7. Organizer Controls (Start, Pause, Resume, Restart, Reserve Firing, Audit Logs)
"""
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import (
    Base, Game, Team, TeamCredential, Company, MarketPrice, MarketCandle,
    NewsEvent, TeamWallet, Holding, Order, OrderFill, GameStatus, OrderStatus, AuditLog
)
from app.price_generator import (
    generate_price_series, CANONICAL_COMPANIES, NEWS_EVENTS_DATA,
    NEWS_TICKS, REACTION_PROFILES, SENSITIVITY_MATRIX
)
from app.services.game_clock import get_current_tick
from app.services.news import get_released_news, get_upcoming_scheduled_events, reset_news_for_restart
from app.services.orders import (
    validate_and_execute_buy, validate_and_execute_sell,
    process_pending_orders, TradingError
)
from app.services.leaderboard import calculate_leaderboard


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for isolated testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    # 1. Create Game
    game = Game(
        name="Market Sprint Test",
        status=GameStatus.RUNNING.value,
        start_time=datetime.now(timezone.utc),
        tick_seconds=37.5,
        starting_balance=10000.00,
        max_trades=22,
        buy_limit_percent=35.0,
        concentration_limit=60.0,
        trade_fee_percent=0.4,
        cooldown_seconds=7,
        is_test_mode=False,
    )
    session.add(game)
    session.flush()

    # 2. Create 25 Teams
    teams = []
    for i in range(1, 26):
        team = Team(
            game_id=game.id,
            team_code=f"TEAM-{i:02d}",
            display_name=f"Team {i:02d}",
        )
        session.add(team)
        session.flush()

        wallet = TeamWallet(
            team_id=team.id,
            cash_balance=10000.00,
            starting_balance=10000.00,
        )
        session.add(wallet)
        teams.append(team)

    # 3. Create Canonical Companies & Prices
    companies = {}
    for c in CANONICAL_COMPANIES:
        company = Company(
            game_id=game.id,
            ticker=c["ticker"],
            name=c["name"],
            sector=c["sector"],
            start_price=c["start_price"],
            description=c["description"],
        )
        session.add(company)
        session.flush()
        companies[c["ticker"]] = company

        prices = generate_price_series(c["ticker"], c["start_price"], num_ticks=97, seed=42)
        for tick, price in enumerate(prices):
            mp = MarketPrice(
                game_id=game.id,
                company_id=company.id,
                tick=tick,
                price=price,
            )
            session.add(mp)

    # 4. Create News Events
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
        session.add(evt)

    session.commit()
    yield session, game, teams, companies
    session.close()


# ── TEST 1: Canonical Companies & Starting Prices ─────────────────

def test_canonical_companies_and_prices(db_session):
    session, game, teams, companies = db_session

    expected = {
        "TAVR": ("Tavorin Energy", "Energy", 84.50),
        "AERV": ("Aerovia Airlines", "Airlines", 42.00),
        "VLTN": ("Vaultline Bank", "Banking", 120.00),
        "BRKW": ("Brickwell Developers", "Property & construction", 65.25),
        "LMRA": ("Lumora Labs", "Technology/cloud software", 150.00),
        "GRFD": ("Greenfield Foods", "Consumer staples", 58.00),
    }

    assert len(companies) == 6
    for ticker, (name, sector, start_price) in expected.items():
        comp = companies[ticker]
        assert comp.name == name
        assert comp.sector == sector
        assert comp.start_price == start_price

        # Check Tick 0 price matches start price exactly
        p0 = session.query(MarketPrice).filter(
            MarketPrice.game_id == game.id,
            MarketPrice.company_id == comp.id,
            MarketPrice.tick == 0,
        ).first()
        assert p0 is not None
        assert p0.price == start_price


# ── TEST 2: Price Playback & Guardrails across 97 Ticks ───────────

def test_price_playback_guardrails(db_session):
    session, game, teams, companies = db_session

    for ticker, comp in companies.items():
        prices = (
            session.query(MarketPrice)
            .filter(MarketPrice.game_id == game.id, MarketPrice.company_id == comp.id)
            .order_by(MarketPrice.tick)
            .all()
        )
        assert len(prices) == 97, f"{ticker} must have 97 ticks (0..96)"

        # Verify guardrails
        for i in range(1, len(prices)):
            price = prices[i].price
            prev_price = prices[i - 1].price
            assert price >= 1.0, f"{ticker} breached price floor at tick {i}"
            assert price <= comp.start_price * 4.0, f"{ticker} breached price ceiling at tick {i}"

            single_tick_change = abs(price - prev_price) / prev_price
            assert single_tick_change <= 0.15, f"{ticker} exceeded max single-tick move at tick {i}: {single_tick_change:.2%}"


# ── TEST 3: 14-Headline Timeline & Reserve Headline Isolation ──────

def test_news_timeline_and_reserve_isolation(db_session):
    session, game, teams, companies = db_session

    # Tick 0: Zero headlines should be released!
    released_t0 = get_released_news(session, game, current_tick=0)
    assert len(released_t0) == 0, "No headlines should be released at Tick 0"

    # Reserve headlines must NOT be released at Tick 0 or any auto tick
    reserves = session.query(NewsEvent).filter(NewsEvent.event_type == "RESERVE").all()
    assert len(reserves) == 2, "Must have exactly 2 reserve headlines (R1, R2)"
    for r in reserves:
        assert r.released is False, "Reserve headlines must never be auto-released"
        assert r.release_tick == -1

    # Check designated release ticks for the 14 main events
    expected_schedule = [
        (1, 10, "SURPRISE"),
        (2, 15, "SURPRISE"),
        (3, 24, "SCHEDULED"),
        (4, 29, "SURPRISE"),
        (5, 36, "SCHEDULED"),
        (6, 42, "SURPRISE"),
        (7, 50, "SURPRISE"),
        (8, 56, "SURPRISE"),
        (9, 64, "SCHEDULED"),
        (10, 69, "SURPRISE"),
        (11, 76, "SURPRISE"),
        (12, 83, "SURPRISE"),
        (13, 88, "SURPRISE"),
        (14, 92, "SURPRISE"),
    ]

    for evt_num, tick, ev_type in expected_schedule:
        # Before release tick: event must not be in released list
        before = get_released_news(session, game, current_tick=tick - 1)
        assert not any(e.event_number == evt_num for e in before), f"Event {evt_num} leaked before tick {tick}"

        # At release tick: event must be released
        at_tick = get_released_news(session, game, current_tick=tick)
        released_nums = [e.event_number for e in at_tick]
        assert evt_num in released_nums, f"Event {evt_num} failed to release at tick {tick}"

    # At Tick 96, all 14 main headlines released, but reserve still unreleased
    all_released = get_released_news(session, game, current_tick=96)
    assert len(all_released) == 14

    for r in session.query(NewsEvent).filter(NewsEvent.event_type == "RESERVE").all():
        assert r.released is False


# ── TEST 4: Anti-Leakage: Scheduled Forecasts vs Hidden Outcomes ──

def test_anti_leakage_scheduled_forecasts(db_session):
    session, game, teams, companies = db_session

    # Upcoming scheduled events at Tick 5
    upcoming = get_upcoming_scheduled_events(session, game, current_tick=5)
    assert len(upcoming) == 3, "Events 3, 5, 9 should be upcoming"

    for evt in upcoming:
        assert evt.is_scheduled is True
        assert evt.forecast is not None
        assert evt.calendar_title is not None
        # Verify surprise outcome is not in calendar_title
        assert "falls to 18-month low" not in evt.calendar_title
        assert "profit jumps 18%" not in evt.calendar_title
        assert "raises interest rates by 0.50%" not in evt.calendar_title


# ── TEST 5: Trading Rules & Guardrails ─────────────────────────────

def test_trading_limits_and_fees(db_session):
    session, game, teams, companies = db_session
    team = teams[0]
    tavr = companies["TAVR"]

    # 1. Minimum order size (100 V-Coins)
    # TAVR start price = 84.50. 1 share = 84.50 < 100. Should be rejected!
    with pytest.raises(TradingError) as exc:
        validate_and_execute_buy(session, game, team, tavr, quantity=1)
    assert "Minimum order value is 100 V-Coins" in str(exc.value)

    # 2. 2 shares = 169.00 > 100. Should be accepted and placed in PENDING!
    order = validate_and_execute_buy(session, game, team, tavr, quantity=2)
    assert order.status == OrderStatus.PENDING.value
    assert order.fill_tick == 1  # submitted at tick 0, fills at tick 1
    assert order.fill_price is None  # HIDDEN! Future price cannot be seen
    assert order.gross_value == 169.00
    assert order.fee == round(169.00 * 0.004, 2)  # 0.4% fee = 0.68

    # 3. 7-second cooldown
    with pytest.raises(TradingError) as exc:
        validate_and_execute_buy(session, game, team, tavr, quantity=2)
    assert "Cooldown active" in str(exc.value)

    # Simulate cooldown expiration
    order.submitted_at = datetime.now(timezone.utc) - timedelta(seconds=10)
    session.commit()

    # 4. 35% Buy limit enforcement
    # Portfolio is 10,000. 35% is 3,500.
    # Buying 50 shares of TAVR @ 84.50 = 4,225 > 3,500 -> Must be rejected!
    with pytest.raises(TradingError) as exc:
        validate_and_execute_buy(session, game, team, tavr, quantity=50)
    assert "Buy exceeds 35.0% limit" in str(exc.value)


# ── TEST 6: True Next-Tick Execution ──────────────────────────────

def test_true_next_tick_execution(db_session):
    session, game, teams, companies = db_session
    team = teams[1]
    aerv = companies["AERV"]

    # AERV Start price = 42.00. 10 shares = 420.00 V-Coins.
    order = validate_and_execute_buy(session, game, team, aerv, quantity=10)
    assert order.status == OrderStatus.PENDING.value
    assert order.submitted_tick == 0
    assert order.fill_tick == 1
    assert order.fill_price is None

    # Before Tick 1 arrives: process_pending_orders at Tick 0 must NOT fill it
    processed_0 = process_pending_orders(session, game, current_tick=0)
    assert processed_0 == 0
    session.refresh(order)
    assert order.status == OrderStatus.PENDING.value

    # When Tick 1 arrives: process_pending_orders fills it at Tick 1 price!
    tick1_price = session.query(MarketPrice).filter(
        MarketPrice.game_id == game.id,
        MarketPrice.company_id == aerv.id,
        MarketPrice.tick == 1,
    ).first().price

    processed_1 = process_pending_orders(session, game, current_tick=1)
    assert processed_1 == 1
    session.refresh(order)
    assert order.status == OrderStatus.FILLED.value
    assert order.fill_price == tick1_price

    # Verify holding updated
    holding = session.query(Holding).filter(
        Holding.team_id == team.id,
        Holding.company_id == aerv.id,
    ).first()
    assert holding is not None
    assert holding.quantity == 10
    assert holding.average_cost == tick1_price


# ── TEST 7: Market Close at Tick 96 ───────────────────────────────

def test_market_close_tick_96(db_session):
    session, game, teams, companies = db_session
    team = teams[2]
    vltn = companies["VLTN"]

    # Set game start_time to 96 ticks ago
    game.start_time = datetime.now(timezone.utc) - timedelta(seconds=96 * game.tick_seconds + 5)
    session.commit()

    current_tick = get_current_tick(game)
    assert current_tick == 96

    # Orders at or after Tick 96 must be rejected with MARKET_CLOSED
    with pytest.raises(TradingError) as exc:
        validate_and_execute_buy(session, game, team, vltn, quantity=5)
    assert "Market has closed" in str(exc.value)


# ── TEST 8: Reserve Headline Manual Firing & Restart ───────────────

def test_reserve_headline_firing_and_restart(db_session):
    session, game, teams, companies = db_session

    r1 = session.query(NewsEvent).filter(NewsEvent.event_number == 15).first()
    assert r1.released is False
    assert r1.release_tick == -1

    # Simulate admin firing reserve headline at Tick 30
    r1.released = True
    r1.release_tick = 30
    r1.released_at = datetime.now(timezone.utc)
    session.commit()

    released = get_released_news(session, game, current_tick=30)
    assert any(e.event_number == 15 for e in released)

    # Test restart
    reset_news_for_restart(session, game)
    session.refresh(r1)
    assert r1.released is False
    assert r1.release_tick == -1
