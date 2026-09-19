import { readFile, writeFile } from 'node:fs/promises';
import { aggregate } from './wcxb-metrics.mjs';
const [input, output] = process.argv.slice(2);
if (!input || !output || input === output) throw new Error('Usage: node benchmark/recalculate.mjs original.json corrected.json (different paths)');
const original = JSON.parse(await readFile(input, 'utf8'));
const rows = original.rows.map(r => ({ ...r, anchor: { ...r.anchor, perfect: r.anchor.tp + r.anchor.fn + r.anchor.fp > 0 && r.anchor.perfect } }));
const engines = [...new Set(rows.map(r => r.engine))];
const corrected = {
  originalRun: original.runUrl, originalSourceCommit: original.sourceCommit,
  correction: 'Word macro metrics previously averaged successful rows only. Now failures score zero and stay in the all-page denominator. Empty anchor arrays no longer count as perfect annotation evidence. No model rerun.',
  dataset: original.dataset,
  previousSummaries: original.summaries,
  summaries: Object.fromEntries(engines.map(e => { const er = rows.filter(r => r.engine === e); return [e, {
    overall: aggregate(er), nonEmptyReference: aggregate(er.filter(r => r.word.referenceWords > 0)),
    byType: Object.fromEntries(original.dataset.types.map(t => [t, aggregate(er.filter(r => r.type === t))]))
  }]; })),
};
await writeFile(output, JSON.stringify(corrected, null, 2) + '\n');
