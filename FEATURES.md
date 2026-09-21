# 🎯 TradeCraft — Features & Capabilities Specification

> Comprehensive reference defining all capabilities, workflows, permissions, and tools available to **Administrators (Organizers)** and **Teams (Participants)** in TradeCraft (*Market Sprint: Fictional Markets Edition*).

---

## 📑 Table of Contents
1. [User Roles & Permission Matrix](#1-user-roles--permission-matrix)
2. [Administrator Capabilities (Admin Command Center)](#2-administrator-capabilities-admin-command-center)
   - [2.1 Game Lifecycle Management](#21-game-lifecycle-management)
   - [2.2 Simulation Speed Control (Test Mode vs Live Mode)](#22-simulation-speed-control-test-mode-vs-live-mode)
   - [2.3 Real-Time Team Monitoring](#23-real-time-team-monitoring)
   - [2.4 Authoritative Master Leaderboard](#24-authoritative-master-leaderboard)
   - [2.5 Global Order Stream & Fill Audit](#25-global-order-stream--fill-audit)
   - [2.6 Manual Reserve Headline Injector](#26-manual-reserve-headline-injector)
   - [2.7 Prep-Time Fictional News Generator Studio](#27-prep-time-fictional-news-generator-studio)
   - [2.8 System Audit Trail](#28-system-audit-trail)
3. [Team (Participant) Capabilities (Trading Terminal)](#3-team-participant-capabilities-trading-terminal)
   - [3.1 Team Authentication & Security](#31-team-authentication--security)
   - [3.2 Market Overview & Equity Dashboard](#32-market-overview--equity-dashboard)
   - [3.3 Interactive Financial Candlestick Charts](#33-interactive-financial-candlestick-charts)
   - [3.4 Direct Breaking News Pop-Up Modal](#34-direct-breaking-news-pop-up-modal)
   - [3.5 Searchable News History Drawer](#35-searchable-news-history-drawer)
   - [3.6 Order Entry & Execution Engine](#36-order-entry--execution-engine)
   - [3.7 True Next-Tick Order Execution ($T \rightarrow T+1$)](#37-true-next-tick-order-execution-t-rightarrow-t1)
   - [3.8 Real-Time Portfolio Management & P&L](#38-real-time-portfolio-management--pl)
   - [3.9 Equity Holdings Inventory](#39-equity-holdings-inventory)
   - [3.10 Order History & Execution Receipts](#310-order-history--execution-receipts)
   - [3.11 Automated Risk & Trading Guardrails](#311-automated-risk--trading-guardrails)
   - [3.12 Podium Prize Eligibility Tracking](#312-podium-prize-eligibility-tracking)
4. [Comparative Capabilities Summary](#4-comparative-capabilities-summary)

---

## 1. User Roles & Permission Matrix

TradeCraft strictly bifurcates permissions between the **Administrator** (the competition organizer) and **Teams** (the 25 competition participants):

```
+=======================================================================================================+
| CAPABILITY / FEATURE                          | ADMINISTRATOR (`ADMIN`) | TEAMS (`TEAM-01` .. `TEAM-25`) |
+=======================================================================================================+
| Start, Pause, Resume Simulation Clock         |            ✅           |               ❌               |
| Full Tournament Restart (Reset all 25 teams)  |            ✅           |               ❌               |
| Toggle 1s Test Mode vs 75s Live Mode          |            ✅           |               ❌               |
| View Master Ranked Leaderboard                |            ✅           |          ❌ (Admin only)       |
| Monitor All 25 Teams (Cash, Holdings, Orders) |            ✅           |               ❌               |
| Inspect Global Orders Across All Teams        |            ✅           |               ❌               |
| Fire Reserve News Headlines On-Demand         |            ✅           |               ❌               |
| Generate Fictional News Candidates            |            ✅           |               ❌               |
| View Full System Audit Trail                  |            ✅           |               ❌               |
| Place Buy & Sell Orders                       |            ❌           |               ✅               |
| View Private Team Cash & Portfolio Value      |            ✅           |        ✅ (Own team only)      |
| View Interactive Candlestick Charts           |            ✅           |               ✅               |
| Receive Direct Breaking News Pop-Ups          |            ✅           |               ✅               |
| Search News History                           |            ✅           |               ✅               |
| View Own Holdings Inventory & Cost Basis      |            ✅           |        ✅ (Own team only)      |
| View Own Order History & Execution Status     |            ✅           |        ✅ (Own team only)      |
| Check Prize Eligibility Status                |            ✅           |               ✅               |
+=======================================================================================================+
```

---

## 2. Administrator Capabilities (Admin Command Center)

The Admin Command Center (`/admin`) is designed for event organizers to operate, monitor, and audit the competition with zero manual spreadsheet tracking.

### 2.1 Game Lifecycle Management
- **`▶ Start Game`**:
  - Initializes the persisted `start_time` in the database.
  - Transitions the game status from `DRAFT` or `READY` to `RUNNING`.
  - Begins the countdown from Tick 0 to Tick 96.
  - Automatically activates order placement for all 25 teams.
- **`⏸ Pause Game`**:
  - Halts the simulation clock without terminating the session.
  - Records `paused_at` timestamp.
  - Prevents order submission while paused with clear participant messaging.
  - Useful during organizer announcements or technical pauses.
- **`▶ Resume Game`**:
  - Calculates the elapsed pause duration: `pause_duration = now - paused_at`.
  - Shifts `start_time` forward by the exact pause duration: `start_time = start_time + pause_duration`.
  - Guarantees **zero tick distortion or skipped ticks** upon resuming.
- **`🔄 Restart Game (Batch Reset)`**:
  - Complete tournament reset designed for multi-batch events (e.g., Round 1 with 25 teams, Round 2 with next 25 teams).
  - Wipes all orders, fills, and holdings across all teams.
  - Resets all 25 team cash balances back to **₡10,000.00 V-Coins**.
  - Wipes portfolio snapshots and leaderboard snapshots.
  - Resets news events state (unreleases all headlines).
  - Resets game clock to Tick 0.

### 2.2 Simulation Speed Control (Test Mode vs Live Mode)
- **Live Competition Mode (Default)**:
  - **75 seconds per tick**.
  - Total simulation duration: 96 ticks × 75s = **7,200 seconds (2 hours)**.
  - Realistic decision-making tempo mirroring institutional markets.
- **Rapid Test Mode (1-Second Ticks)**:
  - **1 second per tick**.
  - Runs the entire 97-tick tournament in **97 seconds**.
  - Allows organizers to dry-run the complete event, verify news popups, order fills, and leaderboard rankings before doors open.

### 2.3 Real-Time Team Monitoring
- **Tabular Status of All 25 Teams**:
  - Team Identifier (`TEAM-01` through `TEAM-25`) and Display Name.
  - Current Cash Balance (liquid V-Coins).
  - Holdings Market Value (current value of equity inventory).
  - Total Authoritative Portfolio Value (`Cash + Holdings`).
  - Total Profit / Loss (₡) and P&L Percentage (%).
  - Total Trade Count executed (out of 22 max).
  - Unique Companies Traded (diversification tracking).
  - Podium Eligibility Status (`ELIGIBLE` or `INELIGIBLE`).
  - Timestamp of most recent order submission.

### 2.4 Authoritative Master Leaderboard
- **Ranked Tournament Standings**:
  - Automatically sorts all 25 teams descending by total portfolio value.
  - Updated every second via the calculation engine.
  - Displays rank numbers (Rank 1 to 25).
  - Highlights podium leaders (Gold, Silver, Bronze).
  - Clearly tags disqualified teams who failed the activity/diversification rules.
  - Formatted for stage projector display.

### 2.5 Global Order Stream & Fill Audit
- **Full Order Book Visibility**:
  - Live log of every order submitted across all teams.
  - Displays Order ID, Team Code, Ticker, Side (`BUY` / `SELL`), Quantity.
  - Status tracking: `PENDING`, `FILLED`, or `REJECTED`.
  - Submitted Tick vs Actual Fill Tick.
  - Fill Price (₡), Gross Value, and Levied Fee (0.4%).
  - Detailed rejection reasons for failed orders (e.g., "Insufficient cash", "Exceeds 35% buy limit").

### 2.6 Manual Reserve Headline Injector
- **On-Demand Breaking News**:
  - Organizers can fire reserve headlines at will:
    - **Reserve 1 (R1)**: *"Retail sales rebound strongly"* (GRFD +2.0%, BRKW +2.0%).
    - **Reserve 2 (R2)**: *"MRB governor signals patience on interest rates"* (VLTN -1.5%, BRKW +3.0%, LMRA +3.0%).
  - Fires at the exact tick the organizer clicks **"Fire Now"**.
  - Automatically pops up on all participant trading terminals.

### 2.7 Prep-Time Fictional News Generator Studio
- **Pre-Competition Authoring Utility**:
  - Built-in library of non-predictive Meridia headline templates.
  - Filterable by **Macro**, **Company-Specific**, and **Policy**.
  - Displays suggested macroeconomic sensitivity drivers (`RATES`, `OIL`, `DEMAND`, `SENTIMENT`) and reaction profiles (`STEP`, `SPIKE-AND-FADE`, `SLOW-BURN`) to assist organizers in script design.

### 2.8 System Audit Trail
- **Immutable Chronological Log**:
  - Records every administrative and participant action with UTC timestamp and simulation tick:
    - `GAME_STARTED`, `GAME_PAUSED`, `GAME_RESUMED`, `GAME_RESTARTED`.
    - `ORDER_SUBMITTED`, `ORDER_FILLED`, `ORDER_REJECTED`.
    - `RESERVE_NEWS_FIRED`.

---

## 3. Team (Participant) Capabilities (Trading Terminal)

The Participant Dashboard (`/dashboard`) provides a professional, terminal-grade trading interface for the 25 competing teams.

### 3.1 Team Authentication & Security
- **Secure Fixed Logins**:
  - Pre-seeded credentials for `TEAM-01` through `TEAM-25`.
  - Bcrypt-hashed password authentication.
  - Automatic routing to the terminal upon authentication.
  - Secure session storage with automatic expiration.

### 3.2 Market Overview & Equity Dashboard
- **The Meridia Six**:
  - Real-time stock cards for all six canonical equities:
    - **TAVR** — Tavorin Energy (Energy)
    - **AERV** — Aerovia Airlines (Airlines)
    - **VLTN** — Vaultline Bank (Banking)
    - **BRKW** — Brickwell Developers (Property & Construction)
    - **LMRA** — Lumora Labs (Enterprise Cloud Software)
    - **GRFD** — Greenfield Foods (Consumer Staples)
  - Displays Current Price (₡), 24h Change (₡), Percentage Change (%), and Opening Price.
  - Visual color indicators (Emerald green for gains, Coral red for losses).
  - Quick-action **BUY** and **SELL** buttons on every card.

### 3.3 Interactive Financial Candlestick Charts
- **TradingView-Powered Lightweight Charts**:
  - High-performance, canvas-rendered OHLC candlestick charts for every equity.
  - Zoom, pan, and hover inspection across all ticks up to the current simulation tick.
  - Mini sparklines for rapid visual scanning across the dashboard.
  - **Full-Screen Chart Modal**: Click any chart to expand into an in-depth analytical modal with candlestick crosshairs and volume analysis.

### 3.4 Direct Breaking News Pop-Up Modal
- **Zero-Spoiler Immediate News Alerts**:
  - No upcoming event countdowns or pre-announced warnings that spoil events.
  - The instant a news headline lands on the wire (at predefined or reserve ticks), a **high-visibility pop-up modal directly appears** on the participant's screen:
    - Flashing breaking news badge (`🔴 BREAKING NEWS — MERIDIA WIRE`).
    - Simulation Tick and Time offset (e.g., `Tick 24 • T+30:00`).
    - Topic / Calendar title.
    - Large, high-contrast headline text.
    - Factual, non-predictive background summary.
    - **"Trade Now →"** button to immediately dismiss and execute orders.
  - Can be re-opened anytime by clicking the headline banner on the dashboard.

### 3.5 Searchable News History Drawer
- **Historical Intelligence Archive**:
  - Click **"📰 News History"** in the wire header to open the slide-out history drawer.
  - Chronological list of every news event released up to the current tick.
  - Full-text search input to filter headlines by keywords (e.g., "oil", "rates", "takeover").
  - Click any historical item to view its complete details.
  - Clean display without distracting "released" or "not released" status tags.

### 3.6 Order Entry & Execution Engine
- **Trade Modal**:
  - Quick-order dialog opened via "BUY" or "SELL" buttons.
  - Dynamic share quantity input with instant financial calculations:
    - **Estimated Gross Value** = `Quantity × Current Price`.
    - **Transaction Fee** = `Gross Value × 0.4%`.
    - **Estimated Net Total** = `Gross Value + Fee` (Buy) or `Gross Value - Fee` (Sell).
  - Built-in validation warnings before submission (e.g., warning if order value exceeds 35% buy limit or if shares are insufficient).

### 3.7 True Next-Tick Order Execution ($T \rightarrow T+1$)
- **Fair Market Matching**:
  - Orders submitted during Tick $T$ are placed into **`PENDING`** state.
  - Cash is reserved immediately at Tick $T$ estimated price + fee to prevent double-spending.
  - Order executes when the clock advances to Tick $T+1$ at the official Tick $T+1$ price.
  - Cash variance (the difference between estimated price and actual fill price) is automatically adjusted into the team wallet upon execution.
  - Eliminates latency exploitation and front-running.

### 3.8 Real-Time Portfolio Management & P&L
- **Live Portfolio Panel**:
  - **Total Portfolio Value**: The authoritative measure of team wealth (`Cash + Total Market Value of Holdings`).
  - **Cash Balance**: Liquid V-Coins available for trading.
  - **Total Profit / Loss**: Net gain or loss relative to the ₡10,000 starting balance.
  - **P&L Percentage**: Return on investment percentage.
  - **Trades Remaining**: Live countdown of remaining trades (starting at 22, decrementing per order).

### 3.9 Equity Holdings Inventory
- **Holdings Table**:
  - Displays all open positions in inventory:
    - Company Ticker and Name.
    - Number of Shares owned (`Quantity`).
    - Weighted Average Purchase Price (`₡ Average Cost`).
    - Current Market Price.
    - Total Position Market Value.
    - Unrealized P&L (₡ and %).
  - Quick **"Trade"** button to instantly launch the sell modal with owned share count pre-populated.

### 3.10 Order History & Execution Receipts
- **Orders Table**:
  - Comprehensive ledger of all team orders.
  - Shows Order Side (`BUY` / `SELL`), Ticker, and Quantity.
  - Submission Tick vs Fill Tick.
  - Execution Price and Levied Fee (0.4%).
  - Status badge: `PENDING` (awaiting next tick) or `FILLED`.
  - Rejection message if an order was denied by the risk engine.

### 3.11 Automated Risk & Trading Guardrails
The trading engine automatically enforces 6 strict trading rules on every order:
1. **Minimum Order Value**: Minimum order size of **₡100.00 V-Coins**.
2. **22-Trade Hard Cap**: Each team is limited to **22 total trades** (buys + sells) during the entire game.
3. **35% Portfolio Buy Limit**: No single buy order can exceed **35.0% of total portfolio value**.
4. **60% Concentration Cap**: Total holdings in any single company cannot exceed **60.0% of total portfolio value**.
5. **0.4% Transaction Fee**: Deducted from gross value on every buy and sell.
6. **7-Second Cooldown**: Mandatory 7-second cooldown between consecutive order submissions.
7. **No Short Selling**: Selling requires owning the underlying shares.

### 3.12 Podium Prize Eligibility Tracking
- **Activity & Diversification Rules**:
  - To qualify for podium prizes, teams must satisfy:
    1. **At least 6 completed trades** (`trade_count >= 6`).
    2. **Across at least 3 distinct companies** (`companies_traded >= 3`).
  - Terminal displays current progress towards meeting both eligibility criteria.

---

## 4. Comparative Capabilities Summary

```
+-----------------------------------------------------------------------------------------------+
| FUNCTIONAL AREA     | ADMINISTRATOR CAPABILITIES           | TEAM (PARTICIPANT) CAPABILITIES  |
+---------------------+--------------------------------------+----------------------------------+
| Simulation Clock    | Start, Pause, Resume, Reset, 1s Mode | View current tick & countdown    |
| Market Data         | View precomputed master price tables | View live prices & candlesticks  |
| Equities Traded     | Configure company parameters         | Trade all 6 canonical equities   |
| News Distribution   | Review script, fire reserves         | Receive pop-ups, search history  |
| Trading             | View global order stream & fees      | Submit Buy / Sell orders         |
| Risk Enforcement    | Monitor rejections and limits        | Bound by 6 automated guardrails  |
| Portfolio View      | Inspect all 25 team portfolios       | View own cash, holdings, and P&L |
| Leaderboard         | View full ranked master standings    | Private portfolio tracking       |
| Audit & Compliance  | Full chronological audit trail       | View own execution receipts      |
+-----------------------------------------------------------------------------------------------+
```
