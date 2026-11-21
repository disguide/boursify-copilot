/**
 * Boursify 20% Total Portfolio Sizer, Price-vs-Average & Raw News Terminal (SBG 2026)
 *
 * Pure numbers & raw news — zero handbook clues, zero AI/script BUY/SELL opinions:
 *  1. 20% of TOTAL PORTFOLIO VALUE share calculator for all 10 stocks live.
 *  2. Price Movement vs. Average (shows Live Price, Average Price, % Deviation from Average
 *     so you immediately spot when a stock is down below its average to bet on mean reversion,
 *     plus 60s % move and Low–High range).
 *  3. Clean Raw Breaking News feed (newest first, scroll-safe).
 */
(() => {
  if (window.__BOURSIFY_COPILOT__) {
    window.__BOURSIFY_COPILOT__.destroy();
  }

  const STORAGE_KEY = 'boursify_copilot_cfg_v4';
  const defaultCfg = {
    simId: '448',
    playerId: '38158',
    pollMs: 2500,
    prefillEnabled: false,
    allocPct: 20,       // 20% of TOTAL PORTFOLIO VALUE
    roundMode: true,    // Clean round share numbers for fast typing
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
    priceHistory: {},      // { sym: [{ t, p }] } last 60s
    sessionStats: {},      // { sym: { sum, count, min, max } }
    cash: 1000000,
    totalValue: 1000000,
    holdings: {},          // { sym: { qty, avgPrice } }
    seenEvents: new Set(),
    newsList: [],          // [{ id, timeLabel, headline }]
    newsVersion: 0,
    lastPollAt: null,
    lastError: null,
    statusMsg: '',
    timer: null,
  };

  let lastRenderedNewsVersion = -1;

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

  // Compute reference Average Price (blends Boursify MA50 / Start Price with live session mean)
  const getAverageStats = (p) => {
    const sym = p.short_name || p.ticker || '?';
    const price = Number(p.current_price || 0);
    const m = p.marketable || {};
    const startP = Number(m.starting_price || START_PRICES[sym] || price);
    const ma50 = Number(m.moving_average_50_days || 0);
    const st = state.sessionStats[sym];
    const sessionAvg = st && st.count > 0 ? st.sum / st.count : price;

    // Reference average: use MA50 if available & valid, blended with session average / start price
    const refAvg = ma50 > 0 ? (ma50 + sessionAvg) / 2 : (startP + sessionAvg) / 2;
    const vsAvgPct = refAvg > 0 ? ((price - refAvg) / refAvg) * 100 : 0;
    const vsStartPct = startP > 0 ? ((price - startP) / startP) * 100 : 0;

    const hi = Math.max(price, Number(m.highest_price || 0), st?.max || price);
    const lo = Math.min(price, Number(m.lowest_price || price) || price, st?.min || price);

    return { refAvg, vsAvgPct, vsStartPct, hi, lo };
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
    root.style.width = cfg.wideMode ? '620px' : '460px';
  };
  root.style.cssText = [
    'position:fixed', 'bottom:14px', 'right:14px', 'z-index:999999',
    'max-height:88vh', 'display:flex', 'flex-direction:column',
    'background:#0f172a', 'color:#f8fafc', 'border:1px solid #334155',
    'border-radius:12px', 'box-shadow:0 12px 32px rgba(0,0,0,0.5)',
    'font-family:system-ui,-apple-system,sans-serif', 'font-size:12px', 'overflow:hidden',
  ].join(';');
  applyWidth();

  root.innerHTML = `
    <div id="bc-drag-handle" style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:#1e293b;border-bottom:1px solid #334155;cursor:move;user-select:none;">
      <div style="min-width:0;padding-right:8px;">
        <div style="font-weight:700;font-size:13px;">Boursify Portfolio Sizer & Price Tracker <span style="color:#38bdf8">#${esc(cfg.simId)}</span> <span id="bc-status-msg" style="font-size:10px;color:#4ade80;"></span></div>
        <div id="bc-cash-line" style="color:#94a3b8;font-size:10px;">Total: $1,000,000 · Cash: $1,000,000</div>
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
          <span style="font-size:11px;color:#e2e8f0;font-weight:600;">Portfolio %:</span>
          <input id="bc-alloc" type="number" min="1" max="100" value="${cfg.allocPct}" style="width:44px;background:#0f172a;color:#38bdf8;font-weight:700;border:1px solid #475569;border-radius:4px;padding:2px 4px;">
          <button data-pct="10" style="background:#334155;color:#cbd5e1;border:none;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:10px;">10%</button>
          <button data-pct="20" style="background:#334155;color:#cbd5e1;border:none;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:10px;">20%</button>
          <button data-pct="30" style="background:#334155;color:#cbd5e1;border:none;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:10px;">30%</button>
          <button data-pct="40" style="background:#334155;color:#cbd5e1;border:none;border-radius:3px;padding:2px 5px;cursor:pointer;font-size:10px;">40%</button>
        </div>
        <span id="bc-budget-pill" style="color:#38bdf8;font-weight:700;font-size:11px;">= $200,000</span>
        <button id="bc-toggle-round" style="background:#2563eb;color:#e2e8f0;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:10px;">Round: ON</button>
      </div>
      <div style="display:grid;grid-template-columns:1.05fr 1.55fr 0.95fr;font-weight:700;font-size:10px;color:#94a3b8;padding:0 2px;">
        <span>STOCK (HELD)</span>
        <span style="text-align:right;">PRICE · VS AVG · 60s</span>
        <span id="bc-col-sh-hdr" style="text-align:right;">${cfg.allocPct}% PORT SHARES</span>
      </div>
      <div id="bc-quotes-list" style="overflow-y:auto;max-height:270px;padding-right:2px;"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
        <span style="font-weight:700;font-size:11px;color:#94a3b8;">LIVE NEWS (NEWEST FIRST)</span>
        <span id="bc-news-count" style="font-size:10px;color:#64748b;">0 items</span>
      </div>
      <div id="bc-news-list" style="overflow-y:auto;max-height:220px;padding-right:2px;"></div>
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
  const elNewsList = root.querySelector('#bc-news-list');
  const elHandle = root.querySelector('#bc-drag-handle');

  const renderHeader = () => {
    const pct = Number(cfg.allocPct || 20);
    const targetDollars = Math.round(state.totalValue * (pct / 100));
    const retPct = ((state.totalValue - 1000000) / 1000000) * 100;
    const retCol = retPct >= 0 ? '#4ade80' : '#f87171';

    elStatus.textContent = state.statusMsg ? `(${state.statusMsg})` : '';
    elCash.innerHTML = `Total: <b>$${Math.round(state.totalValue).toLocaleString()}</b> <span style="color:${retCol}">(${retPct >= 0 ? '+' : ''}${retPct.toFixed(2)}%)</span> · Cash: <b>$${Math.round(state.cash).toLocaleString()}</b> · ${
      state.lastError
        ? `<span style="color:#f87171">${esc(state.lastError)}</span>`
        : esc(state.lastPollAt || '...')
    }`;
    elBudgetPill.textContent = `= $${targetDollars.toLocaleString()}`;
    elColShHdr.textContent = `${pct}% PORT SHARES`;
    elRoundBtn.textContent = `Round: ${cfg.roundMode ? 'ON' : 'Exact'}`;
    elRoundBtn.style.background = cfg.roundMode ? '#2563eb' : '#334155';
    elWideBtn.style.background = cfg.wideMode ? '#2563eb' : '#334155';

    elPrefillBtn.textContent = `Pre-fill: ${cfg.prefillEnabled ? 'ON' : 'OFF'}`;
    elPrefillBtn.style.background = cfg.prefillEnabled ? '#2563eb' : '#334155';
    elMinBtn.textContent = cfg.minimized ? '+' : '−';
    elBody.style.display = cfg.minimized ? 'none' : 'flex';
  };

  const renderQuotes = () => {
    if (!state.products.length) {
      elQuotesList.innerHTML = '<div style="color:#64748b;">Loading live prices...</div>';
      return;
    }
    elQuotesList.innerHTML = state.products
      .map((p) => {
        const sym = p.short_name || p.ticker || '?';
        const price = Number(p.current_price || 0);
        const chg60 = getChg60s(sym, price);
        const { refAvg, vsAvgPct, hi, lo } = getAverageStats(p);

        const chg60Col = chg60 > 0.05 ? '#4ade80' : chg60 < -0.05 ? '#f87171' : '#94a3b8';
        // Highlight stocks trading below their average in bright green (mean-reversion dip opportunity)
        const isDip = vsAvgPct <= -2.0;
        const isHigh = vsAvgPct >= 2.0;
        const vsAvgCol = isDip ? '#4ade80' : isHigh ? '#fb923c' : '#94a3b8';
        const vsAvgBadge = isDip
          ? `<span style="background:#14532d;color:#4ade80;padding:1px 4px;border-radius:3px;font-weight:700;font-size:10px;">▼ ${vsAvgPct.toFixed(1)}% vs Avg</span>`
          : isHigh
          ? `<span style="background:#7c2d12;color:#fdba74;padding:1px 4px;border-radius:3px;font-weight:700;font-size:10px;">▲ +${vsAvgPct.toFixed(1)}% vs Avg</span>`
          : `<span style="color:${vsAvgCol};font-size:10px;">${vsAvgPct >= 0 ? '+' : ''}${vsAvgPct.toFixed(1)}% vs Avg</span>`;

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

        const pctShares = calcPortfolioPctShares(price);
        const fillBtns = cfg.prefillEnabled
          ? `<button data-fill-sym="${esc(sym)}" data-fill-id="${esc(p.id)}" data-fill-qty="${pctShares}" style="background:#2563eb;color:#fff;border:none;border-radius:3px;padding:1px 5px;margin-left:4px;cursor:pointer;font-size:10px;font-weight:600;">Fill</button>${
              qty !== 0
                ? `<button data-fill-sym="${esc(sym)}" data-fill-id="${esc(p.id)}" data-fill-qty="${Math.abs(qty)}" style="background:#475569;color:#fff;border:none;border-radius:3px;padding:1px 4px;margin-left:3px;cursor:pointer;font-size:10px;">All</button>`
                : ''
            }`
          : '';

        return `<div style="display:grid;grid-template-columns:1.05fr 1.55fr 0.95fr;align-items:center;padding:5px 2px;border-bottom:1px solid #1e293b;">
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            <b>${esc(sym)}</b>${heldTag}
            <div style="color:#64748b;font-size:9px;">Avg $${refAvg.toFixed(2)} · Lo $${lo.toFixed(1)} / Hi $${hi.toFixed(1)}</div>
          </div>
          <div style="text-align:right;font-variant-numeric:tabular-nums;">
            <b>$${price.toFixed(2)}</b> ${vsAvgBadge}
            <div style="color:${chg60Col};font-size:10px;">60s: ${chg60 >= 0 ? '+' : ''}${chg60.toFixed(2)}%</div>
          </div>
          <div style="text-align:right;font-variant-numeric:tabular-nums;">
            <b style="color:#38bdf8;font-size:12px;">${pctShares.toLocaleString()} sh</b>${fillBtns}
          </div>
        </div>`;
      })
      .join('');
  };

  const renderNews = () => {
    if (lastRenderedNewsVersion === state.newsVersion) return;

    const prevScrollTop = elNewsList.scrollTop;
    const prevScrollHeight = elNewsList.scrollHeight;

    elNewsCount.textContent = `${state.newsList.length} items`;

    if (!state.newsList.length) {
      elNewsList.innerHTML = '<div style="color:#64748b;padding:6px 0;">Waiting for news...</div>';
    } else {
      elNewsList.innerHTML = state.newsList
        .slice(0, 45)
        .map(
          (n) => `<div style="background:#1e293b;border-radius:8px;padding:7px 9px;margin-bottom:6px;border-left:3px solid #38bdf8;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
              <span style="color:#94a3b8;font-size:10px;">${esc(n.timeLabel)}</span>
            </div>
            <div style="color:#f1f5f9;font-size:11px;line-height:1.35;">${esc(n.headline)}</div>
          </div>`
        )
        .join('');
    }

    if (prevScrollTop > 15) {
      const delta = elNewsList.scrollHeight - prevScrollHeight;
      elNewsList.scrollTop = Math.max(0, prevScrollTop + delta);
    }

    lastRenderedNewsVersion = state.newsVersion;
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
    if (!fillBtn) return;
    prefillTradeForm({
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

        const prevSt = state.sessionStats[sym];
        if (!prevSt) {
          const startP = Number(p.marketable?.starting_price || START_PRICES[sym] || price);
          state.sessionStats[sym] = {
            sum: startP + price,
            count: 2,
            min: Math.min(startP, price),
            max: Math.max(startP, price),
          };
        } else {
          prevSt.sum += price;
          prevSt.count += 1;
          if (price < prevSt.min) prevSt.min = price;
          if (price > prevSt.max) prevSt.max = price;
        }
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

        state.newsList.unshift({
          id: key,
          timeLabel: ev.date || ev.formatted_date || `t=${ev.in_game_starting_time ?? ''}`,
          headline,
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

        state.newsList.unshift({
          id: key,
          timeLabel: art.date || art.published_at || 'Article',
          headline,
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
