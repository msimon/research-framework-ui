// Temporary instrumentation to figure out the actual shape of Anthropic's
// citation events vs. the model's `<cite index="...">` tags. Logs:
//   - every `source` chunk (citation-flavored AND search-result-flavored)
//   - every web_search `tool-call` (the search query) and `tool-result` (the
//     full list of returned search results, with their internal positions)
//   - every text-delta that contains a `<cite` token (so we can see the
//     model's index attribute values in context)
//
// Grep with `[citation-debug]` to extract the full trace from server logs.
// Remove once we've decided on the canonical cite-tag → citation mapping.
export function logCitationDebug(label: string, chunk: unknown): void {
  console.info(`[citation-debug:${label}] ${stringify(chunk)}`);
}

// JSON.stringify with any field whose key starts with `encrypted` redacted
// to `_encrypted_`. Keeps logs readable — Anthropic's web_search results
// pack a multi-kilobyte base64 `encryptedContent` blob per result.
function stringify(value: unknown): string {
  return JSON.stringify(value, (key, val) => (key.startsWith('encrypted') ? '_encrypted_' : val));
}
