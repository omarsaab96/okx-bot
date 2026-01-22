OKX BTC Spot Bot (Demo-first) - Node.js + TypeScript

What this is
- A demo-first OKX BTC-USDT bot that can run in SPOT or SWAP mode.
- In SWAP mode it trades LONG and SHORT with leverage=1.
- Trades using a multi-signal ruleset:
  - Trend filter: 1H EMA with a minimum % slope
  - Entries: breakout, EMA pullback, momentum, mean reversion
  - Stop-loss: ATR-based
  - Take-profit: R-multiple (configurable per entry type)
- Always places a stop-loss and take-profit via OKX conditional algo order.
- Runs 24/7 (no max trades/day).
- Safety:
  - Risk-per-trade sizing (0.5% by default)
  - Daily loss limit (1% of start-of-day USDT) -> halts until next UTC day
  - Cooldown after 3 consecutive losses (default 120 minutes)
- End-of-day report saved to logs/YYYY-MM-DD.json

Quick start
1) Install Node 18+.
2) Copy .env.example -> .env and fill OKX keys.
3) Install deps:
   npm install
4) Run:
   npm run dev

Dashboard
- Open http://localhost:8787 to see live status, config snapshot, and logs.
- Use Start/Stop to pause new entries without shutting down the process.

Notes
- For OKX Demo Trading requests you must send header x-simulated-trading: 1.
- The bot fetches instrument filters (minSz / lotSz / tickSz) and rounds size/prices accordingly.
- This bot is educational. It can lose money. Use DEMO for at least a few days before LIVE.
