/** A deliberately small output format, not an arbitrary HTML sanitizer. */
const ALLOWED = new Set('p div section article header footer h1 h2 h3 h4 h5 h6 a strong b em i u s del sub sup span small mark time abbr br hr pre code kbd samp ul ol li dl dt dd blockquote figure figcaption img table caption thead tbody tfoot tr th td'.split(' '));
export const DROP = 'script,style,noscript,template,iframe,object,embed,svg,math,canvas,input,button,textarea,select,option,link,meta,base';
const DROP_TAGS = new Set(DROP.split(','));
const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export const compact = (s: string) => s.replace(/\s+/g, ' ').trim();

export function safeUrl(raw: string | null, base?: string | null, image = false): string | null {
  if (!raw || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  const value = raw.trim();
  if (!image && /^#[^\s]*$/.test(value)) return value;
  try {
    const url = new URL(value, base || undefined);
    if (!['http:', 'https:', ...(image ? [] : ['mailto:'])].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

/** Rebuild only allowlisted tags/attributes, escaping every text node. */
export function renderHtml(node: Node, base?: string | null): string {
  if (node.nodeType === 3) return escapeText(node.nodeValue ?? '');
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROP_TAGS.has(tag) || (el.namespaceURI && el.namespaceURI !== 'http://www.w3.org/1999/xhtml')) return '';
  const inner = () => Array.from(el.childNodes, child => renderHtml(child, base)).join('');
  if (!ALLOWED.has(tag)) return inner();
  const attrs: string[] = [];
  const add = (key: string, val: string | null) => { if (val !== null) attrs.push(` ${key}="${escapeAttr(val)}"`); };
  if (tag === 'a') {
    add('href', safeUrl(el.getAttribute('href'), base));
    add('title', el.getAttribute('title'));
    add('rel', 'noopener noreferrer');
  }
  if (tag === 'img') {
    // Omit data/blob URLs, srcset and tracking attributes. Hosts may still track image loads.
    add('src', safeUrl(el.getAttribute('src') || el.getAttribute('data-src'), base, true));
    add('alt', el.getAttribute('alt') ?? '');
    add('loading', 'lazy');
    add('referrerpolicy', 'no-referrer');
  }
  if (tag === 'code') {
    const language = el.getAttribute('class')?.match(/(?:^|\s)language-([\w+-]+)/)?.[1];
    if (language) add('class', `language-${language}`);
  }
  if (tag === 'th' || tag === 'td') {
    for (const key of ['colspan', 'rowspan']) {
      const value = el.getAttribute(key);
      if (value && /^\d{1,2}$/.test(value) && +value > 0) add(key, value);
    }
  }
  if (tag === 'ol') {
    const value = el.getAttribute('start');
    if (value && /^-?\d{1,5}$/.test(value)) add('start', value);
  }
  return `<${tag}${attrs.join('')}>${['br', 'hr', 'img'].includes(tag) ? '' : inner() + `</${tag}>`}`;
}

export function plainText(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROP_TAGS.has(tag)) return '';
  if (tag === 'img') return el.getAttribute('alt') || '';
  if (tag === 'br') return '\n';
  if (tag === 'pre') return el.textContent || '';
  const text = Array.from(el.childNodes, plainText).join('');
  if (['td', 'th'].includes(tag)) return text + '\t';
  return text + (/^(p|div|section|article|h[1-6]|li|dt|dd|tr|blockquote|figcaption)$/.test(tag) ? '\n' : '');
}
const mdText = (s: string) => s.replace(/[\\`*_\[\]<>#|]/g, '\\$&');
const fenceFor = (s: string) => '`'.repeat(Math.max(3, ...Array.from(s.matchAll(/`+/g), m => m[0].length + 1)));
const mdUrl = (s: string) => s.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\s/g, '%20').replace(/</g, '%3C').replace(/>/g, '%3E');

/** Markdown is a deterministic rendering of source nodes; Jev never writes prose. */
export function renderMarkdown(node: Node, base?: string | null, depth = 0): string {
  if (node.nodeType === 3) return mdText((node.nodeValue ?? '').replace(/\s+/g, ' '));
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROP_TAGS.has(tag) || (el.namespaceURI && el.namespaceURI !== 'http://www.w3.org/1999/xhtml')) return '';
  const children = () => Array.from(el.childNodes, child => renderMarkdown(child, base, depth)).join('');
  if (tag === 'pre') {
    const text = (el.textContent || '').replace(/\n$/, '');
    const fence = fenceFor(text);
    const language = el.querySelector('code')?.className.match(/language-([\w+-]+)/)?.[1] || '';
    return `\n\n${fence}${language}\n${text}\n${fence}\n\n`;
  }
  if (tag === 'code' || tag === 'kbd' || tag === 'samp') {
    const text = (el.textContent || '').replace(/\n/g, ' ');
    const fence = '`'.repeat(Math.max(1, ...Array.from(text.matchAll(/`+/g), m => m[0].length + 1)));
    const pad = /^`|`$|^ .* $/.test(text) ? ' ' : '';
    return `${fence}${pad}${text}${pad}${fence}`;
  }
  if (/^h[1-6]$/.test(tag)) return `\n\n${'#'.repeat(+tag[1]!)} ${children().trim()}\n\n`;
  if (tag === 'a') {
    const text = children().trim();
    const href = safeUrl(el.getAttribute('href'), base);
    return href ? `[${text}](${mdUrl(href)})` : text;
  }
  if (tag === 'img') {
    const alt = mdText(el.getAttribute('alt') || '');
    const src = safeUrl(el.getAttribute('src') || el.getAttribute('data-src'), base, true);
    return src ? `![${alt}](${mdUrl(src)})` : alt;
  }
  if (tag === 'strong' || tag === 'b') return `**${children()}**`;
  if (tag === 'em' || tag === 'i') return `*${children()}*`;
  if (tag === 'del' || tag === 's') return `~~${children()}~~`;
  if (tag === 'br') return '  \n';
  if (tag === 'hr') return '\n\n---\n\n';
  if (tag === 'blockquote') return '\n\n' + children().trim().split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
  if (tag === 'ul' || tag === 'ol') {
    const start = Number(el.getAttribute('start') || 1);
    return '\n' + Array.from(el.children).filter(e => e.tagName.toLowerCase() === 'li').map((li, i) => {
      const body = Array.from(li.childNodes, child => renderMarkdown(child, base, depth + 1)).join('').trim();
      const prefix = tag === 'ol' ? `${start + i}. ` : '- ';
      return prefix + body.split('\n').map((l, j) => j ? ' '.repeat(prefix.length) + l : l).join('\n');
    }).join('\n') + '\n\n';
  }
  if (tag === 'table') {
    const rows = Array.from(el.querySelectorAll('tr')).filter(tr => tr.closest('table') === el).map(tr =>
      Array.from(tr.children).filter(cell => /^(TD|TH)$/.test(cell.tagName)).map(cell =>
        Array.from(cell.childNodes, child => renderMarkdown(child, base, depth)).join('').trim().replace(/\n+/g, '<br>').replace(/(?<!\\)\|/g, '\\|')));
    const columns = Math.max(0, ...rows.map(r => r.length));
    if (!columns) return '';
    const row = (cells: string[]) => '| ' + Array.from({ length: columns }, (_, i) => cells[i] || '').join(' | ') + ' |';
    const caption = el.querySelector('caption')?.textContent?.trim();
    return '\n\n' + (caption ? mdText(caption) + '\n\n' : '') + row(rows[0]!) + '\n' + row(Array(columns).fill('---')) + '\n' + rows.slice(1).map(row).join('\n') + '\n\n';
  }
  if (/^(p|div|section|article|header|footer|figure|figcaption|dl|dt|dd)$/.test(tag)) return `\n\n${children().trim()}\n\n`;
  return children();
}
