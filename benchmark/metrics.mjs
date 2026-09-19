/** Whitespace-insensitive, case-sensitive anchor matching; not token-level accuracy. */
export const normalize = value => value.normalize('NFKC').replace(/\s+/gu, '');
export function score(text, example) {
  const output = normalize(text);
  const found = anchor => output.includes(normalize(anchor));
  const missing = example.keep.filter(anchor => !found(anchor));
  const leaked = example.drop.filter(found);
  const tp = example.keep.length - missing.length;
  const fn = missing.length;
  const fp = leaked.length;
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp / (tp + fn);
  const f1 = 2 * tp / (2 * tp + fp + fn);
  return { tp, fp, fn, precision, recall, f1, perfect: fn === 0 && fp === 0, missing, leaked };
}
export function aggregate(rows) {
  const completed = rows.filter(row => row.status === 'ok');
  const sum = key => rows.reduce((n, row) => n + (row.metrics?.[key] ?? 0), 0);
  const tp = sum('tp'), fp = sum('fp'), fn = sum('fn');
  return {
    total: rows.length, completed: completed.length, errors: rows.length - completed.length,
    perfect: rows.filter(row => row.status === 'ok' && row.metrics.perfect).length,
    tp, fp, fn, precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    f1: 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null,
  };
}
