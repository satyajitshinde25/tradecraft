# Frontend Specification — Market Sprint

## 1. Purpose

Build the participant trading interface for **Market Sprint: Fictional Markets Edition**.

The frontend must behave like a lightweight real trading terminal while remaining a simulation:

- 25 predefined teams/accounts can participate.
- Every team starts with 10,000 V-Coins.
- Each team sees the same six fictional companies, prices, charts, and news at the same time.
- Prices are authoritative data supplied by the backend/database; the browser never decides the official price.
- News appears at the predefined event ticks.
- The leaderboard updates live.
- The interface must show real-time cash, holdings, portfolio value, profit/loss, orders and trade limits.
- The frontend must never expose organizer-only information such as the hidden sensitivity matrix, reaction profiles, noise settings, or unreleased future event effects.

The source simulation uses six companies, tick 0–96, one tick every 75 seconds, 14 headlines, a 10,000 V-Coin starting balance, and a fixed price series that is prepared before the event. The live system is intended to replay that locked data rather than calculate prices in the browser.

---

## 2. Recommended stack

- React + Vite
- TypeScript
- Tailwind CSS
- Recharts or Lightweight Charts for financial charts
- React Router
- Fetch/Axios for REST API
- WebSocket or Supabase Realtime for live updates
- Supabase Auth is optional; for this event, fixed team credentials can instead be authenticated by FastAPI against a seeded users table.
- Never put a Supabase service-role key in the frontend.

---

## 3. Pages

### 3.1 Login page

Fields:

- Team ID
- Password
- Sign in button

Requirements:

- Exactly 25 predefined team IDs.
- Do not allow public registration.
- Do not expose whether another team ID exists.
- Show a generic invalid-credentials message.
- Rate-limit repeated failed login attempts.
- On successful login, backend returns a secure session/JWT.
- Store only the short-lived authentication token/session required by the frontend.
- Never store plaintext passwords in browser storage.

Example:

```text
TEAM-01
TEAM-02
...
TEAM-25
```

The actual passwords are seeded as hashes in the database, not plaintext.

---

## 4. Participant dashboard

Main layout:

```text
+------------------------------------------------------+
| Market Sprint | Tick 42 | 00:xx remaining | Logout   |
+------------------------------------------------------+
| Portfolio | Cash | P/L | P/L % | Trades Remaining   |
+------------------------------------------------------+
|                    NEWS TICKER                       |
+------------------------------------------------------+
| TAVR Chart              | AERV Chart                 |
| Price + Buy/Sell        | Price + Buy/Sell           |
+-------------------------+----------------------------+
| VLTN Chart              | BRKW Chart                 |
+-------------------------+----------------------------+
| LMRA Chart              | GRFD Chart                 |
+------------------------------------------------------+
| Holdings / Orders       | Live Leaderboard           |
+------------------------------------------------------+
```

The six companies:

- TAVR — Tavros Energy
- AERV — Aerovia Airlines
- VLTN — Vaultline Bank
- BRKW — Brickwell Developers
- LMRA — Lumora Labs
- GRFD — Greenfield Foods

---

## 5. Stock cards

Each stock card should show:

- Company name
- Ticker
- Sector
- Current price
- Absolute change from opening
- Percentage change from opening
- Current position quantity
- Current holding value
- Buy button
- Sell button
- Chart
- Optional mini market status indicator

Do not show hidden volatility multipliers, sensitivities, reaction profiles, future effects, or organizer-only data.

---

## 6. Candlestick chart

The visual should resemble a real trading application.

Recommended:

- Candlestick chart
- Time/tick axis
- Price axis
- Current price marker
- Opening-price reference line
- Tooltip
- Zoom/pan if practical
- Responsive mobile/desktop behavior

### Important simulation detail

The source specification gives one locked price per company per tick, not intratick OHLC data.

Therefore the implementation must not falsely claim that the source contains real market OHLC.

Preferred implementation:

1. Backend/database stores the authoritative locked price at each tick.
2. Backend also exposes deterministic candle data.
3. If only one price exists per tick, create a visual candle deterministically:
   - `open = previous tick close`
   - `close = current tick price`
   - `high = max(open, close)`
   - `low = min(open, close)`
4. Label the chart internally as simulation/candle data rather than real-market OHLC.
5. If the organizers later provide true OHLC values, replace the derived values with those values without changing the UI.

This produces a trading-style candlestick chart while preserving the simulation's fixed-price source.

---

## 7. Market clock

The frontend must NOT be the authority for time.

Backend provides:

```json
{
  "game_status": "RUNNING",
  "current_tick": 42,
  "server_time": "...",
  "tick_started_at": "...",
  "next_tick_at": "..."
}
```

Frontend uses these values to render a countdown.

If the browser refreshes:

1. Authenticate again using the existing session.
2. Request current game state.
3. Jump directly to the current tick.
4. Fetch current portfolio and holdings.
5. Resume live updates.

Do not restart the game timer on refresh.

---

## 8. Price updates

At every tick:

1. Backend determines the current tick.
2. Backend reads the locked price data.
3. Backend broadcasts/returns the new prices.
4. Frontend updates all six charts.
5. Current portfolio valuation is recalculated/displayed.
6. Leaderboard data is refreshed/live-updated.

The frontend must never calculate the official stock price.

---

## 9. News system

All participants receive the same public news event at the same simulation tick.

News UI:

- Large headline banner
- Timestamp/tick
- Event type if appropriate
- News feed/history
- Scheduled-event countdown when applicable

For scheduled events:

- Show public forecast.
- Show countdown before event.
- Do not reveal the actual result before the event.

For surprise events:

- Do not reveal them in advance.

The frontend should only receive a news event when the backend marks it as released.

---

## 10. Trading modal

When Buy is clicked:

```text
Company: TAVR
Current market price: 91.20
Available cash: 7,200
Maximum allowed purchase: ...
Quantity: [   ]

Estimated order value
Fee
Total cost

[CONFIRM BUY]
```

Sell:

```text
Company: TAVR
Current holdings: 40
Current price: 91.20
Quantity: [   ]

Estimated proceeds
Fee

[CONFIRM SELL]
```

The displayed estimate is only an estimate.

The backend is authoritative and performs the final validation/fill.

---

## 11. Order behavior

Source rule:

- Market orders fill at the next tick's price, not the price currently shown on screen.

Frontend must communicate this clearly:

> Orders are filled at the next tick price.

After submission:

```text
ORDER PENDING
        ↓
backend accepts request
        ↓
next tick
        ↓
order fills at next tick price
        ↓
portfolio updates
```

Do not immediately pretend that the order filled at the visible price.

---

## 12. Trading restrictions shown in UI

Display:

- Maximum 22 trades
- Maximum 35% of portfolio per buy
- Maximum 60% of portfolio in one company
- 0.4% transaction fee
- 7-second cooldown
- Minimum eligibility requirement: at least 6 trades across at least 3 companies

The backend enforces these rules. The frontend only provides friendly validation.

---

## 13. Portfolio panel

Show:

```text
Starting balance       10,000.00
Cash                    6,200.00
Holdings value          4,850.00
Portfolio value        11,050.00

P/L                    +1,050.00
P/L %                  +10.50%

Trades used                 8 / 22
Companies traded            3 / 3+
```

P/L:

```text
P/L = current portfolio value - 10,000
```

P/L percentage:

```text
P/L % = (P/L / 10,000) × 100
```

Final ranking is based on final portfolio value at closing, subject to eligibility.

---

## 14. Holdings table

Columns:

- Company
- Quantity
- Average fill price
- Current price
- Market value
- Unrealized P/L
- P/L %

Do not allow the frontend to directly edit any value.

---

## 15. Order history

Columns:

- Time
- Tick submitted
- Fill tick
- Company
- BUY/SELL
- Quantity
- Fill price
- Fee
- Total value
- Status

Possible statuses:

- PENDING
- FILLED
- REJECTED
- CANCELLED

If cancellation is not part of the backend rules, do not expose a cancel button.

---

## 16. Leaderboard

Show:

| Rank | Team | Portfolio Value | P/L | P/L % |
|---|---|---:|---:|---:|

Participant-facing leaderboard should expose only the information the event organizers decide is public.

Organizer dashboard can additionally show:

- Team ID
- Login status
- Number of trades
- Companies traded
- Cash
- Holdings
- Portfolio value
- Eligibility status
- Last activity
- Connection status

Leaderboard must update without manual page refresh.

---

## 17. Real-time transport

Preferred approach:

### Market state

Use a backend-controlled WebSocket or short polling endpoint.

### Leaderboard

Use WebSocket/Supabase Realtime.

### Important rule

Realtime messages are notifications/state updates, not authority.

The backend/database remains the source of truth.

---

## 18. Error states

Handle:

- Lost internet
- WebSocket disconnected
- API timeout
- Server unavailable
- Game not started
- Game paused
- Game finished
- Order rejected
- Cooldown active
- Insufficient cash
- Insufficient holdings
- Trade limit reached

If disconnected:

```text
Connection lost
Reconnecting...
```

After reconnect:

```text
GET current game state
GET current portfolio
GET current holdings
GET latest market state
```

Never continue making local official market decisions while disconnected.

---

## 19. Security rules

The frontend must assume the user can inspect and modify browser JavaScript.

Therefore:

- Never trust frontend calculations.
- Never trust frontend team IDs.
- Never trust frontend prices.
- Never trust frontend portfolio values.
- Never trust frontend trade-limit checks.
- Never expose database service-role credentials.
- Never expose organizer-only price scripts.
- Never expose future unreleased news.
- Never expose other teams' private order details unless intentionally public.

---

## 20. UX principles

The interface should feel like a clean trading terminal, not a generic college dashboard.

Priorities:

1. Current price
2. News
3. Buy/Sell
4. Portfolio
5. P/L
6. Leaderboard
7. Order history

Use clear green/red price movement indicators, but do not rely on color alone.

The six charts must remain readable. On desktop use a 2×3 grid; on mobile stack the cards.

---

## 21. Frontend API contract

Expected endpoints:

```text
POST   /auth/login
POST   /auth/logout
GET    /game/state
GET    /market/overview
GET    /market/{symbol}
GET    /market/{symbol}/candles
GET    /news
GET    /portfolio
GET    /holdings
GET    /orders
POST   /orders/buy
POST   /orders/sell
GET    /leaderboard
GET    /team/me
WS     /ws/market
WS     /ws/leaderboard
```

Actual implementation may combine endpoints where appropriate, but keep the separation of concerns.

---

## 22. Acceptance criteria

Frontend is complete only when:

- All 25 predefined accounts can sign in.
- Team A cannot access Team B's private data.
- Six charts render correctly.
- Prices change at the backend-defined ticks.
- News appears at the correct tick.
- Orders are not falsely filled at the displayed price.
- Portfolio P/L updates after fills.
- Leaderboard updates live.
- Refresh/reconnect restores current game state.
- Game close locks trading.
- Organizer-only information is not sent to participant clients.
