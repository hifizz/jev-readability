import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extract } from '../dist/node.js';

const html = await readFile(new URL('../fixtures/article.html', import.meta.url), 'utf8');
const article = await extract(html, { strategy: 'heuristic', url: 'https://example.org/article' });
assert.equal(article.method, 'heuristic');
assert.equal(article.usage.requests, 0);
assert.ok(article.stats.keptBlocks > 0);
assert.ok(article.markdown.includes('分类器只负责判断'));
assert.ok(article.markdown.includes('```typescript'));
assert.ok(article.blocks.every(block => block.keepProbability === null));
const fragment = await extract('<article><h1>Fragment</h1><p>Original content.</p></article>', { strategy: 'heuristic' });
assert.ok(fragment.markdown.includes('Original content.'));
assert.equal(fragment.title, 'Fragment');
console.log('Node/linkedom integration passed: fixture extraction, code preservation, fragments, no model requests.');
