# Market Sprint --- Portal Update & News Simulation Implementation Spec

## 1. Purpose

This document is the implementation specification for updating the
existing Market Sprint portal.

The source of truth is:

-   **Market Sprint Organizer Handbook v2.0**
-   **Market Sprint Participant Research Pack v1.0**
-   The existing portal/codebase and whatever has already been
    implemented in it
-   The current requirement that the missing **news-driven simulation
    layer** must now be implemented

> Important: Before changing code, inspect the existing project and
> preserve already-working features. Do not rebuild working pages or
> flows unnecessarily.

------------------------------------------------------------------------

# 2. Current Stage Assessment

## What is verified

The event design is already defined at the specification level:

-   Two-hour live trading simulation
-   Six fictional companies
-   10,000 V-Coins starting balance
-   75-second price ticks
-   96 ticks after tick 0
-   22-trade maximum
-   35% maximum portfolio allocation per buy
-   60% single-company concentration cap
-   0.4% fee on every buy and sell
-   7-second order cooldown
-   Minimum order of 100 V-Coins
-   No short selling
-   No limit orders
-   14 main headlines
-   3 scheduled headlines
-   11 surprise headlines
-   2 reserve headlines
-   Precomputed price series
-   News ticker
-   Economic calendar
-   Portfolio and leaderboard
-   Organizer controls and auditability

The handbook describes the core loop as:

**Study → Headline lands → Decide → Trade → Price reacts → Repeat**

The price reaction should normally develop over 4--6 ticks rather than
happening instantly.

## What is explicitly missing

The current portal does **not yet have the complete news layer**
according to the latest project update.

The required update therefore focuses on:

1.  News ticker
2.  Scheduled-event calendar
3.  Countdown system
4.  Timed headline firing
5.  Company-specific and market-wide news
6.  News → deterministic price-reaction linkage
7.  Deliberate but fair uncertainty/conflicting signals
8.  News history
9.  Organizer-side script control
10. Proper testing of the complete event timeline

## Important limitation on the previous shared-chat status

The provided ChatGPT share URL does not expose the conversation contents
to the current environment, so the exact list of already-completed
portal components cannot be independently verified from that link.

Therefore:

**Antigravity must inspect the current repository first and treat the
existing implementation as authoritative for what is already built.**

Do not delete, replace, or unnecessarily refactor working functionality.

------------------------------------------------------------------------

# 3. Source-of-Truth Rules

## Participant-facing information

Participants may see:

-   Company profiles
-   Historical prices
-   Historical reaction ledger
-   Current prices
-   Current charts
-   News headlines
-   Public economic calendar
-   Forecasts for scheduled events
-   Countdown information
-   Their own portfolio
-   Order history
-   Leaderboard information permitted by the rules

Participants must NOT see:

-   Sensitivity matrix
-   Hidden volatility multipliers
-   Noise seed
-   Hidden price series
-   Future surprise headlines
-   Hidden event effects
-   Organizer script
-   Exact future price path

The handbook explicitly treats the sensitivity matrix, volatility
settings, noise settings, and unannounced event script as organizer-only
information.

------------------------------------------------------------------------

# 4. Market Model

The six companies are:

  Ticker   Company                Sector                         Start
  -------- ---------------------- --------------------------- --------
  TAVR     Tavorin Energy         Energy                         84.50
  AERV     Aerovia Airlines       Airlines                       42.00
  VLTN     Vaultline Bank         Banking                       120.00
  BRKW     Brickwell Developers   Property & construction        65.25
  LMRA     Lumora Labs            Technology/cloud software     150.00
  GRFD     Greenfield Foods       Consumer staples               58.00

The four hidden macro drivers are:

-   RATES
-   OIL
-   DEMAND
-   SENTIMENT

The hidden sensitivity matrix is:

  Company     RATES   OIL   DEMAND   SENTIMENT
  --------- ------- ----- -------- -----------
  TAVR            0    +3       +1          +1
  AERV           -1    -3       +3          +2
  VLTN           +3     0       +2          +2
  BRKW           -3    -1       +2          +2
  LMRA           -2     0       +1          +3
  GRFD            0    -1       +1          -1

This matrix must remain organizer-only.

------------------------------------------------------------------------

# 5. Price-Reaction Engine

The event must NOT calculate arbitrary prices from live AI output.

The recommended architecture is:

### Build phase

1.  Define the locked event script.
2.  Define every headline's driver shock or direct percentage effect.
3.  Calculate every company's total reaction.
4.  Apply the reaction profile.
5.  Add fixed seeded noise.
6.  Apply guardrails.
7.  Generate all 97 prices per company:
    -   Tick 0
    -   Tick 1
    -   ...
    -   Tick 96
8.  Validate the complete series.
9.  Store the resulting series.
10. Lock the event configuration.

### Live phase

The live server only:

-   advances the official tick
-   publishes the corresponding precomputed prices
-   fires the scheduled headline
-   updates the news ticker
-   accepts/rejects orders
-   calculates portfolio values
-   logs all actions

Do NOT call an LLM to decide live prices.

Do NOT allow AI-generated news to alter prices after the event has
started.

This preserves fairness and makes the event auditable.

------------------------------------------------------------------------

# 6. Reaction Profiles

Implement the handbook's three profiles.

## Step

Cumulative move:

-   +1: 20%
-   +2: 60%
-   +3: 90%
-   +4: 100%
-   +5: 100%
-   +6: 100%

Use for most clear, lasting events.

## Spike-and-fade

Cumulative move:

-   +1: 30%
-   +2: 80%
-   +3: 120%
-   +4: 100%
-   +5: 80%
-   +6: 60%

Use for hype, rumours, analyst enthusiasm and overreaction.

## Slow burn

Cumulative move:

-   +1: 10%
-   +2: 25%
-   +3: 45%
-   +4: 65%
-   +5: 85%
-   +6: 100%

Use for broad market mood shifts.

------------------------------------------------------------------------

# 7. News System --- Required Update

## Core requirement

The missing news layer must be implemented as a proper event system.

Every news event needs:

``` text
event_id
tick
time_offset
type
headline
calendar_visible
forecast
scheduled
drivers
shock
direct_impacts
reaction_profile
status
```

For organizer-only data, also store:

``` text
expected_company_effects
script_notes
event_purpose
```

The participant client must never receive future surprise events or
hidden effects.

------------------------------------------------------------------------

# 8. Do NOT Search Real News

The companies are fictional.

Do not fetch real-world news about:

-   Tavorin Energy
-   Aerovia Airlines
-   Vaultline Bank
-   Brickwell Developers
-   Lumora Labs
-   Greenfield Foods

These names belong to the fictional Meridia economy.

Instead, the system may use a **news generator during preparation** to
help organizers draft fictional headlines.

The generated headline must then be:

1.  reviewed
2.  mapped to the event model
3.  assigned a fixed effect
4.  inserted into the locked script
5.  included in the precomputed price generation
6.  frozen before the event

The live event must replay the locked version.

------------------------------------------------------------------------

# 9. News Generation Design

Create an organizer-side fictional news generation utility.

The generator can produce candidate headlines from templates such as:

### Macro

-   MRB interest-rate decisions
-   consumer confidence
-   retail spending
-   oil supply
-   fuel prices
-   global market sentiment

### Company-specific

-   earnings
-   dividend changes
-   partnerships
-   product launches
-   customer wins
-   safety incidents
-   recalls
-   regulatory probes
-   takeover rumours
-   takeover denials
-   analyst upgrades/downgrades

### Policy/regulation

-   housing subsidies
-   energy taxes
-   bank fee restrictions
-   financial regulator actions
-   safety regulations

The generator must only create fictional Meridia content.

------------------------------------------------------------------------

# 10. News Must Be Fact-Like, Not Predictive

Headlines must describe facts.

Good:

> Consumer confidence falls to an 18-month low, missing forecasts.

Good:

> Government proposes windfall tax on energy-sector profits.

Good:

> Unconfirmed: global technology group weighing takeover bid for Lumora
> Labs.

Bad:

> Bad news for airlines.

Bad:

> TAVR is about to crash.

Bad:

> Buy LMRA now.

Bad:

> Banks will definitely rise.

The headline itself must not tell participants what trade to make.

------------------------------------------------------------------------

# 11. Deliberate Decision Confusion

The goal is to make participants stop and think:

> "Should I trade this, wait, reduce my position, or do nothing?"

This should come from **conflicting but interpretable information**, not
from random or unclear headlines.

Use these mechanisms.

## A. Opposing company effects

Example:

> Oil prices jump after a major supply disruption.

Likely reasoning:

-   TAVR benefits
-   AERV suffers
-   GRFD may suffer slightly
-   Other companies have smaller indirect effects

This creates a genuine portfolio decision.

## B. Scheduled surprise

Calendar:

> MRB rate decision --- forecast: unchanged

Actual:

> MRB raises rates by 0.50%.

Participants must decide quickly because the result differs materially
from the forecast.

This is specifically supported by the handbook's scheduled-event design.

## C. Rumour → denial

Event 4:

> Unconfirmed: global tech group weighing takeover bid for Lumora Labs.

Later Event 6:

> Lumora Labs says it has received no takeover approach.

This creates a difficult decision:

-   trade the initial spike?
-   wait for confirmation?
-   hold through uncertainty?
-   reverse after denial?

Use Spike-and-fade for the rumour effect where appropriate.

## D. Hype that fades

Example:

> Brokerage upgrades Brickwell to "Strong Buy", calling shares
> undervalued.

The participant must decide whether:

-   to buy the hype
-   wait
-   take profit
-   avoid it because the Research Pack shows that analyst-driven moves
    may not persist

## E. Reversal event

Example:

> Oil Producers' Alliance agrees to cut output sharply.

Later:

> Oil Producers' Alliance reverses output cut; supply restored.

This forces participants to reconsider an earlier position.

## F. Safe-haven uncertainty

During a market sell-off, GRFD can behave more defensively, but it must
not become a guaranteed safe asset.

Participants should still have to consider:

-   limited upside
-   lower volatility
-   company-specific risks
-   opportunity cost

------------------------------------------------------------------------

# 12. Required 14-Headline Timeline

Use the handbook's locked event sequence unless the Event Lead
explicitly changes it.

  -------------------------------------------------------------------------
  Event                           Tick                 Time Headline
  --------------- -------------------- -------------------- ---------------
  1                                 10              T+12:30 Oil prices edge
                                                            higher as fuel
                                                            inventories
                                                            fall.

  2                                 15              T+18:45 Aerovia signs
                                                            code-share deal
                                                            with major
                                                            overseas
                                                            carrier.

  3                                 24              T+30:00 Consumer
                                                            confidence
                                                            falls to
                                                            18-month low,
                                                            missing
                                                            forecasts.

  4                                 29              T+36:15 Unconfirmed:
                                                            global tech
                                                            group weighing
                                                            takeover bid
                                                            for Lumora
                                                            Labs.

  5                                 36              T+45:00 Vaultline
                                                            profit jumps
                                                            18%, dividend
                                                            raised.

  6                                 42              T+52:30 Lumora Labs
                                                            says it has
                                                            received no
                                                            takeover
                                                            approach.

  7                                 50              T+62:30 Oil Producers'
                                                            Alliance agrees
                                                            to cut output
                                                            sharply.

  8                                 56              T+70:00 Brokerage
                                                            upgrades
                                                            Brickwell to
                                                            "Strong Buy",
                                                            calling shares
                                                            undervalued.

  9                                 64              T+80:00 MRB raises
                                                            interest rates
                                                            by 0.50% in
                                                            surprise move.

  10                                69              T+86:15 Greenfield
                                                            Foods pulls one
                                                            snack line as a
                                                            precaution over
                                                            contamination
                                                            reports.

  11                                76              T+95:00 Global markets
                                                            rally as trade
                                                            talks progress.

  12                                83             T+103:45 Government
                                                            proposes
                                                            windfall tax on
                                                            energy-sector
                                                            profits.

  13                                88             T+110:00 Oil Producers'
                                                            Alliance
                                                            reverses output
                                                            cut; supply
                                                            restored.

  14                                92             T+115:00 Regulator opens
                                                            probe into
                                                            Vaultline's
                                                            lending
                                                            practices.
  -------------------------------------------------------------------------

Scheduled events:

-   Event 3 --- Consumer Confidence
-   Event 5 --- Vaultline earnings
-   Event 9 --- MRB rate decision

Show their forecast on the public calendar.

Show countdowns 5 minutes and 1 minute before the scheduled event.

------------------------------------------------------------------------

# 13. News UI

## Main trading dashboard

Add a prominent live news area:

``` text
┌─────────────────────────────────────────────┐
│ 🔴 LIVE — MERIDIA BUSINESS WIRE             │
│                                             │
│ MRB raises interest rates by 0.50%          │
│ in surprise move.                           │
│                                             │
│  TICK 64        01:20:00                    │
└─────────────────────────────────────────────┘
```

The newest headline should be visually prominent.

Previous headlines remain accessible in a compact news history.

## News history

Each item should show:

-   time
-   tick
-   headline
-   Scheduled / Surprise
-   optional company/market tags
-   whether it is currently active

Do NOT show hidden effects.

------------------------------------------------------------------------

# 14. Scheduled Event UI

Economic calendar:

``` text
ECONOMIC CALENDAR

10:00   Consumer Confidence
        Forecast: Slight rise expected
        STATUS: UPCOMING

10:45   Vaultline Earnings
        Forecast: Profit expected flat
        STATUS: UPCOMING

11:20   MRB Rate Decision
        Forecast: Rates expected unchanged
        STATUS: UPCOMING
```

As the event approaches:

``` text
NEXT SCHEDULED EVENT

MRB RATE DECISION
Forecast: Rates expected unchanged

05:00
```

Then:

``` text
01:00
```

At release:

``` text
RESULT RELEASED
MRB raises interest rates by 0.50% in surprise move.
```

------------------------------------------------------------------------

# 15. Timing Behaviour

The event clock is server authoritative.

Tick interval:

**75 seconds**

Tick sequence:

``` text
0 → 1 → 2 → ... → 96
```

At every tick:

1.  Server advances tick.
2.  Price snapshot becomes active.
3.  Portfolio values update.
4.  Charts update.
5.  Leaderboard updates.
6.  If a headline belongs to the tick, publish it.
7.  If a countdown belongs to the tick/time, publish it.
8.  Log the tick.

Do not let the browser determine official time.

------------------------------------------------------------------------

# 16. Order Behaviour

Every order:

-   is validated server-side
-   executes at the next tick's price
-   incurs 0.4% fee
-   respects 7-second cooldown
-   respects 100 V-Coin minimum
-   respects 22-trade maximum
-   respects 35% max buy
-   respects 60% concentration cap
-   rejects after market close

The interface must permanently display:

> Orders fill at the next tick's price.

------------------------------------------------------------------------

# 17. News-to-Price Flow

The correct flow is:

``` text
LOCKED EVENT SCRIPT
        ↓
PRECOMPUTED PRICE SERIES
        ↓
SERVER CLOCK / TICK
        ↓
HEADLINE FIRE
        ↓
PARTICIPANT SEES NEWS
        ↓
PARTICIPANT DECIDES
        ↓
ORDER SUBMITTED
        ↓
NEXT TICK PRICE
        ↓
PORTFOLIO UPDATED
        ↓
REACTION CONTINUES
```

Do not use:

``` text
Headline
   ↓
LLM
   ↓
random price
```

during the live event.

------------------------------------------------------------------------

# 18. News Generator Architecture

If an AI/news-generation component is implemented, keep it completely
separate from live execution.

Recommended:

``` text
Organizer
   ↓
Generate candidate fictional headlines
   ↓
Human review
   ↓
Assign event metadata/effect
   ↓
Generate complete price series
   ↓
Run validation
   ↓
LOCK EVENT
   ↓
Live replay
```

The AI is an authoring assistant, not the market engine.

------------------------------------------------------------------------

# 19. Fairness Tests

Before the event is published, create a test mode.

For every headline:

1.  Give testers the Research Pack.
2.  Hide the answer.
3.  Show the headline.
4.  Ask testers:
    -   Which companies rise?
    -   Which fall?
    -   Which barely move?
    -   Roughly how large is the move?
5.  Record responses.

Target:

-   At least 70% should identify the direction of the main affected
    companies.

If fewer than 70% get the main direction right:

-   rewrite the headline, OR
-   improve the Research Pack precedent.

Do not solve confusion by making the headline itself give away the
answer.

------------------------------------------------------------------------

# 20. "Confusing but Fair" Acceptance Criteria

A headline is GOOD if:

-   participants can reasonably disagree about whether to trade
    immediately
-   there is a meaningful timing decision
-   at least two companies may move in opposite directions
-   the Research Pack contains enough information to reason about it
-   the result is deterministic
-   the event is auditable afterward

A headline is BAD if:

-   it says "good news for TAVR"
-   it directly tells participants to buy/sell
-   the company effect is impossible to infer from the pack
-   the price effect is random
-   the LLM decides the outcome after participants trade
-   participants can see future surprise headlines
-   the event changes between participants

------------------------------------------------------------------------

# 21. Organizer Console

Implement or update the organizer console with:

## Event status

-   DRAFT
-   READY
-   RUNNING
-   PAUSED
-   CLOSED

## Current state

-   current tick
-   next tick
-   elapsed time
-   remaining time
-   next headline
-   next scheduled event
-   number of connected participants

## News control

-   view locked script
-   see armed event
-   release status
-   scheduled time
-   actual release time
-   pause/hold control
-   resume control
-   reserve headline control

Any manual release must be logged.

Use two-person confirmation where the current architecture supports
organizer approval.

------------------------------------------------------------------------

# 22. Audit Logging

Log:

``` text
event_id
timestamp
tick
headline release
participant order
order type
company
requested amount
execution tick
execution price
fee
rejection reason
pause/resume
organizer action
```

Never modify published prices retroactively.

------------------------------------------------------------------------

# 23. Reserve Headlines

Keep two reserve headlines separate from the public participant
experience.

Suggested reserves from the handbook:

### R1

Retail sales rebound strongly.

### R2

MRB governor signals patience on interest rates.

They should only be fired by an authorized organizer if required.

Do not expose them to participants before release.

------------------------------------------------------------------------

# 24. Participant Experience Goal

The portal should feel like a live competition, not a static stock
dashboard.

The participant should constantly have to process:

``` text
NEWS
 ↓
WHAT DOES THIS MEAN?
 ↓
WHO BENEFITS?
 ↓
WHO LOSES?
 ↓
IS IT ALREADY EXPECTED?
 ↓
HOW STRONG IS THE SHOCK?
 ↓
DO I TRADE NOW?
 ↓
HOW MUCH?
 ↓
CAN I AFFORD TO BE WRONG?
```

The interface should make this reasoning possible without giving the
answer.

------------------------------------------------------------------------

# 25. Important UX Principle

Do not add excessive explanatory labels beside live headlines.

Avoid:

> "This is bullish for TAVR."

Avoid:

> "AERV will probably fall."

Instead show the factual headline and let participants apply their
Research Pack.

------------------------------------------------------------------------

# 26. Implementation Order

Antigravity should execute in this order:

### Phase 1 --- Inspect

-   Inspect existing frontend
-   Inspect existing backend
-   Inspect database/schema
-   Inspect authentication
-   Inspect trading engine
-   Inspect WebSocket/realtime implementation
-   Inspect current dashboard
-   Inspect current admin portal
-   Identify what is already working

### Phase 2 --- Protect Existing Features

Create a short internal implementation map:

``` text
EXISTING AND KEEP
EXISTING BUT INCOMPLETE
MISSING
CONFLICTS WITH HANDBOOK
```

Do not rewrite working features.

### Phase 3 --- Event Model

Implement:

-   event configuration
-   ticks
-   event script
-   scheduled events
-   surprise events
-   news metadata
-   locked state

### Phase 4 --- Price Playback

Implement or verify:

-   precomputed prices
-   reaction profiles
-   seeded noise
-   guardrails
-   tick playback

### Phase 5 --- News

Implement:

-   news ticker
-   news history
-   scheduled calendar
-   countdown
-   headline firing
-   organizer script view

### Phase 6 --- Trading Integration

Verify:

-   order → next tick fill
-   fee
-   limits
-   cooldown
-   holdings
-   portfolio value
-   leaderboard

### Phase 7 --- Organizer Controls

Implement:

-   start
-   pause
-   resume
-   hold
-   event status
-   script status
-   audit log

### Phase 8 --- QA

Run the full two-hour simulation in accelerated test mode.

Verify all 14 headlines fire on the correct ticks.

Verify every price reaction matches the locked series.

Verify participants cannot access future surprise data.

Verify multiple simultaneous users see the same market state.

------------------------------------------------------------------------

# 27. Accelerated Simulation Mode

Add a development/test-only mode.

Example:

``` text
LIVE:
75 seconds / tick

TEST:
1 second / tick
```

The test mode must use the exact same event script and price series.

It should be impossible for normal participants to enable test mode.

------------------------------------------------------------------------

# 28. Acceptance Checklist

## Market

-   [ ] Six companies
-   [ ] Correct opening prices
-   [ ] 97 stored prices per company
-   [ ] 75-second tick
-   [ ] 96 closing tick
-   [ ] Fixed noise
-   [ ] Price floor/cap
-   [ ] Max single-tick movement

## News

-   [ ] 14 headlines
-   [ ] 3 scheduled
-   [ ] 11 surprise
-   [ ] 2 reserve
-   [ ] Correct ticks
-   [ ] Correct countdowns
-   [ ] News ticker
-   [ ] News history
-   [ ] No future surprise leakage

## Trading

-   [ ] 10,000 V-Coins
-   [ ] 22 trades
-   [ ] 35% buy cap
-   [ ] 60% concentration cap
-   [ ] 0.4% fee
-   [ ] 7-second cooldown
-   [ ] 100 V-Coin minimum
-   [ ] next-tick execution
-   [ ] no short selling
-   [ ] no limit orders

## Fairness

-   [ ] Same prices for every participant
-   [ ] Same headline timing
-   [ ] Server-authoritative clock
-   [ ] Locked event script
-   [ ] No live AI price decisions
-   [ ] No participant access to hidden effects
-   [ ] Audit logs
-   [ ] Test mode

## UX

-   [ ] News is visually prominent
-   [ ] Scheduled calendar visible
-   [ ] Countdown visible
-   [ ] Charts update
-   [ ] Portfolio updates
-   [ ] Leaderboard updates
-   [ ] Order feedback clear
-   [ ] Mobile-friendly dashboard
-   [ ] Colour is not the only signal

------------------------------------------------------------------------

# 29. Final Product Behaviour

The finished simulation should create this experience:

> A student reads the Research Pack beforehand.

> The market opens.

> They see a normal-looking market.

> A headline suddenly arrives.

> They know enough to understand several possible consequences.

> They have to decide whether the move is strong enough to trade.

> They also have to consider the 0.4% fee, their remaining trade budget,
> concentration, timing and existing positions.

> The price does not immediately reveal the final outcome.

> The next few ticks reveal whether their interpretation was correct.

> Another headline later challenges the previous position.

> A rumour may reverse.

> A scheduled event may surprise the market.

> A company-specific event may conflict with the broader market.

> Near the end, the event becomes more intense without becoming random.

That is the intended Market Sprint experience.

------------------------------------------------------------------------

# 30. Antigravity Execution Instruction

**Do not start coding blindly.**

First inspect the complete existing Market Sprint repository and
identify the current implementation stage.

Then compare the current implementation against this document and the
supplied Organizer Handbook v2.0 / Participant Research Pack v1.0.

Implement only the missing or incomplete pieces.

The highest-priority missing feature is the **news-driven event
system**.

Do not use real-world news because all Market Sprint companies and
events are fictional.

If an AI/news generator is added, use it only during organizer-side
preparation to generate candidate fictional headlines. After review,
every event must be converted into a locked deterministic event
definition and precomputed price series.

During the live event:

**No LLM-generated price decisions.\
No random live news.\
No participant-specific news.\
No future-news leakage.**

The live server must replay the same locked event timeline to everyone.

Preserve all existing working features.

Do not introduce unrelated features.

Do not change the fictional company names, tickers, event rules,
starting balance, trading limits, or timing model unless a conflict is
found and explicitly documented.

After implementation:

1.  Run lint/type checks.
2.  Run backend tests.
3.  Run frontend tests.
4.  Run the accelerated full-event simulation.
5.  Verify all 14 headlines.
6.  Verify all countdowns.
7.  Verify price reactions.
8.  Verify next-tick order execution.
9.  Verify trading limits.
10. Verify multiple participants receive identical market/news state.
11. Verify future surprise headlines cannot be fetched from the client.
12. Verify organizer-only information remains protected.
13. Fix any issues discovered.
14. Give a final implementation report listing:

-   what already existed
-   what was added
-   what was modified
-   files changed
-   tests run
-   remaining limitations

Do not claim a feature is complete unless it has been tested.
