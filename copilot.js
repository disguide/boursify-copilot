/**
 * Boursify 20% Total Portfolio Sizer & Multi-Point Price Tracker (SBG 2026)
 *
 * Pure price data & 20% Total Portfolio Value sizer — no news feed, no handbook text:
 *  - Shows all 10 stocks on screen at once (no scrolling needed).
 *  - Multi-point price metrics per stock:
 *      * Live Price ($XX.XX)
 *      * % vs Average (MA50 / Session Mean) + % vs Start Price
 *      * % off High (drawdown from peak) & % off Low (bounce from bottom)
 *      * Visual Low–High Range Bar (0% = at Low, 100% = at High)
 *      * Multi-timeframe momentum: 30s %, 1m %, 3m %
 *      * Clear DIP / PEAK action tag (DOWN vs Avg -> BUY DIP; UP vs Avg -> SHORT/SELL)
 *  - 1-click Sort: Default | Most Down ▼ | Most Up ▲
 *  - 20% of Total Portfolio Value share calculator (with B / S / Exit pre-fill buttons when Pre-fill: ON).
 */
(() => {
  if (window.__BOURSIFY_COPILOT__) {
    window.__BOURSIFY_COPILOT__.destroy();
  }

  const STORAGE_KEY = 'boursify_copilot_cfg_v6';
  const defaultCfg = {
    simId: '448',
    playerId: '38158',
    pollMs: 2000,
    prefillEnabled: false,
    allocPct: 20,        // 20% of TOTAL PORTFOLIO VALUE
    roundMode: true,
    avgMode: 'BLENDED',  // 'BLENDED' (Roll 3m + Mkt Drift) | 'ROLLING' (3m Moving Avg) | 'MARKET' (vs 10-Stock Market Avg)
    sortMode: 'DEFAULT', // 'DEFAULT' | 'DOWN' | 'UP'
    wideMode: true,
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

  const START_PRICES = {
    RAI: 48.0,
    PAL: 85.0,
    ALE: 112.0,
    TAG: 31.0,
    HAW: 145.0,
    LIA: 24.0,
    NOR: 52.0,
    CHA: 68.5,
    PIN: 18.0,
    HOL: 82.0,
  };

  const state = {
    products: [],
    priceHistory: {},      // { sym: [{ t, p }] } up to 3 minutes
    sessionStats: {},      // { sym: { sum, count, min, max, ema } }
    mktAvgDriftPct: 0,     // equal-weight % change across all 10 stocks vs Start Price
    cash: 1000000,
    totalValue: 1000000,
    holdings: {},          // { sym: { qty, avgPrice, pnlDollars, pnlPct, totalAmount } }
    txCostMap: {},         // { sym: { qty, avgPrice } } reconstructed from /transactions
    pollTick: 0,
    lastPollAt: null,
    lastError: null,
    statusMsg: '',
    timer: null,
  };

  // Reconstruct exact average purchase/short entry price per stock from transaction history
  const computeCostBasisFromTransactions = (txRes) => {
    const list = Array.isArray(txRes)
      ? txRes
      : txRes?.transactions || txRes?.data || [];
    if (!Array.isArray(list) || !list.length) return;

    // Check chronological order: if the first item has a larger ID than the last item, reverse it (newest-first -> oldest-first)
    const sorted = [...list];
    if (sorted.length > 1) {
      const firstId = Number(sorted[0]?.id ?? sorted[0]?.transaction_id ?? 0);
      const lastId = Number(sorted[sorted.length - 1]?.id ?? sorted[sorted.length - 1]?.transaction_id ?? 0);
      if (firstId && lastId && firstId > lastId) {
        sorted.reverse();
      } else if (sorted[0]?.created_at && sorted[sorted.length - 1]?.created_at) {
        if (new Date(sorted[0].created_at) > new Date(sorted[sorted.length - 1].created_at)) {
          sorted.reverse();
        }
      }
    }

    const map = {}; // { sym: { qty: 0, avgPrice: 0 } }
    for (const tx of sorted) {
      if (!tx || typeof tx !== 'object') continue;
      const prodId =
        tx.financial_product_id ??
        tx.product_id ??
        tx.financial_product?.id ??
        tx.marketable?.id;
      const fp =
        tx.financial_product ||
        state.products.find(
          (p) =>
            (prodId !== undefined && String(p.id) === String(prodId)) ||
            (tx.ticker && (p.short_name === tx.ticker || p.marketable?.ticker === tx.ticker)) ||
            (tx.short_name && p.short_name === tx.short_name) ||
            (tx.name && (p.marketable?.name === tx.name || p.name === tx.name))
        );
      const sym =
        tx.short_name ||
        tx.ticker ||
        tx.symbol ||
        tx.financial_product?.short_name ||
        tx.financial_product?.ticker ||
        tx.marketable?.ticker ||
        tx.marketable?.short_name ||
        fp?.short_name ||
        fp?.ticker;
      if (!sym) continue;

      let rawQ = Number(tx.quantity ?? tx.qty ?? tx.shares ?? 0);
      const unitP = Number(
        tx.unit_price ??
          tx.price ??
          tx.execution_price ??
          tx.average_price ??
          (rawQ !== 0 && tx.amount ? Math.abs(Number(tx.amount)) / Math.abs(rawQ) : 0)
      );
      if (!rawQ || unitP <= 0) continue;

      const typeStr = String(tx.type ?? tx.side ?? tx.action ?? tx.transaction_type ?? '').toLowerCase();
      let signedQ = rawQ;
      if (typeStr.includes('sell') || typeStr.includes('vente') || typeStr.includes('short')) {
        signedQ = -Math.abs(rawQ);
      } else if (typeStr.includes('buy') || typeStr.includes('achat')) {
        signedQ = Math.abs(rawQ);
      }

      const cur = map[sym] || { qty: 0, avgPrice: 0 };
      const prevQty = cur.qty;
      const nextQty = prevQty + signedQ;

      if (nextQty === 0) {
        cur.qty = 0;
        cur.avgPrice = 0;
      } else if (prevQty === 0 || (prevQty > 0 && signedQ > 0) || (prevQty < 0 && signedQ < 0)) {
        // Opening or adding to the same side -> weighted average entry price
        const totalCost = Math.abs(prevQty) * cur.avgPrice + Math.abs(signedQ) * unitP;
        cur.avgPrice = totalCost / Math.abs(nextQty);
        cur.qty = nextQty;
      } else if ((prevQty > 0 && nextQty > 0) || (prevQty < 0 && nextQty < 0)) {
        // Partial close -> entry price stays the same
        cur.qty = nextQty;
      } else {
        // Flipped from long to short or short to long -> new side gets current unitP
        cur.qty = nextQty;
        cur.avgPrice = unitP;
      }
      map[sym] = cur;
    }
    state.txCostMap = map;
  };

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

  // Get % price change over lookbackMs (e.g. 30000, 60000, 180000)
  const getChgWindow = (sym, currentPrice, lookbackMs) => {
    const hist = state.priceHistory[sym] || [];
    if (hist.length < 2) return 0;
    const cutoff = Date.now() - lookbackMs;
    let ref = hist[0].p;
    for (let i = hist.length - 1; i >= 0; i--) {
      if (hist[i].t <= cutoff) {
        ref = hist[i].p;
        break;
      }
    }
    return ref > 0 ? ((currentPrice - ref) / ref) * 100 : 0;
  };

  // Compute equal-weight 10-stock market average drift % from Start Price
  const computeMarketDriftPct = () => {
    if (!state.products.length) return 0;
    let sumPct = 0;
    let count = 0;
    for (const p of state.products) {
      const sym = p.short_name || p.ticker || '?';
      const price = Number(p.current_price || 0);
      const startP = Number(p.marketable?.starting_price || START_PRICES[sym] || price);
      if (price > 0 && startP > 0) {
        sumPct += ((price - startP) / startP) * 100;
        count += 1;
      }
    }
    return count > 0 ? sumPct / count : 0;
  };

  // Compute comprehensive drift-adjusted price data points for a stock
  const getPriceMetrics = (p, mktDriftPct) => {
    const sym = p.short_name || p.ticker || '?';
    const price = Number(p.current_price || 0);
    const m = p.marketable || {};
    const startP = Number(m.starting_price || START_PRICES[sym] || price);
    const ma50 = Number(m.moving_average_50_days || 0);
    const ma200 = Number(m.moving_average_200_days || 0);
    const st = state.sessionStats[sym];
    const sessionAvg = st && st.count > 0 ? st.sum / st.count : price;

    // 1. Rolling 3-minute Moving Average (moves up as the stock drifts up over time)
    const hist = state.priceHistory[sym] || [];
    const roll3mAvg =
      hist.length > 0
        ? hist.reduce((acc, pt) => acc + pt.p, 0) / hist.length
        : st?.ema || sessionAvg;
    const vsRollPct = roll3mAvg > 0 ? ((price - roll3mAvg) / roll3mAvg) * 100 : 0;

    // 2. Market-Drift Adjusted Average Price (what this stock's price would be if it moved with the 10-stock average)
    const mktExpectedPrice = startP * (1 + mktDriftPct / 100);
    const vsMktPct =
      mktExpectedPrice > 0 ? ((price - mktExpectedPrice) / mktExpectedPrice) * 100 : 0;

    // 3. Blended Drift-Proof Average (50% Rolling 3m Moving Avg + 50% Market-Drift Expected Price)
    const blendedAvg = (roll3mAvg + mktExpectedPrice) / 2;
    const vsBlendedPct = blendedAvg > 0 ? ((price - blendedAvg) / blendedAvg) * 100 : 0;

    // Select active average based on cfg.avgMode
    let refAvg = blendedAvg;
    let vsAvgPct = vsBlendedPct;
    if (cfg.avgMode === 'ROLLING') {
      refAvg = roll3mAvg;
      vsAvgPct = vsRollPct;
    } else if (cfg.avgMode === 'MARKET') {
      refAvg = mktExpectedPrice;
      vsAvgPct = vsMktPct;
    }

    const vsStartPct = startP > 0 ? ((price - startP) / startP) * 100 : 0;
    const vsMa50Pct = ma50 > 0 ? ((price - ma50) / ma50) * 100 : vsAvgPct;

    const hi = Math.max(price, startP, Number(m.highest_price || 0), st?.max || price);
    const lo = Math.min(price, startP, Number(m.lowest_price || price) || price, st?.min || price);
    const offHighPct = hi > 0 ? ((price - hi) / hi) * 100 : 0; // negative (how far down from peak)
    const offLowPct = lo > 0 ? ((price - lo) / lo) * 100 : 0;  // positive (how far up from bottom)
    const rangePos = hi > lo ? Math.max(0, Math.min(100, ((price - lo) / (hi - lo)) * 100)) : 50;

    const chg30s = getChgWindow(sym, price, 30000);
    const chg1m = getChgWindow(sym, price, 60000);
    const chg3m = getChgWindow(sym, price, 180000);

    return {
      sym,
      price,
      startP,
      ma50,
      ma200,
      sessionAvg,
      roll3mAvg,
      vsRollPct,
      mktExpectedPrice,
      vsMktPct,
      blendedAvg,
      vsBlendedPct,
      refAvg,
      vsAvgPct,
      vsStartPct,
      vsMa50Pct,
      hi,
      lo,
      offHighPct,
      offLowPct,
      rangePos,
      chg30s,
      chg1m,
      chg3m,
    };
  };

  const roundShares = (rawQty) => {
    const n = Math.floor(Number(rawQty) || 0);
    if (!cfg.roundMode) return Math.max(0, n);
    if (n >= 500) return Math.floor(n / 100) * 100;
    if (n >= 100) return Math.floor(n / 50) * 50;
    if (n >= 20) return Math.floor(n / 10) * 10;
    return Math.max(0, n);
  };

  // Calculate shares for X% of TOTAL PORTFOLIO VALUE
  const calcPortfolioPctShares = (price) => {
    if (!price || price <= 0 || state.totalValue <= 0) return 0;
    const targetDollars = state.totalValue * (Number(cfg.allocPct || 20) / 100);
    return roundShares(targetDollars / price);
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

  const prefillTradeForm = ({ side, productId, ticker, qty }) => {
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

    if (side) {
      const buttons = Array.from(form.querySelectorAll('button[type="button"]'));
      const targets = side === 'BUY' ? ['buy', 'acheter'] : ['sell', 'vendre'];
      const sideBtn = buttons.find((b) => targets.includes(b.textContent.trim().toLowerCase()));
      if (sideBtn) sideBtn.click();
    }

    setTimeout(() => {
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

      state.statusMsg = `Filled ${side || ''} ${ticker} × ${qty}`.trim();
      renderHeader();
    }, 50);
  };

  // --- Static DOM Shell ---
  const root = document.createElement('div');
  root.id = 'boursify-copilot-root';
  const applyWidth = () => {
    root.style.width = cfg.wideMode ? '670px' : '510px';
  };
  root.style.cssText = [
    'position:fixed', 'bottom:14px', 'right:14px', 'z-index:999999',
    'max-height:90vh', 'display:flex', 'flex-direction:column',
    'background:#0f172a', 'color:#f8fafc', 'border:1px solid #334155',
    'border-radius:12px', 'box-shadow:0 12px 32px rgba(0,0,0,0.55)',
    'font-family:system-ui,-apple-system,sans-serif', 'font-size:12px', 'overflow:hidden',
  ].join(';');
  applyWidth();

  root.innerHTML = `
    <div id="bc-drag-handle" style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:#1e293b;border-bottom:1px solid #334155;cursor:move;user-select:none;">
      <div style="min-width:0;padding-right:8px;">
        <div style="font-weight:700;font-size:13px;">Boursify 20% Portfolio Sizer & Price Radar <span style="color:#38bdf8">#${esc(cfg.simId)}</span> <span id="bc-status-msg" style="font-size:10px;color:#4ade80;"></span></div>
        <div id="bc-cash-line" style="color:#94a3b8;font-size:10px;">Total: $1,000,000 · Cash: $1,000,000</div>
      </div>
      <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
        <button id="bc-toggle-wide" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:4px 7px;cursor:pointer;font-size:10px;">Wide</button>
        <button id="bc-toggle-prefill" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;font-weight:600;">Pre-fill: OFF</button>
        <button id="bc-min" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">−</button>
      </div>
    </div>
    <div id="bc-body" style="padding:9px 12px;display:flex;flex-direction:column;gap:7px;overflow:hidden;flex:1;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;background:#1e293b;padding:6px 8px;border-radius:6px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:4px;">
          <span style="font-size:11px;color:#e2e8f0;font-weight:600;">Portfolio %:</span>
          <input id="bc-alloc" type="number" min="1" max="100" value="${cfg.allocPct}" style="width:42px;background:#0f172a;color:#38bdf8;font-weight:700;border:1px solid #475569;border-radius:4px;padding:2px 4px;">
          <button data-pct="10" style="background:#334155;color:#cbd5e1;border:none;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:10px;">10%</button>
          <button data-pct="20" style="background:#334155;color:#cbd5e1;border:none;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:10px;">20%</button>
          <button data-pct="30" style="background:#334155;color:#cbd5e1;border:none;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:10px;">30%</button>
          <button data-pct="40" style="background:#334155;color:#cbd5e1;border:none;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:10px;">40%</button>
        </div>
        <span id="bc-budget-pill" style="color:#38bdf8;font-weight:700;font-size:11px;">= $200,000</span>
        <div style="display:flex;gap:4px;">
          <button id="bc-avg-mode" title="Switch Average Basis (accounts for upward market drift)" style="background:#0284c7;color:#e2e8f0;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:10px;font-weight:600;">Avg: Drift+3m</button>
          <button id="bc-sort" style="background:#334155;color:#e2e8f0;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:10px;font-weight:600;">Sort: Default</button>
          <button id="bc-toggle-round" style="background:#2563eb;color:#e2e8f0;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:10px;">Round: ON</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1.05fr 1.1fr 1.2fr 0.95fr;font-weight:700;font-size:10px;color:#94a3b8;padding:0 2px;">
        <span>STOCK · POSITION P&L</span>
        <span style="text-align:right;">PRICE · DRIFT AVG</span>
        <span style="text-align:right;">UP / DOWN vs AVERAGE</span>
        <span id="bc-col-sh-hdr" style="text-align:right;">${cfg.allocPct}% PORT SHARES</span>
      </div>
      <div id="bc-quotes-list" style="overflow-y:auto;max-height:540px;padding-right:2px;"></div>
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
  const elAvgModeBtn = root.querySelector('#bc-avg-mode');
  const elSortBtn = root.querySelector('#bc-sort');
  const elRoundBtn = root.querySelector('#bc-toggle-round');
  const elColShHdr = root.querySelector('#bc-col-sh-hdr');
  const elQuotesList = root.querySelector('#bc-quotes-list');
  const elHandle = root.querySelector('#bc-drag-handle');

  const fmtDollarsSigned = (v) => {
    const rounded = Math.round(Number(v) || 0);
    return `${rounded >= 0 ? '+$' : '-$'}${Math.abs(rounded).toLocaleString()}`;
  };

  const renderHeader = () => {
    const pct = Number(cfg.allocPct || 20);
    const targetDollars = Math.round(state.totalValue * (pct / 100));
    const totalPnlDollars = state.totalValue - 1000000;
    const retPct = (totalPnlDollars / 1000000) * 100;
    const retCol = totalPnlDollars >= 0 ? '#4ade80' : '#f87171';
    const mktCol = state.mktAvgDriftPct >= 0 ? '#4ade80' : '#f87171';

    let openPnlDollars = 0;
    let openPositionsCount = 0;
    for (const p of state.products) {
      const sym = p.short_name || p.ticker;
      const price = Number(p.current_price || 0);
      const h = sym ? state.holdings[sym] : null;
      if (h && h.qty !== 0) {
        openPositionsCount += 1;
        if (h.pnlDollars !== undefined && h.pnlDollars !== null) {
          openPnlDollars += h.pnlDollars;
        } else if (h.avgPrice > 0) {
          openPnlDollars += h.qty > 0
            ? (price - h.avgPrice) * h.qty
            : (h.avgPrice - price) * Math.abs(h.qty);
        }
      }
    }
    const openCol = openPnlDollars >= 0 ? '#4ade80' : '#f87171';

    elStatus.textContent = state.statusMsg ? `(${state.statusMsg})` : '';
    elCash.innerHTML = `Total: <b>$${Math.round(state.totalValue).toLocaleString()}</b> <span style="color:${retCol};font-weight:700;">(${fmtDollarsSigned(totalPnlDollars)} / ${retPct >= 0 ? '+' : ''}${retPct.toFixed(2)}%)</span> · Open P&L (${openPositionsCount}): <b style="color:${openCol}">${fmtDollarsSigned(openPnlDollars)}</b> · Cash: <b>$${Math.round(state.cash).toLocaleString()}</b> · Mkt: <b style="color:${mktCol}">${state.mktAvgDriftPct >= 0 ? '+' : ''}${state.mktAvgDriftPct.toFixed(1)}%</b>`;
    elBudgetPill.textContent = `= $${targetDollars.toLocaleString()}`;
    elColShHdr.textContent = `${pct}% PORT SHARES`;
    elAvgModeBtn.textContent =
      cfg.avgMode === 'ROLLING'
        ? 'Avg: Roll 3m'
        : cfg.avgMode === 'MARKET'
        ? 'Avg: Mkt Drift'
        : 'Avg: Drift+3m';
    elRoundBtn.textContent = `Round: ${cfg.roundMode ? 'ON' : 'Exact'}`;
    elRoundBtn.style.background = cfg.roundMode ? '#2563eb' : '#334155';
    elSortBtn.textContent =
      cfg.sortMode === 'DOWN'
        ? 'Sort: Most Down ▼'
        : cfg.sortMode === 'UP'
        ? 'Sort: Most Up ▲'
        : 'Sort: Default';
    elSortBtn.style.background = cfg.sortMode === 'DEFAULT' ? '#334155' : '#2563eb';
    elWideBtn.style.background = cfg.wideMode ? '#2563eb' : '#334155';

    elPrefillBtn.textContent = `Pre-fill: ${cfg.prefillEnabled ? 'ON' : 'OFF'}`;
    elPrefillBtn.style.background = cfg.prefillEnabled ? '#2563eb' : '#334155';
    elMinBtn.textContent = cfg.minimized ? '+' : '−';
    elBody.style.display = cfg.minimized ? 'none' : 'flex';
  };

  const fmtPct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

  const renderQuotes = () => {
    if (!state.products.length) {
      elQuotesList.innerHTML = '<div style="color:#64748b;">Loading live prices...</div>';
      return;
    }

    const mktDriftPct = state.mktAvgDriftPct;
    const enriched = state.products.map((p) => ({ p, m: getPriceMetrics(p, mktDriftPct) }));
    if (cfg.sortMode === 'DOWN') {
      enriched.sort((a, b) => a.m.vsAvgPct - b.m.vsAvgPct);
    } else if (cfg.sortMode === 'UP') {
      enriched.sort((a, b) => b.m.vsAvgPct - a.m.vsAvgPct);
    }

    elQuotesList.innerHTML = enriched
      .map(({ p, m }) => {
        const {
          sym,
          price,
          startP,
          refAvg,
          vsAvgPct,
          vsRollPct,
          vsMktPct,
          vsStartPct,
          hi,
          lo,
          offHighPct,
          offLowPct,
          rangePos,
          chg30s,
          chg1m,
          chg3m,
        } = m;

        // Every stock gets an explicit UP or DOWN vs Average badge (adjusted for upward drift):
        // Strong DIP (<= -1.5%) -> bright green BUY DIP; Mild DOWN (< 0%) -> green DOWN vs Avg
        // Strong PEAK (>= +1.5%) -> bright red SHORT/SELL; Mild UP (>= 0%) -> amber/red UP vs Avg
        const isStrongDip = vsAvgPct <= -1.5;
        const isStrongPeak = vsAvgPct >= 1.5;
        const isDown = vsAvgPct < 0;

        let signalBadge = '';
        if (isStrongDip) {
          signalBadge = `<span style="background:#14532d;color:#4ade80;padding:1px 5px;border-radius:3px;font-weight:700;font-size:10px;">▼ DOWN ${vsAvgPct.toFixed(1)}% vs Avg (BUY DIP)</span>`;
        } else if (isDown) {
          signalBadge = `<span style="background:#064e3b;color:#6ee7b7;padding:1px 5px;border-radius:3px;font-weight:600;font-size:10px;">▼ DOWN ${vsAvgPct.toFixed(1)}% vs Avg</span>`;
        } else if (isStrongPeak) {
          signalBadge = `<span style="background:#7f1d1d;color:#fca5a5;padding:1px 5px;border-radius:3px;font-weight:700;font-size:10px;">▲ UP +${vsAvgPct.toFixed(1)}% vs Avg (SHORT)</span>`;
        } else {
          signalBadge = `<span style="background:#451a03;color:#fcd34d;padding:1px 5px;border-radius:3px;font-weight:600;font-size:10px;">▲ UP +${vsAvgPct.toFixed(1)}% vs Avg</span>`;
        }

        const vsStartCol = vsStartPct > 0.1 ? '#4ade80' : vsStartPct < -0.1 ? '#f87171' : '#94a3b8';
        const cRoll = vsRollPct < -0.1 ? '#4ade80' : vsRollPct > 0.1 ? '#f87171' : '#94a3b8';
        const cMkt = vsMktPct < -0.1 ? '#4ade80' : vsMktPct > 0.1 ? '#f87171' : '#94a3b8';
        const c30 = chg30s > 0.05 ? '#4ade80' : chg30s < -0.05 ? '#f87171' : '#94a3b8';
        const c1m = chg1m > 0.05 ? '#4ade80' : chg1m < -0.05 ? '#f87171' : '#94a3b8';
        const c3m = chg3m > 0.05 ? '#4ade80' : chg3m < -0.05 ? '#f87171' : '#94a3b8';

        const held = state.holdings[sym];
        const qty = held?.qty || 0;
        let heldLine = '<div style="color:#475569;font-size:10px;">0 sh</div>';
        if (qty !== 0) {
          const entryP = held.avgPrice > 0 ? held.avgPrice : startP;
          const pnlDollars =
            held.pnlDollars !== undefined && held.pnlDollars !== null
              ? held.pnlDollars
              : qty > 0
              ? (price - entryP) * qty
              : (entryP - price) * Math.abs(qty);
          const pnlPct =
            held.pnlPct !== undefined && held.pnlPct !== null
              ? held.pnlPct
              : entryP > 0
              ? qty > 0
                ? ((price - entryP) / entryP) * 100
                : ((entryP - price) / entryP) * 100
              : 0;
          const pnlCol = pnlDollars > 0 ? '#4ade80' : pnlDollars < 0 ? '#f87171' : '#e2e8f0';
          const pnlBg = pnlDollars > 0 ? '#052e16' : pnlDollars < 0 ? '#450a0a' : '#1e293b';
          const sideTag = qty > 0 ? 'LONG' : 'SHORT';
          const posVal = Math.round(Math.abs(qty) * price).toLocaleString();
          heldLine = `
            <div style="font-size:10px;color:#cbd5e1;">
              <span style="color:#38bdf8;font-weight:700;">${qty.toLocaleString()} sh</span>
              <span style="color:#94a3b8;font-size:9px;">(${sideTag} @$${entryP.toFixed(2)} · $${posVal})</span>
            </div>
            <div style="margin-top:2px;">
              <span style="background:${pnlBg};color:${pnlCol};border:1px solid ${pnlCol}44;padding:1px 5px;border-radius:3px;font-weight:700;font-size:10px;display:inline-block;">
                P&L: ${fmtDollarsSigned(pnlDollars)} (${fmtPct(pnlPct)})
              </span>
            </div>`;
        }

        const pctShares = calcPortfolioPctShares(price);
        const fillBtns = cfg.prefillEnabled
          ? `<div style="display:flex;justify-content:flex-end;gap:3px;margin-top:2px;">
              <button data-fill-side="BUY" data-fill-sym="${esc(sym)}" data-fill-id="${esc(p.id)}" data-fill-qty="${pctShares}" title="Pre-fill BUY ${pctShares} sh" style="background:#16a34a;color:#fff;border:none;border-radius:3px;padding:1px 6px;cursor:pointer;font-size:10px;font-weight:700;">Buy</button>
              <button data-fill-side="SELL" data-fill-sym="${esc(sym)}" data-fill-id="${esc(p.id)}" data-fill-qty="${pctShares}" title="Pre-fill SELL/SHORT ${pctShares} sh" style="background:#dc2626;color:#fff;border:none;border-radius:3px;padding:1px 6px;cursor:pointer;font-size:10px;font-weight:700;">Short</button>
              ${
                qty !== 0
                  ? `<button data-fill-side="${qty > 0 ? 'SELL' : 'BUY'}" data-fill-sym="${esc(sym)}" data-fill-id="${esc(p.id)}" data-fill-qty="${Math.abs(qty)}" title="Close full position (${Math.abs(qty)} sh)" style="background:#475569;color:#fff;border:none;border-radius:3px;padding:1px 5px;cursor:pointer;font-size:10px;">Exit</button>`
                  : ''
              }
            </div>`
          : '';

        // Visual Low-to-High Range Bar
        const barCol = isStrongDip ? '#4ade80' : isStrongPeak ? '#f87171' : '#38bdf8';
        const rangeBar = `<div style="width:100%;height:4px;background:#1e293b;border-radius:2px;margin:2px 0;position:relative;overflow:hidden;">
          <div style="width:${rangePos.toFixed(0)}%;height:100%;background:${barCol};"></div>
        </div>`;

        return `<div style="display:grid;grid-template-columns:1.05fr 1.1fr 1.2fr 0.95fr;align-items:center;gap:4px;padding:5px 2px;border-bottom:1px solid #1e293b;">
          <div>
            <div style="font-weight:700;font-size:12px;">${esc(sym)}</div>
            ${heldLine}
          </div>
          <div style="text-align:right;font-variant-numeric:tabular-nums;">
            <div><b style="font-size:12px;">$${price.toFixed(2)}</b> <span style="color:${vsStartCol};font-size:10px;">(${fmtPct(vsStartPct)} start)</span></div>
            <div style="color:#94a3b8;font-size:10px;">Avg <b>$${refAvg.toFixed(2)}</b> · Start $${startP.toFixed(0)}</div>
            <div style="font-size:9px;color:#94a3b8;">
              30s <span style="color:${c30}">${fmtPct(chg30s)}</span> · 1m <span style="color:${c1m}">${fmtPct(chg1m)}</span> · 3m <span style="color:${c3m}">${fmtPct(chg3m)}</span>
            </div>
          </div>
          <div style="text-align:right;font-variant-numeric:tabular-nums;">
            <div>${signalBadge}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:1px;">
              vs 3m Avg <span style="color:${cRoll};font-weight:600;">${fmtPct(vsRollPct)}</span> · vs Mkt <span style="color:${cMkt};font-weight:600;">${fmtPct(vsMktPct)}</span>
            </div>
            ${rangeBar}
            <div style="font-size:9px;color:#94a3b8;">
              Lo $${lo.toFixed(1)} (<span style="color:#4ade80">+${offLowPct.toFixed(1)}%</span>) · Hi $${hi.toFixed(1)} (<span style="color:#f87171">${offHighPct.toFixed(1)}%</span>)
            </div>
          </div>
          <div style="text-align:right;font-variant-numeric:tabular-nums;">
            <div><b style="color:#38bdf8;font-size:12px;">${pctShares.toLocaleString()} sh</b></div>
            ${fillBtns}
          </div>
        </div>`;
      })
      .join('');
  };

  const render = () => {
    renderHeader();
    renderQuotes();
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

  elAvgModeBtn.addEventListener('click', () => {
    cfg.avgMode =
      cfg.avgMode === 'BLENDED' ? 'ROLLING' : cfg.avgMode === 'ROLLING' ? 'MARKET' : 'BLENDED';
    saveCfg();
    renderHeader();
    renderQuotes();
  });

  elSortBtn.addEventListener('click', () => {
    cfg.sortMode =
      cfg.sortMode === 'DEFAULT' ? 'DOWN' : cfg.sortMode === 'DOWN' ? 'UP' : 'DEFAULT';
    saveCfg();
    renderHeader();
    renderQuotes();
  });

  elRoundBtn.addEventListener('click', () => {
    cfg.roundMode = !cfg.roundMode;
    saveCfg();
    renderHeader();
    renderQuotes();
  });

  elQuotesList.addEventListener('click', (e) => {
    const fillBtn = e.target.closest('[data-fill-sym]');
    if (!fillBtn) return;
    prefillTradeForm({
      side: fillBtn.getAttribute('data-fill-side') || null,
      productId: fillBtn.getAttribute('data-fill-id'),
      ticker: fillBtn.getAttribute('data-fill-sym'),
      qty: Number(fillBtn.getAttribute('data-fill-qty') || 0),
    });
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

  // --- Live Poller (Only /financial-products and /portfolio — fast & lightweight) ---
  let isPolling = false;
  const poll = async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      const base = `/resources/simulation/${cfg.simId}`;
      state.pollTick += 1;
      const shouldFetchTx = state.pollTick === 1 || state.pollTick % 2 === 0;
      const [productsRes, portfolioRes, txRes] = await Promise.all([
        fetchJson(`${base}/financial-products`),
        fetchJson(`${base}/player/${cfg.playerId}/portfolio`),
        shouldFetchTx
          ? fetchJson(`${base}/player/${cfg.playerId}/transactions`).catch(() => null)
          : Promise.resolve(null),
      ]);

      const products = Array.isArray(productsRes) ? productsRes : productsRes.data || [];
      state.products = products;
      if (txRes) {
        computeCostBasisFromTransactions(txRes);
      }
      const now = Date.now();
      for (const p of products) {
        const sym = p.short_name || p.ticker;
        const price = Number(p.current_price || 0);
        if (!sym || !price) continue;

        const arr = state.priceHistory[sym] || [];
        arr.push({ t: now, p: price });
        state.priceHistory[sym] = arr.filter((x) => now - x.t <= 185000); // keep 3m history

        const prevSt = state.sessionStats[sym];
        if (!prevSt) {
          const startP = Number(p.marketable?.starting_price || START_PRICES[sym] || price);
          state.sessionStats[sym] = {
            sum: startP + price,
            count: 2,
            min: Math.min(startP, price),
            max: Math.max(startP, price),
            ema: price,
          };
        } else {
          prevSt.sum += price;
          prevSt.count += 1;
          prevSt.ema = prevSt.ema * 0.92 + price * 0.08;
          if (price < prevSt.min) prevSt.min = price;
          if (price > prevSt.max) prevSt.max = price;
        }
      }
      state.mktAvgDriftPct = computeMarketDriftPct();

      if (portfolioRes) {
        const cashVal = portfolioRes.summary?.cash_balance ?? portfolioRes.current_cash;
        if (cashVal !== undefined) state.cash = Number(cashVal);
        const totalVal = portfolioRes.summary?.total_value ?? portfolioRes.total_value;
        if (totalVal !== undefined) state.totalValue = Number(totalVal);

        const rawPositions =
          portfolioRes.positions ||
          portfolioRes.items ||
          portfolioRes.financial_products ||
          portfolioRes.data?.positions ||
          [];
        const items = Array.isArray(rawPositions)
          ? rawPositions
          : rawPositions && typeof rawPositions === 'object'
          ? Object.values(rawPositions)
          : [];

        const nextHoldings = {};
        for (const it of items) {
          if (!it || typeof it !== 'object') continue;
          const prodId =
            it.financial_product_id ??
            it.product_id ??
            it.financial_product?.id ??
            it.marketable?.id;
          const fp =
            it.financial_product ||
            state.products.find(
              (p) =>
                (prodId !== undefined && String(p.id) === String(prodId)) ||
                (it.ticker && (p.short_name === it.ticker || p.marketable?.ticker === it.ticker)) ||
                (it.short_name && p.short_name === it.short_name) ||
                (it.name && (p.marketable?.name === it.name || p.name === it.name))
            );
          const sym =
            it.short_name ||
            it.ticker ||
            it.symbol ||
            it.financial_product?.short_name ||
            it.financial_product?.ticker ||
            it.marketable?.ticker ||
            it.marketable?.short_name ||
            fp?.short_name ||
            fp?.ticker;
          const q = Number(
            it.quantity ??
              it.qty ??
              it.shares ??
              it.pivot?.quantity ??
              it.position ??
              0
          );
          if (!sym || q === 0) continue;

          const livePrice = Number(fp?.current_price ?? it.current_price ?? it.unit_price ?? 0);
          const txBasis = state.txCostMap[sym];
          const prevHeld = state.holdings[sym];

          // 1. Check if portfolio payload gives explicit average / purchase price or cost basis
          const explicitAvg = Number(
            it.average_price ??
              it.avg_price ??
              it.purchase_price ??
              it.buy_price ??
              it.entry_price ??
              it.cost_basis_per_share ??
              it.pivot?.average_price ??
              it.pivot?.unit_price ??
              0
          );
          const explicitCostTotal = Number(
            it.cost_basis ?? it.book_value ?? it.invested_amount ?? it.initial_value ?? 0
          );

          // 2. Determine true entry price (priority: explicitAvg -> explicitCostTotal/q -> /transactions cost basis -> previous tracked entry -> livePrice)
          let entryPrice = 0;
          if (explicitAvg > 0) {
            entryPrice = explicitAvg;
          } else if (explicitCostTotal > 0) {
            entryPrice = explicitCostTotal / Math.abs(q);
          } else if (txBasis && txBasis.avgPrice > 0) {
            entryPrice = txBasis.avgPrice;
          } else if (prevHeld && prevHeld.avgPrice > 0) {
            if (prevHeld.qty === q) {
              entryPrice = prevHeld.avgPrice;
            } else if ((prevHeld.qty > 0 && q > prevHeld.qty) || (prevHeld.qty < 0 && q < prevHeld.qty)) {
              const added = Math.abs(q - prevHeld.qty);
              entryPrice =
                (Math.abs(prevHeld.qty) * prevHeld.avgPrice + added * livePrice) / Math.abs(q);
            } else {
              entryPrice = prevHeld.avgPrice;
            }
          } else {
            entryPrice = livePrice;
          }

          // 3. Check if portfolio payload provides explicit unrealized profit/loss or total position value
          const explicitPnl =
            it.profit_loss ??
            it.pnl ??
            it.unrealized_pnl ??
            it.gain ??
            it.return_amount ??
            null;
          const posAmount = Number(it.amount ?? it.total_value ?? it.value ?? it.market_value ?? 0);
          let pnlDollars = 0;
          if (explicitPnl !== null && explicitPnl !== undefined) {
            pnlDollars = Number(explicitPnl);
          } else if (entryPrice > 0) {
            pnlDollars =
              q > 0
                ? (livePrice - entryPrice) * q
                : (entryPrice - livePrice) * Math.abs(q);
          } else if (posAmount !== 0) {
            pnlDollars = q > 0 ? posAmount - livePrice * q : livePrice * Math.abs(q) - Math.abs(posAmount);
          }
          const pnlPct =
            entryPrice > 0
              ? q > 0
                ? ((livePrice - entryPrice) / entryPrice) * 100
                : ((entryPrice - livePrice) / entryPrice) * 100
              : 0;

          nextHoldings[sym] = {
            qty: q,
            avgPrice: entryPrice,
            pnlDollars,
            pnlPct,
          };
        }

        // Fallback: if portfolioRes.positions was empty or unmapped, also include any non-zero positions from /transactions
        for (const [sym, basis] of Object.entries(state.txCostMap)) {
          if (!nextHoldings[sym] && basis.qty !== 0 && basis.avgPrice > 0) {
            const fp = state.products.find((p) => (p.short_name || p.ticker) === sym);
            const livePrice = Number(fp?.current_price || basis.avgPrice);
            const q = basis.qty;
            const pnlDollars =
              q > 0
                ? (livePrice - basis.avgPrice) * q
                : (basis.avgPrice - livePrice) * Math.abs(q);
            const pnlPct =
              q > 0
                ? ((livePrice - basis.avgPrice) / basis.avgPrice) * 100
                : ((basis.avgPrice - livePrice) / basis.avgPrice) * 100;
            nextHoldings[sym] = {
              qty: q,
              avgPrice: basis.avgPrice,
              pnlDollars,
              pnlPct,
            };
          }
        }

        state.holdings = nextHoldings;
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
