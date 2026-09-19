import type { Candidate } from './types.js';

/** Structural hints only: no model call and no content dropped or reordered. */
export function partitionCandidates(candidates: Candidate[], limit: number): Candidate[][] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new Error('regionBlocks must be an integer from 1 to 500');
  const groups: Candidate[][] = [];
  const signature = (c: Candidate) => [c.inMain, c.inNavigation, c.inAside, c.inFooter, c.inComments].join(':');
  for (let start = 0; start < candidates.length;) {
    let end = Math.min(start + limit, candidates.length);
    if (end < candidates.length) {
      // Prefer a heading or layout boundary in the latter half of the region.
      // Hard slicing is the fallback. Atomic code/list/table blocks remain intact.
      for (let i = end; i >= start + Math.max(1, Math.ceil(limit / 2)); i--) {
        const here = candidates[i]!;
        const previous = candidates[i - 1]!;
        if (here.kind === 'heading' || signature(here) !== signature(previous)) { end = i; break; }
      }
    }
    groups.push(candidates.slice(start, end));
    start = end;
  }
  return groups;
}
