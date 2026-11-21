# Boursify AI Co-Pilot (SBG 2026)

A two-part setup for `play.boursify.io` (Simulation `#448`): a zero-CORS local Node proxy (`proxy.mjs`) that sends full simulation context to NVIDIA NIM, plus a scroll-safe, draggable browser overlay (`copilot.js`).

## 2-Step Setup
1. **Start the local NVIDIA proxy** (once before the simulation):
   - Double-click [`start-proxy.bat`](./start-proxy.bat) (or run `node proxy.mjs` inside this folder).
   - It listens on `http://127.0.0.1:8787` with zero noticeable latency overhead (~1ms local loopback).
2. **Launch the overlay in Brave/Chrome**:
   - Open `https://play.boursify.io/player/trade` and log in.
   - Right-click the page → **Inspect** → **Console** → paste [`copilot.js`](./copilot.js) → press **Enter**.
   - Paste your `nvapi-...` key into the **NVIDIA API Key** box and click **Test**.
   - *(Brave note)* If Brave Shields blocks `127.0.0.1:8787`, click the **Brave Lion icon** in the address bar and toggle **Shields DOWN** for `play.boursify.io`.

## Modes & Controls
- **`Pre-fill: OFF` (Default / Rules-Safe):** Read-only **Order Book** mode—never touches the Boursify trade form.
- **`Pre-fill: ON`:** Adds a **Pre-fill** button on `BUY`/`SELL` cards to populate the `/player/trade` form for 1-click confirmation.
- **`Test`:** Checks `GET /health` and runs the real SBG `Northline Infrastructure` negative headline through NVIDIA so you verify `AVOID`/`SELL` behavior right away.
- **`Re-scan 3`:** Re-analyzes the 3 most recent headlines once NVIDIA is connected.
