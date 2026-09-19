# Market Sprint — Full Architecture Overview & Antigravity Build Prompt

## 1. Project goal

Build a live, browser-based fictional stock trading simulation called:

**Market Sprint: Fictional Markets Edition**

The event allows a maximum of **25 teams/users simultaneously**.

Every team starts with:

```text
10,000 V-Coins
```

There are six fictional companies.

The market is deterministic:

- prices are predefined before the event
- news sequence is predefined
- every participant sees the same market
- prices advance according to simulation time
- news is released at predefined ticks
- orders are processed by the backend
- leaderboard is calculated from authoritative portfolio values
- no real money is involved

The organizer documents are the source of truth for the simulation rules.

---

# 2. Technology stack

Use:

```text
Frontend:
React + Vite + TypeScript
Tailwind CSS
Recharts or Lightweight Charts

Backend:
Python
FastAPI
Pydantic
SQLAlchemy/SQLModel or Supabase server SDK

Database:
Supabase PostgreSQL

Realtime:
FastAPI WebSocket and/or Supabase Realtime

Deployment:
Free-tier services suitable for a small event
```

Do not add unnecessary infrastructure.

Do NOT introduce:

```text
Kubernetes
Kafka
Redis
microservices
GPU services
AI price prediction
real stock market APIs
real brokerage APIs
```

unless there is a demonstrated technical need.

---

# 3. High-level architecture

```text
                    PARTICIPANTS
              25 simultaneous teams
                         |
                         v
              +---------------------+
              | React + Vite Client  |
              |---------------------|
              | Login                |
              | Six stock charts     |
              | News                 |
              | Buy/Sell             |
              | Portfolio/P&L        |
              | Holdings             |
              | Leaderboard          |
              +----------+------------+
                         |
                   HTTPS / WS
                         |
                         v
              +---------------------+
              |      FastAPI        |
              |---------------------|
              | Authentication       |
              | Authorization        |
              | Game Clock           |
              | Market State         |
              | News Engine          |
              | Order Engine         |
              | Portfolio Engine     |
              | Leaderboard Engine   |
              | Audit Logging        |
              +----------+------------+
                         |
                  Server-side DB
                         |
                         v
              +---------------------+
              | Supabase PostgreSQL |
              |---------------------|
              | Teams               |
              | Credentials         |
              | Companies            |
              | Prices               |
              | Candles             |
              | News                |
              | Orders              |
              | Fills               |
              | Holdings            |
              | Wallets             |
              | Leaderboard         |
              | Audit Logs          |
              +---------------------+
```

---

# 4. Core simulation timing

The source simulation uses:

```text
Tick 0 = opening price
Tick 96 = closing price
1 tick = 75 seconds
```

The backend must derive the current tick from persisted game start time.

Concept:

```python
elapsed = current_server_time - game_start_time
current_tick = floor(elapsed_seconds / 75)
```

Never use the browser clock as the authoritative clock.

Never store the current tick only in process memory.

---

# 5. Market data model

The simulation has:

```text
6 companies
×
97 ticks
=
582 locked prices
```

The live backend simply retrieves:

```text
company + current_tick → price
```

The source manual explicitly specifies that the price list is prepared, checked, locked and stored before the event, and the live event plays that list back.

Therefore:

```text
NO live price prediction
NO ML
NO random price generation during event
NO frontend price calculation
```

---

# 6. Six companies

Seed:

```text
TAVR — Tavros Energy
AERV — Aerovia Airlines
VLTN — Vaultline Bank
BRKW — Brickwell Developers
LMRA — Lumora Labs
GRFD — Greenfield Foods
```

Opening prices from the source specification:

```text
TAVR = 84.50
AERV = 42.80
VLTN = 126.40
BRKW = 58.90
LMRA = 71.20
GRFD = 95.60
```

---

# 7. News engine

There are 14 headlines.

Release ticks:

```text
Event 1  → 10
Event 2  → 16
Event 3  → 24
Event 4  → 30
Event 5  → 38
Event 6  → 44
Event 7  → 52
Event 8  → 60
Event 9  → 66
Event 10 → 72
Event 11 → 78
Event 12 → 84
Event 13 → 88
Event 14 → 92
```

Three events are scheduled/public-calendar events:

```text
Event 3
Event 5
Event 9
```

Their actual results are not shown before release.

Surprise events are not shown in advance.

---

# 8. Participant flow

```text
Login
  ↓
Validate fixed team credentials
  ↓
Create authenticated session
  ↓
Load game state
  ↓
Load current market
  ↓
Load participant portfolio
  ↓
Open WebSocket/realtime channel
  ↓
Wait for ticks/news
  ↓
Read headline
  ↓
Buy/Sell
  ↓
Backend validates
  ↓
Order waits for next tick
  ↓
Fill at next tick price
  ↓
Update wallet/holding
  ↓
Calculate portfolio value
  ↓
Update leaderboard
  ↓
Broadcast update
```

---

# 9. Fixed 25-account authentication

There are exactly 25 predefined team accounts.

Example IDs:

```text
TEAM-01
...
TEAM-25
```

Do not implement public registration.

Passwords are predetermined by the organizers but must be stored as secure password hashes.

Authentication must prevent:

```text
TEAM-01 → accessing TEAM-02
TEAM-02 → accessing TEAM-03
```

The authenticated team identity must come from the server-side session/JWT.

Never trust a client-provided `team_id`.

---

# 10. Security model

## Browser

Untrusted.

Assume participants can:

- inspect JavaScript
- modify requests
- change request bodies
- call API endpoints manually
- manipulate local state

Therefore:

```text
Frontend = presentation only
Backend = authority
Database = persisted truth
```

## SQL injection

Use parameterized queries/ORM methods.

Never concatenate user input into SQL.

## Team isolation

Every private query must use the authenticated team identity.

## Secrets

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
password hashes
organizer model
future news impacts
```

---

# 11. Trading rules

Implement the source rules:

```text
Starting balance:
10,000 V-Coins

Maximum trades:
22

Maximum portfolio allocation per buy:
35%

Maximum concentration in one company:
60%

Transaction fee:
0.4%

Cooldown:
7 seconds

Eligibility:
at least 6 trades
across at least 3 companies
```

Backend must enforce every rule.

Frontend can only provide early validation for UX.

---

# 12. Order execution

Important source rule:

```text
Orders fill at the NEXT TICK price.
```

Example:

```text
Current tick = 20
TAVR displayed price = 90

Participant buys

Order submitted at tick 20

Next tick = 21
TAVR tick-21 price = 92

Order fills at 92
```

Do not fill at 90.

Use a database transaction when applying the fill.

---

# 13. Portfolio engine

At any tick:

```text
portfolio_value =
cash
+
sum(holding_quantity × current_price)
```

P/L:

```text
portfolio_value - 10,000
```

P/L percentage:

```text
(portfolio_value - 10,000) / 10,000 × 100
```

Final value:

```text
cash + holdings valued at tick-96 prices
```

---

# 14. Leaderboard

The backend calculates:

```text
Rank
Team
Portfolio Value
P/L
P/L %
Trades
Companies Traded
Eligibility
```

Organizer dashboard additionally shows:

```text
Online/offline
Last activity
Order failures
Current holdings
Cash
Trade count
```

Leaderboard updates:

```text
trade fill
    ↓
portfolio update
    ↓
leaderboard calculation
    ↓
database
    ↓
realtime notification
    ↓
all authorized dashboards
```

---

# 15. Candlestick charts

The frontend should look like a trading application.

Use six candlestick charts.

The source data provides a locked price per tick rather than true exchange-style intratick OHLC.

Therefore create deterministic visual candles:

```text
open  = previous price
close = current price
high  = max(open, close)
low   = min(open, close)
```

If true OHLC data becomes available later, replace these values without changing the frontend architecture.

Do not claim the derived candles are real-market OHLC.

---

# 16. Realtime architecture

Use realtime only where useful.

### Market

Backend controls current tick and market state.

### News

Backend announces newly released events.

### Leaderboard

Realtime update is strongly recommended.

### Orders

Participant receives a direct order-status update.

Concept:

```text
FastAPI
  |
  +--> Database transaction
  |
  +--> Realtime/WebSocket
           |
           +--> Team A
           +--> Team B
           +--> ...
           +--> Organizer dashboard
```

---

# 17. Organizer dashboard

Create a separate protected organizer interface.

Features:

```text
Game status
Current tick
Countdown
Current news
Live leaderboard
25 team statuses
Portfolio values
P/L
Trades
Eligibility
Recent orders
Rejected orders
Audit logs
```

Do not expose organizer-only simulation information to participants.

---

# 18. Recovery

If a participant refreshes:

```text
authenticate
↓
GET game state
↓
GET current tick
↓
GET current prices
↓
GET portfolio
↓
GET holdings
↓
GET orders
↓
reconnect realtime
```

If FastAPI restarts:

```text
load game_start_time from database
↓
derive current tick
↓
continue
```

The simulation must not restart from tick 0.

---

# 19. Failure handling

Handle:

- Network failure
- Browser refresh
- WebSocket failure
- API failure
- Invalid orders
- Insufficient cash
- Insufficient holdings
- Cooldown
- Trade limit
- Game closed
- Invalid authentication
- Concurrent orders

Do not silently alter portfolio state.

Every important state change should be auditable.

---

# 20. Suggested API

```text
POST /auth/login
POST /auth/logout

GET /game/state

GET /market/overview
GET /market/{ticker}
GET /market/{ticker}/candles

GET /news

GET /portfolio
GET /holdings
GET /orders

POST /orders/buy
POST /orders/sell

GET /leaderboard

WS /ws/market
WS /ws/leaderboard
```

Organizer:

```text
GET  /admin/game
GET  /admin/teams
GET  /admin/leaderboard
GET  /admin/orders
GET  /admin/audit

POST /admin/game/start
POST /admin/game/close
```

Protect `/admin/*` with an organizer role.

---

# 21. Development order

## Phase 1 — Database

Build first.

Tasks:

1. Create Supabase project.
2. Create tables.
3. Add constraints.
4. Add indexes.
5. Seed six companies.
6. Seed 25 teams.
7. Hash fixed passwords.
8. Seed game configuration.
9. Import 97 prices per company.
10. Seed 14 news events.
11. Create candle data.
12. Create organizer-only tables.
13. Test relationships.

Do not start frontend work until the database schema is working.

---

# 22. Phase 2 — Backend

Build second.

Tasks:

1. FastAPI project.
2. Environment configuration.
3. Database connection.
4. Authentication.
5. Authorization/team isolation.
6. Game clock.
7. Market service.
8. News service.
9. Order service.
10. Transactional fills.
11. Holdings.
12. Portfolio calculations.
13. P/L.
14. Leaderboard.
15. Realtime.
16. Audit logging.
17. Admin endpoints.
18. Tests.

---

# 23. Phase 3 — Frontend

Build only after backend contracts work.

Tasks:

1. Login page.
2. Authentication state.
3. Main dashboard.
4. Market header.
5. Six company cards.
6. Candlestick charts.
7. News ticker.
8. Buy/Sell modal.
9. Portfolio.
10. Holdings.
11. Orders.
12. Leaderboard.
13. Realtime state.
14. Error/reconnect UI.
15. Organizer dashboard.

---

# 24. Phase 4 — Integration testing

Simulate all 25 teams.

Test:

```text
25 simultaneous logins
25 dashboards
multiple simultaneous orders
same-team concurrent orders
different-team concurrent orders
leaderboard updates
news broadcast
tick transitions
refresh
reconnect
backend restart
game close
```

Verify that:

```text
TEAM-01 cannot see TEAM-02 private data
TEAM-01 cannot trade using TEAM-02 identity
no one receives future news
no one changes market prices
no participant can change portfolio value
```

---

# 25. Phase 5 — Event rehearsal

Run a complete rehearsal before the real event.

Check:

```text
T0
↓
prices
↓
news
↓
orders
↓
fills
↓
portfolio
↓
leaderboard
↓
T96
↓
final ranking
```

Do not modify the locked market data during the live event.

---

# 26. Important source-model requirements

Preserve these simulation properties:

- All participants see the same prices.
- All participants see the same public headlines.
- Noise is pre-generated and shared.
- Price series is locked.
- The hidden price model remains organizer-only.
- The market does not use real financial data.
- The event is a simulation with V-Coins.
- News causes the predefined price movements.
- The leaderboard updates every tick.
- The final result uses closing prices.

---

# 27. Antigravity implementation prompt

You are building the **Market Sprint: Fictional Markets Edition** platform.

Read the project documentation files:

```text
frontend.md
backend.md
database.md
architecture.md
```

Treat them as the implementation specification.

## VERY IMPORTANT

Do not start with the frontend.

### Start with:

1. Database
2. Backend
3. Backend tests
4. Frontend
5. Integration
6. Final testing

After each major phase, verify that it works before continuing.

---

## Step 1 — Database

Create the Supabase PostgreSQL schema described in `database.md`.

Implement:

- games
- teams
- team_credentials
- companies
- market_prices
- market_candles
- news_events
- orders
- order_fills
- holdings
- team_wallets
- portfolio_snapshots
- leaderboard_snapshots
- audit_logs
- connections if required

Seed:

- one game
- 25 fixed teams
- six fictional companies
- 97 price ticks for each company
- 14 news events

Use secure password hashes.

Do not store plaintext passwords.

Add foreign keys, unique constraints, checks and indexes.

Test the database before moving forward.

---

## Step 2 — Backend

Create the FastAPI backend exactly according to `backend.md`.

Implement:

- fixed-account login
- secure password verification
- JWT/session authentication
- team isolation
- organizer role
- game clock
- current tick
- market data
- news release
- buy orders
- sell orders
- next-tick fills
- fees
- cooldown
- trade limits
- holdings
- portfolio
- P/L
- eligibility
- leaderboard
- audit logs
- reconnect/state recovery
- WebSocket/realtime updates

Use parameterized queries/ORM methods.

Never concatenate user input into SQL.

Never trust a client-supplied team ID.

Never expose organizer-only information.

---

## Step 3 — Backend tests

Before creating the frontend, test:

### Authentication

```text
TEAM-01 correct password → success
TEAM-01 wrong password → failure
invalid team → failure
```

### Isolation

```text
TEAM-01 → TEAM-02 portfolio → reject
TEAM-01 → TEAM-02 orders → reject
TEAM-01 → TEAM-02 holdings → reject
```

### Trading

```text
buy
sell
insufficient cash
insufficient holdings
22-trade limit
35% buy limit
60% concentration limit
7-second cooldown
0.4% fee
next-tick fill
```

### Market

```text
tick 0
tick transitions
tick 96
news release
future news hidden
```

### Concurrency

```text
two simultaneous orders
two orders using same cash
25 teams trading simultaneously
```

Do not proceed until these tests pass.

---

## Step 4 — Frontend

After the backend is stable, build the React/Vite frontend.

The participant screen must contain:

```text
Login
↓
Dashboard
↓
Current tick + countdown
↓
News ticker
↓
Six candlestick charts
↓
Buy/Sell
↓
Portfolio
↓
P/L
↓
Holdings
↓
Orders
↓
Leaderboard
```

Make it look like a clean modern trading platform.

Do not make it look like a generic admin panel.

---

## Step 5 — Candlestick implementation

The source data has one price per tick.

Create deterministic visual candles:

```text
open = previous price
close = current price
high = max(open, close)
low = min(open, close)
```

Clearly treat them as simulation candles.

If OHLC data is later supplied, make the chart component accept true OHLC without architectural changes.

---

## Step 6 — Realtime

Implement:

```text
market updates
news updates
leaderboard updates
order status updates
```

When a participant reconnects, fetch authoritative state from the backend.

Do not trust local browser state.

---

## Step 7 — Organizer dashboard

Create a protected organizer dashboard showing:

```text
Current tick
Countdown
Game status
Live leaderboard
25 teams
Online/offline
Cash
Holdings
Portfolio value
P/L
Trades
Eligibility
Recent orders
Audit logs
```

Do not expose the organizer-only price-generation logic to participants.

---

## Step 8 — Final integration test

Run a full simulation.

Start:

```text
Tick 0
```

Run through:

```text
Tick 96
```

Verify:

- prices change correctly
- news appears at the correct ticks
- all participants see the same market
- orders fill at the next tick
- fees are correct
- portfolio values are correct
- P/L is correct
- leaderboard updates
- team isolation works
- reconnect works
- closing locks trading

---

# 28. Do not do these things

Do NOT:

- use real stock APIs
- use real money
- use AI to predict prices
- calculate authoritative prices in frontend
- store plaintext passwords
- trust client-provided team IDs
- expose service-role credentials
- expose future news
- expose sensitivity matrix to participants
- expose hidden reaction profiles
- let participants modify market prices
- use frontend-only leaderboard calculations
- add unnecessary infrastructure

---

# 29. Definition of done

The project is complete only when:

```text
[ ] Database created
[ ] 25 teams seeded
[ ] Passwords securely hashed
[ ] Six companies seeded
[ ] 582 locked price records loaded
[ ] 14 news events loaded
[ ] Backend authentication works
[ ] Team isolation tested
[ ] Game clock works
[ ] Market data works
[ ] News timing works
[ ] Buy works
[ ] Sell works
[ ] Next-tick fills work
[ ] Fees work
[ ] Limits work
[ ] Holdings work
[ ] Portfolio/P&L works
[ ] Leaderboard works
[ ] Realtime works
[ ] Six candlestick charts work
[ ] Participant UI works
[ ] Organizer dashboard works
[ ] Reconnect works
[ ] Backend restart recovery works
[ ] Full 25-team test passes
[ ] Tick-96 closing works
```

---

# 30. Final instruction to Antigravity

**Start with the database and backend. Do not build the frontend first.**

Work in this order:

```text
DATABASE
   ↓
BACKEND
   ↓
TESTS
   ↓
FRONTEND
   ↓
REALTIME
   ↓
INTEGRATION
   ↓
FINAL TEST
```

After completing the database and backend, **stop and report the completed backend/database work and test results to me before proceeding to the frontend**.

Do not silently skip failed tests.

If a requirement is ambiguous, do not invent a new game rule. Use the source documentation and clearly report the ambiguity.

When the entire implementation is complete, provide:

1. Project structure
2. Environment variables required
3. Database setup steps
4. Backend setup steps
5. Frontend setup steps
6. Deployment steps
7. Test results
8. Known limitations
