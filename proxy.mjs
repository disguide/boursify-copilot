import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeCurated } from './curated-engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HOST = '127.0.0.1';
const PORT = 8787;
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODELS_URL = 'https://integrate.api.nvidia.com/v1/models';
const DEFAULT_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';
let cachedWorkingModel = null;

const EXCLUDE_MODEL_RE =
  /translate|riva|embed|rerank|reward|guard|safety|shield|audio|whisper|parakeet|cosmos|parse|ocr|clip|sdxl|flux|bge|e5|nemoretriever|neva|deplot|kosmos|paligemma|vila|corrdiff|fourcastnet|esm|molmim|diffdock|alphafold/i;

const pickActiveModels = async (apiKey) => {
  const res = await fetch(NVIDIA_MODELS_URL, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const ids = (data?.data || [])
    .map((m) => m.id)
    .filter((id) => id && !EXCLUDE_MODEL_RE.test(id));
  if (!ids.length) return [];

  const preferredPatterns = [
    /nemotron-3\.5-lightning/i,
    /nemotron-3\.5-super/i,
    /nemotron-3/i,
    /llama-4.*instruct/i,
    /qwen3(?!.*coder)/i,
    /mistral.*large/i,
    /deepseek-v3/i,
    /nemotron.*instruct/i,
    /qwen.*instruct/i,
    /llama.*instruct/i,
    /gemma.*it/i,
    /instruct|chat/i,
  ];

  const ranked = [];
  for (const pat of preferredPatterns) {
    for (const id of ids) {
      if (pat.test(id) && !ranked.includes(id)) ranked.push(id);
    }
  }
  console.log('[proxy] Discovered live chat models:', ranked.slice(0, 8).join(', '));
  return ranked.slice(0, 6);
};

const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Vary', 'Origin');
};

const sendJson = (req, res, statusCode, payload) => {
  setCorsHeaders(req, res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const COMPANY_PLAYBOOK = `
1. RAI (Rubicon AI, $48 start, Tech/AI, unprof -$1.9B, $9B cash, D/E 0.14): CEO Julian Vance, model Alea-3, Project Legio & Ravenne-2 data centre (Fall 2030). BULLISH: AI breakthroughs, Legio/Ravenne-2 milestones. BEARISH: Taiwan chip/semiconductor disruption, Palissade (6% holder, lock-up ends mid-July 2030) selling or critical Palissade Research report, ex-employee doubts.
2. PAL (Palissade Capital, $85 start, Bank/Asset Mgmt, P/E 12, Beta 0.9, D/E 2.40): CEO Miles Stern, Palissade Research moves markets, holds 6% of RAI. BULLISH: high rates (4.25% helps spread). BEARISH: rate cuts (squeezes margins), recession (commercial/office real estate loan defaults).
3. ALE (Aldren Pharmaceuticals, $112 start, Pharma, P/E 16, Beta 0.6, $11B cash): CEO Dr. Helen Marsh. Defensive. KEY CATALYSTS: Cardiva (38% of rev) patent expires April 2030 (generic risk); HT-114 oral obesity pill Phase 3 results end of summer 2030 (make-or-break!).
4. TAG (Ressources Taïga, $31 start, Critical Metals, P/E 9, Beta 1.4, +22% rev): CEO Luc Bergeron. Project Aurore ($2.8B, $600M subsidies, Indigenous consultation). POLITICAL BINARY (Feb 11 QC election): backs Alliance prospérité Québec (Ouellet = BULLISH); Québec Ensemble (Fortin = BEARISH: subsidy review, higher royalties, strict env rules). BULLISH: Ottawa-Brussels EU critical minerals deal.
5. HAW (Grayhawk Systems, $145 start, Defence/Bastion OS, P/E 22.3, Beta 0.7, $95B backlog): CEO Diane Kessler. Recession-proof. BULLISH: Taiwan Strait tensions, NATO 3.5% GDP defence spending, Ottawa base modernization. BEARISH: AI military ethics backlash/protests.
6. LIA (Hydrélia, $24 start, Green Hydrogen/Storage, Beta 1.9, +95% rev, -$45M loss, D/E 1.22, $250M cash): CEO Sophie Lachance. Needs financing within 18m (rate-sensitive). POLITICAL BINARY (Feb 11): backs Québec Ensemble ($2B green H2 fund + cheap power = BULLISH); Alliance prospérité win = BEARISH. BULLISH: EU hydrogen demand, data centre power storage.
7. NOR (Northline Infrastructure, $52 start, Construction, P/E 15, Beta 1.2, 3.7% thin margin, D/E 1.50): CEO Catherine Doyle. Fixed-price contracts (cost overruns hurt!), rate/real-estate sensitive. BULLISH: Far North Highway ($1.1B tied to TAG Aurore), QC/Ottawa housing & military base upgrades, EU rail/housing.
8. CHA (Épiceries Champlain, $68.50 start, Grocery, P/E 18, Beta 0.5, 4.0% margin): CEO Isabelle Gagnon. Defensive in recession (Marché Fleuve discount). BEARISH: Québec Ensemble inquiry into grocers' margins / price regulation. CATALYST: Comptoir Champlain ready-meals & potential restaurant acquisition (PIN!).
9. PIN (Les Restaurants Papineau, $18 start, Restaurants, P/E 30, Beta 1.6, 2.8% margin, D/E 1.86, 3.6x/4.0x debt covenant): CEO Olivier Desrosiers. BEARISH: minimum wage hike (34% labour cost), recession/rate hike (near 4x covenant!), grocery meal competition. BULLISH: frozen meals in groceries or buyout by CHA.
10. HOL (Hollis & Rowe, $82 start, Outdoor Apparel/Footwear, P/E 17.8, Beta 1.1, ROE 24.2%, $3.8B cash): CEO Grant Hollis. 70% Asia supply chain (Bangladesh, Vietnam, Taiwan). BEARISH: US tariffs on Asian imports, Fall 2030 EU supply-chain directive, NGO labour scandals, recession. BULLISH: Mexico shift, AI inventory (-30% unsold stock).
`.trim();

const buildPrompt = ({ headline, recentEvents = [], products = [], portfolio = {} }, curated = { actions: [] }) => {
  const productLines = products.map((p) => {
    const chg = Number.isFinite(Number(p.chg60s)) ? `${Number(p.chg60s) >= 0 ? '+' : ''}${Number(p.chg60s).toFixed(2)}%` : 'n/a';
    return `- ${p.ticker} (${p.name}): price=$${Number(p.price || 0).toFixed(2)}, 60s=${chg}, start=$${p.startPrice ?? '?'}, ma50=${p.ma50 ?? '?'}`;
  });

  const eventLines = recentEvents.slice(-8).map((ev, idx) => `${idx + 1}. ${ev}`);
  const holdingsEntries = Object.entries(portfolio.holdings || {});
  const holdingLines = holdingsEntries.length
    ? holdingsEntries.map(([sym, h]) => `${sym}: ${h.qty} shares @ avg $${Number(h.avgPrice || 0).toFixed(2)}`).join('; ')
    : 'None (100% cash)';

  const curatedHintLines = (curated?.actions || []).map(
    (a) => `- ${a.ticker}: ${a.action} (conviction ${a.conviction}, target ${a.target_pct}%) — ${a.reason}`
  );

  return [
    'You are an institutional quantitative analyst advising a team in Grasset Stock Market Simulation 2026 (Boursify, Jan 2030-Jan 2031).',
    '',
    'COMPANY PLAYBOOK (USE THESE EXACT DRIVERS & HIDDEN LINKS):',
    COMPANY_PLAYBOOK,
    '',
    'LIVE PRICES & MOMENTUM:',
    ...(productLines.length ? productLines : ['No product data provided.']),
    '',
    'PORTFOLIO STATE:',
    `Cash: $${Math.round(Number(portfolio.cash || 0)).toLocaleString()} | Total Value: $${Math.round(Number(portfolio.totalValue || 0)).toLocaleString()} | Holdings: ${holdingLines}`,
    '',
    'RECENT CONNECTED EVENTS (oldest to newest):',
    ...(eventLines.length ? eventLines : ['None']),
    '',
    `NEW BREAKING HEADLINE TO ANALYZE:\n"${headline}"`,
    ...(curatedHintLines.length
      ? [
          '',
          'CURATED HANDBOOK RULE MATCHES FOR THIS HEADLINE (DO NOT CONTRADICT HIGH-CONVICTION DIRECTION):',
          ...curatedHintLines,
        ]
      : []),
    '',
    'STRICT SIMULATION RULES:',
    '1. Transaction fee is $50 + 0.5% per trade (~1% round-trip). Skip minor noise; only trade clear catalysts.',
    '2. Max single-company concentration is 40% of portfolio. Short selling is allowed up to 100% of portfolio.',
    '3. Boursify executes BUY (go long or cover short) and SELL (close long or open SHORT at 0 shares).',
    '4. Strong negative news on a held long is SELL (100% exit); on an unheld stock, output SHORT (10-25% target_pct) if clear and high-conviction, or AVOID if mild/risky — NEVER BUY.',
    '5. Some news does not name the company directly — match via the playbook (e.g., QC election, Taiwan, tariffs, rates, Cardiva, HT-114, Aurore, Bastion OS, Comptoir Champlain). Include 1 to 3 impacted tickers max.',
    '6. target_pct: 15-20 for conv 2 BUY, 25-35 for conv 3 BUY; 10-15 for conv 2 SHORT, 20-25 for conv 3 SHORT; 50 or 100 for SELL/COVER; 0 for AVOID.',
    '',
    'Return ONLY a single valid JSON object (no markdown, no explanation). Example format:',
    '{"summary":"One short sentence thesis","actions":[{"ticker":"NOR","action":"SHORT","conviction":3,"target_pct":20,"reason":"Delayed payments and $60M provision hit thin 3.7% margin"}]}',
    'Valid action values: "BUY", "SELL", "SHORT", "COVER", "AVOID", or "WATCH". Valid conviction values: 1, 2, or 3.',
  ].join('\n');
};

const FALLBACK_MODELS = [
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'nvidia/nemotron-3.5-super-vl-120b-a12b',
];

const callNvidiaOnce = async ({ apiKey, model, prompt, useJsonMode = true }) => {
  const payload = {
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a quantitative trading analyst. Respond with ONLY one valid JSON object containing "summary" and "actions". Never copy template syntax, never output markdown, never output text outside the JSON.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 320,
  };
  if (useJsonMode) payload.response_format = { type: 'json_object' };
  return fetch(NVIDIA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
};

const extractFirstJsonObject = (text) => {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
};

const parseLlmJson = (raw, label) => {
  const cleaned = String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const candidate = extractFirstJsonObject(cleaned);
  if (!candidate) {
    throw new Error(`${label} returned non-JSON: ${cleaned.slice(0, 120)}`);
  }
  const parsed = JSON.parse(candidate);
  const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    actions: actions.slice(0, 3).map((a) => ({
      ticker: String(a.ticker || '').toUpperCase(),
      action: ['BUY', 'SELL', 'SHORT', 'COVER', 'AVOID', 'WATCH'].includes(String(a.action || '').toUpperCase())
        ? String(a.action).toUpperCase()
        : 'WATCH',
      conviction: Math.max(1, Math.min(3, Number(a.conviction) || 2)),
      target_pct: Math.max(0, Math.min(100, Number(a.target_pct) || 0)),
      reason: String(a.reason || '').slice(0, 120),
    })),
  };
};

const callOpenAiCompat = async ({ url, apiKey, model, prompt, label }) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 300,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`${label} HTTP ${res.status}: ${errText.slice(0, 140) || res.statusText}`);
  }
  const data = await res.json();
  return parseLlmJson(data?.choices?.[0]?.message?.content || '', label);
};

const callGemini = async ({ apiKey, prompt }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 350 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 140) || res.statusText}`);
  }
  const data = await res.json();
  return parseLlmJson(data?.candidates?.[0]?.content?.parts?.[0]?.text || '', 'Gemini');
};

const callNvidia = async ({ apiKey, model, prompt }) => {
  // Auto-detect non-NVIDIA keys pasted into the same box
  if (apiKey.startsWith('AIza')) {
    return callGemini({ apiKey, prompt });
  }
  if (apiKey.startsWith('gsk_')) {
    return callOpenAiCompat({
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey,
      model: 'llama-3.3-70b-versatile',
      prompt,
      label: 'Groq',
    });
  }
  if (apiKey.startsWith('sk-or-')) {
    return callOpenAiCompat({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey,
      model: 'google/gemini-2.5-flash',
      prompt,
      label: 'OpenRouter',
    });
  }
  if (apiKey.startsWith('sk-')) {
    return callOpenAiCompat({
      url: 'https://api.openai.com/v1/chat/completions',
      apiKey,
      model: 'gpt-4o-mini',
      prompt,
      label: 'OpenAI',
    });
  }

  const tryModels = [];
  if (cachedWorkingModel) {
    tryModels.push(cachedWorkingModel);
  } else {
    for (const m of FALLBACK_MODELS) tryModels.push(m);
    const discoveredList = await pickActiveModels(apiKey);
    for (const m of discoveredList) {
      if (!tryModels.includes(m)) tryModels.push(m);
    }
  }

  let lastErr = null;
  for (const candidateModel of tryModels) {
    try {
      let res = await callNvidiaOnce({ apiKey, model: candidateModel, prompt, useJsonMode: true });
      if (res.status === 400 || res.status === 422) {
        res = await callNvidiaOnce({ apiKey, model: candidateModel, prompt, useJsonMode: false });
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastErr = new Error(`NVIDIA HTTP ${res.status} (${candidateModel}): ${errText.slice(0, 140) || res.statusText}`);
        console.error('[proxy]', lastErr.message);
        if (res.status === 401 || res.status === 403) throw lastErr;
        continue;
      }
      const data = await res.json();
      const msg = data?.choices?.[0]?.message || {};
      const raw = msg.content || msg.reasoning_content || '';
      const parsed = parseLlmJson(raw, `NVIDIA (${candidateModel})`);
      cachedWorkingModel = candidateModel;
      console.log(`[proxy] OK via ${candidateModel}: ${parsed.summary}`);
      return parsed;
    } catch (err) {
      lastErr = err;
      console.error(`[proxy] ${candidateModel} failed:`, err.message);
      if (/HTTP 401|HTTP 403/.test(err.message)) throw err;
    }
  }

  throw lastErr || new Error('All NVIDIA models failed');
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(req, res, 200, { ok: true, service: 'boursify-copilot-proxy' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/copilot.js') {
    try {
      const code = fs.readFileSync(path.join(__dirname, 'copilot.js'), 'utf8');
      setCorsHeaders(req, res);
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(code);
    } catch (err) {
      sendJson(req, res, 500, { ok: false, error: err?.message || 'Failed to read copilot.js' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/analyze') {
    try {
      const rawBody = await readBody(req);
      const body = JSON.parse(rawBody || '{}');
      const apiKey = (body.apiKey || process.env.NVIDIA_API_KEY || '').trim();
      const headline = (body.headline || '').trim();

      if (!headline) {
        sendJson(req, res, 400, { ok: false, error: 'Missing headline' });
        return;
      }

      const curated = analyzeCurated({ headline, portfolio: body.portfolio || {} });

      if (!apiKey) {
        sendJson(req, res, 200, {
          ok: true,
          mode: 'CURATED',
          summary: curated.summary,
          actions: curated.actions,
          model: curated.model,
        });
        return;
      }

      try {
        const model = (body.model || DEFAULT_MODEL).trim();
        const prompt = buildPrompt(body, curated);
        const result = await callNvidia({ apiKey, model, prompt });

        // Merge curated handbook guardrails with AI output so high-conviction handbook rules are never missed or inverted
        const mergedMap = new Map();
        for (const a of result.actions || []) {
          if (a.ticker && a.ticker !== 'NONE') mergedMap.set(a.ticker, { ...a });
        }
        for (const ca of curated.actions || []) {
          const existing = mergedMap.get(ca.ticker);
          if (!existing || existing.action === 'WATCH') {
            mergedMap.set(ca.ticker, { ...ca });
          } else if (ca.conviction >= 3) {
            const caBull = ca.action === 'BUY' || ca.action === 'COVER';
            const exBull = existing.action === 'BUY' || existing.action === 'COVER';
            if (caBull !== exBull) {
              // Prevent AI from inverting a conviction-3 handbook trigger
              mergedMap.set(ca.ticker, { ...ca });
            }
          }
        }
        const finalActions = Array.from(mergedMap.values()).slice(0, 3);

        sendJson(req, res, 200, {
          ok: true,
          mode: 'AI',
          summary: result.summary || curated.summary,
          actions: finalActions.length ? finalActions : curated.actions,
          model,
        });
      } catch (aiErr) {
        console.warn('[proxy] AI failed, falling back to Curated Handbook Engine:', aiErr.message);
        sendJson(req, res, 200, {
          ok: true,
          mode: 'CURATED',
          summary: curated.summary,
          actions: curated.actions,
          model: curated.model,
        });
      }
    } catch (err) {
      sendJson(req, res, 502, {
        ok: false,
        error: err?.message || 'Proxy error',
      });
    }
    return;
  }

  sendJson(req, res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`Boursify Co-Pilot proxy listening on http://${HOST}:${PORT}`);
});
