import { readFile, appendFile } from 'node:fs/promises';
let r;
try { r = JSON.parse(await readFile('docs/benchmarks/wcxb-jev-run.json', 'utf8')); }
catch { if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, '# WCXB evaluation\nNo report produced. Inspect the failed setup/preflight step.\n'); process.exit(0); }
const pct = x => x == null ? '—' : (x * 100).toFixed(2) + '%';
const labels = { 'mozilla-readability': 'Mozilla Readability', 'jev-api': 'JEV Typed', 'jev-generic': 'JEV Generic (agent)' };
const lines = ['# WCXB Typed vs Generic', '', `Status: **${r.status}**. Same ${r.dataset.selectedPages} pages; model \`${r.evaluation.requestedModel}\`.`, '', '| Engine | Word P | Word R | Word F1 | Anchor F1 | Error/unrun |', '| --- | ---: | ---: | ---: | ---: | ---: |'];
for (const [e, { overall: s }] of Object.entries(r.summaries)) lines.push(`| ${labels[e]} | ${pct(s.meanWordPrecision)} | ${pct(s.meanWordRecall)} | ${pct(s.meanWordF1)} | ${pct(s.anchorF1)} | ${s.errors}/${s.notRun} |`);
lines.push('', '> Word metrics include ALL scheduled pages. Failures and unrun pages score zero. Generic receives no supplied page-type label. This is a previously inspected public cohort, not a new blind test.', '', '## Per-type Word F1', '', '| Type | Readability | Typed | Generic |', '| --- | ---: | ---: | ---: |');
for (const t of r.dataset.types) lines.push(`| ${t} | ${pct(r.summaries['mozilla-readability']?.byType[t]?.meanWordF1)} | ${pct(r.summaries['jev-api']?.byType[t]?.meanWordF1)} | ${pct(r.summaries['jev-generic']?.byType[t]?.meanWordF1)} |`);
lines.push('', '## Paired differences (95% stratified page-bootstrap interval)', '');
for (const p of r.paired || []) lines.push(`- ${p.contrast}: ${(p.delta * 100).toFixed(2)} pp [${(p.lower * 100).toFixed(2)}, ${(p.upper * 100).toFixed(2)}].`);
lines.push('', 'Intervals cover page-sampling uncertainty, not model-run variability; they do not account for repeated domains.', '', '## HTTP usage', '', `Requests: ${r.usage.requests}; known input-token subtotal: ${r.usage.knownInputTokens}; known output-token subtotal: ${r.usage.knownOutputTokens}.`, `Accounting complete: ${r.usage.tokenAccountingComplete}. Missing input/output usage responses: ${r.usage.responsesMissingInputUsage}/${r.usage.responsesMissingOutputUsage}.`, '', 'Full per-page metrics, failures, configuration, source hashes and model versions are in the artifact. No API key or full page content is stored.');
const markdown = lines.join('\n') + '\n';
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
