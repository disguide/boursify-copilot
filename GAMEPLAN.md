# SBG 2026 Live Trading Cheat Sheet (Team Aschenbrenner)

> **Hard Rules:** Starting capital = **$1,000,000** · Fee = **$50 + 0.5% per trade** (~1% round-trip: never churn small trades) · Max single-stock concentration = **40%** · Short selling allowed up to **100%** of portfolio · Ranking = **team member average return** · Wi-Fi: `ConcordiaGuest` / `WAC-andre26`.

---

## 1. Right Off Rip: 60-Second Setup (Before 11:15 AM Q1 Bell)

1. **Start Local Proxy:** Double-click `start-proxy.bat` and leave the black window open (`http://127.0.0.1:8787`).
2. **Open Boursify Trade Tab:** Log into `portal.boursify.io` → click **Join the simulation now** → go to `/player/trade`.
3. **Launch Co-Pilot Overlay (1-Liner in Brave Console):**
   ```js
   fetch('http://127.0.0.1:8787/copilot.js').then(r=>r.text()).then(eval)
   ```
   *(If Brave blocks localhost, click the Brave Lion icon → **Shields OFF** for `play.boursify.io`.)*
4. **Verify Green:** Click **`Test`** in the panel → confirm **`(NVIDIA OK)`**. Keep **`Pre-fill: OFF`** unless organizers confirm pre-fill is allowed.

---

## 2. Opening-Bell Orders (11:15 AM — Q1 Start, Jan 2030)

Deploy **55% ($550k)** into high-conviction macro winners at the bell and hold **45% ($450k) cash** for the **Feb 11 Quebec Election** and breaking news:

| Action | Ticker | Target $ | Round Shares (@ Start Price) | Opening Thesis |
| :--- | :--- | :--- | :--- | :--- |
| **BUY** | **`HAW`** (Grayhawk Systems) | **~$246,500** (~25%) | **1,700 sh** @ $145.00 | Recession-proof $95B backlog; Taiwan Strait tensions + NATO 3.5% GDP defence hike + Ottawa base modernization. |
| **BUY** | **`PAL`** (Palissade Capital) | **~$148,750** (~15%) | **1,750 sh** @ $85.00 | High 4.25% rates boost lending spread; cheap P/E 12 + 3.8% yield. *(Flip to SELL/SHORT immediately if rate cut or office-CRE default drops.)* |
| **BUY** | **`CHA`** (Épiceries Champlain) | **~$150,700** (~15%) | **2,200 sh** @ $68.50 | Low-beta (0.5) recession shield + Marché Fleuve discount banner. *(Exit if Québec Ensemble wins Feb 11 and launches grocer margin inquiry.)* |
| **CASH** | **Dry Powder** | **~$454,000** (~45%) | — | Fire immediately on the **Feb 11 Quebec Election** + Q1/Q2 shocks below. |

---

## 3. Quarter-by-Quarter Catalyst Calendar (Jan 2030 – Jan 2031)

| Quarter & Time | Fictional Window | Scheduled Make-or-Break Catalysts to Watch |
| :--- | :--- | :--- |
| **Q1** (`11:15–11:45`) | **Jan – Mar 2030** | **1. RAI IPO (Jan 2):** Watch early hype vs. bubble warnings.<br>**2. Quebec Election (Feb 11):**<br>• **Québec Ensemble (Camille Fortin) wins** → **BUY `LIA`** ($2B green H2 fund + cheap power), **SHORT `TAG`** (subsidy review, higher royalties), **SELL/TRIM `CHA`** (grocer margin inquiry).<br>• **Alliance prospérité (Jean-Philippe Ouellet) wins** → **BUY `TAG`** ($600M Aurore subsidy + light rules) & **BUY `NOR`** ($1.1B Far North Highway), **SHORT `LIA`**. |
| **Q2** (`11:55–12:25`) | **Apr – Jun 2030** | **1. `ALE` Cardiva Patent Cliff (April 2030):** Cardiva = 38% of `ALE` revenue. If generic erosion is worse than expected → **SHORT `ALE`**.<br>**2. Macro / Rates / Recession:** Rate cut or office real-estate defaults → **SELL & SHORT `PAL`**; recession / wage hike → **SHORT `PIN`** (debt at 3.6x vs 4.0x covenant!). |
| **Q3** (`2:45–3:15`) | **Jul – Sep 2030** | **1. `RAI` 6-Month IPO Lock-Up Expiry (Mid-July 2030):** `PAL` holds 6% of `RAI` ($7.2B). If `PAL` dumps its `RAI` stake or publishes a bearish Palissade Research report → **SHORT `RAI`**.<br>**2. `ALE` HT-114 Phase 3 Results (Late Summer 2030):** Oral obesity pill trial result. Positive = **MAX BUY `ALE` (up to 35%)**; failure = **MAX SHORT `ALE`** (`ALE` has no fallback!). |
| **Q4** (`3:25–3:55`) | **Oct – Dec 2030** | **1. `RAI` Ravenne-2 Data Centre & Project Legio (Fall 2030):** Breakthrough/on-time = **BUY `RAI`** (+ **`LIA`** if supplying data-centre storage); delay/chip shortage = **SHORT `RAI`**.<br>**2. `HOL` EU Supply-Chain Directive (Fall 2030) & US Asian Tariffs:** Audit failure or tariff hike → **SHORT `HOL`**. |

---

## 4. All 10 Companies: Instant Trigger Matrix (For Anonymous News)

| Ticker | Company (Start Price · P/E · Beta) | Hidden Keywords (CEO / Products / Places) | Instant **BUY / COVER** Triggers | Instant **SELL / SHORT** Triggers |
| :--- | :--- | :--- | :--- | :--- |
| **`RAI`** | **Rubicon AI** ($48 · n.m. · new) | **Julian Vance**, **Alea-3**, **Project Legio**, **Ravenne-2**, San Francisco, Taiwan chips | AGI / Legio breakthrough, Ravenne-2 online early, enterprise adoption surge | **Taiwan Strait** chip blockade, **mid-July lock-up sale by `PAL`**, bearish Palissade Research report, ex-employee whistleblowers |
| **`PAL`** | **Palissade Capital** ($85 · 12.0 · 0.9) | **Miles Stern**, **Palissade Research**, New York, commercial/office real estate | Rates held high (4.25%+), profitable sale of its 6% `RAI` stake in July | **BoC / Fed rate cut** (squeezes spread), **recession / office real-estate loan defaults** |
| **`ALE`** | **Aldren Pharma** ($112 · 16.0 · 0.6) | **Dr. Helen Marsh**, **Cardiva** (heart failure), **HT-114** (oral obesity pill), Cambridge | **HT-114 Phase 3 success** (end of summer), AI drug discovery breakthrough | **April 2030 Cardiva generic crash** (38% of sales), **HT-114 Phase 3 failure/side effects** |
| **`TAG`** | **Ressources Taïga** ($31 · 9.0 · 1.4) | **Luc Bergeron**, **Aurore** deposit, Abitibi, Val-d'Or, 55th parallel, nickel/cobalt/lithium/graphite | **Alliance prospérité (Ouellet) wins Feb 11**, **EU critical-metals contract signed** | **Québec Ensemble (Fortin) wins** (reviews $600M subsidy + raises royalties), Indigenous blockade on 240-km road |
| **`HAW`** | **Grayhawk Systems** ($145 · 22.3 · 0.7) | **Gen. Diane Kessler**, **Bastion OS**, Arlington, Indo-Pacific, drones/radar | **Taiwan Strait escalation**, **NATO 3.5% GDP** pledge, **Ottawa military base contract** | Military AI ethics scandal / employee revolt, US defence budget freeze |
| **`LIA`** | **Hydrélia** ($24 · n.m. · 1.9) | **Sophie Lachance**, **Bécancour** ($1.2B plant), green hydrogen, electrolyzers, grid storage | **Québec Ensemble wins Feb 11** ($2B H2 fund + cheap hydro), EU H2 deal, data-centre storage deal | **Alliance prospérité wins**, **dilutive financing / high-rate crunch** (only $250M cash vs $1.2B plant!), Bécancour delay |
| **`NOR`** | **Northline Infra** ($52 · 15.0 · 1.2) | **Catherine Doyle**, **Far North Highway** ($1.1B), Toronto/Hamilton | **Far North Highway** greenlit (with `TAG`), Ottawa/QC housing & military base contracts, EU rail win, rate cut | **Fixed-price cost overruns** (thin 3.7% margin!), **real-estate developer defaults / delayed payments**, Far North cancelled |
| **`CHA`** | **Épiceries Champlain** ($68.50 · 18.0 · 0.5) | **Isabelle Gagnon**, **Marché Fleuve**, **Comptoir Champlain**, Quebec City / Limoilou | Recession shift to discount grocery, **acquires restaurant chain (`PIN`)**, Comptoir expansion | **Québec Ensemble public inquiry into grocer margins / price caps** |
| **`PIN`** | **Restaurants Papineau** ($18 · 30.0 · 1.6) | **Olivier Desrosiers**, poutine/bistro, Ontario expansion (30 stores), frozen grocery meals | **Buyout offer from `CHA`**, frozen-meal grocery rollout success | **Recession** (families eat out less), **minimum wage hike** (34% labour cost), **breaching 4.0x debt covenant** (currently 3.6x!) |
| **`HOL`** | **Hollis & Rowe** ($82 · 17.8 · 1.1) | **Grant Hollis**, **"Made to Last"**, Portland, Bangladesh/Vietnam/Taiwan factories, Mexico | **AI inventory system** cuts unsold stock 30%, Mexico reshoring success, tariff exemption | **Washington raises tariffs on Asian imports** (70% made in Asia), **Fall 2030 EU directive / NGO sweatshop scandal**, consumer recession |
