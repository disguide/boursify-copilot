/**
 * Boursify AI Co-Pilot (Simulation #448 - SBG 2026)
 *
 * Architecture:
 *  - Static DOM shell built once (no innerHTML wipes, scroll-safe Order Book, draggable header)
 *  - Local CORS-free proxy (http://127.0.0.1:8787) calling NVIDIA NIM with full context:
 *      10 stocks + fundamentals + 60s momentum + recent 8 events + live portfolio
 *  - Pre-fill OFF by default (pure Order Book) with instant ON/OFF toggle
 *  - Price-only Take-Profit (+8%), Cut-Loss (-4%), and Unannounced Move (±5%) alerts
 */
(() => {
  if (window.__BOURSIFY_COPILOT__) {
    window.__BOURSIFY_COPILOT__.destroy();
  }

  const STORAGE_KEY = 'boursify_copilot_cfg_v1';
  const defaultCfg = {
    simId: '448',
    playerId: '38158',
    pollMs: 3000,
    prefillEnabled: false,
    allocPct: 20,
    proxyUrl: 'http://127.0.0.1:8787',
    nvidiaApiKey: '',
    nvidiaModel: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    minimized: false,
  };

  let cfg = { ...defaultCfg };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    cfg = { ...defaultCfg, ...saved };
    // Migrate legacy direct-NVIDIA browser config & aggressive poll interval
    if (!cfg.proxyUrl || (cfg.nvidiaEndpoint && cfg.nvidiaEndpoint.includes('integrate.api.nvidia.com'))) {
      cfg.proxyUrl = 'http://127.0.0.1:8787';
    }
    if (!cfg.pollMs || cfg.pollMs < 2500) cfg.pollMs = 3000;
    delete cfg.nvidiaEndpoint;
    delete cfg.geminiApiKey;
  } catch (_) {}

  const saveCfg = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (_) {}
  };
  saveCfg();

  // Auto-detect simId / playerId from performance entries if available
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

  const TICKERS = {
    RAI: { id: '4224', name: 'Rubicon AI', keywords: ['rubicon', 'rai', 'julian vance', 'alea-3', 'legio', 'ravenne', 'ai', 'intelligence artificielle', 'artificial intelligence', 'llm', 'gpu', 'semiconductor', 'taiwan', 'cloud'] },
    PAL: { id: '4225', name: 'Palissade Capital', keywords: ['palissade', 'pal', 'miles stern', 'capital', 'bank', 'banque', 'interest rate', 'taux', 'fed', 'credit', 'fund', 'office real estate'] },
    ALE: { id: '4226', name: 'Aldren Pharmaceuticals', keywords: ['aldren', 'ale', 'helen marsh', 'cardiva', 'ht-114', 'obesity', 'obésité', 'pharma', 'drug', 'médicament', 'fda', 'santé canada', 'clinical', 'trial', 'patent', 'brevet'] },
    TAG: { id: '4227', name: 'Ressources Taïga', keywords: ['taïga', 'taiga', 'tag', 'luc bergeron', 'aurore', 'abitibi', 'critical metals', 'métaux critiques', 'nickel', 'cobalt', 'lithium', 'graphite', 'mining', 'mine', 'royalties', 'redevances'] },
    HAW: { id: '4228', name: 'Grayhawk Systems', keywords: ['grayhawk', 'haw', 'diane kessler', 'bastion', 'nato', 'otan', 'defense', 'défense', 'military', 'militaire', 'cyber', 'security', 'aerospace', 'drone', 'radar'] },
    LIA: { id: '4229', name: 'Hydrélia', keywords: ['hydrélia', 'hydrelia', 'lia', 'sophie lachance', 'bécancour', 'becancour', 'hydrogen', 'hydrogène', 'electrolyzer', 'électrolyseur', 'hydro', 'energy', 'énergie', 'renewable', 'storage', 'stockage'] },
    NOR: { id: '4230', name: 'Northline Infrastructure', keywords: ['northline', 'nor', 'catherine doyle', 'far north highway', 'route du grand nord', 'infrastructure', 'rail', 'port', 'bridge', 'construction', 'housing', 'logement', 'transport'] },
    CHA: { id: '4231', name: 'Épiceries Champlain', keywords: ['champlain', 'cha', 'isabelle gagnon', 'marché fleuve', 'marche fleuve', 'comptoir champlain', 'épicerie', 'grocery', 'grocers', 'supermarket', 'food', 'retail', 'alimentation'] },
    PIN: { id: '4232', name: 'Les Restaurants Papineau', keywords: ['papineau', 'pin', 'olivier desrosiers', 'poutine', 'minimum wage', 'salaire minimum', 'restaurant', 'restaurants', 'dining', 'hospitality', 'restauration', 'frozen meals'] },
    HOL: { id: '4233', name: 'Hollis & Rowe', keywords: ['hollis', 'rowe', 'hol', 'grant hollis', 'made to last', 'apparel', 'footwear', 'clothing', 'vêtements', 'tariff', 'tarif', 'bangladesh', 'vietnam', 'mexico', 'mexique', 'supply chain'] },
  };

  const state = {
    products: [],          // Latest /financial-products list
    priceHistory: {},      // { ticker: [{ t, p }] }
    cash: 1000000,
    totalValue: 1000000,
    holdings: {},          // { ticker: { qty, avgPrice } }
    seenEvents: new Set(), // Event keys already processed
    recentEvents: [],      // Last 12 headlines (oldest -> newest) for AI context
    alertedMoves: {},      // { ticker: lastAlertTimestamp }
    orders: [],            // Generated Order Book calls
    ordersVersion: 0,      // Incremented only when orders array changes
    lastPollAt: null,
    lastError: null,
    aiStatus: cfg.nvidiaApiKey ? 'Key ready — click Test' : 'Paste NVIDIA key',
    timer: null,
  };

  let lastRenderedOrdersVersion = -1;
  let lastRenderedPrefill = cfg.prefillEnabled;

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

  const tagTickerLocal = (headline) => {
    const text = String(headline || '').toLowerCase();
    let bestSym = null;
    let bestScore = 0;
    for (const [sym, info] of Object.entries(TICKERS)) {
      let score = 0;
      for (const kw of info.keywords) {
        if (text.includes(kw)) score += kw === info.name.toLowerCase() || kw === sym.toLowerCase() ? 3 : 1;
      }
      if (score > bestScore) {
        bestScore = score;
        bestSym = sym;
      }
    }
    return {
      ticker: bestSym,
      action: 'WATCH',
      conviction: 1,
      target_pct: 0,
      reason: state.aiStatus || 'Proxy offline — manual review',
      source: 'TAG',
    };
  };

  const buildCompactProducts = () =>
    state.products.map((p) => {
      const sym = p.short_name || p.ticker;
      const price = Number(p.current_price || 0);
      const m = p.marketable || {};
      return {
        ticker: sym,
        name: m.name || TICKERS[sym]?.name || sym,
        price,
        chg60s: getChg60s(sym, price),
        startPrice: m.starting_price ?? null,
        ma50: m.moving_average_50_days ?? null,
        pe: m.price_to_earnings ?? null,
        debtRatio: m.debt_ratio ?? null,
        marketCorr: m.market_correlation ?? null,
      };
    });

  const analyzeHeadline = async (headline) => {
    try {
      const res = await fetch(`${cfg.proxyUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: cfg.nvidiaApiKey,
          model: cfg.nvidiaModel,
          headline,
          recentEvents: state.recentEvents.slice(-8),
          products: buildCompactProducts(),
          portfolio: {
            cash: state.cash,
            totalValue: state.totalValue,
            holdings: state.holdings,
          },
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        state.aiStatus = data?.error ? String(data.error).slice(0, 42) : `Proxy HTTP ${res.status}`;
        return [tagTickerLocal(headline)];
      }

      const isCurated = data.mode === 'CURATED';
      state.aiStatus = isCurated ? 'CURATED OK' : 'NVIDIA OK';
      const srcTag = isCurated ? 'CURATED' : 'NV-AI';
      const actions = Array.isArray(data.actions) && data.actions.length
        ? data.actions
        : [{ ticker: 'NONE', action: 'WATCH', conviction: 1, target_pct: 0, reason: data.summary || 'No material impact' }];

      return actions.map((a) => ({
        ticker: a.ticker && TICKERS[a.ticker] ? a.ticker : null,
        action: ['BUY', 'SELL', 'SHORT', 'COVER', 'AVOID', 'WATCH'].includes(a.action) ? a.action : 'WATCH',
        conviction: Math.max(1, Math.min(3, Number(a.conviction) || 2)),
        target_pct: Number(a.target_pct || 0),
        reason: a.reason || data.summary || 'Handbook analysis',
        source: srcTag,
      }));
    } catch (_) {
      state.aiStatus = 'Proxy offline — start proxy';
      return [tagTickerLocal(headline)];
    }
  };

  // Round share quantities down to clean numbers for fast manual typing (never exceeds budget/cap)
  const roundShares = (rawQty) => {
    const n = Math.floor(Number(rawQty) || 0);
    if (n >= 500) return Math.floor(n / 100) * 100;
    if (n >= 100) return Math.floor(n / 50) * 50;
    if (n >= 20) return Math.floor(n / 10) * 10;
    return Math.max(0, n);
  };

  const computeOrderCall = (cls, headline) => {
    const sym = cls.ticker;
    const prod = sym ? state.products.find((p) => (p.short_name || p.ticker) === sym) : null;
    const price = prod ? Number(prod.current_price || 0) : 0;
    const heldQty = sym ? Number(state.holdings[sym]?.qty || 0) : 0;

    const conviction = Number(cls.conviction || 2);
    let action = cls.action;
    let qty = 0;
    let reason = cls.reason || '';

    const chgPct = sym && price > 0 ? getChg60s(sym, price) : 0;

    // Fee buffer ($50 + 0.5% per trade) and 40% single-company concentration cap (use 38% safe ceiling)
    const usableCash = Math.max(0, (state.cash - 60) / 1.005);
    const currentLongVal = heldQty > 0 ? heldQty * price : 0;
    const maxAddByCap = Math.max(0, state.totalValue * 0.38 - currentLongVal);

    if (action === 'BUY' && price > 0) {
      if (conviction <= 1 && cls.source === 'NV-AI' && cls.target_pct <= 0) {
        action = 'WATCH';
        reason = `Low conviction — ${reason}`;
      } else {
        const basePct = cls.target_pct > 0 ? cls.target_pct : Number(cfg.allocPct || 20) * (conviction >= 3 ? 1.5 : 1);
        const lateFactor = chgPct >= 6 ? 0.5 : 1.0;
        if (chgPct >= 6) reason = `Spiked +${chgPct.toFixed(1)}% (half size) — ${reason}`;
        const rawBudget = state.totalValue * (Math.min(35, basePct) / 100) * lateFactor;
        const budget = Math.min(usableCash, maxAddByCap, rawBudget);
        qty = roundShares(budget / price);
        if (qty <= 0) {
          action = 'AVOID';
          reason = maxAddByCap < price ? `Near 40% concentration cap — ${reason}` : `Insufficient cash — ${reason}`;
        }
      }
    } else if (action === 'SELL') {
      if (heldQty > 0) {
        const sellPct = cls.target_pct > 0 && cls.target_pct < 100 ? cls.target_pct : 100;
        // Keep exact heldQty on 100% exit so no leftover shares remain; round partial trims
        qty = sellPct >= 100 ? heldQty : Math.max(1, roundShares(heldQty * (sellPct / 100)));
      } else if (price > 0 && conviction >= 2) {
        // Selling at 0 shares opens a short position on Boursify
        action = 'SHORT';
        const shortPct = cls.target_pct > 0 ? Math.min(25, cls.target_pct) : conviction >= 3 ? 20 : 12;
        const currentShortVal = heldQty < 0 ? Math.abs(heldQty) * price : 0;
        const maxShortRoom = Math.max(0, state.totalValue * 0.38 - currentShortVal);
        const budget = Math.min(usableCash, maxShortRoom, state.totalValue * (shortPct / 100));
        qty = roundShares(budget / price);
      } else {
        action = 'AVOID';
      }
    } else if (action === 'SHORT' && price > 0) {
      const shortPct = cls.target_pct > 0 ? Math.min(25, cls.target_pct) : conviction >= 3 ? 20 : 12;
      const lateFactor = chgPct <= -6 ? 0.5 : 1.0;
      if (chgPct <= -6) reason = `Dropped ${chgPct.toFixed(1)}% (half size) — ${reason}`;
      const currentShortVal = heldQty < 0 ? Math.abs(heldQty) * price : 0;
      const maxShortRoom = Math.max(0, state.totalValue * 0.38 - currentShortVal);
      const budget = Math.min(usableCash, maxShortRoom, state.totalValue * (shortPct / 100) * lateFactor);
      qty = roundShares(budget / price);
      if (qty <= 0) action = 'AVOID';
    } else if (action === 'COVER') {
      if (heldQty < 0) {
        qty = Math.abs(heldQty);
      } else {
        action = 'WATCH';
      }
    }

    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time: new Date().toLocaleTimeString(),
      headline,
      ticker: sym || '---',
      productId: prod?.id || (sym ? TICKERS[sym]?.id : null),
      action,
      qty,
      price,
      reason,
      source: cls.source || 'TAG',
    };
  };

  const isExecutable = (action) => ['BUY', 'SELL', 'SHORT', 'COVER'].includes(action);

  const pushOrder = (order) => {
    // Filter out WATCH clutter — keep BUY, SELL, SHORT, COVER, and AVOID
    if (order.action === 'WATCH') return;
    state.orders.unshift(order);
    if (state.orders.length > 40) state.orders.length = 40;
    state.ordersVersion++;
    if (cfg.prefillEnabled && isExecutable(order.action) && order.qty > 0) {
      prefillTradeForm(order);
    }
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

  const prefillTradeForm = (order) => {
    if (!cfg.prefillEnabled) return;
    if (!isExecutable(order.action)) return;

    const select =
      document.querySelector('select[name="financial_product_id"]') ||
      document.querySelector('form select');
    const form = select?.closest('form') || document.querySelector('form');
    if (!form) {
      state.aiStatus = 'Open /player/trade to pre-fill';
      renderHeader();
      return;
    }

    // 1. Toggle Buy (for BUY/COVER) or Sell (for SELL/SHORT)
    const buttons = Array.from(form.querySelectorAll('button[type="button"]'));
    const isBuySide = order.action === 'BUY' || order.action === 'COVER';
    const targets = isBuySide ? ['buy', 'acheter'] : ['sell', 'vendre'];
    const sideBtn = buttons.find((b) => targets.includes(b.textContent.trim().toLowerCase()));
    if (sideBtn) sideBtn.click();

    // 2. Apply ticker & quantity after Vue processes the Buy/Sell toggle
    setTimeout(() => {
      const sel =
        form.querySelector('select[name="financial_product_id"]') ||
        form.querySelector('select');
      if (sel) {
        let targetVal = order.productId ? String(order.productId) : '';
        const opts = Array.from(sel.options || []);
        if (!opts.some((o) => o.value === targetVal) && order.ticker) {
          const byTicker = opts.find((o) => o.textContent.toUpperCase().includes(order.ticker.toUpperCase()));
          if (byTicker) targetVal = byTicker.value;
        }
        if (targetVal) setNativeValue(sel, targetVal);
      }

      const qtyInput =
        form.querySelector('input[name="quantity"]') ||
        form.querySelector('input[type="number"]');
      if (qtyInput && order.qty > 0) {
        setNativeValue(qtyInput, order.qty);
      }

      console.log('[Co-Pilot prefill]', { action: order.action, ticker: order.ticker, qty: order.qty, sideBtn: !!sideBtn, sel: !!sel, qtyInput: !!qtyInput });
      state.aiStatus = `Pre-filled ${order.action} ${order.ticker} × ${order.qty}`;
      renderHeader();
    }, 60);
  };

  // --- Static DOM Shell (built ONCE — never replaced during polling) ---
  const root = document.createElement('div');
  root.id = 'boursify-copilot-root';
  root.style.cssText = [
    'position:fixed', 'bottom:16px', 'right:16px', 'z-index:999999',
    'width:400px', 'max-height:84vh', 'display:flex', 'flex-direction:column',
    'background:#0f172a', 'color:#f8fafc', 'border:1px solid #334155',
    'border-radius:12px', 'box-shadow:0 12px 32px rgba(0,0,0,0.45)',
    'font-family:system-ui,-apple-system,sans-serif', 'font-size:12px', 'overflow:hidden',
  ].join(';');

  root.innerHTML = `
    <div id="bc-drag-handle" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#1e293b;border-bottom:1px solid #334155;cursor:move;user-select:none;">
      <div style="min-width:0;padding-right:8px;">
        <div style="font-weight:700;font-size:13px;">Boursify AI Co-Pilot <span style="color:#38bdf8">#${esc(cfg.simId)}</span> <span id="bc-ai-status" style="font-size:10px;color:#facc15;"></span></div>
        <div id="bc-cash-line" style="color:#94a3b8;font-size:10px;">Cash: $1,000,000 · Syncing...</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
        <button id="bc-toggle-prefill" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;font-weight:600;">Pre-fill: OFF</button>
        <button id="bc-min" style="background:#334155;color:#fff;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;">−</button>
      </div>
    </div>
    <div id="bc-body" style="padding:10px 12px;display:flex;flex-direction:column;gap:8px;overflow:hidden;flex:1;">
      <div style="display:flex;gap:5px;align-items:center;">
        <label style="font-size:10px;color:#94a3b8;white-space:nowrap;">Alloc %
          <input id="bc-alloc" type="number" min="1" max="100" value="${cfg.allocPct}" style="width:42px;background:#0f172a;color:#fff;border:1px solid #334155;border-radius:4px;padding:3px 4px;margin-left:2px;">
        </label>
        <input id="bc-nv-key" type="password" placeholder="NVIDIA API Key (nvapi-...)" value="${esc(cfg.nvidiaApiKey)}" style="flex:1;min-width:0;background:#0f172a;color:#fff;border:1px solid #334155;border-radius:4px;padding:4px 6px;font-size:10px;">
        <button id="bc-test-nv" style="background:#2563eb;color:#fff;border:none;border-radius:4px;padding:4px 7px;cursor:pointer;font-size:10px;font-weight:600;">Test</button>
        <button id="bc-rescan" style="background:#334155;color:#fff;border:none;border-radius:4px;padding:4px 7px;cursor:pointer;font-size:10px;">Re-scan 3</button>
      </div>
      <div id="bc-orders-hdr" style="font-weight:700;font-size:11px;color:#94a3b8;">ORDER BOOK CALLS (Manual input mode)</div>
      <div id="bc-orders-list" style="overflow-y:auto;max-height:260px;padding-right:2px;"></div>
      <div style="font-weight:700;font-size:11px;color:#94a3b8;">LIVE QUOTES (10 TICKERS)</div>
      <div id="bc-quotes-list" style="overflow-y:auto;max-height:170px;padding-right:2px;"></div>
    </div>
  `;
  document.body.appendChild(root);

  const elStatus = root.querySelector('#bc-ai-status');
  const elCash = root.querySelector('#bc-cash-line');
  const elPrefillBtn = root.querySelector('#bc-toggle-prefill');
  const elMinBtn = root.querySelector('#bc-min');
  const elBody = root.querySelector('#bc-body');
  const elAlloc = root.querySelector('#bc-alloc');
  const elKey = root.querySelector('#bc-nv-key');
  const elTestBtn = root.querySelector('#bc-test-nv');
  const elRescanBtn = root.querySelector('#bc-rescan');
  const elOrdersHdr = root.querySelector('#bc-orders-hdr');
  const elOrdersList = root.querySelector('#bc-orders-list');
  const elQuotesList = root.querySelector('#bc-quotes-list');
  const elHandle = root.querySelector('#bc-drag-handle');

  const renderHeader = () => {
    const ok = state.aiStatus === 'NVIDIA OK' || state.aiStatus === 'CURATED OK' || state.aiStatus.startsWith('Pre-filled');
    elStatus.textContent = state.aiStatus ? `(${state.aiStatus})` : '';
    elStatus.style.color = ok ? '#4ade80' : '#facc15';

    elCash.innerHTML = `Cash: $${Math.round(state.cash).toLocaleString()} · ${
      state.lastError
        ? `<span style="color:#f87171">${esc(state.lastError)}</span>`
        : `Synced ${esc(state.lastPollAt || '...')}`
    }`;

    elPrefillBtn.textContent = `Pre-fill: ${cfg.prefillEnabled ? 'ON' : 'OFF'}`;
    elPrefillBtn.style.background = cfg.prefillEnabled ? '#2563eb' : '#334155';
    elOrdersHdr.textContent = `ORDER BOOK CALLS (${cfg.prefillEnabled ? '1-click pre-fill ready' : 'Manual input mode'})`;
    elMinBtn.textContent = cfg.minimized ? '+' : '−';
    elBody.style.display = cfg.minimized ? 'none' : 'flex';
  };

  const renderQuotes = () => {
    if (!state.products.length) {
      elQuotesList.innerHTML = '<div style="color:#64748b;">Loading quotes...</div>';
      return;
    }
    elQuotesList.innerHTML = state.products
      .map((p) => {
        const sym = p.short_name || p.ticker || '?';
        const price = Number(p.current_price || 0);
        const chg = getChg60s(sym, price);
        const chgColor = chg > 0.05 ? '#4ade80' : chg < -0.05 ? '#f87171' : '#94a3b8';
        const held = state.holdings[sym];
        const qty = held?.qty || 0;
        let pnlTag = '';
        if (qty !== 0 && held.avgPrice > 0) {
          const pnl = qty > 0
            ? ((price - held.avgPrice) / held.avgPrice) * 100
            : ((held.avgPrice - price) / held.avgPrice) * 100;
          const pnlCol = pnl >= 0 ? '#4ade80' : '#f87171';
          pnlTag = ` <span style="color:#38bdf8">(${qty})</span> <span style="color:${pnlCol};font-size:10px;">${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%</span>`;
        }
        return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #1e293b;">
          <span><b>${esc(sym)}</b>${pnlTag}</span>
          <span>$${price.toFixed(2)} <span style="color:${chgColor}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span></span>
        </div>`;
      })
      .join('');
  };

  const renderOrders = () => {
    if (
      lastRenderedOrdersVersion === state.ordersVersion &&
      lastRenderedPrefill === cfg.prefillEnabled
    ) {
      return;
    }

    const prevScrollTop = elOrdersList.scrollTop;
    const prevScrollHeight = elOrdersList.scrollHeight;

    if (!state.orders.length) {
      elOrdersList.innerHTML = '<div style="color:#64748b;padding:6px 0;">Waiting for new headlines or price moves...</div>';
    } else {
      elOrdersList.innerHTML = state.orders
        .slice(0, 20)
        .map((o) => {
          const badgeColor =
            o.action === 'BUY' || o.action === 'COVER'
              ? '#16a34a'
              : o.action === 'SELL' || o.action === 'SHORT'
              ? '#dc2626'
              : o.action === 'AVOID'
              ? '#ca8a04'
              : '#475569';
          const canPrefill = cfg.prefillEnabled && o.productId && isExecutable(o.action);
          return `<div style="background:#1e293b;border-radius:8px;padding:8px;margin-bottom:6px;border-left:3px solid ${badgeColor};">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span><span style="background:${badgeColor};padding:2px 6px;border-radius:4px;font-weight:700;">${esc(o.action)}</span> <b>${esc(o.ticker)}</b> ${o.qty > 0 ? `× <b>${o.qty}</b>` : ''} ${o.price > 0 ? `@ $${o.price.toFixed(2)}` : ''}</span>
              <span style="color:#94a3b8;font-size:10px;">${esc(o.time)} (${esc(o.source)})</span>
            </div>
            <div style="color:#cbd5e1;font-size:11px;margin-bottom:4px;">${esc(o.headline)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
              <span style="color:#94a3b8;font-size:10px;">${esc(o.reason)}</span>
              ${canPrefill ? `<button data-prefill="${esc(o.id)}" style="background:#2563eb;color:#fff;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-weight:600;flex-shrink:0;">Pre-fill</button>` : ''}
            </div>
          </div>`;
        })
        .join('');
    }

    // Preserve user scroll position when reading past orders
    if (prevScrollTop > 15) {
      const delta = elOrdersList.scrollHeight - prevScrollHeight;
      elOrdersList.scrollTop = Math.max(0, prevScrollTop + delta);
    }

    lastRenderedOrdersVersion = state.ordersVersion;
    lastRenderedPrefill = cfg.prefillEnabled;
  };

  const render = () => {
    renderHeader();
    renderQuotes();
    renderOrders();
  };

  // --- Wire Static Control Listeners ONCE ---
  elPrefillBtn.addEventListener('click', () => {
    cfg.prefillEnabled = !cfg.prefillEnabled;
    saveCfg();
    renderHeader();
    renderOrders();
  });

  elMinBtn.addEventListener('click', () => {
    cfg.minimized = !cfg.minimized;
    saveCfg();
    renderHeader();
  });

  elAlloc.addEventListener('change', (e) => {
    cfg.allocPct = Math.max(1, Math.min(100, Number(e.target.value) || 20));
    saveCfg();
  });

  const syncKey = (e) => {
    cfg.nvidiaApiKey = e.target.value.trim();
    saveCfg();
  };
  elKey.addEventListener('input', syncKey);
  elKey.addEventListener('change', syncKey);

  // Event delegation for Pre-fill buttons inside Order Book list
  elOrdersList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-prefill]');
    if (!btn) return;
    const ord = state.orders.find((x) => x.id === btn.getAttribute('data-prefill'));
    if (ord) prefillTradeForm(ord);
  });

  elTestBtn.addEventListener('click', async () => {
    cfg.nvidiaApiKey = elKey.value.trim();
    saveCfg();

    state.aiStatus = 'Checking proxy...';
    renderHeader();
    try {
      const hRes = await fetch(`${cfg.proxyUrl}/health`);
      if (!hRes.ok) throw new Error(`HTTP ${hRes.status}`);
    } catch (_) {
      state.aiStatus = 'Proxy offline — start proxy';
      renderHeader();
      return;
    }

    state.aiStatus = 'Testing...';
    renderHeader();
    const testHeadline =
      'A major real estate developer, hard hit by recession, is delaying payments to Northline Infrastructure, which records a $60 million provision.';
    const calls = await analyzeHeadline(testHeadline);
    for (const cls of calls) {
      pushOrder(computeOrderCall(cls, `[TEST] ${testHeadline}`));
    }
    render();
  });

  elRescanBtn.addEventListener('click', async () => {
    cfg.nvidiaApiKey = elKey.value.trim();
    saveCfg();
    const latest = state.recentEvents.slice(-3);
    if (!latest.length) return;
    state.aiStatus = 'Re-scanning 3...';
    renderHeader();
    const results = await Promise.all(latest.map((headline) => analyzeHeadline(headline).then((calls) => ({ headline, calls }))));
    for (const { headline, calls } of results) {
      for (const cls of calls) {
        pushOrder(computeOrderCall(cls, headline));
      }
    }
    render();
  });

  // --- Draggable Header (attached ONCE, cleaned up in destroy) ---
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

  // --- Live Poller (3s interval with overlap lock to avoid rate limits) ---
  let isPolling = false;
  const poll = async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      const base = `/resources/simulation/${cfg.simId}`;
      const [productsRes, portfolioRes, eventsRes] = await Promise.all([
        fetchJson(`${base}/financial-products`),
        fetchJson(`${base}/player/${cfg.playerId}/portfolio`),
        fetchJson(`${base}/player/${cfg.playerId}/past-events`),
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

      // Live /past-events returns { events: [...] } ordered oldest-first
      const rawEvents = Array.isArray(eventsRes) ? eventsRes : eventsRes.events || eventsRes.data || [];
      const extractHeadline = (ev, fallbackKey) => {
        const desc = ev.description;
        return (
          (typeof desc === 'string' ? desc : desc?.en || desc?.fr) ||
          (typeof ev.title === 'string' ? ev.title : ev.title?.en || ev.title?.fr) ||
          ev.content ||
          ev.text ||
          fallbackKey
        );
      };

      const isInitialLoad = state.seenEvents.size === 0;
      if (isInitialLoad && rawEvents.length > 2) {
        const seedStart = Math.max(0, rawEvents.length - 12);
        for (let i = 0; i < rawEvents.length - 2; i++) {
          const oldEv = rawEvents[i];
          const oldKey = String(oldEv.id || oldEv.uuid || oldEv.in_game_starting_time || i);
          state.seenEvents.add(oldKey);
          if (i >= seedStart) state.recentEvents.push(extractHeadline(oldEv, oldKey));
        }
      }

      for (const ev of rawEvents) {
        const key = String(ev.id || ev.uuid || ev.in_game_starting_time || JSON.stringify(ev));
        if (state.seenEvents.has(key)) continue;
        state.seenEvents.add(key);

        const headline = extractHeadline(ev, key);
        state.recentEvents.push(headline);
        if (state.recentEvents.length > 12) state.recentEvents.shift();

        const calls = await analyzeHeadline(headline);
        for (const cls of calls) {
          pushOrder(computeOrderCall(cls, headline));
        }
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
