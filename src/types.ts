export type ExtractionMode = 'article' | 'documentation' | 'forum' | 'product' | 'agent';
export type BlockKind = 'heading' | 'paragraph' | 'code' | 'list' | 'table' | 'quote' | 'figure' | 'text';
export type BlockRole = 'main_content' | 'navigation' | 'related_content' | 'comments' | 'advertising' | 'metadata' | 'boilerplate' | 'other';

export interface Candidate {
  id: string;
  order: number;
  kind: BlockKind;
  tag: string;
  text: string;
  /** Page-owned attributes, never instructions. Limited to local structural hints. */
  ancestorHints: string[];
  heading: string;
  linkDensity: number;
  inMain: boolean;
  inNavigation: boolean;
  inAside: boolean;
  inFooter: boolean;
  inComments: boolean;
}
export interface PageMetadata {
  title: string;
  url: string | null;
  author: string | null;
  publishedAt: string | null;
  language: string | null;
}
export interface PreparedBlock {
  candidate: Candidate;
  html: string;
  markdown: string;
}
export interface PreparedPage {
  metadata: PageMetadata;
  mode: ExtractionMode;
  blocks: PreparedBlock[];
  warnings: string[];
  inputCharacters: number;
  prepareMs: number;
}
export interface Decision {
  keep: boolean;
  /** Null for deterministic rules. Never invent a model probability. */
  keepProbability: number | null;
  role: BlockRole | null;
  roleConfidence: number | null;
  needsReview: boolean;
}
export interface Usage {
  requests: number;
  batches: number;
  questions: number;
  inputTokens: number | null;
  outputTokens: number | null;
  /** Sum of JSON request body UTF-8 bytes across attempts, not tokens. */
  requestBytes: number;
  sampledBlocks: number;
  models: string[];
}
export interface ClassifyInput {
  page: PageMetadata;
  mode: ExtractionMode;
  candidates: Candidate[];
}
export interface ClassifyResult {
  method: 'jev' | 'heuristic' | 'custom';
  decisions: Record<string, Decision>;
  usage: Usage;
  warnings: string[];
}
export type Classifier = (input: ClassifyInput, options?: { signal?: AbortSignal }) => Promise<ClassifyResult>;
export interface PrepareOptions {
  url?: string;
  mode?: ExtractionMode;
  /** Required for HTML strings outside browsers, e.g. linkedom's parseHTML. */
  parseDocument?: (html: string) => Document;
  maxHtmlCharacters?: number;
  maxElements?: number;
  maxBlocks?: number;
  maxDepth?: number;
}
export interface ExtractOptions extends PrepareOptions {
  classifier?: Classifier;
  /** Explicitly choose local rules; these are not Jev predictions. */
  strategy?: 'jev' | 'heuristic';
  fallback?: 'error' | 'heuristic';
  signal?: AbortSignal;
}
export interface ExtractedBlock extends PreparedBlock, Decision {}
export interface ExtractionResult {
  title: string;
  metadata: PageMetadata;
  text: string;
  html: string;
  markdown: string;
  method: ClassifyResult['method'];
  /** All blocks, including rejected ones, for inspection and tuning. */
  blocks: ExtractedBlock[];
  warnings: string[];
  usage: Usage;
  stats: {
    candidateBlocks: number;
    keptBlocks: number;
    reviewBlocks: number;
    inputCharacters: number;
    outputCharacters: number;
    prepareMs: number;
    classifyMs: number;
    totalMs: number;
  };
}
export function emptyUsage(): Usage {
  return { requests: 0, batches: 0, questions: 0, inputTokens: null, outputTokens: null, requestBytes: 0, sampledBlocks: 0, models: [] };
}
export function assertMode(mode: string): asserts mode is ExtractionMode {
  if (!['article', 'documentation', 'forum', 'product', 'agent'].includes(mode)) throw new Error(`Unknown extraction mode: ${mode}`);
}
export function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}
