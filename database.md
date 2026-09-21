# Database Specification — Market Sprint

## 1. Database choice

Use **Supabase PostgreSQL**.

Reasons:

- Relational data fits the simulation naturally.
- Strong transaction support for order execution.
- Constraints and foreign keys help protect data integrity.
- Realtime can be used for leaderboard/state notifications.
- 25 simultaneous teams is a small workload.
- PostgreSQL makes organizer analytics and audit queries straightforward.

The database is the source of persisted truth. FastAPI is the authority for business logic.

---

## 2. Security architecture

Preferred architecture:

```text
Browser
   |
   | HTTPS
   v
FastAPI
   |
   | server-side credentials
   v
Supabase PostgreSQL
```

The browser must NOT receive the Supabase service-role key.

If the frontend does not need direct Supabase access, keep all sensitive database operations behind FastAPI.

Use environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
```

Never commit them to Git.

---

## 3. Tables

Recommended core tables:

```text
games
teams
team_credentials
companies
market_prices
market_candles
news_events
orders
order_fills
holdings
portfolio_snapshots
leaderboard_snapshots
audit_logs
connections
```

---

## 4. `games`

Purpose: store the simulation session.

Fields:

```text
id                  UUID / BIGINT PK
name                TEXT
status              ENUM
start_time          TIMESTAMPTZ
end_time            TIMESTAMPTZ
current_tick        INTEGER
tick_seconds        FLOAT DEFAULT 37.5
starting_balance    NUMERIC(14,2) DEFAULT 10000
max_trades          INTEGER DEFAULT 22
buy_limit_percent   NUMERIC(5,2) DEFAULT 35
concentration_limit NUMERIC(5,2) DEFAULT 60
trade_fee_percent   NUMERIC(5,3) DEFAULT 0.4
cooldown_seconds    INTEGER DEFAULT 7
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Constraints:

```text
current_tick BETWEEN 0 AND 96
tick_seconds = 37.5 (1-hour contest)
starting_balance = 10000
```

---

## 5. `teams`

Purpose: public identity and event state.

Fields:

```text
id                  UUID PK
team_code           TEXT UNIQUE
display_name        TEXT
starting_balance    NUMERIC(14,2)
is_active           BOOLEAN
created_at          TIMESTAMPTZ
```

Exactly 25 records should be seeded.

Example team codes:

```text
TEAM-01
TEAM-02
...
TEAM-25
```

Do not allow public registration.

---

## 6. `team_credentials`

Keep credentials logically separate from team profile data.

Fields:

```text
team_id             UUID PK/FK
password_hash       TEXT
failed_attempts     INTEGER
locked_until        TIMESTAMPTZ NULL
last_login_at       TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

### Password rule

The organizers can define fixed passwords, but the database must store only secure hashes.

Use Argon2id or bcrypt.

Never store:

```text
password = "TEAM01@123"
```

as plaintext.

Never return password hashes through APIs.

---

## 7. `companies`

Seed six fictional companies.

Fields:

```text
id                  UUID PK
ticker              TEXT UNIQUE
name                TEXT
sector              TEXT
start_price         NUMERIC(14,2)
volatility_label    TEXT
description         TEXT
is_active           BOOLEAN
```

Source companies:

| Ticker | Company | Sector | Start price |
|---|---|---|---:|
| TAVR | Tavros Energy | Oil and gas production | 84.50 |
| AERV | Aerovia Airlines | Air travel | 42.80 |
| VLTN | Vaultline Bank | Banking | 126.40 |
| BRKW | Brickwell Developers | Property development | 58.90 |
| LMRA | Lumora Labs | Biotech | 71.20 |
| GRFD | Greenfield Foods | Packaged food and groceries | 95.60 |

These are fictional simulation entities.

---

## 8. `market_prices`

This is the authoritative locked price series.

Fields:

```text
game_id             UUID FK
company_id          UUID FK
tick                INTEGER
price               NUMERIC(14,2)
created_at          TIMESTAMPTZ
```

Primary key:

```text
(game_id, company_id, tick)
```

Expected rows for one game:

```text
6 companies × 97 ticks = 582 price rows
```

Ticks:

```text
0 ... 96
```

Important:

- Tick 0 = opening price.
- Tick 96 = closing price.
- One tick = 37.5 seconds (1-hour contest total).
- Do not update historical price rows during the live game.
- Do not let participants write to this table.

---

## 9. `market_candles`

Purpose: make the participant UI capable of showing a trading-style candlestick chart.

Fields:

```text
game_id             UUID FK
company_id          UUID FK
tick                INTEGER
open_price          NUMERIC(14,2)
high_price          NUMERIC(14,2)
low_price           NUMERIC(14,2)
close_price         NUMERIC(14,2)
created_at          TIMESTAMPTZ
```

### Source-data limitation

The organizer model specifies one locked price per company per tick, not true intratick OHLC.

Therefore the first implementation may deterministically derive visual candles:

```text
open  = previous tick price
close = current tick price
high  = max(open, close)
low   = min(open, close)
```

This is a simulation visualization, not real exchange OHLC.

If true OHLC data is later generated, replace the derived rows with the official OHLC dataset.

---

## 10. `news_events`

Fields:

```text
id                  UUID PK
game_id             UUID FK
event_number        INTEGER
release_tick        INTEGER
event_type          TEXT
headline            TEXT
description         TEXT
forecast            TEXT NULL
is_scheduled        BOOLEAN
released            BOOLEAN DEFAULT FALSE
released_at         TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ
```

Source release ticks:

```text
10, 16, 24, 30, 38, 44, 52, 60, 66, 72, 78, 84, 88, 92
```

There are 14 events.

Do not store unreleased answer/impact data in a participant-readable table if the frontend can access it directly.

---

## 11. Organizer-only market data

Create a separate protected table/schema for information such as:

```text
company_sensitivities
volatility_multipliers
reaction_profiles
noise_settings
event_impacts
price_generation_metadata
reserve_headlines
```

Do not expose these through participant endpoints.

Even if the frontend cannot see them, assume users can inspect every API response.

---

## 12. `orders`

One row per submitted order.

Fields:

```text
id                  UUID PK
game_id             UUID FK
team_id             UUID FK
company_id          UUID FK
side                TEXT CHECK (side IN ('BUY','SELL'))
quantity            INTEGER
submitted_tick      INTEGER
submitted_at        TIMESTAMPTZ
status              TEXT
requested_price     NUMERIC(14,2) NULL
fill_tick           INTEGER NULL
fill_price          NUMERIC(14,2) NULL
fee                 NUMERIC(14,2) DEFAULT 0
gross_value         NUMERIC(14,2) NULL
net_value           NUMERIC(14,2) NULL
rejection_reason    TEXT NULL
created_at          TIMESTAMPTZ
```

Do not use requested screen price as the authoritative fill price.

---

## 13. `order_fills`

Optional but recommended for a clean audit trail.

Fields:

```text
id                  UUID PK
order_id            UUID FK
fill_tick           INTEGER
fill_price          NUMERIC(14,2)
quantity            INTEGER
fee                 NUMERIC(14,2)
filled_at           TIMESTAMPTZ
```

For the current simulation, each accepted market order should normally have one fill at the next tick.

---

## 14. `holdings`

Current position per team/company.

Fields:

```text
team_id             UUID FK
company_id          UUID FK
quantity            INTEGER
average_cost        NUMERIC(14,2)
updated_at          TIMESTAMPTZ
```

Primary key:

```text
(team_id, company_id)
```

Constraint:

```text
quantity >= 0
```

---

## 15. `team_wallets`

Keep cash separate from holdings.

Fields:

```text
team_id             UUID PK/FK
cash_balance        NUMERIC(14,2)
starting_balance    NUMERIC(14,2)
updated_at          TIMESTAMPTZ
```

Constraint:

```text
cash_balance >= 0
```

---

## 16. `portfolio_snapshots`

Useful for the organizer dashboard and post-event analysis.

Fields:

```text
id                  UUID PK
game_id             UUID FK
team_id             UUID FK
tick                INTEGER
cash                NUMERIC(14,2)
holdings_value      NUMERIC(14,2)
portfolio_value     NUMERIC(14,2)
profit_loss         NUMERIC(14,2)
profit_loss_percent NUMERIC(8,3)
created_at          TIMESTAMPTZ
```

A snapshot can be recorded once per tick per team.

For 25 teams × 97 ticks this is only 2,425 rows for one game.

---

## 17. `leaderboard_snapshots`

Fields:

```text
id                  UUID PK
game_id             UUID FK
team_id             UUID FK
tick                INTEGER
rank                INTEGER
portfolio_value     NUMERIC(14,2)
profit_loss         NUMERIC(14,2)
profit_loss_percent NUMERIC(8,3)
is_eligible         BOOLEAN
created_at          TIMESTAMPTZ
```

This makes historical leaderboard inspection easy.

---

## 18. `audit_logs`

Fields:

```text
id                  UUID PK
game_id             UUID FK
team_id             UUID NULL
event_type          TEXT
tick                INTEGER NULL
order_id            UUID NULL
message             TEXT
metadata            JSONB
created_at          TIMESTAMPTZ
```

Examples:

```text
LOGIN_SUCCESS
LOGIN_FAILURE
ORDER_SUBMITTED
ORDER_REJECTED
ORDER_FILLED
TICK_CHANGED
NEWS_RELEASED
GAME_STARTED
GAME_FINISHED
ADMIN_ACTION
```

Never store passwords or secrets in metadata.

---

## 19. `connections`

Optional organizer monitoring table.

Fields:

```text
id                  UUID PK
team_id             UUID FK
connected_at        TIMESTAMPTZ
last_seen_at        TIMESTAMPTZ
disconnected_at     TIMESTAMPTZ NULL
```

This is for monitoring only and must not affect trading calculations.

---

## 20. Relationships

```text
games
 ├── teams
 ├── companies
 ├── market_prices
 ├── market_candles
 ├── news_events
 ├── orders
 ├── portfolio_snapshots
 ├── leaderboard_snapshots
 └── audit_logs

teams
 ├── team_credentials
 ├── team_wallets
 ├── holdings
 ├── orders
 ├── portfolio_snapshots
 ├── leaderboard_snapshots
 └── audit_logs

companies
 ├── market_prices
 ├── market_candles
 ├── holdings
 └── orders
```

---

## 21. Indexes

Recommended:

```text
teams(team_code)

market_prices(game_id, company_id, tick)

market_candles(game_id, company_id, tick)

news_events(game_id, release_tick)

orders(game_id, team_id, submitted_at)

orders(game_id, status)

holdings(team_id, company_id)

portfolio_snapshots(game_id, tick)

leaderboard_snapshots(game_id, tick, rank)

audit_logs(game_id, created_at)
```

---

## 22. Data integrity

Use:

- Primary keys
- Foreign keys
- UNIQUE constraints
- CHECK constraints
- NOT NULL where appropriate
- PostgreSQL transactions

Never rely only on Python validation.

---

## 23. Team isolation

All team-private records contain `team_id`.

Backend must derive the team from authenticated identity.

Example:

```text
authenticated identity = TEAM-07
```

The backend queries:

```text
WHERE team_id = TEAM-07
```

not:

```text
WHERE team_id = request.team_id
```

unless the request value has first been verified against the authenticated identity.

---

## 24. Row Level Security

If the frontend directly accesses Supabase tables, configure strict RLS policies.

Preferred simpler architecture:

```text
frontend → FastAPI → database
```

Then sensitive tables remain inaccessible from the browser.

If Supabase Realtime is used for public leaderboard updates, expose only the minimum required fields.

Never expose:

```text
password_hash
organizer-only model data
future news impacts
other team's private orders
service-role credentials
```

---

## 25. Seed process

Before event:

1. Create one game record.
2. Seed 25 teams.
3. Seed password hashes.
4. Seed six companies.
5. Import 97 prices per company.
6. Generate/insert candle data.
7. Seed 14 news events.
8. Validate ticks 0–96 exist for every company.
9. Validate no duplicate prices.
10. Validate all news ticks are correct.
11. Run simulation test.
12. Lock market data before event.

---

## 26. Database acceptance criteria

Database is ready when:

- 25 teams exist.
- Passwords are hashed.
- Six companies exist.
- 582 price rows exist for one game.
- All ticks 0–96 exist.
- 14 news events exist.
- Orders are traceable to teams.
- Every fill records fill tick and price.
- Holdings can be reconstructed.
- Portfolio value can be reconstructed.
- Leaderboard history can be reconstructed.
- Audit logs exist.
- Team-private data is isolated.
- Organizer-only data cannot be queried by participant APIs.
