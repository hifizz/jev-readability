import { prepare } from './dom.js';
import { heuristicClassifier } from './heuristic.js';
import { emptyUsage } from './types.js';
import type { ClassifyResult, ExtractOptions, ExtractionResult, PreparedPage } from './types.js';
export * from './types.js';
export { prepare } from './dom.js';
export { heuristicClassifier } from './heuristic.js';
export { createRemoteClassifier } from './remote.js';

export function finalize(page: PreparedPage, classified: ClassifyResult, classifyMs = 0): ExtractionResult {
  const blocks = page.blocks.map(b => {
    const d = classified.decisions[b.candidate.id];
    if (!d || typeof d.keep !== 'boolean' || typeof d.needsReview !== 'boolean' ||
      (d.keepProbability !== null && (typeof d.keepProbability !== 'number' || !Number.isFinite(d.keepProbability) || d.keepProbability < 0 || d.keepProbability > 1))) {
      throw new Error(`Missing or invalid decision for ${b.candidate.id}`);
    }
    if ((d.role !== null && !['main_content', 'navigation', 'related_content', 'comments', 'advertising', 'metadata', 'boilerplate', 'other'].includes(d.role)) ||
      (d.roleConfidence !== null && (typeof d.roleConfidence !== 'number' || !Number.isFinite(d.roleConfidence) || d.roleConfidence < 0 || d.roleConfidence > 1))) {
      throw new Error(`Invalid role decision for ${b.candidate.id}`);
    }
    // Never spread external fields over source HTML/text, even from a custom backend.
    return { ...b, keep: d.keep, keepProbability: d.keepProbability, role: d.role, roleConfidence: d.roleConfidence, needsReview: d.needsReview };
  });
  const kept = blocks.filter(b => b.keep);
  const warnings = [...page.warnings, ...classified.warnings];
  if (blocks.length && !kept.length) warnings.push('Every candidate was rejected. No fallback was applied automatically.');
  const reviewBlocks = blocks.filter(b => b.needsReview).length;
  if (reviewBlocks) warnings.push(`${reviewBlocks} block(s) are near the keep threshold and need review.`);
  const text = kept.map(b => b.candidate.text).join('\n\n');
  return {
    title: page.metadata.title, metadata: page.metadata, text,
    html: kept.length ? '<article>\n' + kept.map(b => b.html).join('\n') + '\n</article>' : '',
    markdown: kept.map(b => b.markdown).filter(Boolean).join('\n\n'),
    method: classified.method, blocks, warnings, usage: classified.usage,
    stats: { candidateBlocks: blocks.length, keptBlocks: kept.length, reviewBlocks, inputCharacters: page.inputCharacters, outputCharacters: text.length, prepareMs: page.prepareMs, classifyMs, totalMs: page.prepareMs + classifyMs },
  };
}

export async function extract(input: string | Document, options: ExtractOptions = {}): Promise<ExtractionResult> {
  options.signal?.throwIfAborted();
  const page = prepare(input, options);
  if (!page.blocks.length) return finalize(page, { method: options.strategy === 'heuristic' ? 'heuristic' : 'custom', decisions: {}, warnings: [], usage: emptyUsage() });
  const start = performance.now();
  const classifier = options.strategy === 'heuristic' ? heuristicClassifier : options.classifier;
  if (!classifier) throw new Error('Provide a classifier, or explicitly select strategy: "heuristic" for the offline baseline.');
  const data = { page: page.metadata, mode: page.mode, candidates: page.blocks.map(b => b.candidate) };
  try {
    const result = await classifier(data, { signal: options.signal });
    options.signal?.throwIfAborted();
    return finalize(page, result, performance.now() - start);
  } catch (error) {
    options.signal?.throwIfAborted();
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) throw error;
    if (options.fallback !== 'heuristic') throw error;
    const result = await heuristicClassifier(data, { signal: options.signal });
    if (error && typeof error === 'object' && 'partialUsage' in error && error.partialUsage && typeof error.partialUsage === 'object') {
      result.usage = { ...result.usage, ...error.partialUsage, inputTokens: null, outputTokens: null };
    }
    result.warnings.push('The requested classifier failed. Output uses explicit heuristic fallback; failed request token usage is unknown.');
    return finalize(page, result, performance.now() - start);
  }
}
