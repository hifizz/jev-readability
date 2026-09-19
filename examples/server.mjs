import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createJevClassifier, validateClassifyInput } from '../dist/jev.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer between 1024 and 65535');
const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const sessionToken = randomBytes(32).toString('hex');
const apiKey = process.env.TYPESAFE_API_KEY?.trim();
const classifier = apiKey ? createJevClassifier({ apiKey, model: process.env.JEV_MODEL || 'jev-latest' }) : null;
let active = 0;
const commonHeaders = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};
function json(res, status, value) { res.writeHead(status, { ...commonHeaders, 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
async function body(req) {
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > 3_000_000) throw new Error('Request body exceeds 3 MB'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function safeToken(value) {
  if (typeof value !== 'string' || value.length !== sessionToken.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(sessionToken));
}
const server = createServer(async (req, res) => {
  if (!allowedHosts.has(req.headers.host)) return json(res, 403, { error: 'Invalid Host header' });
  const origin = req.headers.origin;
  const expectedOrigin = `http://${req.headers.host}`;
  if (origin && origin !== expectedOrigin) return json(res, 403, { error: 'Cross-origin access denied' });
  const pathname = new URL(req.url, expectedOrigin).pathname;
  if (req.method === 'GET' && pathname === '/api/config') return json(res, 200, { hasApiKey: !!apiKey, model: process.env.JEV_MODEL || 'jev-latest', sessionToken });
  if (req.method === 'POST' && pathname === '/api/classify') {
    if (!safeToken(req.headers['x-demo-token'])) return json(res, 403, { error: 'Missing or invalid local session token' });
    if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Expected application/json' });
    if (!classifier) return json(res, 503, { error: 'TYPESAFE_API_KEY is not configured on the local server. Choose the explicit heuristic baseline or configure .env.' });
    if (active >= 2) return json(res, 429, { error: 'Two extractions are already active; retry after one completes.' });
    active++;
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(new DOMException('Browser disconnected', 'AbortError')); };
    res.once('close', abort);
    try {
      const input = await body(req); validateClassifyInput(input);
      const result = await classifier(input, { signal: controller.signal });
      if (!res.destroyed) json(res, 200, result);
    } catch (error) {
      // Never log the key, incoming page text, or the provider's raw response body.
      if (!res.destroyed) json(res, 502, { error: error instanceof Error ? error.message.slice(0, 250) : 'Extraction failed' });
    } finally { active--; res.removeListener('close', abort); }
    return;
  }
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  const fixed = {
    '/': ['examples/index.html', 'text/html'], '/app.js': ['examples/app.js', 'text/javascript'],
    '/styles.css': ['examples/styles.css', 'text/css'], '/tests': ['test/browser.html', 'text/html'],
    '/tests/browser.mjs': ['test/browser.mjs', 'text/javascript'],
    '/fixtures/article.html': ['fixtures/article.html', 'text/plain'],
    '/fixtures/documentation.html': ['fixtures/documentation.html', 'text/plain'],
  };
  let file = fixed[pathname];
  if (/^\/dist\/[a-z-]+\.js$/.test(pathname)) file = [pathname.slice(1), 'text/javascript'];
  if (!file) return json(res, 404, { error: 'Not found' });
  try { const contents = await readFile(resolve(root, file[0])); res.writeHead(200, { ...commonHeaders, 'Content-Type': file[1] + '; charset=utf-8' }); res.end(contents); }
  catch { json(res, 404, { error: 'Not found' }); }
});
server.requestTimeout = 100_000;
server.headersTimeout = 10_000;
server.listen(port, '127.0.0.1', () => {
  console.log(`jev-readability demo: http://127.0.0.1:${port}`);
  console.log(apiKey ? 'TypeSafe key configured. Jev is available; requests may incur API charges.' : 'No TypeSafe key configured. The offline heuristic baseline is available.');
});
