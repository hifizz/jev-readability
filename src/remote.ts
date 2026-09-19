import type { Classifier, ClassifyResult } from './types.js';
/** Browser adapter. Authenticate/authorize the endpoint on your own server. */
export function createRemoteClassifier(options: { endpoint: string; headers?: Record<string, string>; fetch?: typeof fetch }): Classifier {
  return async (input, runtime) => {
    const response = await (options.fetch || fetch)(options.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...options.headers },
      body: JSON.stringify(input), signal: runtime?.signal,
    });
    if (!response.ok) {
      let message = `Classifier endpoint returned HTTP ${response.status}`;
      try { const value: unknown = await response.json(); if (value && typeof value === 'object' && 'error' in value && typeof value.error === 'string') message += `: ${value.error.slice(0, 200)}`; } catch { /* Do not reflect arbitrary error HTML. */ }
      throw new Error(message);
    }
    const result = await response.json() as ClassifyResult;
    if (!result || !['jev', 'heuristic', 'custom'].includes(result.method) || !result.decisions || !Array.isArray(result.warnings) || !result.usage) throw new Error('Malformed classifier endpoint response');
    return result;
  };
}
