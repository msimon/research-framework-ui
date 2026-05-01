# Source-trust URL lookup — batch by encoded query-string size, not entry count

## Problem

`findSourceTrustByUrls` in `src/server/domain/source-trust/source-trust.repository.ts` chunks URL lookups into batches of 30 to keep PostgREST's `.in('url', [...])` query string under the proxy's ~6KB URI limit:

```ts
const URL_BATCH_SIZE = 30;
```

The cap is on **entry count**, not on **encoded byte size**. URLs with heavy tracking parameters (UTM tags, ad-network click IDs, base64-ish blobs) routinely run 500B–1KB each once URL-encoded. A batch of 30 such URLs builds a query string well past the 6KB ceiling, and PostgREST / the proxy returns `414 URI Too Long` before any of the parallel requests even reach the database.

Result: landscapes and deep-research sessions whose sources are tracking-heavy (news aggregators, syndicated links, ad-tech-laden pages) still fail to load trust rows despite the chunking fix that motivated `URL_BATCH_SIZE = 30`. The whole `findSourceTrustByUrls` call throws, and the caller has no fallback.

## Fix

### Pack batches by encoded size, not by entry count

Replace the fixed 30-entry cap with a byte-budget loop that measures each URL's contribution to the final query string (`url=in.(...)` with comma separators, percent-encoded). Target a safe budget — e.g. **4KB** of encoded URL payload per batch — to leave headroom for the rest of the URL (host, path, other params, headers the proxy counts toward the limit).

```ts
const URL_BATCH_BYTE_BUDGET = 4096;

function chunkByEncodedSize(urls: ReadonlyArray<string>): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentBytes = 0;
  for (const url of urls) {
    const encodedSize = encodeURIComponent(url).length + 1; // +1 for the comma
    if (current.length > 0 && currentBytes + encodedSize > URL_BATCH_BYTE_BUDGET) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(url);
    currentBytes += encodedSize;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}
```

A single URL longer than the budget still goes in its own batch — that's fine, PostgREST will accept one giant value; the failure mode is *aggregate* size, not per-value size.

### Keep the parallel `Promise.all` shape

The existing `Promise.all(batches.map(...))` structure stays. Only the batching strategy changes.

## Why not just lower `URL_BATCH_SIZE`?

A lower entry cap (say 10) would mask the bug for typical URLs but still fail for pathological cases, and it would needlessly fragment requests for short URLs. Sizing by encoded bytes is the actual constraint the proxy enforces — match the constraint directly.

## Out of scope

- Falling back to a POST-based lookup (PostgREST does not support `.in()` over POST without RPC; would require a server-side RPC or a different access pattern).
- Trimming tracking params before lookup. Tempting, but the trust row is keyed on the exact URL the agent emitted; rewriting at lookup time would silently miss rows or hit the wrong row. If we want canonical-URL trust, that's a separate, larger change to the classifier and repository.
- Touching `upsertSourceTrustRows` — the body uses POST, so it isn't subject to the URI limit.
