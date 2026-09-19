/** WCXB-style bag-of-words metrics; neither order nor semantic equivalence is scored. */
export const TYPES = ['article', 'documentation', 'forum', 'product', 'service', 'listing', 'collection'];
export const MODES = { article: 'article', documentation: 'documentation', forum: 'forum', product: 'product', service: 'agent', listing: 'agent', collection: 'agent' };
export function modeFor(variant, type) {
  if (variant === 'generic') return 'agent'; // Never consult type labels on this branch.
  if (variant !== 'typed' || !Object.hasOwn(MODES, type)) throw new Error('Invalid benchmark variant/type');
  return MODES[type];
}
const tokens = text => String(text).toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
const counts = text => { const m = new Map(); for (const t of tokens(text)) m.set(t, (m.get(t) || 0) + 1); return m; };
export function wordScore(text, reference) {
  const p = counts(text), r = counts(reference);
  const predictedWords = [...p.values()].reduce((a, b) => a + b, 0);
  const referenceWords = [...r.values()].reduce((a, b) => a + b, 0);
  let overlap = 0;
  for (const [t, n] of p) overlap += Math.min(n, r.get(t) || 0);
  const precision = predictedWords ? overlap / predictedWords : referenceWords ? 0 : 1;
  const recall = referenceWords ? overlap / referenceWords : 1;
  return { precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0, overlap, predictedWords, referenceWords };
}
const normalize = value => value.normalize('NFKC').replace(/\s+/gu, '');
export function anchorScore(text, gt) {
  const output = normalize(text);
  const tp = gt.with.filter(t => output.includes(normalize(t))).length;
  const fn = gt.with.length - tp;
  const fp = gt.without.filter(t => output.includes(normalize(t))).length;
  return { tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null, f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null, perfect: fn === 0 && fp === 0 };
}
export function aggregate(rows) {
  if (!rows.length) throw new Error('Cannot aggregate an empty cohort');
  const ok = rows.filter(r => r.status === 'ok');
  const sum = field => rows.reduce((n, r) => n + r.anchor[field], 0);
  const tp = sum('tp'), fp = sum('fp'), fn = sum('fn');
  // Denominator is ALL scheduled pages, not just successful extractions.
  const meanWord = field => rows.reduce((n, r) => n + (r.status === 'ok' ? r.word[field] : 0), 0) / rows.length;
  return { pages: rows.length, completed: ok.length, errors: rows.filter(r => r.status === 'error').length, notRun: rows.filter(r => r.status === 'not_run').length,
    meanWordPrecision: meanWord('precision'), meanWordRecall: meanWord('recall'), meanWordF1: meanWord('f1'),
    anchorPrecision: tp + fp ? tp / (tp + fp) : null, anchorRecall: tp + fn ? tp / (tp + fn) : null,
    anchorF1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null,
    perfectAnchors: ok.filter(r => r.anchor.perfect).length,
    meanElapsedMs: ok.length ? ok.reduce((n, r) => n + r.elapsedMs, 0) / ok.length : null };
}
export function pairedBootstrap(rows, a, b, draws = 5000) {
  const ar = rows.filter(r => r.engine === a), br = new Map(rows.filter(r => r.engine === b).map(r => [r.id, r]));
  if (ar.length !== br.size || ar.some(r => !br.has(r.id))) throw new Error('Unpaired benchmark rows');
  const score = r => r.status === 'ok' ? r.word.f1 : 0;
  const groups = TYPES.map(type => ar.filter(r => r.type === type).map(r => score(r) - score(br.get(r.id))));
  if (groups.some(g => !g.length)) throw new Error('Missing page-type stratum');
  let state = 20260920;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  const samples = Array.from({ length: draws }, () => groups.reduce((sum, g) => sum + g.reduce(n => n + g[Math.floor(random() * g.length)], 0), 0) / ar.length).sort((x, y) => x - y);
  return { contrast: `${a} - ${b}`, delta: groups.flat().reduce((x, y) => x + y, 0) / ar.length,
    lower: samples[Math.floor(draws * .025)], upper: samples[Math.ceil(draws * .975) - 1], confidence: .95, draws, seed: 20260920,
    method: 'paired page bootstrap stratified by page type; NOT domain-clustered; sampling uncertainty only' };
}
