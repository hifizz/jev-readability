import { assertMode, positiveInteger } from './types.js';
import type { Candidate, BlockKind, PageMetadata, PrepareOptions, PreparedPage, PreparedBlock } from './types.js';
import { DROP, compact, plainText, renderHtml, renderMarkdown, safeUrl } from './render.js';

const ATOMIC = new Set('p h1 h2 h3 h4 h5 h6 pre table ul ol dl blockquote figure'.split(' '));
const INLINE = new Set('a abbr b bdi bdo br cite code data del dfn em i img ins kbd mark q rp rt ruby s samp small span strong sub sup time u var wbr'.split(' '));
const kindOf = (tag: string): BlockKind => /^h[1-6]$/.test(tag) ? 'heading' : tag === 'p' ? 'paragraph' : tag === 'pre' ? 'code' : tag === 'table' ? 'table' : ['ul', 'ol', 'dl'].includes(tag) ? 'list' : tag === 'blockquote' ? 'quote' : tag === 'figure' || tag === 'img' ? 'figure' : 'text';
const hint = (el: Element) => [el.tagName.toLowerCase(), el.getAttribute('id')?.slice(0, 80), el.getAttribute('class')?.slice(0, 100), el.getAttribute('role')?.slice(0, 30)].filter(Boolean).join(' ');
function chain(el: Element): Element[] { const result: Element[] = []; for (let e: Element | null = el; e; e = e.parentElement) result.push(e); return result; }
function metadata(doc: Document, url?: string): PageMetadata {
  const meta = (selector: string) => doc.querySelector(selector)?.getAttribute('content')?.trim() || null;
  return {
    title: meta('meta[property="og:title"]') || (doc.querySelector('main h1, article h1') || doc.querySelector('h1'))?.textContent?.trim() || doc.title?.trim() || '',
    url: url ? safeUrl(url) : null,
    author: meta('meta[name="author"]') || meta('meta[property="article:author"]'),
    publishedAt: meta('meta[property="article:published_time"]') || doc.querySelector('article time[datetime], main time[datetime]')?.getAttribute('datetime') || null,
    language: doc.documentElement?.getAttribute('lang') || null,
  };
}

export function prepare(input: string | Document, options: PrepareOptions = {}): PreparedPage {
  const start = performance.now();
  const mode = options.mode || 'article'; assertMode(mode);
  const maxHtml = positiveInteger(options.maxHtmlCharacters ?? 2_000_000, 'maxHtmlCharacters');
  const maxElements = positiveInteger(options.maxElements ?? 30_000, 'maxElements');
  const maxBlocks = positiveInteger(options.maxBlocks ?? 500, 'maxBlocks');
  const maxDepth = positiveInteger(options.maxDepth ?? 100, 'maxDepth');
  const html = typeof input === 'string' ? input : input.documentElement.outerHTML;
  if (html.length > maxHtml) throw new Error(`HTML exceeds maxHtmlCharacters (${maxHtml}); no silent truncation was performed`);
  let doc: Document;
  if (typeof input !== 'string') doc = input.cloneNode(true) as Document;
  else if (options.parseDocument) doc = options.parseDocument(input);
  else if (typeof DOMParser !== 'undefined') doc = new DOMParser().parseFromString(input, 'text/html');
  else throw new Error('This runtime has no DOMParser. Import jev-readability/node with linkedom installed, or supply parseDocument.');
  if (!doc?.documentElement) throw new Error('parseDocument must return an HTML Document');
  const elements = Array.from(doc.querySelectorAll('*'));
  if (elements.length > maxElements) throw new Error(`HTML exceeds maxElements (${maxElements})`);
  // Guard recursion before visiting or serializing nested input.
  for (const el of elements) {
    let depth = 0;
    for (let p: Element | null = el; p; p = p.parentElement) if (++depth > maxDepth) throw new Error(`DOM exceeds maxDepth (${maxDepth})`);
  }
  const sourceUrl = options.url || (typeof input !== 'string' && /^https?:/.test(input.URL) ? input.URL : undefined);
  const pageMetadata = metadata(doc, sourceUrl);
  const warnings: string[] = [];
  if (sourceUrl && !pageMetadata.url) warnings.push('Invalid or unsupported page URL; relative links may be omitted.');
  doc.querySelectorAll(DROP).forEach(e => e.remove());
  doc.querySelectorAll('[hidden],[aria-hidden="true"],[style]').forEach(e => {
    const style = e.getAttribute('style') || '';
    if (e.hasAttribute('hidden') || e.getAttribute('aria-hidden') === 'true' || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important)?\s*(?:;|$)/i.test(style)) e.remove();
  });
  const blocks: PreparedBlock[] = [];
  let heading = '';
  const emit = (node: Element, context: Element) => {
    const tag = node.tagName.toLowerCase();
    const kind = kindOf(tag);
    const raw = plainText(node);
    const text = kind === 'code' ? raw : raw.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text.trim() && !node.querySelector('img[alt]')) return;
    if (blocks.length >= maxBlocks) throw new Error(`Page exceeds maxBlocks (${maxBlocks}); increase the limit instead of silently losing content`);
    const parents = chain(context);
    const hints = parents.slice(0, 6).map(hint);
    const allHints = parents.map(hint).join(' ');
    const links = (node.matches('a') ? [node] : Array.from(node.querySelectorAll('a')));
    const linked = links.reduce((n, a) => n + compact(a.textContent || '').length, 0);
    const candidate: Candidate = {
      id: `b${String(blocks.length + 1).padStart(4, '0')}`, order: blocks.length, kind, tag, text,
      ancestorHints: hints, heading: kind === 'heading' ? text : heading,
      linkDensity: Math.min(1, linked / Math.max(1, compact(text).length)),
      inMain: parents.some(e => /^(MAIN|ARTICLE)$/.test(e.tagName) || e.getAttribute('role') === 'main'),
      inNavigation: parents.some(e => e.tagName === 'NAV' || e.getAttribute('role') === 'navigation'),
      inAside: parents.some(e => e.tagName === 'ASIDE' || e.getAttribute('role') === 'complementary'),
      inFooter: parents.some(e => e.tagName === 'FOOTER' || e.getAttribute('role') === 'contentinfo'),
      inComments: /(?:^|[\s_-])(comments?|replies|discussion)(?:$|[\s_-])/i.test(allHints),
    };
    if (kind === 'heading') heading = text;
    blocks.push({ candidate, html: renderHtml(node, pageMetadata.url), markdown: renderMarkdown(node, pageMetadata.url).trim() });
  };
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (ATOMIC.has(tag)) { emit(el, el); return; }
    // Non-overlapping leaf/run partition: no parent/child duplication, no lost direct text.
    let inline: Node[] = [];
    const flush = () => {
      if (!inline.length) return;
      const wrapper = doc.createElement('div');
      inline.forEach(n => wrapper.appendChild(n.cloneNode(true)));
      emit(wrapper, el); inline = [];
    };
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 3) { inline.push(child); continue; }
      if (child.nodeType !== 1) continue;
      const c = child as Element;
      if (INLINE.has(c.tagName.toLowerCase()) && !c.querySelector('p,div,section,article,pre,table,ul,ol,h1,h2,h3,h4,h5,h6')) inline.push(c);
      else { flush(); walk(c); }
    }
    flush();
  };
  walk(doc.body || doc.documentElement);
  if (!blocks.length) warnings.push('No readable DOM blocks found. This may be an empty page or an unrendered SPA.');
  if (blocks.some(b => /(?:rowspan|colspan)=/.test(b.html))) warnings.push('Merged table cells are preserved in HTML, but Markdown tables flatten their layout.');
  return { metadata: pageMetadata, mode, blocks, warnings, inputCharacters: html.length, prepareMs: performance.now() - start };
}
