import { extract as extractCore } from './index.js';
import { createJevClassifier } from './jev.js';
import type { JevOptions } from './jev.js';
import type { ExtractOptions, ExtractionResult } from './types.js';
export interface NodeExtractOptions extends ExtractOptions {
  apiKey?: string;
  jev?: Omit<JevOptions, 'apiKey'>;
}
/** Node convenience entrypoint; install optional peer dependency `linkedom`. */
export async function extract(html: string, options: NodeExtractOptions = {}): Promise<ExtractionResult> {
  let parseDocument = options.parseDocument;
  if (!parseDocument) {
    let parser: typeof import('linkedom');
    try { parser = await import('linkedom'); }
    catch { throw new Error('Node HTML parsing requires the optional peer dependency: npm install linkedom. Browser/demo use needs no dependency.'); }
    parseDocument = input => {
      // linkedom accepts documents; explicitly wrap fragments to obtain a real body.
      const documentHtml = /<html[\s>]/i.test(input) ? input : /<body[\s>]/i.test(input) ? `<html>${input}</html>` : `<html><head></head><body>${input}</body></html>`;
      return parser.parseHTML(documentHtml).document;
    };
  }
  const processLike = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  const classifier = options.strategy === 'heuristic' ? undefined : options.classifier || createJevClassifier({ ...options.jev, apiKey: options.apiKey || processLike?.env?.TYPESAFE_API_KEY || '' });
  return extractCore(html, { ...options, parseDocument, classifier });
}
export { createJevClassifier } from './jev.js';
export * from './types.js';
