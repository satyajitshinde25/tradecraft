# Backend Specification — Market Sprint

## 1. Purpose

Build the authoritative FastAPI backend for a 25-team live fictional stock-market simulation.

The backend is the single authority for:

- Authentication
- Team identity
- Game state
- Simulation clock
- Current tick
- Price retrieval
- News release
- Order validation
- Order execution
- Fees
- Holdings
- Portfolio valuation
- P/L
- Trade limits
- Eligibility
- Leaderboard
- Reconnection/state recovery
- Audit logging
- Organizer controls

The frontend is never authoritative.

---

## 2. Core source model

The simulation has:

- 6 fictional companies
- Tick 0 through tick 96
- 75 seconds per tick
- 2-hour trading session
- 10,000 V-Coins starting balance per participant
- 14 headlines
- 3 scheduled events and 11 surprise events
- Locked, precomputed price series
- Same market data for all teams
- Maximum 22 trades
- Maximum 35% of portfolio per buy
- Maximum 60% concentration in one company
- 0.4% transaction fee
- 7-second cooldown
- Eligibility: at least 6 trades across at least 3 companies
- Final ranking by closing portfolio value

The source model explicitly states that the live event plays back a locked list of 97 prices per company rather than calculating prices live.

---

## 3. Architecture

```text
React frontend
      |
      | HTTPS / WebSocket
      v
FastAPI
  |
  +-- Auth service
  +-- Game clock
  +-- Market service
  +-- News service
  +-- Order service
  +-- Portfolio service
  +-- Leaderboard service
  +-- Audit service
  |
  v
Supabase PostgreSQL
```

Optional:

```text
FastAPI
   |
   +---- Supabase Realtime / WebSocket
```

Do not add Redis, Kafka, microservices, Kubernetes, or a separate market engine unless testing proves they are necessary.

For 25 concurrent teams this is unnecessary complexity.

---

## 4. Server-authoritative game clock

Store one authoritative `game_start_time`.

Calculate the current tick from server time:

```python
elapsed_seconds = now_utc - game_start_time
current_tick = floor(elapsed_seconds / 75)
```

Bound:

```text
minimum tick = 0
maximum tick = 96
```

If:

```text
current_tick >= 96
```

the game is closing/closed according to the configured close rule.

Do not increment a Python variable once every 75 seconds and assume the process will always remain alive. The tick must be derivable from persisted start time so restart/redeploy does not reset the simulation.

---

## 5. Game state

Suggested state machine:

```text
DRAFT
  ↓
READY
  ↓
RUNNING
  ↓
CLOSING
  ↓
FINISHED
```

Optional:

```text
RUNNING → PAUSED → RUNNING
```

If pause/resume is not part of the event rules, do not implement it initially.

---

## 6. Market service

The market service must:

1. Determine current tick.
2. Read the six company prices for that tick.
3. Read public news events released by that tick.
4. Return the market snapshot.

Example:

```json
{
  "tick": 52,
  "timestamp": "...",
  "prices": {
    "TAVR": 93.20,
    "AERV": 39.15,
    "VLTN": 128.40,
    "BRKW": 56.10,
    "LMRA": 75.50,
    "GRFD": 94.20
  }
}
```

The exact numbers must come from the database's locked data.

---

## 7. No live price calculation

Do not implement the hidden price model inside the production request path.

The organizer specification says the final 97-price series is prepared, checked and locked before the event.

Therefore:

```text
pre-event:
model/script → generate → validate → store

live:
database → retrieve → broadcast
```

This makes the live system deterministic.

---

## 8. News service

Store the 14 events with their release ticks.

The source script uses:

```text
10
16
24
30
38
44
52
60
66
72
78
84
88
92
```

At each tick:

```python
events = get_news_events_for_tick(current_tick)
```

Only release an event when its tick has arrived.

Scheduled events:

- Consumer Confidence Index
- Vaultline earnings
- MRB rate decision

Participants can see their public calendar/forecast, but not the unreleased outcome.

---

## 9. Order flow

A buy request:

```text
Frontend
   ↓
POST /orders/buy
   ↓
authenticate token
   ↓
resolve team from server-side identity
   ↓
validate game is RUNNING
   ↓
validate company
   ↓
validate cooldown
   ↓
validate trade count
   ↓
validate 35% buy limit
   ↓
validate cash
   ↓
create pending order
   ↓
next tick
   ↓
fill at next tick price
   ↓
apply fee
   ↓
update cash
   ↓
update holding
   ↓
record fill
   ↓
recalculate portfolio
   ↓
update leaderboard
   ↓
broadcast update
```

Sell follows the same principle.

---

## 10. Market order rule

The source rule is:

> Market orders fill at the next tick's price, not the price on screen.

Therefore a request at tick 52 must not automatically use tick 52's price.

It becomes eligible for execution at tick 53.

If the game closes before a pending order can legally fill, define a deterministic close policy before implementation. Recommended:

```text
No fill after closing.
Mark order EXPIRED.
```

Do not silently fill a closing order at an invented price.

---

## 11. Concurrency and transactions

This is critical.

Two requests can arrive nearly simultaneously.

Example:

```text
cash = 1000

BUY request A
BUY request B
```

Without a transaction/locking strategy, both may see 1000 and overspend.

Use PostgreSQL transactions for order execution.

Conceptually:

```text
BEGIN
  lock team/portfolio row
  read current cash
  validate
  create/update order
  update cash/holding
  COMMIT
```

The exact SQL/ORM implementation must use safe parameterized queries.

---

## 12. SQL injection prevention

Do not construct SQL like:

```python
query = f"SELECT * FROM users WHERE team_id = '{team_id}'"
```

Use SQLAlchemy/SQLModel parameter binding or Supabase's safe query interface.

Also validate:

- team ID format
- ticker format
- quantity
- numeric ranges
- enum values

Never trust request JSON.

---

## 13. Authentication

There are exactly 25 predefined team accounts.

Recommended:

```text
team_id
password_hash
team_name
is_active
```

Passwords are fixed by organizers but stored as secure password hashes.

Never store plaintext passwords.

Login:

```text
team_id + password
        ↓
verify password hash
        ↓
create session/JWT
        ↓
token contains authenticated team identity
```

Do not allow the client to choose another `team_id` for protected endpoints.

---

## 14. Authorization and team isolation

This is mandatory.

Never accept:

```text
GET /portfolio?team_id=TEAM-07
```

and blindly trust the parameter.

Instead:

```text
JWT/session
    ↓
authenticated_team_id
    ↓
server-side query
    ↓
WHERE team_id = authenticated_team_id
```

If a user changes a URL or request body to another team:

```text
TEAM-01 token
TEAM-02 requested
```

backend must reject it.

For team-private endpoints:

```text
403 Forbidden
```

or return only the authenticated team's resource.

Organizer endpoints require a separate organizer role.

---

## 15. Password security

Use:

- Argon2id or bcrypt
- Rate limiting
- Generic login failure messages
- Secure HTTP-only cookies if using cookie sessions
- HTTPS only
- No password logging
- No password returned in API responses

Because there are fixed accounts, disable registration.

---

## 16. Portfolio calculation

At any tick:

```text
portfolio_value =
cash
+
sum(quantity × current_price)
```

P/L:

```text
profit_loss = portfolio_value - starting_balance
```

P/L %:

```text
profit_loss_percent =
profit_loss / starting_balance × 100
```

Use the current authoritative tick price.

Do not use browser-calculated values for ranking.

---

## 17. Leaderboard

At every tick and after every filled trade:

```text
for each active team:
    calculate portfolio value
    calculate P/L
    determine eligibility
    rank according to configured ranking rules
```

During the game, show live ranking.

At closing:

```text
freeze final values
freeze final ranking
determine eligible participants
```

Eligibility:

```text
trade_count >= 6
AND
distinct_companies_traded >= 3
```

Final winner selection must use the documented final portfolio value and eligibility rule.

---

## 18. Leaderboard real-time updates

Use:

```text
FastAPI
   ↓
database update
   ↓
Realtime event / WebSocket
   ↓
participant dashboards
   ↓
organizer dashboard
```

Do not let the frontend calculate rankings independently.

---

## 19. Organizer dashboard backend

Organizer-only APIs:

```text
GET /admin/game
GET /admin/teams
GET /admin/leaderboard
GET /admin/orders
GET /admin/audit
POST /admin/game/start
POST /admin/game/close
POST /admin/game/pause   (only if supported)
```

Organizer dashboard should show:

- 25 teams
- online/offline status
- current cash
- holdings value
- portfolio value
- P/L
- trades
- companies traded
- eligibility
- last activity
- rejected orders
- current tick
- current news event
- server/game health

---

## 20. Audit logging

Log:

- Login attempt
- Successful login
- Failed login
- Logout
- Order request
- Order rejection
- Order fill
- Trade fee
- Tick transition
- News release
- Game start
- Game close
- Admin action
- Connection/reconnection where useful

Never log passwords or secrets.

Audit records should include:

```text
timestamp
event_type
team_id (if applicable)
request/order ID
tick
metadata
```

---

## 21. Reconnection

The backend must support recovery after:

- Browser refresh
- Network interruption
- WebSocket disconnect
- Backend restart

On reconnect:

```text
GET /game/state
GET /portfolio
GET /holdings
GET /orders
GET /market/overview
```

The backend reconstructs state from persisted data.

---

## 22. Game close

At tick 96:

1. Stop accepting new orders.
2. Resolve the configured treatment of pending orders.
3. Calculate closing portfolio values using tick-96 prices.
4. Freeze leaderboard.
5. Mark game FINISHED.
6. Store final rankings.
7. Allow read-only participant access.
8. Preserve audit logs.

---

## 23. Backend invariants

The following must never become false:

```text
cash >= 0
holding quantity >= 0
trade count <= 22
single-company concentration <= 60%
buy allocation <= 35%
only authenticated team can modify its own account
prices come from locked market data
future news is not released
finished game cannot accept trades
```

---

## 24. Testing

Test at minimum:

### Authentication
- valid team
- invalid password
- inactive team
- repeated failures
- token expiry

### Isolation
- Team 01 trying Team 02 portfolio
- Team 01 trying Team 02 orders
- Team 01 trying Team 02 holdings
- manipulating team_id in request body

### Trading
- valid buy
- valid sell
- insufficient cash
- insufficient holdings
- 22nd/23rd trade
- 35% buy limit
- 60% concentration limit
- 7-second cooldown
- 0.4% fee
- next-tick fill

### Market
- tick calculation
- price lookup
- news release
- scheduled countdown
- game close

### Recovery
- backend restart
- refresh
- websocket reconnect

### Concurrency
- two simultaneous orders
- two orders spending same cash
- simultaneous orders from different teams
