Read and execute the attached `Market-Sprint-Portal-Update-Spec.md`.

Also use the supplied:

* Market Sprint Organizer Handbook v2.0
* Market Sprint Participant Research Pack v1.0

as the specification sources.

IMPORTANT: Do not start coding blindly.

First inspect the entire existing Market Sprint repository and determine:

1. What is already implemented and working.
2. What is partially implemented.
3. What is missing.
4. What conflicts with the handbook/research pack.
5. What can be reused without modification.

Create an internal implementation map:

EXISTING AND KEEP
EXISTING BUT INCOMPLETE
MISSING
CONFLICTS / BUGS

Do not rebuild working features unnecessarily.

The main missing feature is the NEWS-DRIVEN SIMULATION.

Implement the complete news system described in `Market-Sprint-Portal-Update-Spec.md`.

Core requirements:

* 6 fictional companies.
* 10,000 V-Coins starting balance.
* 75-second ticks.
* Tick 0 through tick 96.
* 14 main headlines.
* 3 scheduled events.
* 11 surprise events.
* 2 reserve headlines.
* News ticker.
* News history.
* Economic calendar.
* Forecasts for scheduled events.
* 5-minute and 1-minute countdowns.
* Server-authoritative timing.
* Precomputed deterministic price series.
* Next-tick order execution.
* Existing trading limits and fees must remain correct.

VERY IMPORTANT:

Do NOT search the internet for real-world news about Tavorin Energy, Aerovia Airlines, Vaultline Bank, Brickwell Developers, Lumora Labs or Greenfield Foods.

These are fictional companies.

If you implement a news-generation utility, it may generate fictional Meridia news during ORGANIZER PREPARATION only.

The workflow must be:

Generate candidate fictional news
→ organizer reviews it
→ assign deterministic effect
→ generate complete price series
→ validate
→ lock script
→ live replay

Never do:

headline
→ live LLM
→ random price

during the actual event.

The live event must replay a locked event script and locked price series.

Every participant must see the exact same:

* prices
* ticks
* headlines
* headline timing
* scheduled-event timing

Do not expose to participants:

* future surprise headlines
* sensitivity matrix
* volatility multipliers
* hidden price series
* noise seed
* hidden event effects
* organizer script

Implement the handbook's 14-event sequence:

1. Tick 10 — Oil prices edge higher as fuel inventories fall.
2. Tick 15 — Aerovia signs code-share deal with major overseas carrier.
3. Tick 24 — Consumer confidence falls to 18-month low, missing forecasts.
4. Tick 29 — Unconfirmed: global tech group weighing takeover bid for Lumora Labs.
5. Tick 36 — Vaultline profit jumps 18%, dividend raised.
6. Tick 42 — Lumora Labs says it has received no takeover approach.
7. Tick 50 — Oil Producers' Alliance agrees to cut output sharply.
8. Tick 56 — Brokerage upgrades Brickwell to “Strong Buy”, calling shares undervalued.
9. Tick 64 — MRB raises interest rates by 0.50% in surprise move.
10. Tick 69 — Greenfield Foods pulls one snack line as a precaution over contamination reports.
11. Tick 76 — Global markets rally as trade talks progress.
12. Tick 83 — Government proposes windfall tax on energy-sector profits.
13. Tick 88 — Oil Producers' Alliance reverses output cut; supply restored.
14. Tick 92 — Regulator opens probe into Vaultline's lending practices.

Scheduled events:

* Event 3: Consumer Confidence
* Event 5: Vaultline Earnings
* Event 9: MRB Rate Decision

Show their forecasts on the public calendar.

Implement the countdown system exactly so that scheduled events receive warning banners before release.

The news experience should feel like a real-time competition.

The latest headline should be highly visible.

Example:

LIVE — MERIDIA BUSINESS WIRE

MRB raises interest rates by 0.50% in surprise move.

TICK 64
01:20:00

Maintain a compact news history so participants can review previous headlines.

Do NOT show participants labels such as:

* "bullish"
* "bearish"
* "buy this"
* "sell this"
* "good for TAVR"
* "bad for AERV"

The headline must state facts and let participants reason.

The simulation should intentionally make students think:

"Should I trade?"
"Should I wait?"
"Is this already priced in?"
"Which company benefits?"
"Which company gets hurt?"
"How strong is the effect?"
"Should I take the risk?"
"Should I reverse my position?"

Create this confusion through deliberate, solvable situations:

1. Opposing company effects.
2. Scheduled events that surprise the forecast.
3. Rumour followed later by denial.
4. Analyst hype that can fade.
5. Oil-supply shock followed later by reversal.
6. Market-wide sentiment changes.
7. Company-specific news during broader market movements.
8. Late-event shocks.

Do NOT make the confusion random or impossible to reason about.

The Research Pack must contain enough information for participants to form a reasonable expectation.

The event must remain deterministic.

Use the handbook's reaction profiles:

STEP:
20%, 60%, 90%, 100%, 100%, 100%

SPIKE-AND-FADE:
30%, 80%, 120%, 100%, 80%, 60%

SLOW BURN:
10%, 25%, 45%, 65%, 85%, 100%

Preserve the existing trading rules:

* Maximum 22 trades.
* Maximum 35% of portfolio per buy.
* Maximum 60% concentration in one company.
* 0.4% fee per buy/sell.
* 7-second cooldown.
* Minimum 100 V-Coins.
* No short selling.
* No limit orders.
* Orders fill at the next tick's price.

The UI must permanently remind users:

"Orders fill at the next tick's price."

Implement/verify organizer functionality:

* event status
* current tick
* next tick
* elapsed time
* remaining time
* next headline
* next scheduled event
* participant count
* locked script
* armed headline
* headline release status
* pause/hold
* resume
* broadcast
* audit log
* reserve headline controls

Organizer-only information must remain protected.

Add an accelerated development/test mode where the tick interval can be reduced for testing, for example:

LIVE = 75 seconds/tick
TEST = 1 second/tick

The test mode must use the exact same event script and price series.

It must not be accessible to normal participants.

After implementation, run the complete simulation in accelerated mode.

Verify:

* all 14 headlines fire
* all headlines fire on the correct ticks
* all scheduled countdowns appear correctly
* news history works
* charts update
* prices update
* price reactions match the locked series
* orders execute at the next tick
* fees are correct
* trade limits work
* cooldown works
* concentration limit works
* leaderboard updates
* portfolio values update
* multiple participants see identical market state
* participants cannot fetch future surprise headlines
* organizer-only data is protected
* pause/resume works
* close at tick 96 works
* orders after close are rejected
* audit logs are created

Also test the complete news/decision experience.

The objective is NOT to make the simulation random.

The objective is to make participants uncertain about the correct decision while still giving them enough information to reason correctly.

If an existing implementation already satisfies a requirement, keep it.

If the current code conflicts with the handbook, document the conflict and fix it carefully.

Do not introduce unrelated features.

Do not rename the fictional companies or tickers.

Do not replace the existing stack unless absolutely necessary.

At the end, provide a concise implementation report containing:

1. Existing features discovered.
2. Features added.
3. Features modified.
4. Files changed.
5. Database/schema changes.
6. API/WebSocket changes.
7. News-system changes.
8. Price-engine changes.
9. Tests executed.
10. Test results.
11. Remaining limitations.

Do not claim something is complete unless it has actually been tested.
