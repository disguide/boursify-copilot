import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeCurated } from './curated-engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = '127.0.0.1';
const PORT = 8787;

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(req, res, 200, { ok: true, service: 'boursify-copilot-curated', mode: 'CURATED' });
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
      const headline = (body.headline || '').trim();
      if (!headline) {
        sendJson(req, res, 400, { ok: false, error: 'Missing headline' });
        return;
      }

      const result = analyzeCurated({ headline, portfolio: body.portfolio || {} });
      console.log(`[curated] "${headline.slice(0, 70)}..." -> ${result.summary}`);
      sendJson(req, res, 200, {
        ok: true,
        mode: 'CURATED',
        summary: result.summary,
        actions: result.actions,
        model: result.model,
      });
    } catch (err) {
      sendJson(req, res, 500, { ok: false, error: err?.message || 'Curated engine error' });
    }
    return;
  }

  sendJson(req, res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`Boursify Co-Pilot CURATED (No API Key Needed) listening on http://${HOST}:${PORT}`);
});
