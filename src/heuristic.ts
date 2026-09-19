import { emptyUsage } from './types.js';
import type { Classifier, BlockRole } from './types.js';

/** Offline baseline only; its decisions have no statistical confidence. */
export const heuristicClassifier: Classifier = async (input, options) => {
  options?.signal?.throwIfAborted();
  const decisions: Awaited<ReturnType<Classifier>>['decisions'] = {};
  for (const c of input.candidates) {
    let keep: boolean;
    let role: BlockRole;
    const hint = c.ancestorHints.join(' ');
    if (c.inNavigation) { keep = false; role = 'navigation'; }
    else if (c.inFooter) { keep = false; role = 'boilerplate'; }
    else if (/(?:^|[\s_-])(ads?|advertisement|sponsored|cookie|newsletter)(?:$|[\s_-])/i.test(hint)) { keep = false; role = 'advertising'; }
    else if (c.inComments) { keep = input.mode === 'forum' || input.mode === 'agent'; role = 'comments'; }
    else if (c.inAside && !/(?:^|[\s_-])(note|callout|warning|tip)(?:$|[\s_-])/i.test(hint)) { keep = false; role = 'related_content'; }
    else {
      keep = c.inMain || ['heading', 'code', 'table', 'quote'].includes(c.kind) || (c.text.trim().length >= 40 && c.linkDensity < 0.65);
      role = keep ? 'main_content' : 'other';
    }
    decisions[c.id] = { keep, keepProbability: null, role, roleConfidence: null, needsReview: false };
  }
  return { method: 'heuristic', decisions, usage: emptyUsage(), warnings: ['Local heuristic baseline: no Jev request was made; these are not model predictions.'] };
};
