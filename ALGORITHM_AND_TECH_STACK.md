# 🧠 TradeCraft — Algorithms, Architecture & Technology Stack

> Comprehensive architectural reference detailing the **mathematical models, core algorithms, and technology stack choices** powering TradeCraft (*Market Sprint: Fictional Markets Edition*).

---

## 📑 Table of Contents
1. [Architectural Principles](#1-architectural-principles)
2. [Core Algorithms & Mathematical Foundations](#2-core-algorithms--mathematical-foundations)
   - [2.1 Deterministic Price Generation Algorithm](#21-deterministic-price-generation-algorithm)
   - [2.2 Multi-Tick News Reaction Curves (Profiles)](#22-multi-tick-news-reaction-curves-profiles)
   - [2.3 True Next-Tick Order Execution & Matching Engine](#23-true-next-tick-order-execution--matching-engine)
   - [2.4 Inventory & Weighted-Average Cost Basis Algorithm](#24-inventory--weighted-average-cost-basis-algorithm)
   - [2.5 Automated Risk & Allocation Validation Chain](#25-automated-risk--allocation-validation-chain)
   - [2.6 Server-Authoritative Game Clock Algorithm](#26-server-authoritative-game-clock-algorithm)
   - [2.7 Leaderboard Valuation & Prize Eligibility Algorithm](#27-leaderboard-valuation--prize-eligibility-algorithm)
   - [2.8 Anti-Leakage Data Redaction Algorithm](#28-anti-leakage-data-redaction-algorithm)
3. [Technology Stack & Architectural Purpose](#3-technology-stack--architectural-purpose)
   - [3.1 Backend Technologies](#31-backend-technologies)
   - [3.2 Frontend Technologies](#32-frontend-technologies)
   - [3.3 Real-Time Communication Layer](#33-real-time-communication-layer)
   - [3.4 Database & Persistence Layer](#34-database--persistence-layer)
4. [Design Rationale & Non-Goals](#4-design-rationale--non-goals)

---

## 1. Architectural Principles

TradeCraft was architected around four core competitive engineering principles:
1. **Absolute Determinism & Fairness**: Every participant observes identical market data, identical candlestick histories, and identical news timestamps. Market outcomes depend entirely on strategic decision-making, not network latency or server random-number generator (RNG) variance.
2. **Zero Client Authority**: The client browser is strictly a presentation and input terminal. Order validation, price lookup, fill execution, fee levying, and cash reconciliation occur exclusively on the server.
3. **True Information Sequestration**: Secret surprise headlines, future price paths, and macroeconomic sensitivity matrices exist exclusively on the server and are cryptographically redacted from all client network payloads.
4. **Resilient Real-Time Streaming**: High-frequency updates are broadcast over WebSockets with automatic reconnection, health verification, and background REST polling fallback.

---

## 2. Core Algorithms & Mathematical Foundations

### 2.1 Deterministic Price Generation Algorithm

#### Problem Statement
In a live competitive simulation, prices cannot be generated using an unseeded live random walk (which causes different participants to see divergent prices) or live real-world stock APIs (which allow participants to search news or front-run lagging data). 

#### Mathematical Formulation
Prices for all 6 equities across all 97 ticks ($t = 0 \dots 96$) are **precomputed deterministically at database genesis** using a seeded geometric Brownian motion variant with mean-reversion dampening and bounded headline shock propagation:

$$P_{i, t} = P_{i, t-1} \times \left(1 + \text{clip}\left(\epsilon_{i, t} + \text{rev}_{i, t} + \Delta\text{News}_{i, t}, -0.12, 0.12\right)\right)$$

Where:
- **Seed Derivation**: Each ticker's pseudo-random number generator is initialized with:
  $$\text{Seed}_i = \text{MasterSeed} + \sum_{c \in \text{Ticker}_i} \text{ord}(c)$$
  With $\text{MasterSeed} = 42$. This guarantees 100% reproducible price curves across environment restarts.
- **Stochastic Noise Component**:
  $$\epsilon_{i, t} \sim \mathcal{N}\left(0, \sigma_{\text{base}} \times \text{VolMult}_i\right)$$
  Where $\sigma_{\text{base}} = 0.010$ (1.0% base tick standard deviation) and $\text{VolMult}_i$ reflects sector-specific volatility:
  - `TAVR`: $1.1\times$
  - `AERV`: $1.2\times$
  - `VLTN`: $0.8\times$
  - `BRKW`: $1.0\times$
  - `LMRA`: $1.3\times$
  - `GRFD`: $0.7\times$
- **Mean-Reversion Dampener**:
  $$\text{rev}_{i, t} = -0.001 \times \left(\frac{P_{i, t-1} - P_{i, 0}}{P_{i, 0}}\right)$$
  Prevents unconstrained compound drift away from economic fundamentals over the 97-tick lifecycle.
- **Marginal News Impact ($\Delta\text{News}_{i, t}$)**: The deterministic price adjustment injected by active news event reaction profiles at tick $t$.
- **Hard Guardrails**:
  - **Single-Tick Movement Cap**: Clamped to $[-12.0\%, +12.0\%]$ to prevent unrealistic discontinuous jumps.
  - **Price Floor**: $P_{i, t} \ge ₡1.00$ (prevents bankruptcy or negative pricing).
  - **Price Ceiling**: $P_{i, t} \le 4.0 \times P_{i, 0}$ (caps maximum valuation at 400% of opening price).

---

### 2.2 Multi-Tick News Reaction Curves (Profiles)

#### Problem Statement
In real financial markets, news is not absorbed instantaneously in a single instantaneous step; it diffuses across multiple periods as institutional order flow digests the information.

#### The 6-Tick Reaction Horizon
TradeCraft models headline price impacts over a **6-tick reaction horizon** ($s \in \{0, 1, 2, 3, 4, 5\}$). Let $I_{\text{total}}$ be the total percentage price impact assigned to an event for company $i$. The cumulative percentage impact at step $s$ is governed by one of three canonical reaction profiles:

```
Percentage Impact
  120% |                         * (Peak Overreaction)
  100% |                 * * * *       * * * * (Full Realization)
   80% |             *                     *
   60% |         *                           * (Fade to true value)
   40% |
   20% |     *
    0% +-------------------------------------------------->
            s=0   s=1   s=2   s=3   s=4   s=5  (Tick Offset)
```

1. **`STEP` Profile (Permanent Structural Valuation Shift)**:
   - Cumulative: `[20%, 60%, 90%, 100%, 100%, 100%]`
   - Marginal shock per tick:
     $$\Delta\text{News}[s] = I_{\text{total}} \times \left(\text{Profile}[s] - \text{Profile}[s-1]\right)$$
     - $s=0$: $20\%$ of total impact
     - $s=1$: $40\%$ of total impact
     - $s=2$: $30\%$ of total impact
     - $s=3$: $10\%$ of total impact
     - $s=4, 5$: $0\%$ (stable at new baseline)
   - *Use Case*: Permanent policy shifts, interest rate changes, windfall taxes, earnings surprises.
2. **`SPIKE-AND-FADE` Profile (Speculative Rumors & Overreaction)**:
   - Cumulative: `[30%, 80%, 120%, 100%, 80%, 60%]`
   - Peak overreaction occurs at $s=2$ (120% of target impact), followed by institutional profit-taking and fade back to 60%.
   - *Use Case*: Takeover speculation, analyst upgrades, unconfirmed market rumors.
3. **`SLOW-BURN` Profile (Gradual Macroeconomic Diffusion)**:
   - Cumulative: `[10%, 25%, 45%, 65%, 85%, 100%]`
   - Marginal shock: smooth, steady 15–20% increment per tick.
   - *Use Case*: Macro sentiment erosion, consumer confidence decline, trade negotiations.

---

### 2.3 True Next-Tick Order Execution & Matching Engine

#### Problem Statement
In live competitive trading, allowing market orders to fill immediately at the currently displayed tick price creates unfair latency races (front-running the clock). 

#### Algorithm Workflow ($T \rightarrow T+1$)
TradeCraft enforces **True Next-Tick Execution**:

```
[Participant Submits Order at Tick T]
                 |
                 v
   +------------------------------+
   |   Validate Trading Rules     |
   +------------------------------+
                 | (Pass)
                 v
   +------------------------------+
   | Reserve Liquidity in Wallet  | ---> Deduct: (Qty * Price_T) + Est_Fee
   +------------------------------+
                 |
                 v
   +------------------------------+
   |  Create Order in PENDING     | ---> status = PENDING, fill_tick = T + 1
   +------------------------------+
                 |
                 | (Simulation Clock Advances to Tick T+1)
                 v
   +------------------------------+
   | Fetch Authoritative Price    | ---> Price_{T+1} from market_prices
   +------------------------------+
                 |
                 v
   +------------------------------+
   | Execute Fill & Reconcile     |
   | - Compute actual gross & fee |
   | - Adjust cash variance       | ---> Wallet_Cash += (Reserved_Total - Actual_Total)
   | - Update holding quantity    |
   | - Recalculate average cost   |
   | - Set status = FILLED        |
   +------------------------------+
```

1. **Submission Phase (Tick $T$)**:
   - Order is validated against cooldown, buy limits, concentration caps, and cash balance.
   - Estimated gross value is calculated:
     $$\text{Gross}_{\text{est}} = \text{Quantity} \times P_{i, T}$$
   - Estimated transaction fee is computed:
     $$\text{Fee}_{\text{est}} = \text{Gross}_{\text{est}} \times 0.004$$
   - For `BUY` orders, the full estimated total ($\text{Gross}_{\text{est}} + \text{Fee}_{\text{est}}$) is **immediately debited from the team's wallet** into escrow. This prevents double-spending cash across concurrent orders.
   - The order is persisted with `status = PENDING` and `fill_tick = T + 1`.
2. **Fill Phase (Tick $T+1$)**:
   - The engine retrieves the precomputed official price $P_{i, T+1}$.
   - Actual gross value and fee are calculated:
     $$\text{Gross}_{\text{actual}} = \text{Quantity} \times P_{i, T+1}$$
     $$\text{Fee}_{\text{actual}} = \text{Gross}_{\text{actual}} \times 0.004$$
     $$\text{Total}_{\text{actual}} = \text{Gross}_{\text{actual}} + \text{Fee}_{\text{actual}}$$
3. **Cash Variance Reconciliation**:
   - The variance between reserved cash and actual execution cost is reconciled:
     $$\Delta\text{Cash} = \text{Total}_{\text{est}} - \text{Total}_{\text{actual}}$$
     $$\text{Wallet Cash} = \max\left(0.00, \text{Wallet Cash} + \Delta\text{Cash}\right)$$
   - If the price dropped at Tick $T+1$, the team receives an automatic refund. If the price rose, the additional required cash is deducted.

---

### 2.4 Inventory & Weighted-Average Cost Basis Algorithm

For portfolio tracking and P&L attribution, TradeCraft tracks share inventory using the **Weighted-Average Cost (WAC)** formula:

$$\overline{C}_{\text{new}} = \frac{\left(\overline{C}_{\text{old}} \times Q_{\text{old}}\right) + \left(P_{\text{fill}} \times Q_{\text{order}}\right)}{Q_{\text{old}} + Q_{\text{order}}}$$

Where:
- $\overline{C}$ is the weighted-average purchase cost per share.
- $Q$ is the share quantity.
- When an equity is sold completely ($Q = 0$), $\overline{C}$ resets to $0.00$.

---

### 2.5 Automated Risk & Allocation Validation Chain

Every incoming order must pass through an atomic 8-point validation pipeline executed inside an ACID transaction:

1. **Game Status Check**: Must be `RUNNING` and $\text{current\_tick} < 96$.
2. **Anti-Spam Cooldown Check**:
   $$\text{now} - \text{submitted\_at}_{\text{last}} \ge 7.0\text{ seconds}$$
3. **Trade Limit Check**: Total orders with status `FILLED` or `PENDING` must be $< 22$.
4. **Minimum Order Size**:
   $$\text{Quantity} \times P_{i, T} \ge ₡100.00$$
5. **35% Single-Order Allocation Limit (`BUY`)**:
   $$\text{Quantity} \times P_{i, T} \le 0.35 \times \text{Total Portfolio Value}$$
6. **60% Company Concentration Cap (`BUY`)**:
   $$\left(Q_{\text{existing}} + Q_{\text{order}}\right) \times P_{i, T} \le 0.60 \times \text{Total Portfolio Value}$$
7. **Sufficient Liquidity / Inventory**:
   - `BUY`: $\text{Wallet Cash} \ge \text{Total}_{\text{est}}$.
   - `SELL`: $Q_{\text{owned}} \ge Q_{\text{order}}$ (No short selling).
8. **Next-Tick State Transition**: Create order in `PENDING` status.

---

### 2.6 Server-Authoritative Game Clock Algorithm

#### Linear Tick Derivation
Rather than running an imprecise server-side `while True: sleep(75)` loop that suffers from cumulative clock drift, the simulation derives the active tick mathematically from the database `start_time`:

$$\Delta t = \text{Server Time} - \text{Game Start Time}$$

$$\text{Current Tick} = \min\left(96, \left\lfloor \frac{\Delta t}{\text{Tick Seconds}} \right\rfloor\right)$$

Where $\text{Tick Seconds} = 75$ in live mode and $1$ in rapid test mode.

#### Zero-Distortion Pause & Resume
When the administrator pauses the simulation at timestamp $t_{\text{pause}}$ and resumes at timestamp $t_{\text{resume}}$, the elapsed pause duration is computed:

$$\Delta t_{\text{pause}} = t_{\text{resume}} - t_{\text{pause}}$$

The persisted `start_time` is shifted forward:

$$\text{start\_time}_{\text{new}} = \text{start\_time}_{\text{old}} + \Delta t_{\text{pause}}$$

This guarantees that **not a single second of trading time is lost or gained**, and tick calculations remain strictly continuous.

---

### 2.7 Leaderboard Valuation & Prize Eligibility Algorithm

#### Portfolio Valuation
At any simulation tick $t$:

$$\text{Holdings Value} = \sum_{k=1}^{6} \left(Q_k \times P_{k, t}\right)$$

$$\text{Total Portfolio Value} = \text{Wallet Cash} + \text{Holdings Value}$$

$$\text{Profit / Loss} = \text{Total Portfolio Value} - ₡10,000.00$$

$$\text{P\&L \%} = \left(\frac{\text{Profit / Loss}}{₡10,000.00}\right) \times 100$$

#### Prize Eligibility Logic
To prevent participants from winning through complete inaction or single-trade gambles:

$$\text{is\_eligible} = \left(\text{Trade Count} \ge 6\right) \land \left(\text{Companies Traded} \ge 3\right)$$

Teams failing this condition are flagged on the master leaderboard and disqualified from podium rankings.

---

### 2.8 Anti-Leakage Data Redaction Algorithm

To preserve absolute fairness, the server implements strict response masking:
1. **Surprise News Redaction**: The `/news` endpoint filters:
   $$\text{events} = \{\text{evt} \in \text{NewsEvents} \mid \text{evt.release\_tick} \le \text{current\_tick}\}$$
2. **Scheduled Event Title Masking**: For future scheduled events ($\text{release\_tick} > \text{current\_tick}$), the actual `headline` is completely redacted; only `calendar_title`, `time_offset`, and `forecast` are returned.
3. **Future Price Sequestration**: The candlestick endpoint `/market/{ticker}/candles` strictly filters:
   $$\text{candles} = \{\text{candle} \in \text{MarketCandles} \mid \text{candle.tick} \le \text{current\_tick}\}$$
4. **Organizer Data Sequestration**: The macro sensitivity matrix and reserve event impacts exist only in server memory and are never serialized over REST or WebSockets.

---

## 3. Technology Stack & Architectural Purpose

```
+---------------------------------------------------------------------------------------+
|                                    TECHNOLOGY STACK                                   |
+---------------------------------------------------------------------------------------+
| LAYER               | TECHNOLOGY          | PURPOSE & ARCHITECTURAL RATIONALE         |
+---------------------+---------------------+-------------------------------------------+
| Frontend Framework  | React 19            | High-performance concurrent rendering     |
| Build Tool          | Vite                | Sub-second HMR & optimized Rollup bundle  |
| Type System         | TypeScript 5.8      | Strict domain modeling & compile safety   |
| Styling             | Vanilla CSS Tokens  | Zero-runtime CSS, dark Bloomberg terminal |
| Financial Charts    | Lightweight Charts  | 60 FPS canvas-rendered financial OHLC     |
| Analytics Charts    | Recharts            | Declarative SVG portfolio visualizations  |
| Routing             | React Router v7     | Client-side routing with auth guards      |
| Backend Framework   | FastAPI 0.115       | High-throughput async ASGI framework      |
| ASGI Web Server     | Uvicorn Standard    | High-concurrency event-loop worker        |
| ORM & Persistence   | SQLAlchemy 2.0      | ACID transactions & row-level locking     |
| Schema Validation   | Pydantic v2         | Rust-backed ultra-fast data validation    |
| Authentication      | Python-Jose + BCrypt| Stateless JWTs + salted password hashing  |
| Real-Time Streaming | Native WebSockets   | Full-duplex broadcast with health probe   |
| Database Engine     | SQLite / PostgreSQL | Zero-config portable or cloud Supabase    |
+---------------------------------------------------------------------------------------+
```

### 3.1 Backend Technologies

- **FastAPI 0.115**:
  - *Purpose*: Serves as the authoritative API and WebSocket server.
  - *Why Selected*: Built on Starlette and Pydantic, FastAPI provides asynchronous concurrency via Python's native `asyncio`, auto-generates OpenAPI documentation, and processes thousands of requests per second with sub-millisecond response latency.
- **Uvicorn 0.30**:
  - *Purpose*: Production-grade ASGI web server running the FastAPI application.
  - *Why Selected*: Fast, lightweight, and supports native WebSocket protocols (`uvloop` + `httptools`).
- **SQLAlchemy 2.0**:
  - *Purpose*: Object-Relational Mapping (ORM) and database transaction management.
  - *Why Selected*: Provides explicit transaction boundaries (`db.commit()`, `db.rollback()`) and supports row-level locking (`with_for_update()`) on team wallets to prevent concurrent double-spending race conditions.
- **Pydantic 2.9**:
  - *Purpose*: Data modeling, serialization, and input validation.
  - *Why Selected*: Powered by a core written in Rust (Pydantic-Core), delivering 5–10x faster serialization than standard Python validators.
- **Python-Jose & Passlib (Bcrypt)**:
  - *Purpose*: Authentication and credential security.
  - *Why Selected*: Passlib hashes team passwords with salted Bcrypt (cost factor 12). Python-Jose signs stateless JSON Web Tokens (HS256) containing team identity and role claims.

### 3.2 Frontend Technologies

- **React 19 + TypeScript**:
  - *Purpose*: Powers the responsive single-page participant and admin dashboards.
  - *Why Selected*: React 19's optimized reconciler pairs with TypeScript's compile-time type checking to ensure complete state integrity and eliminate runtime null errors.
- **Vite**:
  - *Purpose*: Next-generation frontend build tooling and development server.
  - *Why Selected*: Native ESM-based development server starts in $<300\text{ms}$; Rollup production bundler produces tree-shaken, ultra-compact static bundles.
- **Vanilla CSS with Design Tokens**:
  - *Purpose*: Complete user interface styling.
  - *Why Selected*: Avoids heavy CSS framework overhead (Tailwind/Bootstrap), providing 100% control over the dark glassmorphic terminal theme with CSS variables (`--bg-primary`, `--border-primary`, `--accent-green`, `--accent-red`).
- **Lightweight Charts 5.2.1 (TradingView)**:
  - *Purpose*: Interactive financial candlestick charts.
  - *Why Selected*: Built by TradingView, it renders directly to HTML5 Canvas rather than generating thousands of SVG DOM nodes. It maintains smooth 60 FPS pan/zoom interactions even with hundreds of historical candles.
- **Recharts 3.10**:
  - *Purpose*: Portfolio allocation breakdowns and P&L charts.
  - *Why Selected*: Declarative SVG components that integrate seamlessly with React state.

### 3.3 Real-Time Communication Layer

- **Full-Duplex ASGI WebSockets (`/ws/market`)**:
  - *Purpose*: Streams live tick updates, prices, breaking news, and server clock state.
  - *Why Selected*: Eliminates the HTTP polling overhead of 25 teams constantly querying the database. Updates are broadcast once per second.
- **Intelligent Reconnection & Health Probing**:
  - *Purpose*: Eliminates false "Reconnecting..." flickering.
  - *Why Selected*: Verifies connection state using `/health` probes before displaying reconnection indicators, maintaining a smooth, professional trading experience.

### 3.4 Database & Persistence Layer

- **SQLite (`market_sprint.db`) / PostgreSQL (Supabase)**:
  - *Purpose*: Stores all games, teams, credentials, 582 market prices, 582 candles, orders, fills, holdings, snapshots, and audit logs.
  - *Why Selected*: SQLite provides zero-configuration, single-file embedded deployment perfect for offline college hackathons. The SQLAlchemy ORM layer is 100% database-agnostic, allowing seamless migration to PostgreSQL or Supabase by changing a single environment variable (`DATABASE_URL`).

---

## 4. Design Rationale & Non-Goals

To maintain high reliability during live events, TradeCraft intentionally avoids unnecessary enterprise bloat:

- **No Redis / Kafka**: For a 25-team competition, an in-memory WebSocket connection manager inside FastAPI easily handles the concurrent connection load without the operational complexity of distributed message brokers.
- **No Microservices**: A cohesive, monolithic FastAPI backend ensures atomic ACID transactions across wallets, holdings, and orders without distributed two-phase commit overhead.
- **No Real-Market APIs**: Relying on real-world stock market feeds exposes tournaments to rate-limits, API downtime, and external news leaks. TradeCraft's deterministic, self-contained Meridia economy guarantees fair, reproducible, and uninterrupted gameplay.
