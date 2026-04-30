# "More topics arriving…" loading indicator is static and uninformative

## Symptom

When the user triggers "Find more" (the narrow-topics input) on a subject that already has topics, the loading state is a one-line `<p>More topics arriving…</p>` (`topics-section.view.tsx:94`) — the trailing `…` is **literal text, not animated**, there's no elapsed-time counter, no estimate of how long the call usually takes, and no echo of the hint the user just typed.

Compare with the **initial** discover state (`DiscoverThinking` component, `topics-section.view.tsx:176-207`), which gets the full treatment: pulsing dot, animated `…` cycling 0–3 dots every 400ms, live elapsed seconds, a paragraph explaining what's being surfaced, and an expected duration ("This usually takes 60–120 seconds.").

The two code paths are inconsistent: the user gets a rich loading screen the first time and a flat one-liner every subsequent time, even though the underlying server work is identical and takes just as long.

## Reproduction

1. Open a subject that already has discovered topics.
2. In the "Missing a topic you had in mind?" row, type a hint and click **Find more**.
3. Observe the indicator below the topic list: static text, no motion, no time signal. It's easy to assume nothing is happening — especially since narrowing typically takes 30–90 seconds.

## Recommended fix

Replace the static line with a compact variant of `DiscoverThinking` suited for in-list rendering (the existing `DiscoverThinking` is a centered, padded block — too big to drop above an existing topic list). The compact variant should include:

- **Animated dots** — same `useState` + `setInterval` cycling pattern already in `DiscoverThinking` (lines 177-183, 185).
- **Elapsed seconds** — `Date.now() - startRef.current` ticking, same pattern.
- **The hint, if one was provided** — e.g. `Narrowing on "payer-side economics"… 12s · usually 30–90s`. The hint lives in `discover_hint` on the topic; pass the *just-submitted* hint down from `NarrowTopicsRow` so the indicator can show it without waiting for a topic row to land.
- **Expected duration** — narrowing-with-hint is typically faster than the initial wide discovery; "30–90s" is a reasonable estimate. Verify against actual `[discover]` log timings before committing the number.
- **Pulsing dot** — same `bg-primary animate-pulse` accent used in `DiscoverThinking:191`.

Implementation sketch: extract the dot-tick + elapsed-tick logic from `DiscoverThinking` into a shared `useTickingState({ intervalMs: 400 })` hook (or co-located util), then render two presentations — the existing centered block for `!hasTopics`, and a new inline horizontal strip for `hasTopics`.

## Out of scope

- Replacing the JS `setInterval` with pure CSS keyframes for the dots (current approach is fine; refactor only if it becomes a perf concern).
- Reading actual server-side timing from past discover runs to compute a per-subject expected duration. Static range is fine for now.
- Cancelling an in-flight discover from the UI.
