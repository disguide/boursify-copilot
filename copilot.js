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

  const STORAGE_KEY = 'boursify_copilot_cfg_v8';
  const defaultCfg = {
    simId: '448',
    playerId: '38158',
    playerName: '',
    idConfirmed: false,
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
    cfg = {
      ...defaultCfg,
      ...saved,
      // Never load stale simId/playerId from localStorage before checking the live page!
      simId: defaultCfg.simId,
      playerId: defaultCfg.playerId,
      idConfirmed: false,
    };
  } catch (_) {}

  const saveCfg = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (_) {}
  };

  const applyDetectedIds = (sId, pId) => {
    let changed = false;
    if (sId && String(sId) !== String(cfg.simId)) {
      cfg.simId = String(sId);
      changed = true;
    }
    if (pId && String(pId) !== String(cfg.playerId)) {
      cfg.playerId = String(pId);
      changed = true;
    }
    if (sId && pId) {
      cfg.idConfirmed = true;
    }
    if (changed) {
      saveCfg();
    }
    return Boolean(sId && pId);
  };

  const detectIds = () => {
    try {
      // 1. Check Boursify's native Print link on /player/trade or /player/portfolio
      const printLinks = Array.from(
        document.querySelectorAll('a[href*="/resources/simulation/"]')
      );
      for (const link of printLinks) {
        const href = link.getAttribute('href') || '';
        const m = href.match(/\/resources\/simulation\/(\d+)\/player\/(\d+)/);
        if (m) {
          return applyDetectedIds(m[1], m[2]);
        }
      }

      // 2. Scan all performance network entries in chronological order (OLDEST FIRST -> Boursify's native XHRs at page load!)
      // Check initiatorType === 'xmlhttprequest' first (Boursify uses Axios XHR; our copilot uses fetch!)
      const entries = performance.getEntriesByType('resource') || [];
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].initiatorType === 'xmlhttprequest') {
          const m = entries[i].name.match(/\/resources\/simulation\/(\d+)\/player\/(\d+)/);
          if (m) {
            return applyDetectedIds(m[1], m[2]);
          }
        }
      }
      // Also check oldest performance entry of any type (index 0 -> N) that has /resources/simulation/X/player/Y
      for (let i = 0; i < entries.length; i++) {
        const m = entries[i].name.match(/\/resources\/simulation\/(\d+)\/player\/(\d+)/);
        if (m && (m[1] !== '448' || m[2] !== '38158')) {
          return applyDetectedIds(m[1], m[2]);
        }
      }

      // 3. Deep scan ALL DOM elements for Vue 2 (__vue__) or Vue 3 (__vueParentComponent) instances
      const allEls = document.querySelectorAll('#app, #app *');
      for (let i = 0; i < Math.min(allEls.length, 300); i++) {
        const el = allEls[i];
        const vm = el.__vue__ || el._vnode?.context || el.__vueParentComponent?.ctx;
        if (!vm) continue;
        const pId =
          vm.player?.id ??
          vm.currentPlayer?.id ??
          vm.$data?.player?.id ??
          vm.$props?.player?.id ??
          vm.$store?.state?.player?.id ??
          vm.$root?.player?.id;
        const sId =
          vm.simulation?.id ??
          vm.player?.simulation_id ??
          vm.$data?.simulation?.id ??
          vm.$props?.simulation?.id ??
          vm.$store?.state?.simulation?.id ??
          vm.$root?.simulation?.id;
        if (pId || sId) {
          if (applyDetectedIds(sId || cfg.simId, pId || cfg.playerId)) return true;
        }
      }

      // 4. Inspect inline scripts / HTML for /resources/simulation/X/player/Y or JSON props
      const html = document.documentElement?.innerHTML || '';
      const pm = html.match(/\/resources\/simulation\/(\d+)\/player\/(\d+)/);
      if (pm) {
        return applyDetectedIds(pm[1], pm[2]);
      }
      const simAttr = html.match(/simulation[_-]id["'\s:=]+(\d+)/i);
      const pidAttr = html.match(/player[_-]id["'\s:=]+(\d+)/i);
      if (simAttr || pidAttr) {
        return applyDetectedIds(simAttr ? simAttr[1] : cfg.simId, pidAttr ? pidAttr[1] : cfg.playerId);
      }

      // 5. Check if any simulation ID (even without /player/) appears in XHR performance entries
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].initiatorType === 'xmlhttprequest') {
          const sm = entries[i].name.match(/\/resources\/simulation\/(\d+)/);
          if (sm && sm[1] !== String(cfg.simId)) {
            cfg.simId = sm[1];
            saveCfg();
          }
        }
      }
    } catch (_) {}
    return false;
  };
  detectIds();

  // Also hook XMLHttpRequest (which Boursify's Axios uses; our copilot uses fetch) so any native Boursify request locks in the real simId & playerId
  const captureUrlIds = (urlStr) => {
    if (typeof urlStr !== 'string') return;
    const m = urlStr.match(/\/resources\/simulation\/(\d+)\/player\/(\d+)/);
    if (m) {
      cfg.simId = m[1];
      cfg.playerId = m[2];
      cfg.idConfirmed = true;
      saveCfg();
    }
  };
  try {
    const origOpen = XMLHttpRequest.prototype.open;
    if (origOpen && !origOpen.__bcHooked) {
      const wrappedOpen = function (method, url, ...rest) {
        try {
          captureUrlIds(String(url || ''));
        } catch (_) {}
        return origOpen.call(this, method, url, ...rest);
      };
      wrappedOpen.__bcHooked = true;
      XMLHttpRequest.prototype.open = wrappedOpen;
    }
  } catch (_) {}

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
    teamPlayers: [],       // [{ id, name, cash, totalValue }] from /players
    teamTotalPnl: 0,       // combined P&L across all 3 team accounts
    pollTick: 0,
    lastPollAt: null,
    lastError: null,
    statusMsg: '',
    timer: null,
  };

  const KNOWN_TICKERS = new Set(['RAI', 'PAL', 'ALE', 'TAG', 'HAW', 'LIA', 'NOR', 'CHA', 'PIN', 'HOL']);
  const NAME_TO_TICKER = {
    'rubicon': 'RAI',
    'palissade': 'PAL',
    'aldren': 'ALE',
    'taïga': 'TAG',
    'taiga': 'TAG',
    'grayhawk': 'HAW',
    'hydrélia': 'LIA',
    'hydrelia': 'LIA',
    'northline': 'NOR',
    'champlain': 'CHA',
    'papineau': 'PIN',
    'hollis': 'HOL',
  };

  // Resolve ticker symbol from any Boursify position or transaction object
  const resolveSymbol = (obj) => {
    if (!obj || typeof obj !== 'object') return null;

    // 1. Direct string fields
    const directCandidates = [
      obj.short_name,
      obj.ticker,
      obj.symbol,
      obj.code,
      obj.financial_product?.short_name,
      obj.financial_product?.ticker,
      obj.financial_product?.marketable?.ticker,
      obj.financial_product?.marketable?.short_name,
      obj.marketable?.ticker,
      obj.marketable?.short_name,
      obj.product?.short_name,
      obj.product?.ticker,
      obj.stock?.ticker,
      obj.stock?.short_name,
    ];
    for (const c of directCandidates) {
      if (typeof c === 'string') {
        const up = c.trim().toUpperCase();
        if (KNOWN_TICKERS.has(up)) return up;
      }
    }

    // 2. Match by product ID against state.products (check both financial_product.id and marketable.id)
    const idCandidates = [
      obj.financial_product_id,
      obj.product_id,
      obj.marketable_id,
      obj.stock_id,
      obj.financial_product?.id,
      obj.financial_product?.marketable_id,
      obj.marketable?.id,
      obj.pivot?.financial_product_id,
      obj.id,
    ].filter((x) => x !== undefined && x !== null);

    for (const idVal of idCandidates) {
      const fp = state.products.find(
        (p) =>
          String(p.id) === String(idVal) ||
          String(p.marketable_id) === String(idVal) ||
          String(p.marketable?.id) === String(idVal) ||
          String(p.portal_original_uuid) === String(idVal)
      );
      if (fp) {
        const s = (fp.short_name || fp.ticker || fp.marketable?.ticker || '').toUpperCase();
        if (s) return s;
      }
    }

    // 3. Deep scan all string values in the object for known ticker or company name
    const jsonStr = JSON.stringify(obj);
    for (const tk of KNOWN_TICKERS) {
      const re = new RegExp(`"(?:ticker|short_name|symbol|code)"\\s*:\\s*"${tk}"`, 'i');
      if (re.test(jsonStr)) return tk;
    }
    const lowerStr = jsonStr.toLowerCase();
    for (const [kw, tk] of Object.entries(NAME_TO_TICKER)) {
      if (lowerStr.includes(kw)) return tk;
    }

    return null;
  };

  // Scrape any visible portfolio / transaction rows from the Boursify page DOM as a secondary source
  const scrapeDomHoldingsAndTx = () => {
    const domPos = {}; // { sym: { qty, avgPrice, pnlDollars } }
    try {
      const rows = Array.from(document.querySelectorAll('table tr, tbody tr'));
      for (const tr of rows) {
        const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim());
        if (cells.length < 2) continue;
        const rowText = cells.join(' | ');
        let matchedSym = null;
        for (const c of cells) {
          const up = c.toUpperCase();
          if (KNOWN_TICKERS.has(up)) {
            matchedSym = up;
            break;
          }
        }
        if (!matchedSym) {
          const lower = rowText.toLowerCase();
          for (const [kw, tk] of Object.entries(NAME_TO_TICKER)) {
            if (lower.includes(kw)) {
              matchedSym = tk;
              break;
            }
          }
        }
        if (!matchedSym) continue;

        // Parse numbers from cells (excluding cell that is just a row index #1, #2 or ticker)
        const nums = [];
        for (const c of cells) {
          if (c.toUpperCase() === matchedSym || /^#\d+$/.test(c)) continue;
          const cleaned = c.replace(/[$,\s]/g, '');
          if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
            nums.push(Number(cleaned));
          }
        }
        if (nums.length >= 1) {
          // Typically [quantity, unit_price, amount]
          const qty = nums[0];
          const unitP = nums.length >= 2 ? nums[1] : 0;
          if (qty !== 0 && Math.abs(qty) < 10000000) {
            if (!domPos[matchedSym]) {
              domPos[matchedSym] = { qty, avgPrice: unitP > 0 && unitP < 5000 ? unitP : 0 };
            }
          }
        }
      }
    } catch (_) {}
    return domPos;
  };

  // Reconstruct exact average purchase/short entry price per stock from transaction history.
  // Accepts actualQuantitiesBySym ({ RAI: 4000, PAL: -2000 }) from /portfolio so it can solve for
  // the exact entry price even when /transactions uses positive quantities with no buy/sell field!
  const computeCostBasisFromTransactions = (txRes, actualQuantitiesBySym = {}) => {
    const list = Array.isArray(txRes)
      ? txRes
      : txRes?.transactions || txRes?.data?.transactions || txRes?.data || [];
    if (!Array.isArray(list) || !list.length) return;

    // Group transactions by symbol in chronological order (oldest -> newest)
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

    const bySym = {};
    for (const tx of sorted) {
      if (!tx || typeof tx !== 'object') continue;
      const sym = resolveSymbol(tx);
      if (!sym) continue;

      let rawQ = Number(
        tx.quantity ??
          tx.qty ??
          tx.shares ??
          tx.number_of_shares ??
          tx.amount_of_shares ??
          tx.pivot?.quantity ??
          0
      );
      const amt = Number(tx.amount ?? tx.total ?? tx.total_amount ?? tx.value ?? tx.cost ?? 0);
      let unitP = Number(
        tx.unit_price ??
          tx.price ??
          tx.execution_price ??
          tx.share_price ??
          tx.average_price ??
          0
      );
      if (unitP <= 0 && rawQ !== 0 && amt !== 0) {
        unitP = Math.abs(amt) / Math.abs(rawQ);
      }
      if (rawQ === 0 && unitP > 0 && amt !== 0) {
        rawQ = Math.round(amt / unitP);
      }
      if (!rawQ || unitP <= 0) continue;

      const typeStr = String(
        tx.type ?? tx.side ?? tx.action ?? tx.transaction_type ?? tx.order_type ?? ''
      ).toLowerCase();

      let explicitSign = 0;
      if (rawQ < 0) {
        explicitSign = -1;
      } else if (
        typeStr.includes('sell') ||
        typeStr.includes('vente') ||
        typeStr.includes('vendre') ||
        typeStr.includes('short') ||
        typeStr === 's'
      ) {
        explicitSign = -1;
      } else if (
        typeStr.includes('buy') ||
        typeStr.includes('achat') ||
        typeStr.includes('acheter') ||
        typeStr === 'b'
      ) {
        explicitSign = 1;
      }

      if (!bySym[sym]) bySym[sym] = [];
      bySym[sym].push({ absQ: Math.abs(rawQ), unitP, amt, explicitSign });
    }

    const runChronoAvg = (txList, signs) => {
      let curQty = 0;
      let curAvg = 0;
      for (let i = 0; i < txList.length; i++) {
        const { absQ, unitP } = txList[i];
        const signedQ = signs[i] * absQ;
        const nextQty = curQty + signedQ;
        if (nextQty === 0) {
          curQty = 0;
          curAvg = 0;
        } else if (curQty === 0 || (curQty > 0 && signedQ > 0) || (curQty < 0 && signedQ < 0)) {
          const totalCost = Math.abs(curQty) * curAvg + Math.abs(signedQ) * unitP;
          curAvg = totalCost / Math.abs(nextQty);
          curQty = nextQty;
        } else if ((curQty > 0 && nextQty > 0) || (curQty < 0 && nextQty < 0)) {
          curQty = nextQty;
        } else {
          curQty = nextQty;
          curAvg = unitP;
        }
      }
      return { qty: curQty, avgPrice: curAvg };
    };

    const map = {};
    for (const [sym, txList] of Object.entries(bySym)) {
      const targetQ = actualQuantitiesBySym[sym];

      // 1. First try explicit signs (defaulting unknown to +1 if targetQ >= 0, or -1 if targetQ < 0)
      const defaultSign = targetQ !== undefined && targetQ < 0 ? -1 : 1;
      const baseSigns = txList.map((t) => (t.explicitSign !== 0 ? t.explicitSign : defaultSign));
      let res = runChronoAvg(txList, baseSigns);

      // 2. If targetQ from /portfolio is known and baseSigns doesn't sum to targetQ, solve for the exact sign assignment!
      if (targetQ !== undefined && res.qty !== targetQ) {
        let solved = false;
        // Check from most recent transactions backwards if a suffix sums to targetQ
        let suffixQ = 0;
        let suffixCost = 0;
        const tSign = targetQ >= 0 ? 1 : -1;
        for (let i = txList.length - 1; i >= 0; i--) {
          suffixQ += tSign * txList[i].absQ;
          suffixCost += txList[i].absQ * txList[i].unitP;
          if (suffixQ === targetQ) {
            res = { qty: targetQ, avgPrice: suffixCost / Math.abs(targetQ) };
            solved = true;
            break;
          }
        }

        // If not a simple recent suffix and txList has <= 12 trades for this stock, find latest valid sign combination matching targetQ
        if (!solved && txList.length <= 12) {
          const n = txList.length;
          const totalCombos = 1 << n;
          for (let mask = totalCombos - 1; mask >= 0; mask--) {
            let sum = 0;
            const candidateSigns = new Array(n);
            for (let b = 0; b < n; b++) {
              const s = (mask & (1 << b)) ? 1 : -1;
              candidateSigns[b] = s;
              sum += s * txList[b].absQ;
            }
            if (sum === targetQ) {
              res = runChronoAvg(txList, candidateSigns);
              solved = true;
              break;
            }
          }
        }

        // Fallback if still unsolved: use the most recent transaction's unitP for this symbol
        if (!solved && txList.length > 0) {
          res = { qty: targetQ, avgPrice: txList[txList.length - 1].unitP };
        }
      }

      map[sym] = res;
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
    root.style.width = cfg.wideMode ? '640px' : '500px';
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
        <div style="font-weight:700;font-size:13px;">Boursify 20% Portfolio Sizer & Price Radar <span id="bc-sim-badge" style="color:#38bdf8">#${esc(cfg.simId)}</span> <span id="bc-player-badge" style="font-size:10px;color:#fbbf24;cursor:pointer;text-decoration:underline;" title="Click to switch active team player account"></span> <span id="bc-status-msg" style="font-size:10px;color:#4ade80;"></span></div>
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
      <div style="display:grid;grid-template-columns:1.1fr 0.9fr 1.05fr 0.95fr;font-weight:700;font-size:10px;color:#94a3b8;padding:0 2px;">
        <span>STOCK · P&L</span>
        <span style="text-align:right;">PRICE · AVG</span>
        <span style="text-align:right;">UP / DOWN vs AVG</span>
        <span id="bc-col-sh-hdr" style="text-align:right;">${cfg.allocPct}% SHARES</span>
      </div>
      <div id="bc-quotes-list" style="overflow-y:auto;max-height:540px;padding-right:2px;"></div>
    </div>
  `;
  document.body.appendChild(root);

  const elStatus = root.querySelector('#bc-status-msg');
  const elSimBadge = root.querySelector('#bc-sim-badge');
  const elPlayerBadge = root.querySelector('#bc-player-badge');
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

  // Read exact cash, portfolio value, positions, and transactions directly from Boursify's live Vue component state or DOM!
  const readNativePortfolioTotals = () => {
    try {
      const allEls = document.querySelectorAll('#app, #app *');
      let bestSummary = null;
      let bestPositions = null;
      let bestTransactions = null;
      for (let i = 0; i < Math.min(allEls.length, 400); i++) {
        const el = allEls[i];
        const vm = el.__vue__ || el._vnode?.context || el.__vueParentComponent?.ctx;
        if (!vm) continue;

        const sum =
          vm.portfolio?.summary ??
          vm.summary ??
          vm.$data?.portfolio?.summary ??
          vm.$data?.summary;
        if (sum && sum.total_value !== undefined) {
          bestSummary = sum;
        }
        const pos =
          vm.portfolio?.positions ??
          vm.positions ??
          vm.$data?.portfolio?.positions ??
          vm.$data?.positions;
        if (Array.isArray(pos) && pos.length > 0) {
          bestPositions = pos;
        }
        const txs =
          vm.transactions?.transactions ??
          vm.transactions ??
          vm.$data?.transactions?.transactions ??
          vm.$data?.transactions;
        if (Array.isArray(txs) && txs.length > 0) {
          bestTransactions = txs;
        }
      }

      if (bestSummary || bestPositions || bestTransactions) {
        return {
          totalValue: bestSummary ? Number(bestSummary.total_value) : 0,
          cash: bestSummary && bestSummary.cash_balance !== undefined ? Number(bestSummary.cash_balance) : undefined,
          positions: bestPositions,
          transactions: bestTransactions,
        };
      }

      // Fallback: Check visible text on /player/trade or /player/portfolio ("Cash balance 1000000$" / "Portfolio value 1000000$")
      const bodyText = document.body?.innerText || '';
      const pvMatch = bodyText.match(/(?:Portfolio value|Valeur du portefeuille)\s*[:\n\t]*\s*([0-9,\s]+(?:\.\d+)?)\s*\$/i) ||
                      bodyText.match(/\$\s*([0-9,]+(?:\.\d+)?)\s*(?:Portfolio value|Valeur du portefeuille)/i);
      const cbMatch = bodyText.match(/(?:Cash balance|Encaisse|Solde en espèces)\s*[:\n\t]*\s*([0-9,\s]+(?:\.\d+)?)\s*\$/i);
      if (pvMatch) {
        const pv = Number(pvMatch[1].replace(/[,\s]/g, ''));
        const cb = cbMatch ? Number(cbMatch[1].replace(/[,\s]/g, '')) : null;
        if (pv > 0) {
          return { totalValue: pv, cash: cb !== null && cb >= 0 ? cb : state.cash, positions: null, transactions: null };
        }
      }
    } catch (_) {}
    return null;
  };

  const renderHeader = () => {
    const pct = Number(cfg.allocPct || 20);
    const targetDollars = Math.round(state.totalValue * (pct / 100));

    // Calculate live holdings market value & open P&L across all held stocks
    let openPnlDollars = 0;
    let openPositionsCount = 0;
    let longMarketVal = 0;
    let shortLiabVal = 0;
    for (const p of state.products) {
      const sym = p.short_name || p.ticker;
      const price = Number(p.current_price || 0);
      const h = sym ? state.holdings[sym] : null;
      if (h && h.qty !== 0) {
        openPositionsCount += 1;
        if (h.qty > 0) longMarketVal += h.qty * price;
        else shortLiabVal += Math.abs(h.qty) * price;

        if (h.pnlDollars !== undefined && h.pnlDollars !== null) {
          openPnlDollars += h.pnlDollars;
        } else if (h.avgPrice > 0) {
          openPnlDollars += h.qty > 0
            ? (price - h.avgPrice) * h.qty
            : (h.avgPrice - price) * Math.abs(h.qty);
        }
      }
    }

    // Personal Portfolio Win / Loss ($ and %) vs $1,000,000 starting capital
    // If Boursify's summary.total_value hasn't updated between ticks, compute live equity from cash + live positions!
    let personalTotalValue = state.totalValue;
    if (
      openPositionsCount > 0 &&
      Math.abs(personalTotalValue - 1000000) < 1 &&
      Math.abs(openPnlDollars) > 1
    ) {
      personalTotalValue = 1000000 + openPnlDollars;
    }

    const personalWinLossDollars = personalTotalValue - 1000000;
    const personalWinLossPct = (personalWinLossDollars / 1000000) * 100;
    const wlCol =
      personalWinLossDollars > 0 ? '#4ade80' : personalWinLossDollars < 0 ? '#f87171' : '#e2e8f0';
    const wlBg =
      personalWinLossDollars > 0 ? '#14532d' : personalWinLossDollars < 0 ? '#7f1d1d' : '#334155';
    const wlLabel = personalWinLossDollars >= 0 ? 'WIN' : 'LOSS';
    const openCol = openPnlDollars > 0 ? '#4ade80' : openPnlDollars < 0 ? '#f87171' : '#e2e8f0';

    elStatus.textContent = state.statusMsg ? `(${state.statusMsg})` : '';
    if (elSimBadge) elSimBadge.textContent = `#${cfg.simId}`;
    elPlayerBadge.textContent = cfg.playerName
      ? `[${cfg.playerName} #${cfg.playerId}]`
      : `[Player #${cfg.playerId}]`;
    elCash.innerHTML = `
      <span style="background:${wlBg};color:${wlCol};padding:1px 6px;border-radius:4px;font-weight:700;font-size:11px;">
        MY P&L (${wlLabel}): ${fmtDollarsSigned(personalWinLossDollars)} (${personalWinLossPct >= 0 ? '+' : ''}${personalWinLossPct.toFixed(2)}%)
      </span>
      · Portfolio: <b style="color:#f8fafc;">$${Math.round(personalTotalValue).toLocaleString()}</b>
      · Open Trades: <b style="color:${openCol};">${fmtDollarsSigned(openPnlDollars)}</b>
      · Cash: <b>$${Math.round(state.cash).toLocaleString()}</b>
    `;
    elBudgetPill.textContent = `= $${targetDollars.toLocaleString()}`;
    elColShHdr.textContent = `${pct}% SHARES`;
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
          chg1m,
        } = m;

        // Clean, direct UP or DOWN vs Average badge (adjusted for upward drift)
        const isStrongDip = vsAvgPct <= -1.5;
        const isStrongPeak = vsAvgPct >= 1.5;
        const isDown = vsAvgPct < 0;

        let signalBadge = '';
        if (isStrongDip) {
          signalBadge = `<span style="background:#14532d;color:#4ade80;padding:2px 6px;border-radius:4px;font-weight:700;font-size:11px;display:inline-block;">▼ DOWN ${vsAvgPct.toFixed(1)}% (BUY)</span>`;
        } else if (isDown) {
          signalBadge = `<span style="background:#064e3b;color:#6ee7b7;padding:2px 6px;border-radius:4px;font-weight:600;font-size:11px;display:inline-block;">▼ DOWN ${vsAvgPct.toFixed(1)}%</span>`;
        } else if (isStrongPeak) {
          signalBadge = `<span style="background:#7f1d1d;color:#fca5a5;padding:2px 6px;border-radius:4px;font-weight:700;font-size:11px;display:inline-block;">▲ UP +${vsAvgPct.toFixed(1)}% (SHORT)</span>`;
        } else {
          signalBadge = `<span style="background:#451a03;color:#fcd34d;padding:2px 6px;border-radius:4px;font-weight:600;font-size:11px;display:inline-block;">▲ UP +${vsAvgPct.toFixed(1)}%</span>`;
        }

        const c1m = chg1m > 0.05 ? '#4ade80' : chg1m < -0.05 ? '#f87171' : '#94a3b8';

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
          heldLine = `
            <div style="font-size:10px;color:#cbd5e1;">
              <span style="color:#38bdf8;font-weight:700;">${qty.toLocaleString()} sh</span>
              <span style="color:#94a3b8;font-size:10px;">(${sideTag} @$${entryP.toFixed(2)})</span>
            </div>
            <div style="margin-top:2px;">
              <span style="background:${pnlBg};color:${pnlCol};border:1px solid ${pnlCol}55;padding:1px 6px;border-radius:4px;font-weight:700;font-size:11px;display:inline-block;">
                ${fmtDollarsSigned(pnlDollars)} (${fmtPct(pnlPct)})
              </span>
            </div>`;
        }

        const pctShares = calcPortfolioPctShares(price);
        const fillBtns = cfg.prefillEnabled
          ? `<div style="display:flex;justify-content:flex-end;gap:3px;margin-top:3px;">
              <button data-fill-side="BUY" data-fill-sym="${esc(sym)}" data-fill-id="${esc(p.id)}" data-fill-qty="${pctShares}" title="Pre-fill BUY ${pctShares} sh" style="background:#16a34a;color:#fff;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:10px;font-weight:700;">Buy</button>
              <button data-fill-side="SELL" data-fill-sym="${esc(sym)}" data-fill-id="${esc(p.id)}" data-fill-qty="${pctShares}" title="Pre-fill SELL/SHORT ${pctShares} sh" style="background:#dc2626;color:#fff;border:none;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:10px;font-weight:700;">Short</button>
              ${
                qty !== 0
                  ? `<button data-fill-side="${qty > 0 ? 'SELL' : 'BUY'}" data-fill-sym="${esc(sym)}" data-fill-id="${esc(p.id)}" data-fill-qty="${Math.abs(qty)}" title="Close full position (${Math.abs(qty)} sh)" style="background:#475569;color:#fff;border:none;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:10px;">Exit</button>`
                  : ''
              }
            </div>`
          : '';

        return `<div style="display:grid;grid-template-columns:1.1fr 0.9fr 1.05fr 0.95fr;align-items:center;gap:6px;padding:6px 2px;border-bottom:1px solid #1e293b;">
          <div>
            <div style="font-weight:700;font-size:13px;">${esc(sym)}</div>
            ${heldLine}
          </div>
          <div style="text-align:right;font-variant-numeric:tabular-nums;">
            <div><b style="font-size:13px;">$${price.toFixed(2)}</b></div>
            <div style="color:#94a3b8;font-size:10px;">Avg $${refAvg.toFixed(2)}</div>
          </div>
          <div style="text-align:right;font-variant-numeric:tabular-nums;">
            <div>${signalBadge}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">
              1m: <span style="color:${c1m};font-weight:600;">${fmtPct(chg1m)}</span>
            </div>
          </div>
          <div style="text-align:right;font-variant-numeric:tabular-nums;">
            <div><b style="color:#38bdf8;font-size:13px;">${pctShares.toLocaleString()} sh</b></div>
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
  elPlayerBadge.addEventListener('click', () => {
    if (state.teamPlayers.length > 1) {
      const idx = state.teamPlayers.findIndex((tp) => String(tp.id) === String(cfg.playerId));
      const next = state.teamPlayers[(idx + 1) % state.teamPlayers.length];
      cfg.playerId = String(next.id);
      cfg.playerName = next.name;
      cfg.idConfirmed = true;
      state.holdings = {};
      state.txCostMap = {};
      saveCfg();
      poll();
    }
  });

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

  // --- Live Poller ---
  let isPolling = false;
  const poll = async () => {
    if (isPolling) return;
    isPolling = true;
    detectIds();
    window.__BC_POLL_STARTED__ = true;
    try {
      const base = `/resources/simulation/${cfg.simId}`;
      state.pollTick += 1;

      // On first poll (or every 5th poll if player has 0 positions and $1M cash), check /players to auto-select the active trading account on the team!
      if (state.pollTick === 1 || (!cfg.idConfirmed && state.pollTick % 3 === 0)) {
        const playersRes = await fetchJson(`${base}/players`).catch(() => null);
        const pList = Array.isArray(playersRes) ? playersRes : playersRes?.data || [];
        if (Array.isArray(pList) && pList.length > 0) {
          state.teamPlayers = pList.map((pl) => ({
            id: String(pl.id),
            name: pl.user?.first_name || pl.user?.full_name || `#${pl.player_number || pl.id}`,
            cash: Number(pl.current_cash ?? 1000000),
            totalValue: Number(pl.total_value ?? 1000000),
          }));

          // Match current cfg.playerId to set playerName
          const curMatch = state.teamPlayers.find((tp) => tp.id === String(cfg.playerId));
          if (curMatch) cfg.playerName = curMatch.name;

          // If current playerId has untouched $1M cash & $1M totalValue, check if another teammate account is the one actively trading!
          if (!cfg.idConfirmed) {
            const activeTrader = state.teamPlayers.find(
              (tp) => Math.abs(tp.cash - 1000000) > 1 || Math.abs(tp.totalValue - 1000000) > 1
            );
            if (activeTrader && activeTrader.id !== String(cfg.playerId)) {
              cfg.playerId = activeTrader.id;
              cfg.playerName = activeTrader.name;
              saveCfg();
            } else if (!curMatch && state.teamPlayers[0]) {
              cfg.playerId = state.teamPlayers[0].id;
              cfg.playerName = state.teamPlayers[0].name;
              saveCfg();
            }
          }
        }
      }

      const [productsRes, portfolioRes, txRes] = await Promise.all([
        fetchJson(`${base}/financial-products`),
        fetchJson(`${base}/player/${cfg.playerId}/portfolio`),
        fetchJson(`${base}/player/${cfg.playerId}/transactions`).catch(() => null),
      ]);

      const products = Array.isArray(productsRes) ? productsRes : productsRes.data || [];
      state.products = products;
      const nativeSnap = readNativePortfolioTotals();

      // Extract actual current quantities per stock from portfolioRes (or native Vue positions) BEFORE running transaction cost-basis solver
      const actualQuantitiesBySym = {};
      const rawPosPre =
        (Array.isArray(portfolioRes?.positions) && portfolioRes.positions.length > 0
          ? portfolioRes.positions
          : null) ??
        portfolioRes?.items ??
        portfolioRes?.financial_products ??
        portfolioRes?.data?.positions ??
        nativeSnap?.positions ??
        [];
      const posListPre = Array.isArray(rawPosPre)
        ? rawPosPre
        : rawPosPre && typeof rawPosPre === 'object'
        ? Object.entries(rawPosPre).map(([k, v]) =>
            v && typeof v === 'object' ? { _key: k, ...v } : { _key: k, quantity: v }
          )
        : [];
      for (const it of posListPre) {
        if (!it || typeof it !== 'object') continue;
        const s =
          (it._key && KNOWN_TICKERS.has(String(it._key).toUpperCase())
            ? String(it._key).toUpperCase()
            : null) || resolveSymbol(it);
        const q = Number(
          it.quantity ??
            it.qty ??
            it.shares ??
            it.number_of_shares ??
            it.amount_of_shares ??
            it.pivot?.quantity ??
            it.position ??
            0
        );
        if (s && q !== 0) actualQuantitiesBySym[s] = q;
      }

      const effectiveTxRes =
        (txRes && ((Array.isArray(txRes.transactions) && txRes.transactions.length > 0) || (Array.isArray(txRes) && txRes.length > 0))
          ? txRes
          : null) ||
        (nativeSnap?.transactions ? { transactions: nativeSnap.transactions } : txRes);

      if (effectiveTxRes) {
        computeCostBasisFromTransactions(effectiveTxRes, actualQuantitiesBySym);
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
        const cashVal =
          portfolioRes.summary?.cash_balance ??
          portfolioRes.current_cash ??
          portfolioRes.cash_balance ??
          portfolioRes.data?.summary?.cash_balance;
        if (cashVal !== undefined && cashVal !== null) state.cash = Number(cashVal);

        const totalVal =
          portfolioRes.summary?.total_value ??
          portfolioRes.total_value ??
          portfolioRes.portfolio_value ??
          portfolioRes.data?.summary?.total_value;
        if (totalVal !== undefined && totalVal !== null) state.totalValue = Number(totalVal);
        state.portfolioSummary = portfolioRes.summary || portfolioRes.data?.summary || null;

        // Also cross-check with /players entry for this playerId and native DOM/Vue state
        const teamEntry = state.teamPlayers.find((tp) => tp.id === String(cfg.playerId));
        if (
          teamEntry &&
          Math.abs(state.totalValue - 1000000) < 1 &&
          Math.abs(teamEntry.totalValue - 1000000) > 1
        ) {
          state.totalValue = teamEntry.totalValue;
          state.cash = teamEntry.cash;
        }
        const nativeTotals = readNativePortfolioTotals();
        if (
          nativeTotals &&
          nativeTotals.totalValue > 0 &&
          (Math.abs(state.totalValue - 1000000) < 1 || Math.abs(nativeTotals.totalValue - 1000000) > 1)
        ) {
          if (Math.abs(nativeTotals.totalValue - 1000000) > 1) {
            state.totalValue = nativeTotals.totalValue;
          }
          if (nativeTotals.cash !== undefined && Math.abs(nativeTotals.cash - 1000000) > 1) {
            state.cash = nativeTotals.cash;
          }
        }

        const rawPositions =
          (Array.isArray(portfolioRes.positions) && portfolioRes.positions.length > 0
            ? portfolioRes.positions
            : null) ??
          portfolioRes.items ??
          portfolioRes.financial_products ??
          portfolioRes.data?.positions ??
          nativeSnap?.positions ??
          [];
        let items = [];
        if (Array.isArray(rawPositions)) {
          items = rawPositions;
        } else if (rawPositions && typeof rawPositions === 'object') {
          items = Object.entries(rawPositions).map(([k, v]) =>
            v && typeof v === 'object' ? { _key: k, ...v } : { _key: k, quantity: v }
          );
        }

        const nextHoldings = {};
        for (const it of items) {
          if (!it || typeof it !== 'object') continue;
          const sym =
            (it._key && KNOWN_TICKERS.has(String(it._key).toUpperCase())
              ? String(it._key).toUpperCase()
              : null) || resolveSymbol(it);
          const fp = state.products.find((p) => (p.short_name || p.ticker) === sym);

          // Find quantity across all possible field names
          let q = Number(
            it.quantity ??
              it.qty ??
              it.shares ??
              it.number_of_shares ??
              it.amount_of_shares ??
              it.pivot?.quantity ??
              it.position ??
              0
          );
          if (q === 0 && typeof it.total_quantity === 'number') q = it.total_quantity;
          if (!sym || q === 0) continue;

          const livePrice = Number(fp?.current_price ?? it.current_price ?? 0);
          const txBasis = state.txCostMap[sym];
          const prevHeld = state.holdings[sym];

          // 1. Check if portfolio payload gives explicit average / purchase price or cost basis
          // NOTE: Do NOT use it.unit_price if it equals livePrice!
          const candidateUnitP = Number(it.unit_price ?? it.pivot?.unit_price ?? 0);
          const explicitAvg = Number(
            it.average_price ??
              it.avg_price ??
              it.purchase_price ??
              it.buy_price ??
              it.entry_price ??
              it.cost_basis_per_share ??
              it.pivot?.average_price ??
              (candidateUnitP > 0 && Math.abs(candidateUnitP - livePrice) > 0.001 ? candidateUnitP : 0)
          );
          const explicitCostTotal = Number(
            it.cost_basis ?? it.book_value ?? it.invested_amount ?? it.initial_value ?? 0
          );

          // 2. Determine true entry price (priority: /transactions cost basis -> explicitAvg -> explicitCostTotal/q -> previous tracked entry -> livePrice)
          let entryPrice = 0;
          if (txBasis && txBasis.avgPrice > 0) {
            entryPrice = txBasis.avgPrice;
          } else if (explicitAvg > 0) {
            entryPrice = explicitAvg;
          } else if (explicitCostTotal > 0) {
            entryPrice = explicitCostTotal / Math.abs(q);
          } else if (prevHeld && prevHeld.avgPrice > 0 && Math.abs(prevHeld.avgPrice - livePrice) > 0.0001) {
            if (prevHeld.qty === q) {
              entryPrice = prevHeld.avgPrice;
            } else if ((prevHeld.qty > 0 && q > prevHeld.qty) || (prevHeld.qty < 0 && q < prevHeld.qty)) {
              const added = Math.abs(q - prevHeld.qty);
              entryPrice =
                (Math.abs(prevHeld.qty) * prevHeld.avgPrice + added * livePrice) / Math.abs(q);
            } else {
              entryPrice = prevHeld.avgPrice;
            }
          } else if (items.length === 1 && Math.abs(state.cash - 1000000) > 1) {
            // Single position fallback: derive exact entry price from cash spent/received!
            if (q > 0 && state.cash < 1000000) {
              entryPrice = (1000000 - state.cash) / q;
            } else if (q < 0 && state.cash > 1000000) {
              entryPrice = (state.cash - 1000000) / Math.abs(q);
            } else {
              entryPrice = livePrice;
            }
          } else {
            entryPrice = livePrice;
          }

          // 3. Check if portfolio payload provides explicit unrealized profit/loss
          const explicitPnl =
            it.profit_loss ??
            it.pnl ??
            it.unrealized_pnl ??
            it.gain ??
            it.return_amount ??
            null;
          let pnlDollars = 0;
          if (explicitPnl !== null && explicitPnl !== undefined) {
            pnlDollars = Number(explicitPnl);
          } else if (entryPrice > 0) {
            pnlDollars =
              q > 0
                ? (livePrice - entryPrice) * q
                : (entryPrice - livePrice) * Math.abs(q);
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

        // Fallback 1: Include any non-zero positions reconstructed from /transactions
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

        // Fallback 2: Scrape visible DOM table rows if API positions were still not matched
        if (Object.keys(nextHoldings).length === 0) {
          const domPos = scrapeDomHoldingsAndTx();
          for (const [sym, d] of Object.entries(domPos)) {
            if (d.qty !== 0) {
              const fp = state.products.find((p) => (p.short_name || p.ticker) === sym);
              const livePrice = Number(fp?.current_price || d.avgPrice || 0);
              const prevHeld = state.holdings[sym];
              const entryP =
                state.txCostMap[sym]?.avgPrice ||
                (d.avgPrice > 0 && Math.abs(d.avgPrice - livePrice) > 0.001 ? d.avgPrice : 0) ||
                prevHeld?.avgPrice ||
                livePrice;
              const pnlDollars =
                d.qty > 0 ? (livePrice - entryP) * d.qty : (entryP - livePrice) * Math.abs(d.qty);
              const pnlPct =
                entryP > 0
                  ? d.qty > 0
                    ? ((livePrice - entryP) / entryP) * 100
                    : ((entryP - livePrice) / entryP) * 100
                  : 0;
              nextHoldings[sym] = {
                qty: d.qty,
                avgPrice: entryP,
                pnlDollars,
                pnlPct,
              };
            }
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
