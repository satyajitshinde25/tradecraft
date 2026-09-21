"""
Market Sprint — Deterministic Price Series Generator

Generates realistic price movements for 6 fictional companies across 97 ticks (0..96).
Uses a seeded random walk so prices are reproducible.
News events at specific ticks cause price jumps using canonical Reaction Profiles.
"""
import random

# Ticks when news is released (Canonical 14-headline timeline, 37.5s/tick for 1-hour contest)
NEWS_TICKS = {
    1: 10,   # T+06:15
    2: 15,   # T+09:22
    3: 24,   # T+15:00 (Scheduled - Consumer Confidence)
    4: 29,   # T+18:07
    5: 36,   # T+22:30 (Scheduled - Vaultline Earnings)
    6: 42,   # T+26:15
    7: 50,   # T+31:15
    8: 56,   # T+35:00
    9: 64,   # T+40:00 (Scheduled - MRB Rate Decision)
    10: 69,  # T+43:07
    11: 76,  # T+47:30
    12: 83,  # T+51:52
    13: 88,  # T+55:00
    14: 92,  # T+57:30
    15: -1,  # R1 Reserve (manually triggered only)
    16: -1,  # R2 Reserve (manually triggered only)
}

# Canonical Reaction profiles mapping (step offset -> cumulative percentage of total impact)
# STEP: 20%, 60%, 90%, 100%, 100%, 100%
# SPIKE-AND-FADE: 30%, 80%, 120%, 100%, 80%, 60%
# SLOW-BURN: 10%, 25%, 45%, 65%, 85%, 100%
REACTION_PROFILES = {
    "STEP": {0: 0.20, 1: 0.60, 2: 0.90, 3: 1.00, 4: 1.00, 5: 1.00},
    "SPIKE-AND-FADE": {0: 0.30, 1: 0.80, 2: 1.20, 3: 1.00, 4: 0.80, 5: 0.60},
    "SLOW-BURN": {0: 0.10, 1: 0.25, 2: 0.45, 3: 0.65, 4: 0.85, 5: 1.00},
}

# Organizer-Only Hidden Sensitivity Matrix
# Macro Drivers: RATES, OIL, DEMAND, SENTIMENT
SENSITIVITY_MATRIX = {
    "TAVR": {"RATES": 0, "OIL": 3, "DEMAND": 1, "SENTIMENT": 1},
    "AERV": {"RATES": -1, "OIL": -3, "DEMAND": 3, "SENTIMENT": 2},
    "VLTN": {"RATES": 3, "OIL": 0, "DEMAND": 2, "SENTIMENT": 2},
    "BRKW": {"RATES": -3, "OIL": -1, "DEMAND": 2, "SENTIMENT": 2},
    "LMRA": {"RATES": -2, "OIL": 0, "DEMAND": 1, "SENTIMENT": 3},
    "GRFD": {"RATES": 0, "OIL": -1, "DEMAND": 1, "SENTIMENT": -1},
}

# Canonical 6 Companies according to Market Sprint Spec Section 4
CANONICAL_COMPANIES = [
    {
        "ticker": "TAVR",
        "name": "Tavorin Energy",
        "sector": "Energy",
        "start_price": 84.50,
        "description": "A vertically integrated energy producer operating across exploration, refining, and distribution.",
    },
    {
        "ticker": "AERV",
        "name": "Aerovia Airlines",
        "sector": "Airlines",
        "start_price": 42.00,
        "description": "A leading regional carrier operating domestic and short-haul international flights.",
    },
    {
        "ticker": "VLTN",
        "name": "Vaultline Bank",
        "sector": "Banking",
        "start_price": 120.00,
        "description": "A major commercial and retail bank serving corporate, institutional, and private clients.",
    },
    {
        "ticker": "BRKW",
        "name": "Brickwell Developers",
        "sector": "Property & construction",
        "start_price": 65.25,
        "description": "A premier real estate developer focused on urban commercial complexes and large residential projects.",
    },
    {
        "ticker": "LMRA",
        "name": "Lumora Labs",
        "sector": "Technology/cloud software",
        "start_price": 150.00,
        "description": "A high-growth enterprise cloud software and analytics platform provider.",
    },
    {
        "ticker": "GRFD",
        "name": "Greenfield Foods",
        "sector": "Consumer staples",
        "start_price": 58.00,
        "description": "A defensive consumer goods manufacturer distributing essential food products and groceries.",
    },
]

# Define each event's impact on companies and which profile it uses.
# format: (event_number, ticker): (total_percentage_impact, profile_name)
NEWS_IMPACTS = {
    # 1. Tick 10 — Oil prices edge higher as fuel inventories fall
    (1, "TAVR"): (2.5, "STEP"),
    (1, "AERV"): (-1.5, "STEP"),

    # 2. Tick 15 — Aerovia signs code-share deal
    (2, "AERV"): (4.0, "STEP"),

    # 3. Tick 24 — Consumer confidence falls (Scheduled)
    (3, "GRFD"): (-1.5, "SLOW-BURN"),
    (3, "BRKW"): (-2.5, "SLOW-BURN"),
    (3, "AERV"): (-2.0, "SLOW-BURN"),

    # 4. Tick 29 — Unconfirmed takeover bid for Lumora Labs
    (4, "LMRA"): (8.0, "SPIKE-AND-FADE"),

    # 5. Tick 36 — Vaultline profit jumps 18% (Scheduled)
    (5, "VLTN"): (4.5, "STEP"),
    (5, "BRKW"): (1.0, "SLOW-BURN"),

    # 6. Tick 42 — Lumora takeover denial
    (6, "LMRA"): (-6.0, "STEP"),

    # 7. Tick 50 — Oil Producers cut output sharply
    (7, "TAVR"): (4.5, "STEP"),
    (7, "AERV"): (-3.0, "STEP"),
    (7, "GRFD"): (-1.0, "SLOW-BURN"),

    # 8. Tick 56 — Brokerage upgrades Brickwell
    (8, "BRKW"): (3.5, "SPIKE-AND-FADE"),

    # 9. Tick 64 — MRB raises rates by 0.50% (Scheduled surprise)
    (9, "VLTN"): (3.0, "STEP"),
    (9, "BRKW"): (-3.5, "STEP"),
    (9, "LMRA"): (-2.5, "STEP"),

    # 10. Tick 69 — Greenfield contamination recall
    (10, "GRFD"): (-5.0, "STEP"),

    # 11. Tick 76 — Global markets rally
    (11, "TAVR"): (1.5, "SLOW-BURN"),
    (11, "AERV"): (2.0, "SLOW-BURN"),
    (11, "VLTN"): (2.5, "SLOW-BURN"),
    (11, "BRKW"): (3.0, "SLOW-BURN"),
    (11, "LMRA"): (3.5, "SLOW-BURN"),
    (11, "GRFD"): (1.0, "SLOW-BURN"),

    # 12. Tick 83 — Windfall tax on energy
    (12, "TAVR"): (-6.0, "STEP"),

    # 13. Tick 88 — Oil supply restored
    (13, "TAVR"): (-3.5, "STEP"),
    (13, "AERV"): (2.5, "STEP"),

    # 14. Tick 92 — Vaultline lending probe
    (14, "VLTN"): (-5.5, "STEP"),
}


def generate_price_series(
    ticker: str,
    start_price: float,
    num_ticks: int = 97,
    seed: int = 42,
    base_volatility: float = 0.010,
) -> list[float]:
    """
    Generate a deterministic price series for a company across 97 ticks.
    Applies reaction profiles over 6 ticks for each news event, with fixed seeded noise
    and guardrails (price floor, price ceiling, single-tick movement bounds).
    """
    ticker_seed = seed + sum(ord(c) for c in ticker)
    rng = random.Random(ticker_seed)

    volatility_map = {
        "TAVR": 1.1,
        "AERV": 1.2,
        "VLTN": 0.8,
        "BRKW": 1.0,
        "LMRA": 1.3,
        "GRFD": 0.7,
    }
    vol_mult = volatility_map.get(ticker, 1.0)

    prices = [round(start_price, 2)]

    # Calculate tick-by-tick deterministic news impacts based on profiles
    tick_marginal_impacts = {i: 0.0 for i in range(num_ticks + 10)}

    for (evt_num, evt_ticker), (total_impact, profile_name) in NEWS_IMPACTS.items():
        if evt_ticker == ticker:
            release_tick = NEWS_TICKS[evt_num]
            if release_tick < 0:
                continue  # Reserve event, not baked into precomputed scheduled timeline
            profile = REACTION_PROFILES[profile_name]

            prev_cumulative = 0.0
            for step in range(6):
                target_tick = release_tick + step
                if target_tick < len(tick_marginal_impacts):
                    cumulative_pct = profile[step]
                    marginal_pct = cumulative_pct - prev_cumulative
                    tick_marginal_impacts[target_tick] += total_impact * marginal_pct
                    prev_cumulative = cumulative_pct

    for tick in range(1, num_ticks):
        prev = prices[-1]
        noise = rng.gauss(0, base_volatility * vol_mult)
        reversion = -0.001 * (prev - start_price) / start_price
        news_impact = tick_marginal_impacts.get(tick, 0.0) / 100.0

        raw_change = noise + reversion + news_impact
        # Guardrail: Maximum single-tick movement capped at ±12%
        bounded_change = max(-0.12, min(0.12, raw_change))

        new_price = prev * (1 + bounded_change)
        # Guardrail: Price floor (1.00) and ceiling (4x start price)
        new_price = max(1.0, min(start_price * 4.0, new_price))
        prices.append(round(new_price, 2))

    return prices


# ── Canonical News Headlines & Schedule ────────────────────────────

NEWS_EVENTS_DATA = [
    {
        "event_number": 1,
        "release_tick": 10,
        "time_offset": "T+06:15",
        "event_type": "SURPRISE",
        "headline": "Oil prices edge higher as fuel inventories fall.",
        "calendar_title": "Energy Inventory Report",
        "description": "Global fuel inventories have dropped below expected levels, pushing crude prices up across trading hubs.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR,AERV",
    },
    {
        "event_number": 2,
        "release_tick": 15,
        "time_offset": "T+09:22",
        "event_type": "SURPRISE",
        "headline": "Aerovia signs code-share deal with major overseas carrier.",
        "calendar_title": "Carrier Partnership Announcement",
        "description": "Aerovia Airlines expands its international reach through a new strategic code-share partnership.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "AERV",
    },
    {
        "event_number": 3,
        "release_tick": 24,
        "time_offset": "T+15:00",
        "event_type": "SCHEDULED",
        "headline": "Consumer confidence falls to 18-month low, missing forecasts.",
        "calendar_title": "Consumer Confidence",
        "description": "The latest sentiment index showed a sharp drop as consumers worry about living costs.",
        "forecast": "Forecast: Slight rise expected",
        "is_scheduled": True,
        "affected_tickers": "GRFD,BRKW,AERV",
    },
    {
        "event_number": 4,
        "release_tick": 29,
        "time_offset": "T+18:07",
        "event_type": "SURPRISE",
        "headline": "Unconfirmed: global tech group weighing takeover bid for Lumora Labs.",
        "calendar_title": "Technology Sector Acquisition Rumours",
        "description": "Market rumours suggest a major international technology conglomerate is preparing an all-cash offer for Lumora.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "LMRA",
    },
    {
        "event_number": 5,
        "release_tick": 36,
        "time_offset": "T+22:30",
        "event_type": "SCHEDULED",
        "headline": "Vaultline profit jumps 18%, dividend raised.",
        "calendar_title": "Vaultline Earnings",
        "description": "Vaultline Bank reported strong quarterly earnings, comfortably beating estimates, and increased its shareholder payout.",
        "forecast": "Forecast: Profit expected flat",
        "is_scheduled": True,
        "affected_tickers": "VLTN,BRKW",
    },
    {
        "event_number": 6,
        "release_tick": 42,
        "time_offset": "T+26:15",
        "event_type": "SURPRISE",
        "headline": "Lumora Labs says it has received no takeover approach.",
        "calendar_title": "Lumora Corporate Statement",
        "description": "In a brief statement to the exchange, Lumora management denied any ongoing acquisition discussions.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "LMRA",
    },
    {
        "event_number": 7,
        "release_tick": 50,
        "time_offset": "T+31:15",
        "event_type": "SURPRISE",
        "headline": "Oil Producers' Alliance agrees to cut output sharply.",
        "calendar_title": "Oil Alliance Supply Decision",
        "description": "Major oil-producing nations have unexpectedly agreed to reduce supply targets by 2 million barrels per day.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR,AERV,GRFD",
    },
    {
        "event_number": 8,
        "release_tick": 56,
        "time_offset": "T+35:00",
        "event_type": "SURPRISE",
        "headline": "Brokerage upgrades Brickwell to “Strong Buy”, calling shares undervalued.",
        "calendar_title": "Brokerage Equity Research",
        "description": "A prominent investment bank has raised its price target for Brickwell Developers by 40%.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "BRKW",
    },
    {
        "event_number": 9,
        "release_tick": 64,
        "time_offset": "T+40:00",
        "event_type": "SCHEDULED",
        "headline": "MRB raises interest rates by 0.50% in surprise move.",
        "calendar_title": "MRB Rate Decision",
        "description": "The Monetary Review Board shocked markets with a 50-basis-point hike to combat lingering inflation.",
        "forecast": "Forecast: Rates expected unchanged",
        "is_scheduled": True,
        "affected_tickers": "VLTN,BRKW,LMRA",
    },
    {
        "event_number": 10,
        "release_tick": 69,
        "time_offset": "T+43:07",
        "event_type": "SURPRISE",
        "headline": "Greenfield Foods pulls one snack line as a precaution over contamination reports.",
        "calendar_title": "Consumer Product Safety Notice",
        "description": "Following isolated consumer complaints, Greenfield has paused distribution of its popular snack line.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "GRFD",
    },
    {
        "event_number": 11,
        "release_tick": 76,
        "time_offset": "T+47:30",
        "event_type": "SURPRISE",
        "headline": "Global markets rally as trade talks progress.",
        "calendar_title": "International Trade Summit",
        "description": "Optimism returned to equity markets following positive signals from international trade negotiations.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR,AERV,VLTN,BRKW,LMRA,GRFD",
    },
    {
        "event_number": 12,
        "release_tick": 83,
        "time_offset": "T+51:52",
        "event_type": "SURPRISE",
        "headline": "Government proposes windfall tax on energy-sector profits.",
        "calendar_title": "Energy Fiscal Policy Leak",
        "description": "Draft legislation leaked today suggests a one-off levy on extraordinary profits recorded by oil and gas firms.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR",
    },
    {
        "event_number": 13,
        "release_tick": 88,
        "time_offset": "T+55:00",
        "event_type": "SURPRISE",
        "headline": "Oil Producers' Alliance reverses output cut; supply restored.",
        "calendar_title": "Alliance Policy Reversal",
        "description": "Under political pressure, the alliance reversed its earlier decision, immediately boosting global crude supply.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR,AERV",
    },
    {
        "event_number": 14,
        "release_tick": 92,
        "time_offset": "T+57:30",
        "event_type": "SURPRISE",
        "headline": "Regulator opens probe into Vaultline's lending practices.",
        "calendar_title": "Financial Conduct Authority Inquiry",
        "description": "The Financial Conduct Authority confirmed it is investigating Vaultline Bank over lending risk-management concerns.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "VLTN",
    },
    {
        "event_number": 15,
        "release_tick": -1,
        "time_offset": "RESERVE",
        "event_type": "RESERVE",
        "headline": "Retail sales rebound strongly.",
        "calendar_title": "Reserve: Retail Sales Data",
        "description": "Consumer spending has shown unexpected resilience in the latest data release.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "GRFD,BRKW",
    },
    {
        "event_number": 16,
        "release_tick": -1,
        "time_offset": "RESERVE",
        "event_type": "RESERVE",
        "headline": "MRB governor signals patience on interest rates.",
        "calendar_title": "Reserve: Central Bank Guidance",
        "description": "The central bank head indicated a pause in rate hikes is likely for the remainder of the year.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "VLTN,BRKW,LMRA",
    },
]
