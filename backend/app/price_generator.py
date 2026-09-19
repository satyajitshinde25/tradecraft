"""
Market Sprint — Deterministic Price Series Generator

Generates realistic price movements for 6 fictional companies across 97 ticks.
Uses a seeded random walk so prices are reproducible.
News events at specific ticks cause price jumps.
"""
import random
import math


# News event impacts — maps (event_number, ticker) to a percentage impact
# Positive = price goes up, negative = price goes down
NEWS_IMPACTS = {
    # Event 1 (tick 10): Oil supply disruption rumor
    (1, "TAVR"): 3.5,   # Oil company benefits from supply fears
    (1, "AERV"): -2.8,  # Airlines hurt by fuel cost fears
    (1, "GRFD"): -1.0,  # Food transport costs

    # Event 2 (tick 16): Tech patent breakthrough for biotech
    (2, "LMRA"): 5.2,   # Biotech direct beneficiary
    (2, "VLTN"): 0.8,   # Banks slight positive (investment)

    # Event 3 (tick 24): Consumer Confidence Index (SCHEDULED)
    (3, "GRFD"): 2.5,   # Consumer staples benefit
    (3, "BRKW"): 3.0,   # Property benefits from confidence
    (3, "AERV"): 2.0,   # Travel benefits from confidence

    # Event 4 (tick 30): Banking regulation concerns
    (4, "VLTN"): -4.2,  # Bank directly hit
    (4, "BRKW"): -2.0,  # Property lending affected

    # Event 5 (tick 38): Vaultline Earnings Report (SCHEDULED)
    (5, "VLTN"): -3.5,  # Earnings miss
    (5, "BRKW"): -1.5,  # Related sector

    # Event 6 (tick 44): Greenfield wins major contract
    (6, "GRFD"): 6.0,   # Direct beneficiary
    (6, "TAVR"): 1.0,   # Supply chain partner

    # Event 7 (tick 52): International trade tensions
    (7, "AERV"): -3.5,  # Airlines hurt by trade war
    (7, "GRFD"): -2.0,  # Food imports affected
    (7, "TAVR"): 2.0,   # Domestic oil benefits

    # Event 8 (tick 60): Lumora drug trial results positive
    (8, "LMRA"): 7.5,   # Direct massive impact
    (8, "VLTN"): 1.5,   # Investment banking fees

    # Event 9 (tick 66): MRB Rate Decision (SCHEDULED)
    (9, "VLTN"): 2.5,   # Banks benefit from rate hold
    (9, "BRKW"): 3.5,   # Property benefits from rate hold
    (9, "LMRA"): -1.0,  # Growth stocks pressure

    # Event 10 (tick 72): Aerovia fleet expansion announcement
    (10, "AERV"): 4.5,  # Direct beneficiary
    (10, "TAVR"): 1.5,  # More fuel demand

    # Event 11 (tick 78): Energy sector regulation fears
    (11, "TAVR"): -5.0, # Direct hit
    (11, "AERV"): 2.0,  # Lower fuel costs possibility

    # Event 12 (tick 84): Property market data strong
    (12, "BRKW"): 4.5,  # Direct beneficiary
    (12, "VLTN"): 2.0,  # Mortgage lending boost

    # Event 13 (tick 88): Greenfield product recall
    (13, "GRFD"): -5.5, # Direct hit
    (13, "LMRA"): 1.5,  # Alternative health foods

    # Event 14 (tick 92): Market-wide optimism rally
    (14, "TAVR"): 2.0,
    (14, "AERV"): 2.5,
    (14, "VLTN"): 1.5,
    (14, "BRKW"): 2.0,
    (14, "LMRA"): 3.0,
    (14, "GRFD"): 1.5,
}

# Ticks when news is released
NEWS_TICKS = {
    1: 10, 2: 16, 3: 24, 4: 30, 5: 38,
    6: 44, 7: 52, 8: 60, 9: 66, 10: 72,
    11: 78, 12: 84, 13: 88, 14: 92,
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

    Uses a random walk with drift and news event impacts.
    Each company gets a unique seed based on ticker + master seed.
    """
    # Unique seed per company
    ticker_seed = seed + sum(ord(c) for c in ticker)
    rng = random.Random(ticker_seed)

    # Company-specific volatility multiplier
    volatility_map = {
        "TAVR": 1.2,   # Oil — higher volatility
        "AERV": 1.3,   # Airlines — highest volatility
        "VLTN": 0.8,   # Bank — lower volatility
        "BRKW": 1.0,   # Property — moderate
        "LMRA": 1.4,   # Biotech — very volatile
        "GRFD": 0.7,   # Food — lowest volatility
    }
    vol_mult = volatility_map.get(ticker, 1.0)

    prices = [round(start_price, 2)]

    # Build tick-to-impact map for this ticker
    tick_impacts = {}
    for (evt_num, evt_ticker), impact_pct in NEWS_IMPACTS.items():
        if evt_ticker == ticker:
            release_tick = NEWS_TICKS[evt_num]
            tick_impacts[release_tick] = tick_impacts.get(release_tick, 0) + impact_pct

    for tick in range(1, num_ticks):
        prev = prices[-1]

        # Base random walk
        noise = rng.gauss(0, base_volatility * vol_mult)

        # Small mean-reversion toward start price (prevents runaway)
        reversion = -0.001 * (prev - start_price) / start_price

        # News impact at this tick
        news_impact = 0.0
        if tick in tick_impacts:
            news_impact = tick_impacts[tick] / 100.0

        # Calculate new price
        change = noise + reversion + news_impact
        new_price = prev * (1 + change)

        # Floor at 1.0 (no negative prices)
        new_price = max(1.0, new_price)

        prices.append(round(new_price, 2))

    return prices


# ── News Headlines ─────────────────────────────────────────────────

NEWS_EVENTS_DATA = [
    {
        "event_number": 1,
        "release_tick": 10,
        "event_type": "SURPRISE",
        "headline": "BREAKING: Oil Pipeline Disruption Reported in Eastern Provinces",
        "description": "Reports of a major pipeline disruption have sent shockwaves through the energy sector. Tavros Energy shares expected to react as supply concerns mount. Airlines may face increased fuel costs.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR,AERV,GRFD",
    },
    {
        "event_number": 2,
        "release_tick": 16,
        "event_type": "SURPRISE",
        "headline": "Lumora Labs Announces Breakthrough Patent in Gene Therapy",
        "description": "Lumora Labs has been granted a key patent for their novel gene therapy platform, positioning the company ahead of competitors in the rapidly growing biotech space.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "LMRA,VLTN",
    },
    {
        "event_number": 3,
        "release_tick": 24,
        "event_type": "SCHEDULED",
        "headline": "Consumer Confidence Index Surges to 18-Month High",
        "description": "The National Consumer Confidence Index has beaten expectations, rising to 112.4 from 104.8. Consumer spending and property markets expected to benefit.",
        "forecast": "Analysts expected a modest increase to 106.0",
        "is_scheduled": True,
        "affected_tickers": "GRFD,BRKW,AERV",
    },
    {
        "event_number": 4,
        "release_tick": 30,
        "event_type": "SURPRISE",
        "headline": "Central Regulator Proposes Stricter Capital Requirements for Banks",
        "description": "The Central Financial Authority has proposed new capital adequacy rules that would require banks to hold 15% more reserves. Vaultline Bank among those most affected.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "VLTN,BRKW",
    },
    {
        "event_number": 5,
        "release_tick": 38,
        "event_type": "SCHEDULED",
        "headline": "Vaultline Bank Q3 Earnings Miss Analyst Estimates by 8%",
        "description": "Vaultline Bank reported earnings per share of V₡2.14 vs. expected V₡2.33. Increased loan defaults and trading losses cited as key factors.",
        "forecast": "Analysts expected EPS of V₡2.33",
        "is_scheduled": True,
        "affected_tickers": "VLTN,BRKW",
    },
    {
        "event_number": 6,
        "release_tick": 44,
        "event_type": "SURPRISE",
        "headline": "Greenfield Foods Secures Exclusive 5-Year Government Supply Contract",
        "description": "Greenfield Foods has won a major government contract worth an estimated V₡850M over five years to supply packaged food to public institutions nationwide.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "GRFD,TAVR",
    },
    {
        "event_number": 7,
        "release_tick": 52,
        "event_type": "SURPRISE",
        "headline": "Trade Ministry Announces New Import Tariffs on Foreign Goods",
        "description": "The Trade Ministry has imposed a 12% tariff on imported goods from several major trading partners. Airlines and food importers expected to face higher costs, while domestic energy may benefit.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "AERV,GRFD,TAVR",
    },
    {
        "event_number": 8,
        "release_tick": 60,
        "event_type": "SURPRISE",
        "headline": "MAJOR: Lumora Labs Phase III Drug Trial Shows 94% Efficacy",
        "description": "Lumora Labs' flagship cancer treatment has shown remarkable 94% efficacy in Phase III clinical trials, far exceeding the 70% threshold for regulatory approval.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "LMRA,VLTN",
    },
    {
        "event_number": 9,
        "release_tick": 66,
        "event_type": "SCHEDULED",
        "headline": "MRB Holds Interest Rates Steady at 4.25%",
        "description": "The Monetary Review Board has voted to maintain interest rates at 4.25%, citing balanced inflation and growth. Banks and property sectors expected to welcome the decision.",
        "forecast": "Markets expected a 50bps hike to 4.75%",
        "is_scheduled": True,
        "affected_tickers": "VLTN,BRKW,LMRA",
    },
    {
        "event_number": 10,
        "release_tick": 72,
        "event_type": "SURPRISE",
        "headline": "Aerovia Airlines Announces V₡2B Fleet Expansion Programme",
        "description": "Aerovia Airlines has announced the acquisition of 15 new aircraft as part of a V₡2 billion fleet modernisation programme, signalling confidence in the travel sector recovery.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "AERV,TAVR",
    },
    {
        "event_number": 11,
        "release_tick": 78,
        "event_type": "SURPRISE",
        "headline": "Environment Agency Proposes Carbon Tax on Energy Producers",
        "description": "A proposed carbon tax of V₡45 per tonne would significantly impact energy producers like Tavros Energy, potentially cutting operating margins by 12-15%.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR,AERV",
    },
    {
        "event_number": 12,
        "release_tick": 84,
        "event_type": "SURPRISE",
        "headline": "National Property Index Shows 6.2% Quarterly Growth",
        "description": "The National Property Index has risen 6.2% quarter-on-quarter, the strongest growth in three years. Brickwell Developers positioned to benefit from continued demand.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "BRKW,VLTN",
    },
    {
        "event_number": 13,
        "release_tick": 88,
        "event_type": "SURPRISE",
        "headline": "Greenfield Foods Issues Voluntary Recall on Three Product Lines",
        "description": "Greenfield Foods has issued a voluntary recall affecting three major product lines due to contamination concerns. Estimated cost of V₡120M in write-offs and brand damage.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "GRFD,LMRA",
    },
    {
        "event_number": 14,
        "release_tick": 92,
        "event_type": "SURPRISE",
        "headline": "Central Bank Signals Economic Growth Upgrade — Markets Rally",
        "description": "The Central Bank has revised its GDP growth forecast upward to 3.8%, sparking a broad market rally across all sectors in late trading.",
        "forecast": None,
        "is_scheduled": False,
        "affected_tickers": "TAVR,AERV,VLTN,BRKW,LMRA,GRFD",
    },
]
