import { readFile } from 'node:fs/promises';
import { extract } from '../dist/node.js';
// One-time: npm install linkedom
// Run: node --env-file=.env examples/node-usage.mjs
const html = await readFile(new URL('../fixtures/article.html', import.meta.url), 'utf8');
const result = await extract(html, {
  url: 'https://example.org/article',
  mode: 'article',
  // API key defaults to process.env.TYPESAFE_API_KEY.
  // For an explicit offline baseline instead: strategy: 'heuristic'.
});
console.log(result.markdown);
console.error(JSON.stringify({ method: result.method, usage: result.usage, stats: result.stats }, null, 2));
