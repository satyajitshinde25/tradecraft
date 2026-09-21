# 🌐 TradeCraft — Market Sprint: Fictional Markets Edition

> **A high-fidelity, server-authoritative, deterministic stock trading simulation and competition engine.**  
> Designed for live hackathons, university trading challenges, and corporate finance events with up to **25 simultaneous teams**.

---

## 📑 Table of Contents

1. [Executive Overview](#-executive-overview)
2. [Key Highlights & Core Architecture](#-key-highlights--core-architecture)
3. [The Meridia Fictional Economy & Canonical Companies](#-the-meridia-fictional-economy--canonical-companies)
4. [Deterministic Price Engine & Reaction Profiles](#-deterministic-price-engine--reaction-profiles)
5. [The News System (Meridia Business Wire & Economic Calendar)](#-the-news-system-meridia-business-wire--economic-calendar)
6. [Trading Engine Rules & Risk Guardrails](#-trading-engine-rules--risk-guardrails)
7. [Leaderboard, P&L & Prize Eligibility](#-leaderboard-pl--prize-eligibility)
8. [Anti-Leakage & Information Security Model](#-anti-leakage--information-security-model)
9. [Organizer & Admin Command Center](#-organizer--admin-command-center)
10. [Technology Stack](#-technology-stack)
11. [Repository Structure](#-repository-structure)
12. [Installation & Quickstart Guide](#-installation--quickstart-guide)
13. [Default Credentials & Authentication](#-default-credentials--authentication)
14. [API & WebSocket Reference](#-api--websocket-reference)
15. [Automated Verification & Test Suite](#-automated-verification--test-suite)
16. [Deployment & Production Runbook](#-deployment--production-runbook)

---

## 🎯 Executive Overview

**TradeCraft** (internally specified as **Market Sprint: Fictional Markets Edition**) is a complete live simulation platform where participants step into the roles of institutional portfolio managers inside the fictional country of **Meridia**.

Unlike real-market simulators that rely on volatile external APIs (which allow participants to search live news or front-run lagging data feeds), TradeCraft is **100% deterministic, self-contained, and fair**:
- **Identical Market State**: All 25 teams observe the exact same prices, candlestick patterns, order books, and news headlines at the exact same sub-second timestamps.
- **Pure Skill & Analysis**: Participants must rely solely on financial intuition, macroeconomic analysis, financial statement interpretation, and rapid order execution.
- **Server-Authoritative Clock**: The frontend is strictly a view layer; game ticks, fills, trade validation, and cash reconciliation are computed exclusively by the FastAPI backend.
- **No Real Money**: All transactions use **V-Coins (₡)**.

```
+-----------------------------------------------------------------------------------+
|                                TRADECRAFT ECOSYSTEM                               |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|    [ 25 Predefined Teams ]           [ Live Video Screen / Organizer ]            |
|       TEAM-01 .. TEAM-25                   Admin Command Center                   |
|              |                                      |                             |
|              | HTTPS (REST) / WSS (WebSockets)      |                             |
|              v                                      v                             |
|    +-------------------------------------------------------------------------+    |
|    |                         FASTAPI CORE BACKEND                            |    |
|    |-------------------------------------------------------------------------|    |
|    | - Game Clock Engine (37.5s live ticks / 1s rapid test mode)             |    |
|    | - True Next-Tick Order Execution (T -> T+1 fills with variance adj.)    |    |
|    | - Real-Time Risk & Allocation Guardrails (35% Buy / 60% Concentration)  |    |
|    | - Timed News Dispatcher & Upcoming Calendar Redaction Filter            |    |
|    | - Full-Duplex WebSocket Broadcast Manager (/ws/market)                  |    |
|    | - Eligibility Engine (Min 6 trades across 3 companies)                  |    |
|    +-------------------------------------------------------------------------+    |
|                                      |                                            |
|                                      v                                            |
|    +-------------------------------------------------------------------------+    |
|    |                   PERSISTENCE LAYER (SQLite / PostgreSQL)               |    |
|    |-------------------------------------------------------------------------|    |
|    |  582 Precomputed Prices  |  16 News Events  |  Orders & Audit Trail     |    |
|    |  Wallets & Inventory     |  Snapshots       |  Active Connections       |    |
|    +-------------------------------------------------------------------------+    |
+-----------------------------------------------------------------------------------+
```

---

## ⚡ Key Highlights & Core Architecture

| Metric / Dimension | Specification | Description |
| :--- | :--- | :--- |
| **Max Concurrent Teams** | **25 Teams** | Fixed team accounts (`TEAM-01` to `TEAM-25`) with pre-seeded hashed credentials. |
| **Starting Balance** | **₡10,000.00 V-Coins** | Uniform starting liquidity deposited into every team wallet at genesis. |
| **Simulation Duration** | **97 Ticks (Tick 0 to 96)** | Tick 0 = opening bell; Tick 96 = closing bell (96 elapsed periods). |
| **Tick Cadence** | **37.5 Seconds / Tick** | Total competition runtime of **60 minutes (1 hour)**. |
| **Rapid Test Mode** | **1 Second / Tick** | Full 97-tick game completes in **97 seconds** for organizer rehearsal and CI testing. |
| **Fictional Equities** | **6 Canonical Equities** | Spanning Energy, Aviation, Banking, Real Estate, Enterprise Cloud, and Staples. |
| **News Sequence** | **14 Core + 2 Reserve** | 3 Scheduled Macro Events + 11 Surprise Breaking Headlines + 2 Manual Reserve Events. |
| **Order Matching** | **True Next-Tick Fill** | Orders submitted during Tick $T$ execute at the authoritative Tick $T+1$ price. |
| **Max Trade Volume** | **22 Trades Maximum** | Hard cap per team to prevent spamming and incentivize deliberate decision-making. |
| **Trade Fee** | **0.4% per transaction** | Flat 0.4% transaction fee levied on gross transaction value (both Buys and Sells). |
| **Anti-Spam Cooldown** | **7 Seconds** | Mandatory rate-limiting interval between consecutive order submissions per team. |

---

## 🏢 The Meridia Fictional Economy & Canonical Companies

The simulation takes place within the high-growth economy of **Meridia**. The market consists of six canonical publicly traded corporations, each with distinct sector characteristics, baseline starting prices, volatility factors, and macroeconomic sensitivities:

```
+===================================================================================================+
| TICKER | COMPANY NAME         | SECTOR               | START PRICE | VOLATILITY | PRIMARY DRIVERS |
+===================================================================================================+
| TAVR   | Tavorin Energy       | Energy               | ₡84.50      | 1.1x       | Oil, Demands    |
| AERV   | Aerovia Airlines     | Airlines             | ₡42.00      | 1.2x       | Travel, Oil (-) |
| VLTN   | Vaultline Bank       | Banking              | ₡120.00     | 0.8x       | Rates, Credit   |
| BRKW   | Brickwell Developers | Property & Constr.   | ₡65.25      | 1.0x       | Rates (-), Land |
| LMRA   | Lumora Labs          | Enterprise Cloud/AI  | ₡150.00     | 1.3x       | Sentiment, M&A  |
| GRFD   | Greenfield Foods     | Consumer Staples     | ₡58.00      | 0.7x       | Defensive, ESG  |
+===================================================================================================+
```

### Deep Company Profiles

1. **Tavorin Energy (`TAVR`) — ₡84.50**  
   *Sector*: Upstream, Midstream & Downstream Energy  
   *Overview*: Vertically integrated energy conglomerate with offshore drilling rights and nationwide refineries.  
   *Sensitivity*: Heavily buoyed by rising crude prices and supply constraints (`OIL: +3`). Resilient against rate hikes (`RATES: 0`). Vulnerable to government windfall taxation and supply restoration.

2. **Aerovia Airlines (`AERV`) — ₡42.00**  
   *Sector*: Commercial Aviation  
   *Overview*: Leading regional and international carrier operating high-frequency domestic and trans-continental routes.  
   *Sensitivity*: Severely impaired by oil and jet fuel spikes (`OIL: -3`). Highly sensitive to consumer disposable income and discretionary travel demand (`DEMAND: +3`). Responsive to strategic alliances and route codeshares.

3. **Vaultline Bank (`VLTN`) — ₡120.00**  
   *Sector*: Financial Institutions & Commercial Banking  
   *Overview*: Systemically important commercial lender with corporate finance, retail deposits, and prime brokerage wings.  
   *Sensitivity*: Highest beneficiary of monetary tightening and rate hikes via net interest margin expansion (`RATES: +3`). Exposed to regulatory inquiries and lending conduct audits.

4. **Brickwell Developers (`BRKW`) — ₡65.25**  
   *Sector*: Real Estate, Commercial Properties & Infrastructure  
   *Overview*: Major metropolitan developer specializing in high-density commercial towers and master-planned residential communities.  
   *Sensitivity*: Heavily leveraged and sensitive to mortgage and borrowing costs (`RATES: -3`). Boosted by municipal infrastructure tenders, favorable broker upgrades, and lower debt financing burdens.

5. **Lumora Labs (`LMRA`) — ₡150.00**  
   *Sector*: Enterprise Cloud Infrastructure & Analytics Software  
   *Overview*: High-growth enterprise software provider supplying mission-critical database clustering and government sovereign cloud instances.  
   *Sensitivity*: High beta, sentiment-driven growth equity (`SENTIMENT: +3`). Vulnerable to takeover speculation and subsequent corporate denials. Negatively affected by discount rate increases (`RATES: -2`).

6. **Greenfield Foods (`GRFD`) — ₡58.00**  
   *Sector*: Consumer Packaged Goods & Staples  
   *Overview*: Defensive distributor of essential food products, packaged goods, and grocery staples with sticky brand loyalty.  
   *Sensitivity*: Counter-cyclical safe haven. Low overall volatility (`0.7x`). Vulnerable to product recalls and isolated contamination incidents, but recovers quickly during broad market rallies.

---

## 📈 Deterministic Price Engine & Reaction Profiles

### 1. Mathematical Formulation
To ensure absolute competition integrity, market prices are **precalculated at database seed time** rather than generated on-the-fly via unconstrained random walks. The price sequence for equity $i$ at tick $t$ is governed by:

$$P_{i, t} = P_{i, t-1} \times \left(1 + \text{clip}\left(\epsilon_{i, t} + \text{rev}_{i, t} + \Delta\text{News}_{i, t}, -0.12, 0.12\right)\right)$$

Where:
- $\epsilon_{i, t} \sim \mathcal{N}\left(0, \sigma_{\text{base}} \times \text{VolMult}_i\right)$ with $\sigma_{\text{base}} = 0.010$ (1.0% base standard deviation) and deterministic per-ticker RNG seed.
- $\text{rev}_{i, t} = -0.001 \times \frac{P_{i, t-1} - P_{i, 0}}{P_{i, 0}}$ (subtle mean-reversion dampener preventing runaway drift).
- $\Delta\text{News}_{i, t}$ is the marginal impact delivered by active news events at tick $t$.
- **Hard Guardrails**:
  - Maximum single-tick price movement: $\pm 12\%$.
  - Absolute price floor: $\ge ₡1.00$.
  - Maximum price ceiling: $\le 400\%$ of opening price ($4.0 \times P_{i, 0}$).

### 2. Multi-Tick Reaction Profiles
In real markets, major announcements take time to be digested by institutional participants. TradeCraft models news impacts over a **6-tick reaction horizon** ($t = 0 \dots 5$) using three canonical reaction curves:

```
Percentage
of Total
Impact
 120% |                         * (Peak Overreaction)
 100% |                 * * * *       * * * * (Full Realization)
  80% |             *                     *
  60% |         *                           * (Fade to true value)
  40% |
  20% |     *
   0% +-------------------------------------------------->
           T+0   T+1   T+2   T+3   T+4   T+5  (Tick Offset)
```

1. **`STEP` (Permanent Structural Revaluation)**:
   - *Progression*: `[20%, 60%, 90%, 100%, 100%, 100%]`
   - *Application*: Permanent changes in cash flows, taxation, or official monetary policy (e.g., MRB Rate Hikes, Windfall Taxes, Earnings Beats).
2. **`SPIKE-AND-FADE` (Speculative Sentiment / Overreaction)**:
   - *Progression*: `[30%, 80%, 120%, 100%, 80%, 60%]`
   - *Application*: Unconfirmed rumors and analyst upgrades that spark initial retail euphoria followed by institutional mean-reversion (e.g., Takeover Rumors for Lumora, Brokerage "Strong Buy" ratings).
3. **`SLOW-BURN` (Gradual Macro / Industry Diffusion)**:
   - *Progression*: `[10%, 25%, 45%, 65%, 85%, 100%]`
   - *Application*: Diffuse economic indicators and broad market sentiment that seep into corporate earnings over extended cycles (e.g., Consumer Confidence erosion, Trade Talk breakthroughs).

---

## 📰 The News System (Meridia Business Wire & Economic Calendar)

The news system is divided into **Scheduled Economic Events** (published on the public calendar with consensus forecasts) and **Surprise Breaking News** (unannounced releases that hit the tape instantly).

### Canonical 14-Event Master Schedule (1-Hour Session, 37.5s/Tick)

```
+=======================================================================================================================+
| EVT | TICK | SIM TIME  | TYPE      | HEADLINE SUMMARY                             | CALENDAR TITLE / TOPIC            |
+=======================================================================================================================+
| #01 |  10  | T+06:15   | SURPRISE  | Oil prices edge higher as fuel inventories   | Energy Inventory Report           |
|     |      |           |           | fall. (TAVR +2.5%, AERV -1.5%)               |                                   |
| #02 |  15  | T+09:22   | SURPRISE  | Aerovia signs overseas code-share deal.      | Carrier Partnership Announcement  |
|     |      |           |           | (AERV +4.0%)                                 |                                   |
| #03 |  24  | T+15:00   | SCHEDULED | Consumer confidence falls to 18-month low.   | Consumer Confidence               |
|     |      |           |           | (GRFD -1.5%, BRKW -2.5%, AERV -2.0%)         | Forecast: Slight rise expected    |
| #04 |  29  | T+18:07   | SURPRISE  | Unconfirmed takeover bid for Lumora Labs.    | Tech Sector Acquisition Rumours   |
|     |      |           |           | (LMRA +8.0% Spike-and-Fade)                  |                                   |
| #05 |  36  | T+22:30   | SCHEDULED | Vaultline profit jumps 18%, dividend raised. | Vaultline Earnings                |
|     |      |           |           | (VLTN +4.5%, BRKW +1.0%)                     | Forecast: Profit expected flat    |
| #06 |  42  | T+26:15   | SURPRISE  | Lumora Labs denies takeover approach.        | Lumora Corporate Statement        |
|     |      |           |           | (LMRA -6.0%)                                 |                                   |
| #07 |  50  | T+31:15   | SURPRISE  | Oil Producers' Alliance cuts output sharply. | Oil Alliance Supply Decision      |
|     |      |           |           | (TAVR +4.5%, AERV -3.0%, GRFD -1.0%)         |                                   |
| #08 |  56  | T+35:00   | SURPRISE  | Broker upgrades Brickwell to "Strong Buy".   | Brokerage Equity Research         |
|     |      |           |           | (BRKW +3.5% Spike-and-Fade)                  |                                   |
| #09 |  64  | T+40:00   | SCHEDULED | MRB raises interest rates by 0.50% shock.    | MRB Rate Decision                 |
|     |      |           |           | (VLTN +3.0%, BRKW -3.5%, LMRA -2.5%)         | Forecast: Rates expected unch.    |
| #10 |  69  | T+43:07   | SURPRISE  | Greenfield Foods recalls snack line.         | Consumer Product Safety Notice    |
|     |      |           |           | (GRFD -5.0%)                                 |                                   |
| #11 |  76  | T+47:30   | SURPRISE  | Global markets rally on trade talks.          | International Trade Summit        |
|     |      |           |           | (Market-wide rally: all 6 stocks gain)       |                                   |
| #12 |  83  | T+51:52   | SURPRISE  | Government proposes energy windfall tax.     | Energy Fiscal Policy Leak         |
|     |      |           |           | (TAVR -6.0%)                                 |                                   |
| #13 |  88  | T+55:00   | SURPRISE  | Oil Alliance reverses output cut; oil falls. | Alliance Policy Reversal          |
|     |      |           |           | (TAVR -3.5%, AERV +2.5%)                     |                                   |
| #14 |  92  | T+57:30   | SURPRISE  | Regulator opens probe into Vaultline lending.| Financial Conduct Inquiry         |
|     |      |           |           | (VLTN -5.5%)                                 |                                   |
| R1  | Opt. | Manual    | RESERVE   | Retail sales rebound strongly.               | Reserve 1 (GRFD +2%, BRKW +2%)    |
| R2  | Opt. | Manual    | RESERVE   | MRB signals patience on rates.               | Reserve 2 (BRKW +3%, LMRA +3%)    |
+=======================================================================================================================+
```

### Direct Breaking News Pop-Up Modal
To maintain realistic trading urgency without spoiling market events beforehand:
- **No Spoiler Previews**: Upcoming events are not pre-announced with countdown warnings or calendar lists.
- **Direct Pop-Up**: The instant a headline crosses the wire (at scheduled ticks or reserve trigger), a high-visibility **Breaking News Pop-Up Modal** appears directly on the trader's screen with full headline details, topic, and a one-click `"Trade Now →"` action.
- **Clean Headline Feed**: All distracting `"RELEASED"` / `"NOT RELEASED"` / `"UPCOMING"` status tags have been eliminated.

---

## 🛡️ Trading Engine Rules & Risk Guardrails

To prevent gambling, market manipulation, and reckless concentration, the backend executes an atomic 8-stage validation chain on every single order:

```
[Incoming Order Request]
          |
          v
 1. Game Status Check      ---> Must be RUNNING and current_tick < 96
          |
 2. 7-Second Cooldown      ---> Difference since last non-rejected order >= 7.0s
          |
 3. Trade Count Cap        ---> Team's total (FILLED + PENDING) orders < 22
          |
 4. Minimum Order Value    ---> Gross order value >= 100.00 V-Coins
          |
 5. Sufficient Liquidity   ---> Cash >= Estimated Total (BUY) or Holding >= Qty (SELL)
          |
 6. 35% Buy Limit Cap      ---> Gross order value <= 35.0% of Total Portfolio Value
          |
 7. 60% Concentration Cap  ---> (Existing Value + New Value) <= 60.0% of Total Portfolio
          |
 8. True Next-Tick State   ---> Order created in PENDING status; Fills at Tick T+1
```

### True Next-Tick Execution Model
- **Anti-Front-Running**: When a participant clicks "BUY" or "SELL" at Tick $T$, the order is acknowledged as **`PENDING`** with `fill_tick = T + 1`.
- **Cash Reservation**: For buy orders, cash is immediately debited based on Tick $T$'s known price plus estimated fee ($0.4\%$). This prevents double-spending cash across multiple orders.
- **Tick T+1 Fill**: When the simulation clock reaches Tick $T+1$, the order engine fills the order using Tick $T+1$'s authoritative price.
- **Cash Reconciliation**: Any variance between the estimated Tick $T$ price and the actual Tick $T+1$ execution price is automatically refunded or debited from the team's wallet.
- **No Limit Orders & No Short Selling**: Only spot market orders are supported. Selling requires possessing the underlying shares.

---

## 🏆 Leaderboard, P&L & Prize Eligibility

### Portfolio Valuation Formula
At any given tick $t$:

$$\text{Holdings Value} = \sum_{k=1}^{6} \left(\text{Quantity}_{k} \times P_{k, t}\right)$$

$$\text{Portfolio Value} = \text{Cash Balance} + \text{Holdings Value}$$

$$\text{Profit / Loss (P&L)} = \text{Portfolio Value} - ₡10,000.00$$

$$\text{P\&L \%} = \left(\frac{\text{Profit / Loss}}{₡10,000.00}\right) \times 100$$

### Prize Eligibility Rule (Diversification & Activity)
To prevent "lucky one-trade wonders" or inactive teams from winning the tournament, an authoritative eligibility check is enforced:
1. **Activity Threshold**: Team must execute **at least 6 completed trades** (`trade_count >= 6`).
2. **Diversification Threshold**: Trades must span **at least 3 distinct companies** (`companies_traded >= 3`).

Teams that fail either criterion have `is_eligible = false` on the leaderboard and cannot claim podium awards regardless of their final cash balance.

---

## 🔒 Anti-Leakage & Information Security Model

Competition fairness depends on complete information isolation. TradeCraft incorporates bank-grade anti-leakage protections:

1. **Zero Client Authority**: The frontend never computes prices, portfolio values, trade fills, or news state. It renders exclusively what the backend authorizes.
2. **Future News Redaction**: The `/news` endpoint and WebSocket payload redact all surprise news events where `release_tick > current_tick`. Even inspecting network logs reveals zero future headlines.
3. **Calendar Masking**: For upcoming scheduled events, the backend supplies only the `calendar_title`, `time_offset`, and `forecast`. The headline itself is concealed until release.
4. **Future Price Sequestration**: Candlestick endpoints (`/market/{ticker}/candles`) and overview endpoints strictly clamp responses to `tick <= current_tick`.
5. **Private Organizers Matrix**: The 6-company sensitivity matrix, reaction profile curves, base volatility multipliers, and reserve event impacts exist solely in server memory.
6. **Isolated Team Scope**: Teams can only query their own portfolio, orders, and wallet balance. The global leaderboard is restricted to organizer credentials.

---

## 🎛️ Organizer & Admin Command Center

The Admin Portal (`/admin`) provides full oversight and controls for tournament organizers:

- **Game Lifecycle Controls**:
  - `Start Game`: Launches the official clock and transitions state to `RUNNING`.
  - `Pause Game`: Freezes the simulation clock without losing time.
  - `Resume Game`: Smoothly shifts `start_time` by elapsed pause duration to resume without missing ticks.
  - `Restart Game`: Comprehensive tournament reset. Resets all 25 team wallets to ₡10,000, wipes all orders/fills/holdings, clears portfolio snapshots, and arms all 14 headlines for the next batch of participants.
  - `Test Mode Toggle`: Switches between 37.5-second ticks (1-hour contest) and 1-second ticks for rapid rehearsals.
- **Manual Reserve Headline Injector**: Trigger Reserve Event 1 (Retail Sales) or Reserve Event 2 (MRB Guidance) on-demand to test participant responsiveness during unexpected lulls.
- **Prep-Time Fictional News Generator**: Authoring studio with category filters (Macro, Company, Policy) generating non-predictive Meridia headline templates with suggested sensitivity drivers for organizer review prior to competition lock.
- **Full Team Monitoring & Order Stream**: Real-time table displaying all 25 teams, active socket connections, portfolio values, trade counts, eligibility flags, and a live audit trail of all actions.

---

## 💻 Technology Stack

### Backend
- **Language**: Python 3.10+
- **Framework**: FastAPI 0.115.0 (ASGI high-concurrency framework)
- **Server**: Uvicorn (standard async worker)
- **Database ORM**: SQLAlchemy 2.0.35
- **Data Validation**: Pydantic 2.9.0 & Pydantic-Settings
- **Authentication**: Python-Jose (JWT HS256), Passlib (Bcrypt password hashing)
- **Database Engine**: SQLite (`market_sprint.db`) for local/embedded zero-config setups; fully compatible with Supabase / PostgreSQL.
- **WebSockets**: Native ASGI WebSocket connection pooling with periodic 1s/2s broadcasts.

### Frontend
- **Framework**: React 19 + Vite + TypeScript
- **Routing**: React Router DOM v7
- **Styling**: Vanilla CSS with customized design system (Bloomberg / Trading Terminal Dark Glassmorphic Theme)
- **Charting**: Lightweight Charts 5.2.1 (TradingView high-performance financial charts) & Recharts 3.10.1 (portfolio & distribution analytics)
- **State Management**: Reactive React hooks with full-duplex WebSocket streaming and fallback REST reconciliation.

---

## 📁 Repository Structure

```
tradecraft/
├── README.md                           # Master Project Documentation & Specification
├── Market-Sprint-Portal-Update-Spec.md # Canonical Organizer & Simulation Update Spec
├── architecture(1).md                  # High-level architecture specification
├── backend(1).md                       # Authoritative backend design document
├── frontend(1).md                      # Participant UI design specification
├── database.md                         # Relational schema & database specifications
├── prompt.md                           # Original simulation build prompt
│
├── backend/                            # FastAPI Server Application
│   ├── .env                            # Backend configuration & secrets
│   ├── requirements.txt                # Python dependencies
│   ├── market_sprint.db                # SQLite database (auto-generated by seed)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # Application entry point, CORS & router mounting
│   │   ├── config.py                   # Pydantic Settings & environment variable loader
│   │   ├── database.py                 # SQLAlchemy engine, session maker & Base
│   │   ├── models.py                   # 13 SQLAlchemy database ORM models
│   │   ├── schemas.py                  # Pydantic request/response validation schemas
│   │   ├── auth.py                     # JWT token encoding/decoding & auth dependencies
│   │   ├── seed.py                     # Master database seeding script
│   │   ├── price_generator.py          # Deterministic price engine & news reaction curves
│   │   ├── routers/
│   │   │   ├── auth_router.py          # /auth (login, logout, credentials)
│   │   │   ├── game_router.py          # /game (game state & simulation clock)
│   │   │   ├── market_router.py        # /market (prices, candles, quotes)
│   │   │   ├── news_router.py          # /news (released news & upcoming calendar)
│   │   │   ├── order_router.py         # /orders (buy, sell, order history)
│   │   │   ├── portfolio_router.py     # /portfolio (cash, holdings, P&L)
│   │   │   ├── admin_router.py         # /admin (game controls, leaderboard, audit)
│   │   │   └── ws_router.py            # /ws/market (real-time WebSocket broadcast)
│   │   └── services/
│   │       ├── game_clock.py           # Tick derivation & timing calculations
│   │       ├── market.py               # Price lookups & candlestick builders
│   │       ├── news.py                 # News release & scheduled event filtering
│   │       ├── orders.py               # True Next-Tick order engine & validation
│   │       ├── portfolio.py            # Portfolio valuation & holding calculations
│   │       ├── leaderboard.py          # Ranking & eligibility calculations
│   │       └── audit.py                # Structured audit logging
│   └── tests/
│       └── test_simulation.py          # Comprehensive end-to-end automated test suite
│
└── frontend/                           # React + TypeScript Client Application
    ├── package.json                    # Node dependencies and scripts
    ├── tsconfig.json                   # TypeScript configuration
    ├── index.html                      # HTML5 entry page
    ├── vercel.json                     # Production deployment routing configuration
    └── src/
        ├── main.tsx                    # React DOM entry point
        ├── App.tsx                     # Routing setup & protected route guards
        ├── index.css                   # Global theme tokens, typography & CSS reset
        ├── types/                      # TypeScript domain models & API response interfaces
        ├── api/
        │   └── client.ts               # HTTP client & WebSocket factory
        ├── components/
        │   ├── AdvancedChart.tsx       # Lightweight Charts interactive candlestick view
        │   ├── ChartModal.tsx          # Full-screen expanded candlestick modal
        │   ├── HoldingsTable.tsx       # Current equity positions & market value
        │   ├── MiniChart.tsx           # Sparkline overview charts
        │   ├── NewsTicker.tsx          # Meridia Business Wire, Calendar & Countdowns
        │   ├── OrderHistory.tsx        # Submitted & filled orders table
        │   ├── PortfolioPanel.tsx      # Portfolio metrics, cash, P&L & remaining trades
        │   ├── StockCard.tsx           # Stock price card with quick Buy/Sell triggers
        │   └── TradeModal.tsx          # Modal order entry form with validation warnings
        └── pages/
            ├── LoginPage.tsx           # Team & Admin authentication screen
            ├── Dashboard.tsx           # Main participant trading terminal
            └── AdminDashboard.tsx      # Organizer command center & live leaderboard
```

---

## 🚀 Installation & Quickstart Guide

### Prerequisites
- **Python 3.10+** (with `pip`)
- **Node.js 18+** (with `npm`)

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate a virtual environment
# On Windows (PowerShell):
python -m venv venv
.\venv\Scripts\Activate.ps1

# On macOS/Linux:
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (a pre-configured .env exists by default)
# Ensure .env contains:
# DATABASE_URL=sqlite:///./market_sprint.db
# JWT_SECRET=market-sprint-dev-secret-key-2024
# ADMIN_PASSWORD=admin123
# CORS_ORIGINS=http://localhost:5173

# Seed the database with all 25 teams, 6 companies, 582 prices, and 16 news events
python -m app.seed

# Start the FastAPI server
uvicorn app.main:app --reload --port 8000
```

The backend server is now live at `http://localhost:8000`.  
Interactive Swagger API documentation is available at `http://localhost:8000/docs`.

---

### 2. Frontend Setup

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node packages
npm install

# Start the Vite development server
npm run dev
```

The frontend terminal is now running at `http://localhost:5173`.

---

## 🔑 Default Credentials & Authentication

The database is pre-seeded with 25 team accounts and one master administrator:

### 1. Participant Accounts (25 Teams)
All team passwords follow the strict formula `sprint` + two-digit team number:

| Team Code | Password | Starting Balance | Initial Max Trades |
| :--- | :--- | :--- | :--- |
| `TEAM-01` | `sprint01` | ₡10,000.00 | 22 |
| `TEAM-02` | `sprint02` | ₡10,000.00 | 22 |
| `TEAM-03` | `sprint03` | ₡10,000.00 | 22 |
| `...` | `...` | `...` | `...` |
| `TEAM-25` | `sprint25` | ₡10,000.00 | 22 |

### 2. Administrator Account
- **Team ID / Username**: `ADMIN`
- **Password**: `admin123` (or configured via `ADMIN_PASSWORD` in `.env`)
- **Direct Link**: Navigating to `http://localhost:5173/` and entering `ADMIN` automatically routes to the Admin Command Center (`/admin`).

---

## 📡 API & WebSocket Reference

### Public & Authentication Endpoints
- `POST /auth/login` — Authenticate team or admin credentials; returns JWT session token.
- `POST /auth/logout` — Revoke active session token.
- `GET /health` — Health check status probe.

### Participant Market & Portfolio Endpoints (Requires Team JWT)
- `GET /game/state` — Current simulation tick, status (`RUNNING`, `PAUSED`, `FINISHED`), next tick timestamp.
- `GET /market/overview` — Current tick prices, 24h percentage change, and sector info for all 6 stocks.
- `GET /market/{ticker}/candles` — Historical OHLC candlestick records up to `current_tick`.
- `GET /news` — Released headlines and upcoming scheduled calendar events (with sensitive data redacted).
- `GET /portfolio` — Team cash, holdings, portfolio value, P&L, trade counts, and eligibility.
- `GET /orders` — Order history and status (`PENDING`, `FILLED`, `REJECTED`).
- `POST /orders/buy` — Place BUY order (`{ "ticker": "TAVR", "quantity": 10 }`).
- `POST /orders/sell` — Place SELL order (`{ "ticker": "TAVR", "quantity": 10 }`).

### Real-Time WebSocket Channel
- `WS /ws/market` — Broadcasts every second. Emits:
  - `current_tick` and `status`
  - Latest prices for all 6 equities
  - Latest released breaking headline
  - Upcoming scheduled calendar items and countdowns
  - Triggers next-tick order execution reconciliation

### Administrator Endpoints (Requires Admin JWT)
- `GET /admin/game` — Full game configuration and timing status.
- `POST /admin/game/start` — Launch competition clock.
- `POST /admin/game/pause` — Pause simulation clock.
- `POST /admin/game/resume` — Resume simulation clock.
- `POST /admin/game/restart` — Reset all 25 teams, wallets, orders, holdings, and news.
- `POST /admin/game/test-mode` — Toggle 1-second vs 37.5-second tick duration.
- `GET /admin/leaderboard` — Full ranked standings across all 25 teams.
- `GET /admin/orders` — Global order stream across all participants.
- `GET /admin/audit` — Immutable chronological audit logs.
- `POST /admin/game/fire-reserve/{event_id}` — Trigger Reserve Headline 1 or 2.
- `GET /admin/news-generator/candidates?category=all` — Fictional news authoring studio.

---

## 🧪 Automated Verification & Test Suite

TradeCraft includes an end-to-end automated test suite in `backend/tests/test_simulation.py` that verifies every core rule, risk guardrail, and anti-leakage mechanism using isolated in-memory databases.

### Running Tests

```bash
cd backend
pytest tests/test_simulation.py -v
```

### Verified Test Categories
1. **Canonical Profiles**: Confirms all 6 companies and starting prices match specifications.
2. **Deterministic Price Curves**: Validates all 97 ticks execute without NaN, obeying floor (₡1.00) and ceiling (400%).
3. **Anti-Leakage Verification**: Confirms that future surprise headlines and future candle prices are completely hidden from participants.
4. **Trading Guardrails**:
   - Rejection of orders below 100 V-Coins.
   - Rejection of buys exceeding 35% portfolio allocation.
   - Rejection of buys exceeding 60% company concentration.
   - Rejection of orders violating the 7-second cooldown.
   - Rejection of orders after reaching 22 trades.
   - Rejection of short sells.
5. **True Next-Tick Fill**: Validates that orders submitted at Tick $T$ fill at the authoritative Tick $T+1$ price with exact fee and cash adjustments.
6. **Eligibility Engine**: Verifies that teams with $<6$ trades or $<3$ companies are disqualified from prize consideration.
7. **Organizer Operations**: Verifies game start, pause, resume, and restart cycles.

---

## 🚢 Deployment & Production Runbook

### Running a Live Event (Organizer Checklist)

1. **Pre-Event Setup (T minus 24 Hours)**:
   - Deploy backend to any modern container or VM host (AWS EC2, Render, Railway, DigitalOcean).
   - Point `DATABASE_URL` to Supabase PostgreSQL or high-performance SQLite.
   - Build frontend (`npm run build`) and host on Vercel, Netlify, or AWS CloudFront.
   - Set frontend `VITE_API_URL` and `VITE_WS_URL` to point to the backend domain.
   - Run `python -m app.seed` to prepare fresh accounts.
   - Print or distribute credentials for `TEAM-01` through `TEAM-25`.

2. **Event Day Opening (T minus 15 Minutes)**:
   - Organizers log in to `/admin` using `ADMIN` / `admin123`.
   - Ensure Test Mode is **OFF** (Tick duration shows `37.5s`).
   - Project the Admin Dashboard onto the main event stage screen.
   - Instruct teams to log in at their trading terminals. Verify team connections in the admin overview.

3. **Event Execution (T = 0 to 60 Minutes)**:
   - Click **▶ Start Game** on the Admin Dashboard.
   - The simulation automatically advances through Tick 0 to Tick 96.
   - Breaking news and warnings will flash on participant screens automatically.
   - Organizers can use **⏸ Pause** if an announcement or room technical issue arises.

4. **Event Conclusion (Tick 96 / Market Close)**:
   - The market officially closes at Tick 96.
   - Pending orders are finalized and all portfolio values lock.
   - Organizers display the final **Eligible Leaderboard** on the projector to announce podium winners!

---

## 📜 License & Integrity Notice

TradeCraft / Market Sprint is developed for sanctioned educational trading challenges. All companies, economic data, news headlines, and central bank actions referenced are entirely fictional. Any resemblance to real corporations, living persons, or actual financial entities is purely coincidental.
