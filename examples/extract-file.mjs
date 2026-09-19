#!/usr/bin/env node
import { readFile, stat, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { extract } from '../dist/node.js';

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    help: { type: 'boolean', short: 'h' }, heuristic: { type: 'boolean', default: false },
    mode: { type: 'string', default: 'article' }, url: { type: 'string' },
    format: { type: 'string', default: 'markdown' }, out: { type: 'string' },
  }});
  if (values.help) {
    console.log('Usage: jev-readability page.html [--heuristic] [--mode article|documentation|forum|product|agent] [--url https://example.org/page] [--format markdown|text|html|json] [--out result.md]');
    process.exit(0);
  }
  if (positionals.length !== 1) throw new Error('Provide one local HTML file. Use --help for usage.');
  if (!['markdown', 'text', 'html', 'json'].includes(values.format)) throw new Error('Invalid --format; choose markdown, text, html or json');
  const file = positionals[0];
  if ((await stat(file)).size > 6_000_000) throw new Error('Input file exceeds the 6 MB byte guard. The core also enforces a 2,000,000-character limit.');
  const html = await readFile(file, 'utf8');
  const result = await extract(html, {
    mode: values.mode, url: values.url, strategy: values.heuristic ? 'heuristic' : 'jev',
    jev: { model: process.env.JEV_MODEL || 'jev-latest' }, fallback: 'error',
  });
  const output = values.format === 'json' ? JSON.stringify(result, null, 2) : result[values.format];
  if (values.out) await writeFile(values.out, output + '\n', 'utf8'); else process.stdout.write(output + '\n');
  console.error(`Method=${result.method}; blocks=${result.stats.keptBlocks}/${result.stats.candidateBlocks}; Jev requests=${result.usage.requests}; pipeline=${result.stats.totalMs.toFixed(0)}ms`);
  for (const warning of result.warnings) console.error(`Warning: ${warning}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
