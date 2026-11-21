# Boursify Live 20% Cash Calculator, Price & News Terminal (SBG 2026)

A pure data & position-sizing overlay for `play.boursify.io` (Simulation `#448`). No AI/script `BUY` or `SELL` opinions—just live prices, instant breaking news, and live share math.

## What It Shows Live (Every 2.5s)
1. **Live 20% Cash Share Calculator (All 10 Stocks):**
   - Automatically calculates the exact share count covering **20% of your current cash** (`Cash % per Trade` is adjustable to any `%`, and **`Round: ON / Exact`** toggles clean round share numbers vs. exact share counts).
   - If you turn **`Pre-fill: ON`**, clicking **`Fill`** next to any stock populates its ticker and that exact `20%` share count into `/player/trade`.
2. **Live Price Table:**
   - Shows every stock's **live price**, **60-second `%` change**, **total `%` change from Start Price**, and your **held shares + unrealized P&L `%`**.
3. **Live Breaking News Feed (Newest First):**
   - Auto-refreshes `/past-events` without clicking `Update`, tagging related company tickers (`RAI`, `PAL`, `ALE`, etc.) with zero `BUY`/`SELL` bias.

## How to Launch
- **With local server running (`start-proxy.bat` or `start-proxy-curated.bat`):**
  ```js
  fetch('http://127.0.0.1:8787/copilot.js').then(r=>r.text()).then(eval)
  ```
- **Or paste [`copilot.js`](./copilot.js) directly into your browser Console** (no proxy or API key needed).
