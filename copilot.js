/**
 * Boursify Live Intel Dashboard, 20% Cash Sizer & News Terminal (SBG 2026)
 *
 * Pure data & handbook-intel terminal — zero AI/script BUY or SELL guessing:
 *  1. Portfolio Bar: Live Cash, Invested $, Total Value, Total Return %, and 20% Cash Sizer
 *     (with quick 10% / 20% / 30% presets, Round ON/Exact, and remaining 40%-cap room per stock).
 *  2. Live Quotes + Expandable Handbook Intel: Live Price, 60s %, Total % vs Start, MA50/MA200,
 *     Held Shares & P&L %, 20% Cash Shares, and 1-click expandable company dossier (CEO, products,
 *     ratios, political/macro links from the 18-page SBG 2026 Participant Handbook).
 *  3. Live Breaking News + Articles Feed: Auto-updates /past-events and /articles newest-first,
 *     tags related tickers (even when only a CEO/product/party is named), and displays the
 *     matching handbook fact below the headline with a ticker filter bar.
 */
(() => {
  if (window.__BOURSIFY_COPILOT__) {
    window.__BOURSIFY_COPILOT__.destroy();
  }

  const STORAGE_KEY = 'boursify_copilot_cfg_v3';
  const defaultCfg = {
    simId: '448',
    playerId: '38158',
    pollMs: 2500,
    prefillEnabled: false,
    allocPct: 20,
    roundMode: true,
    wideMode: false,
    minimized: false,
  };

  let cfg = { ...defaultCfg };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    cfg = { ...defaultCfg, ...saved };
  } catch (_) {}

  const saveCfg = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (_) {}
  };

  const detectIds = () => {
    try {
      const entries = performance.getEntriesByType('resource') || [];
      for (let i = entries.length - 1; i >= 0; i--) {
        const m = entries[i].name.match(/\/resources\/simulation\/(\d+)\/player\/(\d+)/);
        if (m) {
          cfg.simId = m[1];
          cfg.playerId = m[2];
          saveCfg();
          return;
        }
      }
    } catch (_) {}
  };
  detectIds();

  // Full 18-page SBG 2026 Participant Handbook Intel Dossiers
  const TICKERS = {
    RAI: {
      id: '4224',
      name: 'Rubicon AI',
      sector: 'AI / Tech',
      ceo: 'Julian Vance',
      hq: 'San Francisco',
      startPrice: 48.0,
      pe: 'n.m. (loss)',
      beta: 'new',
      de: '0.14',
      revGrowth: '+180%',
      netMargin: '-59.4%',
      intel: 'Flagship Alea-3 (12k clients). Secret AGI Project Legio + Ravenne-2 data centre (Fall 2030). Unprofitable (-$1.9B on $3.2B rev), $9B IPO cash (4-5 yrs runway), ~37x sales. Dependent on Taiwan chips. Palissade (PAL) owns 6% — 6-month IPO lock-up expires mid-July 2030.',
      keywords: ['rubicon', 'julian vance', 'alea-3', 'alea 3', 'legio', 'ravenne', 'artificial intelligence', 'intelligence artificielle', 'agi', 'semiconductor', 'taiwan'],
    },
    PAL: {
      id: '4225',
      name: 'Palissade Capital',
      sector: 'Bank & Asset Mgmt',
      ceo: 'Miles Stern',
      hq: 'New York',
      startPrice: 85.0,
      pe: '12.0',
      beta: '0.9',
      de: '2.40 (bank)',
      revGrowth: '+3%',
      netMargin: '22.4%',
      intel: 'Commercial & office real estate lender + $1,400B AUM + Palissade Research (reports move markets). Div yield 3.8%. High 4.25% rates boost spread; rate cuts squeeze margin; recession increases office real-estate loan defaults. Owns 6% of RAI (lock-up ends mid-July 2030).',
      keywords: ['palissade', 'miles stern', 'palissade research', 'commercial real estate', 'office real estate', 'immobilier de bureau', 'bank of canada', 'banque du canada', 'federal reserve', 'policy rate', 'taux directeur'],
    },
    ALE: {
      id: '4226',
      name: 'Aldren Pharmaceuticals',
      sector: 'Pharma',
      ceo: 'Dr. Helen Marsh',
      hq: 'Cambridge, MA',
      startPrice: 112.0,
      pe: '16.0',
      beta: '0.6',
      de: '0.63',
      revGrowth: '+2%',
      netMargin: '18.6%',
      intel: 'Defensive healthcare (div 3.0%, $11B cash, 18% R&D). Cardiva (heart failure = 38% of revenue) patent expires April 2030 (sales could halve on generics). Betting everything on HT-114 (once-daily oral obesity pill) — Phase 3 results due end of summer 2030 (no fallback if it fails).',
      keywords: ['aldren', 'helen marsh', 'cardiva', 'ht-114', 'ht 114', 'obesity', 'obésité', 'heart failure', 'insuffisance cardiaque', 'patent', 'brevet', 'generic', 'générique', 'phase 3', 'pharma'],
    },
    TAG: {
      id: '4227',
      name: 'Ressources Taïga',
      sector: 'Critical Metals',
      ceo: 'Luc Bergeron',
      hq: 'Val-d\'Or, QC',
      startPrice: 31.0,
      pe: '9.0',
      beta: '1.4',
      de: '0.59',
      revGrowth: '+22%',
      netMargin: '15.0%',
      intel: 'QC largest producer of nickel, cobalt, lithium, graphite (4 mines). Cheap P/E 9. Flagship Aurore deposit north of 55th parallel ($2.8B cost, $600M promised subsidy, 240-km road, Indigenous consultation). CEO backs Alliance prospérité (Ouellet). Hurt if Québec Ensemble (Fortin) reviews subsidies/raises royalties. In talks with EU buyers.',
      keywords: ['taïga', 'taiga', 'luc bergeron', 'aurore', 'abitibi', 'val-d\'or', '55th parallel', '55e parallèle', 'critical metals', 'métaux critiques', 'critical minerals', 'nickel', 'cobalt', 'lithium', 'graphite', 'royalties', 'redevances', 'alliance prospérité', 'ouellet'],
    },
    HAW: {
      id: '4228',
      name: 'Grayhawk Systems',
      sector: 'Defence & Tech',
      ceo: 'Gen. Diane Kessler',
      hq: 'Arlington, VA',
      startPrice: 145.0,
      pe: '22.3',
      beta: '0.7',
      de: '0.75',
      revGrowth: '+7%',
      netMargin: '9.3%',
      intel: 'Radar, surveillance drones, air defence & Bastion OS real-time command software. 80% US govt, 20% allies (Canada, Japan, EU). $95B backlog (>3 yrs revenue, recession/rate-proof). Tailwinds: Indo-Pacific/Taiwan tensions, NATO 3.5% GDP defence target, Ottawa military base modernization. Risk: AI ethics backlash.',
      keywords: ['grayhawk', 'diane kessler', 'bastion', 'nato', 'otan', '3.5% of gdp', 'defence', 'defense', 'défense', 'military', 'militaire', 'drone', 'radar', 'indo-pacific', 'taiwan'],
    },
    LIA: {
      id: '4229',
      name: 'Hydrélia',
      sector: 'Clean Energy / H2',
      ceo: 'Sophie Lachance',
      hq: 'Bécancour, QC',
      startPrice: 24.0,
      pe: 'n.m. (loss)',
      beta: '1.9',
      de: '1.22',
      revGrowth: '+95%',
      netMargin: '-25.0%',
      intel: 'Green hydrogen electrolyzers & grid/industrial battery storage. Fast growth (+95% to $180M) but unprofitable (-$45M). Building $1.2B Bécancour plant; only $250M cash & D/E 1.22 — needs new financing within 18 months. CEO backs Québec Ensemble (Fortin: $2B green H2 fund + cheap hydro). Eyeing EU & data-centre storage.',
      keywords: ['hydrélia', 'hydrelia', 'sophie lachance', 'bécancour', 'becancour', 'green hydrogen', 'hydrogène vert', 'hydrogen', 'hydrogène', 'electrolyzer', 'électrolyseur', 'battery storage', 'québec ensemble', 'camille fortin'],
    },
    NOR: {
      id: '4230',
      name: 'Northline Infrastructure',
      sector: 'Engineering & Const.',
      ceo: 'Catherine Doyle',
      hq: 'Toronto, ON',
      startPrice: 52.0,
      pe: '15.0',
      beta: '1.2',
      de: '1.50',
      revGrowth: '+6%',
      netMargin: '3.7%',
      intel: '35% transport, 25% energy, 20% buildings/housing, 10% north/defence, 10% intl (Europe). $26B backlog including $1.1B Far North Highway (connects TAG Aurore). Thin 3.7% margin with fixed-price contracts (cost overruns hurt!) and D/E 1.50 (sensitive to interest rates & real-estate client defaults).',
      keywords: ['northline', 'catherine doyle', 'far north highway', 'route du grand nord', 'fixed-price', 'prix fixe', 'infrastructure', 'construction', 'real estate developer', 'promoteur immobilier', 'housing', 'rail'],
    },
    CHA: {
      id: '4231',
      name: 'Épiceries Champlain',
      sector: 'Food Retail',
      ceo: 'Isabelle Gagnon',
      hq: 'Quebec City, QC',
      startPrice: 68.5,
      pe: '18.0',
      beta: '0.5',
      de: '0.85',
      revGrowth: '+4%',
      netMargin: '4.0%',
      intel: 'QC largest grocer (28% share, 410 stores: Champlain, Express, Marché Fleuve discount). Defensive Beta 0.5, ROE 16.5%, 12 yrs dividend hikes. Testing Comptoir Champlain ready-meals & open to acquiring a restaurant chain (PIN). Risk: Québec Ensemble promises public inquiry into grocers’ margins / price regulation.',
      keywords: ['champlain', 'isabelle gagnon', 'marché fleuve', 'marche fleuve', 'comptoir champlain', 'limoilou', 'grocery', 'grocers', 'épicerie', 'épicier', 'supermarket', 'food retail'],
    },
    PIN: {
      id: '4232',
      name: 'Les Restaurants Papineau',
      sector: 'Restaurants',
      ceo: 'Olivier Desrosiers',
      hq: 'Montreal, QC',
      startPrice: 18.0,
      pe: '30.0',
      beta: '1.6',
      de: '1.86',
      revGrowth: '+14%',
      netMargin: '2.8%',
      intel: '260 QC family bistros expanding to Ontario (30 by 2032). Expensive P/E 30, thin 2.8% margin, 34% labour cost (minimum wage sensitive), cyclic in recession. Heavy debt: D/E 1.86, debt/operating income at 3.6x vs 4.0x credit covenant limit! Considering frozen meals in grocery stores / potential CHA acquisition target.',
      keywords: ['papineau', 'olivier desrosiers', 'poutine', 'minimum wage', 'salaire minimum', 'restaurant', 'restauration', 'frozen meal', 'plats surgelés', 'covenant'],
    },
    HOL: {
      id: '4233',
      name: 'Hollis & Rowe',
      sector: 'Apparel & Footwear',
      ceo: 'Grant Hollis',
      hq: 'Portland, OR',
      startPrice: 82.0,
      pe: '17.8',
      beta: '1.1',
      de: '0.55',
      revGrowth: '+5%',
      netMargin: '8.8%',
      intel: '2,100 outdoor apparel stores ("Made to Last", ROE 24.2%, $3.8B cash). Sales: 55% US, 25% EU, 20% Asia. 70% made in Asia (Bangladesh, Vietnam, Taiwan). Risks: NGO labour accusations, US tariffs on Asian imports, Fall 2030 EU supply-chain directive, consumer recession. Moving part of production to Mexico & testing AI inventory (-30% unsold stock).',
      keywords: ['hollis', 'grant hollis', 'made to last', 'portland', 'apparel', 'footwear', 'clothing', 'vêtements', 'tariff', 'tarif', 'bangladesh', 'vietnam', 'mexico', 'mexique', 'unsold stock', 'working conditions'],
    },
  };

  // Context clues for anonymous news items
  const CLUE_NOTES = [
    { match: ['québec ensemble', 'quebec ensemble', 'camille fortin'], note: 'QC Election: Québec Ensemble backs LIA ($2B H2 fund), threatens TAG ($600M subsidy/royalties) & CHA (grocer margin inquiry).' },
    { match: ['alliance prospérité', 'alliance prosperite', 'jean-philippe ouellet', 'ouellet'], note: 'QC Election: Alliance prospérité backs TAG (Aurore mining) & NOR (Far North Highway), shelves LIA green H2 fund.' },
    { match: ['cardiva'], note: 'Cardiva = ALE heart-failure drug (38% of revenue; patent expires April 2030).' },
    { match: ['ht-114', 'ht 114', 'obesity', 'obésité'], note: 'HT-114 = ALE once-daily oral obesity pill (Phase 3 results due late summer 2030; no fallback if it fails).' },
    { match: ['legio', 'ravenne', 'alea-3', 'julian vance'], note: 'Rubicon AI (RAI): Alea-3 model, Project Legio AGI & Ravenne-2 data centre (Fall 2030).' },
    { match: ['lock-up', 'blocage', 'miles stern', 'palissade research'], note: 'Palissade (PAL) holds 6% of RAI (lock-up expires mid-July 2030); Palissade Research reports move markets.' },
    { match: ['aurore', 'luc bergeron', '55th parallel', '55e parallèle'], note: 'Aurore = TAG $2.8B lithium/nickel project ($600M subsidy, 240-km road via NOR).' },
    { match: ['bastion', 'diane kessler'], note: 'Bastion OS = Grayhawk (HAW) military command software ($95B backlog).' },
    { match: ['bécancour', 'becancour', 'sophie lachance'], note: 'Hydrélia (LIA) $1.2B green hydrogen plant in Bécancour (needs financing within 18m).' },
    { match: ['far north highway', 'route du grand nord', 'catherine doyle'], note: 'Northline (NOR) $1.1B Far North Highway contract (thin 3.7% margin, fixed-price risk).' },
    { match: ['marché fleuve', 'comptoir champlain', 'isabelle gagnon'], note: 'Champlain (CHA): Marché Fleuve discount banner & Comptoir Champlain ready-meals (eyeing restaurant M&A).' },
    { match: ['olivier desrosiers', 'minimum wage', 'salaire minimum'], note: 'Papineau (PIN): 34% labour cost, P/E 30, debt at 3.6x vs 4.0x credit covenant.' },
    { match: ['grant hollis', 'made to last', 'bangladesh', 'vietnam'], note: 'Hollis & Rowe (HOL): 70% made in Asia (Bangladesh/Vietnam/Taiwan); shifting to Mexico + AI inventory.' },
  ];

  const state = {
    products: [],
    priceHistory: {},
    cash: 1000000,
    totalValue: 1000000,
    holdings: {},          // { ticker: { qty, avgPrice } }
    seenEvents: new Set(),
    newsList: [],          // [{ id, timeLabel, tags, clue, headline, isArticle }]
    newsVersion: 0,
    expandedSym: null,     // Ticker whose handbook dossier is expanded
    newsFilter: 'ALL',     // 'ALL' or ticker symbol
    lastPollAt: null,
    lastError: null,
    statusMsg: '',
    timer: null,
  };

  let lastRenderedNewsVersion = -1;
  let lastRenderedFilter = 'ALL';

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fetchJson = async (path) => {
    const res = await fetch(path, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.json();
  };

  const getChg60s = (sym, currentPrice) => {
    const hist = state.priceHistory[sym] || [];
    const baseP = hist.length > 1 ? hist[0].p : currentPrice;
    return baseP > 0 ? ((currentPrice - baseP) / baseP) * 100 : 0;
  };

  const roundShares = (rawQty) => {
    const n = Math.floor(Number(rawQty) || 0);
    if (!cfg.roundMode) return Math.max(0, n);
    if (n >= 500) return Math.floor(n / 100) * 100;
    if (n >= 100) return Math.floor(n / 50) * 50;
    if (n >= 20) return Math.floor(n / 10) * 10;
    return Math.max(0, n);
  };

  // Calculate shares for X% of current cash (plus max shares allowed under 40% single-stock cap)
  const calcCashPctShares = (sym, price) => {
    if (!price || price <= 0 || state.cash <= 50) return { pctShares: 0, maxCapShares: 0 };
    const targetCash = state.cash * (Number(cfg.allocPct || 20) / 100);
    const maxSpendable = Math.max(0, (state.cash - 55) / 1.005);
    const budget = Math.min(targetCash, maxSpendable);
    const pctShares = roundShares(budget / price);

    const heldQty = Math.abs(Number(state.holdings[sym]?.qty || 0));
    const maxTotalSharesFor40Pct = Math.floor((state.totalValue * 0.395) / price);
    const maxCapShares = Math.max(0, maxTotalSharesFor40Pct - heldQty);
    return { pctShares, maxCapShares };
  };

  const analyzeNewsIntel = (headline) => {
    const t = String(headline || '').toLowerCase();
    const tags = [];
    for (const [sym, info] of Object.entries(TICKERS)) {
      if (info.keywords.some((kw) => t.includes(kw))) {
        tags.push(sym);
      }
    }
    const clues = [];
    for (const c of CLUE_NOTES) {
      if (c.match.some((m) => t.includes(m))) {
        clues.push(c.note);
      }
    }
    return { tags, clue: clues.join(' · ') };
  };

  const setNativeValue = (el, val) => {
    const proto =
      el.tagName === 'SELECT'
        ? window.HTMLSelectElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, String(val));
    else el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const prefillTradeForm = ({ productId, ticker, qty }) => {
    if (!cfg.prefillEnabled) return;
    const select =
      document.querySelector('select[name="financial_product_id"]') ||
      document.querySelector('form select');
    const form = select?.closest('form') || document.querySelector('form');
    if (!form) {
      state.statusMsg = 'Open /player/trade to fill';
      renderHeader();
      return;
    }

    const sel =
      form.querySelector('select[name="financial_product_id"]') ||
      form.querySelector('select');
    if (sel) {
      let targetVal = productId ? String(productId) : '';
      const opts = Array.from(sel.options || []);
      if (!opts.some((o) => o.value === targetVal) && ticker) {
        const byTicker = opts.find((o) => o.textContent.toUpperCase().includes(ticker.toUpperCase()));
        if (byTicker) targetVal = byTicker.value;
      }
      if (targetVal) setNativeValue(sel, targetVal);
    }

    const qtyInput =
      form.querySelector('input[name="quantity"]') ||
      form.querySelector('input[type="number"]');
    if (qtyInput && qty > 0) {
      setNativeValue(qtyInput, qty);
    }

    state.statusMsg = `Filled ${ticker} × ${qty}`;
    renderHeader();
  };

  // --- Static DOM Shell ---
  const root = document.createElement('div');
  root.id = 'boursify-copilot-root';
  const applyWidth = () => {
    root.style.width = cfg.wideMode ? '620px' : '450px';
  };
  root.style.cssText = [
    'position:fixed', 'bottom:14px', 'right:14px', 'z-index:999999',
    'max-height:88vh', 'display:flex', 'flex-direction:column',
    'background:#0f172a', 'color:#f8fafc', 'border:1px solid #334155',
    'border-radius:12px', 'box-shadow:0 12px 32px rgba(0,0,0,0.5)',
    'font-family:system-ui,-apple-system,sans-serif', 'font-size:12px', 'overflow:hidden',
  ].join(';');
  applyWidth();

  const filterSymbols = ['ALL', ...Object.keys(TICKERS)];
  const filterPillsHtml = filterSymbols
    .map(
      (sym) =>
        `<button data-filter-sym="${sym}" style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:4px;padding:2px 5px;cursor:pointer;font-size:10px;font-weight:600;">${sym}</button>`
    )
    .join('');

  root.innerHTML = `
    <div id="bc-drag-handle" style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:#1e293b;border-bottom:1px solid #334155;cursor:move;user-select:none;">
      <div style="min-width:0;padding-right:8px;">
        <div style="font-weight:700;font-size:13px;">Boursify Intel & 20% Cash Sizer <span style="color:#38bdf8">#${esc(cfg.simId)}</span> <span id="bc-status-msg" style="font-size:10px;color:#4ade80;"></span></div>
        <div id="bc-cash-line" style="color:#94a3b8;font-size:10px;">Cash: $1,000,000 · Total: $1,000,000 (+0.0%)</div>
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
        <button id="bc-toggle-wide" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:4px 7px;cursor:pointer;font-size:10px;">Wide</button>
        <button id="bc-toggle-prefill" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;font-weight:600;">Pre-fill: OFF</button>
        <button id="bc-min" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">−</button>
      </div>
    </div>
    <div id="bc-body" style="padding:9px 12px;display:flex;flex-direction:column;gap:7px;overflow:hidden;flex:1;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;background:#1e293b;padding:5px 8px;border-radius:6px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:4px;">
          <span style="font-size:11px;color:#e2e8f0;font-weight:600;">Cash %:</span>
          <input id="bc-alloc" type="number" min="1" max="100" value="${cfg.allocPct}" style="width:44px;background:#0f172a;color:#38bdf8;font-weight:700;border:1px solid #475569;border-radius:4px;padding:2px 4px;">
          <button data-pct="10" style="background:#334155;color:#cbd5e1;border:none;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:10px;">10%</button>
          <button data-pct="20" style="background:#334155;color:#cbd5e1;border:none;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:10px;">20%</button>
          <button data-pct="30" style="background:#334155;color:#cbd5e1;border:none;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:10px;">30%</button>
        </div>
        <span id="bc-budget-pill" style="color:#38bdf8;font-weight:700;font-size:11px;">= $200,000</span>
        <button id="bc-toggle-round" style="background:#2563eb;color:#e2e8f0;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:10px;">Round: ON</button>
      </div>
      <div style="display:grid;grid-template-columns:1.3fr 1.25fr 1.1fr;font-weight:700;font-size:10px;color:#94a3b8;padding:0 2px;">
        <span>STOCK (CLICK FOR INTEL)</span>
        <span style="text-align:right;">PRICE · 60s · VS START</span>
        <span id="bc-col-sh-hdr" style="text-align:right;">${cfg.allocPct}% CASH SHARES</span>
      </div>
      <div id="bc-quotes-list" style="overflow-y:auto;max-height:260px;padding-right:2px;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
        <span style="font-weight:700;font-size:11px;color:#94a3b8;">LIVE NEWS & HANDBOOK CLUES</span>
        <span id="bc-news-count" style="font-size:10px;color:#64748b;">0 items</span>
      </div>
      <div id="bc-filter-bar" style="display:flex;gap:3px;flex-wrap:wrap;">${filterPillsHtml}</div>
      <div id="bc-news-list" style="overflow-y:auto;max-height:240px;padding-right:2px;"></div>
    </div>
  `;
  document.body.appendChild(root);

  const elStatus = root.querySelector('#bc-status-msg');
  const elCash = root.querySelector('#bc-cash-line');
  const elWideBtn = root.querySelector('#bc-toggle-wide');
  const elPrefillBtn = root.querySelector('#bc-toggle-prefill');
  const elMinBtn = root.querySelector('#bc-min');
  const elBody = root.querySelector('#bc-body');
  const elAlloc = root.querySelector('#bc-alloc');
  const elBudgetPill = root.querySelector('#bc-budget-pill');
  const elRoundBtn = root.querySelector('#bc-toggle-round');
  const elColShHdr = root.querySelector('#bc-col-sh-hdr');
  const elQuotesList = root.querySelector('#bc-quotes-list');
  const elNewsCount = root.querySelector('#bc-news-count');
  const elFilterBar = root.querySelector('#bc-filter-bar');
  const elNewsList = root.querySelector('#bc-news-list');
  const elHandle = root.querySelector('#bc-drag-handle');

  const renderHeader = () => {
    const pct = Number(cfg.allocPct || 20);
    const targetDollars = Math.round(state.cash * (pct / 100));
    const retPct = ((state.totalValue - 1000000) / 1000000) * 100;
    const retCol = retPct >= 0 ? '#4ade80' : '#f87171';

    elStatus.textContent = state.statusMsg ? `(${state.statusMsg})` : '';
    elCash.innerHTML = `Cash: <b>$${Math.round(state.cash).toLocaleString()}</b> · Total: <b>$${Math.round(state.totalValue).toLocaleString()}</b> <span style="color:${retCol}">(${retPct >= 0 ? '+' : ''}${retPct.toFixed(2)}%)</span> · ${
      state.lastError
        ? `<span style="color:#f87171">${esc(state.lastError)}</span>`
        : esc(state.lastPollAt || '...')
    }`;
    elBudgetPill.textContent = `= $${targetDollars.toLocaleString()}`;
    elColShHdr.textContent = `${pct}% CASH SHARES`;
    elRoundBtn.textContent = `Round: ${cfg.roundMode ? 'ON' : 'Exact'}`;
    elRoundBtn.style.background = cfg.roundMode ? '#2563eb' : '#334155';
    elWideBtn.style.background = cfg.wideMode ? '#2563eb' : '#334155';

    elPrefillBtn.textContent = `Pre-fill: ${cfg.prefillEnabled ? 'ON' : 'OFF'}`;
    elPrefillBtn.style.background = cfg.prefillEnabled ? '#2563eb' : '#334155';
    elMinBtn.textContent = cfg.minimized ? '+' : '−';
    elBody.style.display = cfg.minimized ? 'none' : 'flex';

    elFilterBar.querySelectorAll('[data-filter-sym]').forEach((btn) => {
      const active = btn.getAttribute('data-filter-sym') === state.newsFilter;
      btn.style.background = active ? '#2563eb' : '#1e293b';
      btn.style.color = active ? '#fff' : '#cbd5e1';
    });
  };

  const renderQuotes = () => {
    if (!state.products.length) {
      elQuotesList.innerHTML = '<div style="color:#64748b;">Loading live prices...</div>';
      return;
    }
    elQuotesList.innerHTML = state.products
      .map((p) => {
        const sym = p.short_name || p.ticker || '?';
        const info = TICKERS[sym] || {};
        const m = p.marketable || {};
        const price = Number(p.current_price || 0);
        const startP = Number(m.starting_price || info.startPrice || price);
        const chg60 = getChg60s(sym, price);
        const chgTot = startP > 0 ? ((price - startP) / startP) * 100 : 0;
        const chg60Col = chg60 > 0.05 ? '#4ade80' : chg60 < -0.05 ? '#f87171' : '#94a3b8';
        const chgTotCol = chgTot > 0.1 ? '#4ade80' : chgTot < -0.1 ? '#f87171' : '#94a3b8';

        const held = state.holdings[sym];
        const qty = held?.qty || 0;
        let heldTag = '';
        if (qty !== 0 && held.avgPrice > 0) {
          const pnl = qty > 0
            ? ((price - held.avgPrice) / held.avgPrice) * 100
            : ((held.avgPrice - price) / held.avgPrice) * 100;
          const pnlCol = pnl >= 0 ? '#4ade80' : '#f87171';
          heldTag = ` <span style="color:#38bdf8;font-weight:700;">(${qty})</span> <span style="color:${pnlCol};font-size:10px;">${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%</span>`;
        }

        const { pctShares, maxCapShares } = calcCashPctShares(sym, price);
        const fillBtns = cfg.prefillEnabled
          ? `<button data-fill-sym="${esc(sym)}" data-fill-id="${esc(p.id)}" data-fill-qty="${pctShares}" style="background:#2563eb;color:#fff;border:none;border-radius:3px;padding:1px 5px;margin-left:4px;cursor:pointer;font-size:10px;font-weight:600;">Fill</button>${
              qty !== 0
                ? `<button data-fill-sym="${esc(sym)}" data-fill-id="${esc(p.id)}" data-fill-qty="${Math.abs(qty)}" style="background:#475569;color:#fff;border:none;border-radius:3px;padding:1px 4px;margin-left:3px;cursor:pointer;font-size:10px;">All</button>`
                : ''
            }`
          : '';

        const isExpanded = state.expandedSym === sym;
        const ma50 = m.moving_average_50_days ? `$${Number(m.moving_average_50_days).toFixed(2)}` : 'n/a';
        const ma200 = m.moving_average_200_days ? `$${Number(m.moving_average_200_days).toFixed(2)}` : 'n/a';
        const hi = m.highest_price ? `$${Number(m.highest_price).toFixed(2)}` : 'n/a';
        const lo = m.lowest_price ? `$${Number(m.lowest_price).toFixed(2)}` : 'n/a';

        const detailHtml = isExpanded
          ? `<div style="background:#1e293b;border-radius:6px;padding:7px 9px;margin:3px 0 5px;font-size:11px;border-left:3px solid #38bdf8;">
              <div style="display:flex;justify-content:space-between;color:#94a3b8;font-size:10px;margin-bottom:3px;">
                <span><b>${esc(info.name || sym)}</b> · ${esc(info.sector || '')} · CEO: <b>${esc(info.ceo || '?')}</b></span>
                <span>40%-Cap Room: <b style="color:#e2e8f0">${maxCapShares.toLocaleString()} sh</b></span>
              </div>
              <div style="color:#cbd5e1;font-size:10px;margin-bottom:4px;">
                Start: <b>$${startP.toFixed(2)}</b> · P/E: <b>${esc(info.pe || '?')}</b> · Beta: <b>${esc(info.beta || '?')}</b> · D/E: <b>${esc(info.de || '?')}</b> · Rev: <b>${esc(info.revGrowth || '?')}</b> · Margin: <b>${esc(info.netMargin || '?')}</b> · MA50: <b>${ma50}</b> · MA200: <b>${ma200}</b> · Range: <b>${lo}–${hi}</b>
              </div>
              <div style="color:#f1f5f9;line-height:1.35;">${esc(info.intel || '')}</div>
            </div>`
          : '';

        return `<div style="border-bottom:1px solid #1e293b;">
          <div data-expand-sym="${esc(sym)}" style="display:grid;grid-template-columns:1.3fr 1.25fr 1.1fr;align-items:center;padding:4px 2px;cursor:pointer;">
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              <span style="color:#64748b;font-size:10px;">${isExpanded ? '▼' : '▶'}</span> <b>${esc(sym)}</b> <span style="color:#64748b;font-size:10px;">${esc(info.sector || '')}</span>${heldTag}
            </span>
            <span style="text-align:right;font-variant-numeric:tabular-nums;">
              <b>$${price.toFixed(2)}</b>
              <span style="color:${chg60Col};font-size:10px;">${chg60 >= 0 ? '+' : ''}${chg60.toFixed(1)}%</span>
              <span style="color:${chgTotCol};font-size:10px;">(${chgTot >= 0 ? '+' : ''}${chgTot.toFixed(1)}%)</span>
            </span>
            <span style="text-align:right;font-variant-numeric:tabular-nums;">
              <b style="color:#38bdf8;font-size:12px;">${pctShares.toLocaleString()} sh</b>${fillBtns}
            </span>
          </div>
          ${detailHtml}
        </div>`;
      })
      .join('');
  };

  const renderNews = () => {
    if (
      lastRenderedNewsVersion === state.newsVersion &&
      lastRenderedFilter === state.newsFilter
    ) {
      return;
    }

    const prevScrollTop = elNewsList.scrollTop;
    const prevScrollHeight = elNewsList.scrollHeight;

    const filtered =
      state.newsFilter === 'ALL'
        ? state.newsList
        : state.newsList.filter((n) => n.tags.includes(state.newsFilter));

    elNewsCount.textContent = `${filtered.length} / ${state.newsList.length} items`;

    if (!filtered.length) {
      elNewsList.innerHTML = '<div style="color:#64748b;padding:6px 0;">No news matching filter...</div>';
    } else {
      elNewsList.innerHTML = filtered
        .slice(0, 45)
        .map((n) => {
          const tagsHtml = n.tags.length
            ? n.tags
                .map(
                  (sym) =>
                    `<span style="background:#1d4ed8;color:#fff;padding:1px 5px;border-radius:4px;font-weight:700;font-size:10px;margin-right:4px;">${esc(sym)}</span>`
                )
                .join('')
            : `<span style="background:#334155;color:#cbd5e1;padding:1px 5px;border-radius:4px;font-size:10px;margin-right:4px;">MACRO</span>`;
          const artTag = n.isArticle
            ? `<span style="background:#7c3aed;color:#fff;padding:1px 5px;border-radius:4px;font-weight:700;font-size:10px;margin-right:4px;">ARTICLE</span>`
            : '';
          const clueHtml = n.clue
            ? `<div style="color:#38bdf8;font-size:10px;margin-top:3px;padding-top:3px;border-top:1px dashed #334155;"><b>Handbook Intel:</b> ${esc(n.clue)}</div>`
            : '';

          return `<div style="background:#1e293b;border-radius:8px;padding:7px 9px;margin-bottom:6px;border-left:3px solid ${n.tags.length ? '#38bdf8' : '#64748b'};">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
              <div>${artTag}${tagsHtml}</div>
              <span style="color:#94a3b8;font-size:10px;">${esc(n.timeLabel)}</span>
            </div>
            <div style="color:#f1f5f9;font-size:11px;line-height:1.35;">${esc(n.headline)}</div>
            ${clueHtml}
          </div>`;
        })
        .join('');
    }

    if (prevScrollTop > 15 && lastRenderedFilter === state.newsFilter) {
      const delta = elNewsList.scrollHeight - prevScrollHeight;
      elNewsList.scrollTop = Math.max(0, prevScrollTop + delta);
    }

    lastRenderedNewsVersion = state.newsVersion;
    lastRenderedFilter = state.newsFilter;
  };

  const render = () => {
    renderHeader();
    renderQuotes();
    renderNews();
  };

  // --- Controls ---
  elWideBtn.addEventListener('click', () => {
    cfg.wideMode = !cfg.wideMode;
    saveCfg();
    applyWidth();
    renderHeader();
  });

  elPrefillBtn.addEventListener('click', () => {
    cfg.prefillEnabled = !cfg.prefillEnabled;
    saveCfg();
    renderHeader();
    renderQuotes();
  });

  elMinBtn.addEventListener('click', () => {
    cfg.minimized = !cfg.minimized;
    saveCfg();
    renderHeader();
  });

  const setAllocPct = (val) => {
    cfg.allocPct = Math.max(1, Math.min(100, Number(val) || 20));
    elAlloc.value = String(cfg.allocPct);
    saveCfg();
    renderHeader();
    renderQuotes();
  };
  elAlloc.addEventListener('input', (e) => setAllocPct(e.target.value));
  elAlloc.addEventListener('change', (e) => setAllocPct(e.target.value));

  root.querySelectorAll('[data-pct]').forEach((btn) => {
    btn.addEventListener('click', () => setAllocPct(btn.getAttribute('data-pct')));
  });

  elRoundBtn.addEventListener('click', () => {
    cfg.roundMode = !cfg.roundMode;
    saveCfg();
    renderHeader();
    renderQuotes();
  });

  elQuotesList.addEventListener('click', (e) => {
    const fillBtn = e.target.closest('[data-fill-sym]');
    if (fillBtn) {
      e.stopPropagation();
      prefillTradeForm({
        productId: fillBtn.getAttribute('data-fill-id'),
        ticker: fillBtn.getAttribute('data-fill-sym'),
        qty: Number(fillBtn.getAttribute('data-fill-qty') || 0),
      });
      return;
    }
    const row = e.target.closest('[data-expand-sym]');
    if (row) {
      const sym = row.getAttribute('data-expand-sym');
      state.expandedSym = state.expandedSym === sym ? null : sym;
      renderQuotes();
    }
  });

  elFilterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter-sym]');
    if (!btn) return;
    state.newsFilter = btn.getAttribute('data-filter-sym') || 'ALL';
    renderHeader();
    renderNews();
  });

  // --- Draggable Header ---
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  const onMouseMove = (e) => {
    if (!dragging) return;
    root.style.left = `${Math.max(0, origLeft + (e.clientX - startX))}px`;
    root.style.top = `${Math.max(0, origTop + (e.clientY - startY))}px`;
  };
  const onMouseUp = () => {
    dragging = false;
  };
  elHandle.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    dragging = true;
    const rect = root.getBoundingClientRect();
    root.style.right = 'auto';
    root.style.bottom = 'auto';
    root.style.left = `${rect.left}px`;
    root.style.top = `${rect.top}px`;
    startX = e.clientX;
    startY = e.clientY;
    origLeft = rect.left;
    origTop = rect.top;
  });
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  // --- Live Poller ---
  let isPolling = false;
  const poll = async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      const base = `/resources/simulation/${cfg.simId}`;
      const [productsRes, portfolioRes, eventsRes, articlesRes] = await Promise.all([
        fetchJson(`${base}/financial-products`),
        fetchJson(`${base}/player/${cfg.playerId}/portfolio`),
        fetchJson(`${base}/player/${cfg.playerId}/past-events`),
        fetchJson(`${base}/articles`).catch(() => null),
      ]);

      const products = Array.isArray(productsRes) ? productsRes : productsRes.data || [];
      state.products = products;
      const now = Date.now();
      for (const p of products) {
        const sym = p.short_name || p.ticker;
        const price = Number(p.current_price || 0);
        if (!sym || !price) continue;
        const arr = state.priceHistory[sym] || [];
        arr.push({ t: now, p: price });
        state.priceHistory[sym] = arr.filter((x) => now - x.t <= 60000);
      }

      if (portfolioRes) {
        const cashVal = portfolioRes.summary?.cash_balance ?? portfolioRes.current_cash;
        if (cashVal !== undefined) state.cash = Number(cashVal);
        const totalVal = portfolioRes.summary?.total_value ?? portfolioRes.total_value;
        if (totalVal !== undefined) state.totalValue = Number(totalVal);

        const items = portfolioRes.positions || portfolioRes.items || portfolioRes.financial_products || [];
        const nextHoldings = {};
        if (Array.isArray(items)) {
          for (const it of items) {
            const fp = it.financial_product || state.products.find((p) => p.id === it.financial_product_id);
            const sym = it.short_name || it.ticker || fp?.short_name || fp?.ticker;
            const q = Number(it.quantity ?? it.pivot?.quantity ?? 0);
            const avg = Number(it.average_price ?? it.avg_price ?? it.unit_price ?? fp?.current_price ?? 0);
            if (sym && q !== 0) nextHoldings[sym] = { qty: q, avgPrice: avg };
          }
        }
        state.holdings = nextHoldings;
      }

      const rawEvents = Array.isArray(eventsRes) ? eventsRes : eventsRes.events || eventsRes.data || [];
      for (const ev of rawEvents) {
        const key = `ev_${ev.id || ev.uuid || ev.in_game_starting_time || JSON.stringify(ev)}`;
        if (state.seenEvents.has(key)) continue;
        state.seenEvents.add(key);

        const desc = ev.description;
        const headline =
          (typeof desc === 'string' ? desc : desc?.en || desc?.fr) ||
          (typeof ev.title === 'string' ? ev.title : ev.title?.en || ev.title?.fr) ||
          ev.content ||
          ev.text ||
          key;

        const { tags, clue } = analyzeNewsIntel(headline);
        state.newsList.unshift({
          id: key,
          timeLabel: ev.date || ev.formatted_date || `t=${ev.in_game_starting_time ?? ''}`,
          tags,
          clue,
          headline,
          isArticle: false,
        });
        state.newsVersion++;
      }

      const rawArticles = Array.isArray(articlesRes) ? articlesRes : articlesRes?.articles || articlesRes?.data || [];
      for (const art of rawArticles) {
        const key = `art_${art.id || art.uuid || JSON.stringify(art)}`;
        if (state.seenEvents.has(key)) continue;
        state.seenEvents.add(key);

        const title = typeof art.title === 'string' ? art.title : art.title?.en || art.title?.fr || '';
        const body = typeof art.content === 'string' ? art.content : art.content?.en || art.content?.fr || art.description?.en || art.description?.fr || '';
        const headline = [title, body].filter(Boolean).join(' — ');
        if (!headline) continue;

        const { tags, clue } = analyzeNewsIntel(headline);
        state.newsList.unshift({
          id: key,
          timeLabel: art.date || art.published_at || 'Article',
          tags,
          clue,
          headline,
          isArticle: true,
        });
        state.newsVersion++;
      }

      state.lastPollAt = new Date().toLocaleTimeString();
      state.lastError = null;
    } catch (err) {
      state.lastError = err.message;
    } finally {
      isPolling = false;
    }
    render();
  };

  render();
  poll();
  state.timer = setInterval(poll, cfg.pollMs);

  window.__BOURSIFY_COPILOT__ = {
    destroy: () => {
      clearInterval(state.timer);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      root.remove();
      delete window.__BOURSIFY_COPILOT__;
    },
    poll,
  };
})();
