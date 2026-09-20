"""
Market Sprint — Deterministic Price Series Generator

Generates realistic price movements for 6 fictional companies across 97 ticks.
Uses a seeded random walk so prices are reproducible.
News events at specific ticks cause price jumps using Reaction Profiles.
"""
import random

# Ticks when news is released
NEWS_TICKS = {
    1: 10, 2: 15, 3: 24, 4: 29, 5: 36,
    6: 42, 7: 50, 8: 56, 9: 64, 10: 69,
    11: 76, 12: 83, 13: 88, 14: 92,
    15: 0, # R1 Reserve (manually triggered, not in auto ticks)
    16: 0, # R2 Reserve
}

# Reaction profiles mapping (step offset -> cumulative percentage of total impact)
REACTION_PROFILES = {
    "STEP": {0: 0.20, 1: 0.60, 2: 0.90, 3: 1.00, 4: 1.00, 5: 1.00},
    "SPIKE-AND-FADE": {0: 0.30, 1: 0.80, 2: 1.20, 3: 1.00, 4: 0.80, 5: 0.60},
    "SLOW-BURN": {0: 0.10, 1: 0.25, 2: 0.45, 3: 0.65, 4: 0.85, 5: 1.00}
}

# Define each event's impact on companies and which profile it uses.
# format: (event_number, ticker): (total_percentage_impact, profile_name)
NEWS_IMPACTS = {
    # 1. Tick 10 — Oil prices edge higher
    (1, "TAVR"): (2.5, "STEP"),
    (1, "AERV"): (-1.5, "STEP"),
    
    # 2. Tick 15 — Aerovia code-share
    (2, "AERV"): (4.0, "STEP"),
    
    # 3. Tick 24 — Consumer confidence falls (Scheduled)
    (3, "GRFD"): (-1.5, "SLOW-BURN"),
    (3, "BRKW"): (-2.5, "SLOW-BURN"),
    (3, "AERV"): (-2.0, "SLOW-BURN"),
    
    # 4. Tick 29 — Unconfirmed takeover bid for Lumora
    (4, "LMRA"): (8.0, "SPIKE-AND-FADE"),
    
    # 5. Tick 36 — Vaultline profit jumps (Scheduled)
    (5, "VLTN"): (4.5, "STEP"),
    (5, "BRKW"): (1.0, "SLOW-BURN"),
    
    # 6. Tick 42 — Lumora takeover denial
    (6, "LMRA"): (-6.0, "STEP"), # Crushes the remaining spike
    
    # 7. Tick 50 — Oil Producers cut output
    (7, "TAVR"): (4.5, "STEP"),
    (7, "AERV"): (-3.0, "STEP"),
    (7, "GRFD"): (-1.0, "SLOW-BURN"),
    
    # 8. Tick 56 — Brokerage upgrades Brickwell
    (8, "BRKW"): (3.5, "SPIKE-AND-FADE"),
    
    # 9. Tick 64 — MRB raises rates (Scheduled)
    (9, "VLTN"): (3.0, "STEP"),
    (9, "BRKW"): (-3.5, "STEP"),
    (9, "LMRA"): (-2.5, "STEP"),
    
    # 10. Tick 69 — Greenfield contamination
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
    
    # 14. Tick 92 — Vaultline probe
    (14, "VLTN"): (-5.5, "STEP"),
}

def generate_price_series(
    ticker: str,
    start_price: float,
    num_ticks: int = 97,
    seed: int = 42,
    base_volatility: float = 0.012,
) -> list[float]:
    """
    Generate a deterministic price series for a company.
    Applies reaction profiles over 6 ticks for each news event.
    """
    ticker_seed = seed + sum(ord(c) for c in ticker)
    rng = random.Random(ticker_seed)

    volatility_map = {
        "TAVR": 1.2, "AERV": 1.3, "VLTN": 0.8,
        "BRKW": 1.0, "LMRA": 1.4, "GRFD": 0.7,
    }
    vol_mult = volatility_map.get(ticker, 1.0)

    prices = [round(start_price, 2)]

    # Calculate tick-by-tick deterministic news impacts based on profiles
    # tick_impacts[tick] = total news-driven % change to apply AT this tick (marginal)
    tick_marginal_impacts = {i: 0.0 for i in range(num_ticks + 10)}
    
    for (evt_num, evt_ticker), (total_impact, profile_name) in NEWS_IMPACTS.items():
        if evt_ticker == ticker:
            release_tick = NEWS_TICKS[evt_num]
            profile = REACTION_PROFILES[profile_name]
            
            prev_cumulative = 0.0
            for step in range(6):
                target_tick = release_tick + step
                if target_tick < len(tick_marginal_impacts):
                    cumulative_pct = profile[step]
                    marginal_pct = cumulative_pct - prev_cumulative
                    tick_marginal_impacts[target_tick] += (total_impact * marginal_pct)
                    prev_cumulative = cumulative_pct

    for tick in range(1, num_ticks):
        prev = prices[-1]
        noise = rng.gauss(0, base_volatility * vol_mult)
        reversion = -0.001 * (prev - start_price) / start_price
        news_impact = tick_marginal_impacts.get(tick, 0.0) / 100.0

        change = noise + reversion + news_impact
        new_price = prev * (1 + change)
        new_price = max(1.0, new_price)
        prices.append(round(new_price, 2))

    return prices


# ── News Headlines ─────────────────────────────────────────────────

NEWS_EVENTS_DATA = [
    {
        "event_number": 1,
        "release_tick": 10,
        "event_type": "SURPRISE",
        "headline": "Oil prices edge higher as fuel inventories fall.",
        "description": "Global fuel inventories have dropped below expected levels, pushing crude prices up across trading hubs.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR,AERV",
    },
    {
        "event_number": 2,
        "release_tick": 15,
        "event_type": "SURPRISE",
        "headline": "Aerovia signs code-share deal with major overseas carrier.",
        "description": "Aerovia Airlines expands its international reach through a new strategic code-share partnership.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "AERV",
    },
    {
        "event_number": 3,
        "release_tick": 24,
        "event_type": "SCHEDULED",
        "headline": "Consumer confidence falls to 18-month low, missing forecasts.",
        "description": "The latest sentiment index showed a sharp drop as consumers worry about living costs.",
        "forecast": "Forecast: Slight rise expected",
        "is_scheduled": True,
        "affected_tickers": "GRFD,BRKW,AERV",
    },
    {
        "event_number": 4,
        "release_tick": 29,
        "event_type": "SURPRISE",
        "headline": "Unconfirmed: global tech group weighing takeover bid for Lumora Labs.",
        "description": "Market rumours suggest a major international technology conglomerate is preparing an all-cash offer for Lumora.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "LMRA",
    },
    {
        "event_number": 5,
        "release_tick": 36,
        "event_type": "SCHEDULED",
        "headline": "Vaultline profit jumps 18%, dividend raised.",
        "description": "Vaultline Bank reported strong quarterly earnings, comfortably beating estimates, and increased its shareholder payout.",
        "forecast": "Forecast: Profit expected flat",
        "is_scheduled": True,
        "affected_tickers": "VLTN,BRKW",
    },
    {
        "event_number": 6,
        "release_tick": 42,
        "event_type": "SURPRISE",
        "headline": "Lumora Labs says it has received no takeover approach.",
        "description": "In a brief statement to the exchange, Lumora management denied any ongoing acquisition discussions.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "LMRA",
    },
    {
        "event_number": 7,
        "release_tick": 50,
        "event_type": "SURPRISE",
        "headline": "Oil Producers' Alliance agrees to cut output sharply.",
        "description": "Major oil-producing nations have unexpectedly agreed to reduce supply targets by 2 million barrels per day.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR,AERV,GRFD",
    },
    {
        "event_number": 8,
        "release_tick": 56,
        "event_type": "SURPRISE",
        "headline": "Brokerage upgrades Brickwell to “Strong Buy”, calling shares undervalued.",
        "description": "A prominent investment bank has raised its price target for Brickwell Developers by 40%.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "BRKW",
    },
    {
        "event_number": 9,
        "release_tick": 64,
        "event_type": "SCHEDULED",
        "headline": "MRB raises interest rates by 0.50% in surprise move.",
        "description": "The Monetary Review Board shocked markets with a 50-basis-point hike to combat lingering inflation.",
        "forecast": "Forecast: Rates expected unchanged",
        "is_scheduled": True,
        "affected_tickers": "VLTN,BRKW,LMRA",
    },
    {
        "event_number": 10,
        "release_tick": 69,
        "event_type": "SURPRISE",
        "headline": "Greenfield Foods pulls one snack line as a precaution over contamination reports.",
        "description": "Following isolated consumer complaints, Greenfield has paused distribution of its popular cereal bar.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "GRFD",
    },
    {
        "event_number": 11,
        "release_tick": 76,
        "event_type": "SURPRISE",
        "headline": "Global markets rally as trade talks progress.",
        "description": "Optimism returned to equity markets following positive signals from international trade negotiations.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR,AERV,VLTN,BRKW,LMRA,GRFD",
    },
    {
        "event_number": 12,
        "release_tick": 83,
        "event_type": "SURPRISE",
        "headline": "Government proposes windfall tax on energy-sector profits.",
        "description": "Draft legislation leaked today suggests a one-off levy on extraordinary profits recorded by oil and gas firms.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR",
    },
    {
        "event_number": 13,
        "release_tick": 88,
        "event_type": "SURPRISE",
        "headline": "Oil Producers' Alliance reverses output cut; supply restored.",
        "description": "Under political pressure, the alliance reversed its earlier decision, immediately boosting global crude supply.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR,AERV",
    },
    {
        "event_number": 14,
        "release_tick": 92,
        "event_type": "SURPRISE",
        "headline": "Regulator opens probe into Vaultline's lending practices.",
        "description": "The Financial Conduct Authority confirmed it is investigating Vaultline Bank over compliance and risk-management concerns.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "VLTN",
    },
    {
        "event_number": 15,
        "release_tick": 0,
        "event_type": "RESERVE",
        "headline": "Retail sales rebound strongly.",
        "description": "Consumer spending has shown unexpected resilience in the latest data release.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "GRFD,BRKW",
    },
    {
        "event_number": 16,
        "release_tick": 0,
        "event_type": "RESERVE",
        "headline": "MRB governor signals patience on interest rates.",
        "description": "The central bank head indicated a pause in rate hikes is likely for the remainder of the year.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "VLTN,BRKW,LMRA",
    },
]
