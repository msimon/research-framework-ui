# Enable adaptive thinking with `display: omitted`

## Problem

Production currently runs Claude Opus 4.7 with thinking effectively disabled. `src/server/infra/anthropic/anthropic.client.ts` sets only `effort: serverConfig.llm.effort` on the provider options:

```ts
export const anthropicProviderOptions = {
  effort: serverConfig.llm.effort,
} satisfies AnthropicProviderOptions;
```

The AI SDK's request builder only includes a `thinking` field in the API call when `thinking.type` is explicitly set (verified at `node_modules/@ai-sdk/anthropic/dist/index.mjs:2122–2148` for `@ai-sdk/anthropic@2.0.77`). `effort` alone sends `output_config: { effort: 'high' }` with NO thinking config. Anthropic's server does NOT auto-enable thinking when only `output_config.effort` is set — even on opus-4-7. The "`display: omitted` is the default on opus-4-7" line from Anthropic docs only applies once thinking is explicitly turned on.

Practical consequence: the model emits a preamble narration (e.g. `"I'll research the latest developments in Medicare Advantage star ratings."`) as regular `text` content blocks before getting to the actual landscape/findings output. The `deep-research.command.ts` flow has a `# Findings` regex marker (`FINDINGS_MARKER`) that strips this preamble from the broadcast stream; landscape has no equivalent and its preamble leaks all the way to the rendered markdown.

## Fix

In `src/server/infra/anthropic/anthropic.client.ts`:

```ts
export const anthropicProviderOptions = {
  thinking: { type: 'adaptive', display: 'omitted' },
  effort: serverConfig.llm.effort,
} satisfies AnthropicProviderOptions;
```

Effects (verified by `scripts/citation-diagnostic.mjs` against opus-4-7):
- The model shifts its preamble narration into the `thinking` content block channel.
- `display: omitted` tells the API to skip streaming thinking tokens entirely (only sends `content_block_start` / `content_block_stop` markers + signature for multi-turn). About 1.3s faster than `display: summarized`.
- First user-visible `text-delta` is the real content (e.g. `# Medicare Advantage Star Ratings...`).
- Total turn latency is unchanged — the thinking happens during the web_search wait time either way.

## Cleanup that becomes possible

- Remove `FINDINGS_MARKER` regex + `pending` / `markerFound` buffer logic in `src/server/domain/deep-research/deep-research.command.ts` (the `runDeepResearchTurn` `onChunk` text-delta branch).
- Remove the "**CRITICAL — findings marker.** The first two lines of your findings markdown MUST be exactly `# Findings` …" instruction from `src/prompts/deep-research/deep-research.prompt.ts`.
- Skip adding the equivalent `# Landscape` marker workaround we considered for `landscapes.command.ts`.

## Verification

Before/after, run:

```bash
npm run diag:citations -- "<test question>" omitted
```

Inspect the resulting `Anthropic-thinking-omitted-*.jsonl` and `Landscape-ai-sdk-thinking-omitted-*.jsonl` files. The first `text_delta` should be the canonical heading (`# ...`), not preamble. Counts of `thinking` content blocks should be > 0 (presence of start/stop markers without thinking content streamed).

The diagnostic script supports four modes for comparison: `off`, `effort_only` (matches current production), `summarized`, `omitted`. Run them and check the summary table for TTFT differences.

## Out of scope here

This is independent of the citation work in PR #3 — it's a separate behavioral change that touches the broader chat completion surface. Land it as its own change after the citation PR merges, then re-baseline `scripts/citation-diagnostic.mjs` outputs against the new defaults.
