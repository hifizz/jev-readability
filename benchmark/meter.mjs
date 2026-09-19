/** Counts every HTTP attempt before dispatch. Never stores credentials or response content. */
export class BudgetError extends Error { constructor() { super('Global benchmark request/byte budget exhausted'); this.name = 'BudgetError'; } }
export function createMeter({ maxRequests = 2400, maxBytes = 120_000_000, expectedModel }, baseFetch = globalThis.fetch) {
  if (![maxRequests, maxBytes].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Invalid global HTTP budget');
  const all = [], scope = { current: null };
  const summarize = entries => {
    const successes = entries.filter(e => e.status >= 200 && e.status < 300);
    const knownIn = successes.filter(e => Number.isSafeInteger(e.inputTokens));
    const knownOut = successes.filter(e => Number.isSafeInteger(e.outputTokens));
    return { requests: entries.length, requestBytes: entries.reduce((n, e) => n + e.bytes, 0), successfulResponses: successes.length,
      failedOrUnknownAttempts: entries.length - successes.length,
      responsesMissingInputUsage: successes.length - knownIn.length, responsesMissingOutputUsage: successes.length - knownOut.length,
      knownInputTokens: knownIn.reduce((n, e) => n + e.inputTokens, 0), knownOutputTokens: knownOut.reduce((n, e) => n + e.outputTokens, 0),
      tokenAccountingComplete: entries.length > 0 && successes.length === entries.length && knownIn.length === successes.length && knownOut.length === successes.length,
      models: [...new Set(successes.map(e => e.model).filter(Boolean))] };
  };
  let bytes = 0;
  const meteredFetch = async (url, init) => {
    if (String(url) !== 'https://api.typesafe.ai/v1/systemone') throw new Error('Unexpected JEV endpoint');
    const n = Buffer.byteLength(String(init.body));
    if (all.length >= maxRequests || bytes + n > maxBytes) throw new BudgetError();
    const entry = { scope: scope.current, bytes: n, status: null, model: null, inputTokens: null, outputTokens: null };
    all.push(entry); bytes += n;
    const response = await baseFetch(url, init);
    entry.status = response.status;
    if (response.ok) {
      try {
        const data = await response.clone().json();
        entry.model = typeof data.model === 'string' ? data.model : null;
        for (const [dest, key] of [['inputTokens', 'input_tokens'], ['outputTokens', 'output_tokens']]) {
          const value = data.usage?.[key];
          if (Number.isSafeInteger(value) && value >= 0) entry[dest] = value;
        }
      } catch { /* Client validates malformed responses; missing accounting stays unknown. */ }
      if (expectedModel && entry.model && entry.model !== expectedModel) {
        await response.body?.cancel();
        const error = new Error('Returned model differs from pinned benchmark model'); error.name = 'ModelMismatchError'; throw error;
      }
    }
    return response;
  };
  return { fetch: meteredFetch, setScope: name => { scope.current = name; }, snapshot: name => summarize(name === undefined ? all : all.filter(e => e.scope === name)), limits: { maxRequests, maxBytes } };
}
