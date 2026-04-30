# Development

Clean Architecture over Next.js 16 + Supabase + Cloudflare. See `PLAN.md` for product scope and the agent architecture; this file is the engineering rulebook.

## TL;DR — Key Rules

1. Entry points (`app/`) delegate to commands (`server/domain/`) — never contain business logic
2. Commands never call other commands; repositories never call other repositories
3. Vendor/external integrations go in `src/server/infra/*`, not `domain/`
4. Long-running agent work currently runs as exported functions inside `*.command.ts`, invoked via `ctx.waitUntil` from server actions. Migration to real Cloudflare Workflows under `workers/` is planned future work, not current state.
5. Use file suffixes: `.command.ts`, `.repository.ts`, `.action.ts`, `.service.ts`, `.view.tsx`, `.dto.ts`, `.prompt.ts`
6. Imports always use `@/` alias — no relative paths
7. `process.env` is only read inside `src/shared/config/*`
8. No `SELECT *` — select explicit fields for type safety and RLS compatibility
9. Use `supabaseUser()` by default; `supabaseAdmin()` only for cross-user/system operations
10. Run `npm run check:fix` to fix lint and format (Biome)
11. All colors in OKLCH; use shadcn components and Tailwind utilities
12. Prefer `const` over `let` — use IIFEs, ternaries, or helpers instead of reassignment
13. Stream agent output via Supabase Realtime broadcast + final row via `postgres_changes`. No SSE.
14. Pages are shells (no markup); views are primarily JSX; substantial logic (subscriptions, state machines, streaming) lives in co-located `use<Feature>.hook.ts`

## Directory Structure

```
src/
├── app/                            # Next.js App Router — entry points only
│   ├── _actions/                   # Server Actions ('use server')
│   ├── api/                        # Route handlers (small reads, external callbacks)
│   ├── auth/                       # OAuth callback + sign-out
│   ├── (app)/                      # Authed layout + routes
│   └── page.tsx                    # Landing (redirects to /subjects if signed in)
├── server/
│   ├── domain/{feature}/           # Business logic
│   │   ├── {feature}.command.ts    # Public entry points called by actions/routes
│   │   └── {feature}.repository.ts # Data access for these commands
│   ├── infra/                      # Vendor adapters (cloudflare, anthropic, ...)
│   │   └── {service}/{service}.service.ts
│   └── lib/                        # Shared backend utilities (auth, currentUser, llm, tools)
├── ui/
│   ├── components/                 # shadcn primitives + shared components
│   ├── css/                        # globals.css, colors.css (OKLCH tokens)
│   └── views/{feature}/            # Feature views — self-contained .view.tsx + components/hooks/types
├── shared/
│   ├── config/                     # Typed config + Zod env parsing (ONLY place that reads process.env)
│   └── lib/supabase/               # client.ts, server.ts, proxy.ts, supabase.types.ts
├── prompts/{skill}/                # Ported rf skill: {skill}.prompt.ts + {skill}.schema.ts
└── middleware.ts                   # Next.js edge middleware (refresh Supabase session)
supabase/                           # config.toml, migrations/, seed.sql
```

`workers/` (Cloudflare Workflow classes) is reserved for future migration but does not exist today — see the agent runtime section below.

## Domain Layer Rules

- **Commands**: execute business operations, coordinate repositories and services. Commands **never** call other commands (but may call repositories from other domains). Long-running agent work (e.g. interview turns, discover, landscape, deep-research) lives as exported functions inside `*.command.ts` and is invoked from server actions via `ctx.waitUntil(...)`.
- **Repositories**: data access scoped to a command. Never call other repositories.
  - `get${Name}()` throws when not found; `find${Name}()` returns `null`.
  - Order inside a repository file: Find/Get → Create → Update/Upsert → Delete.
- **Domain never depends on infrastructure** — `server/domain/*` imports from `server/infra/*` only via well-typed adapter interfaces.

## Infrastructure Layer Rules

- Vendor adapters (Anthropic, Cloudflare, web search, ...) live in `src/server/infra/*`.
- Services **never** call commands.
- Keep adapters replaceable — e.g. `web-search.service.ts` exposes a neutral interface so we can swap providers.

## Import Conventions

Always use the `@/` alias — never relative paths or `src/` prefixes.

```ts
// ✅
import { Button } from '@/ui/components/ui/button';
import { supabaseUser } from '@/shared/lib/supabase/server';

// ❌
import { Button } from '../../../ui/components/ui/button';
import * as Users from '@/server/domain/users/users.command';
```

No namespace imports. No default exports for shared modules (use named exports).

## Naming Conventions

```
conversation.action.ts       Server actions
conversation.command.ts      Business logic commands
conversation.repository.ts   Data access
conversation.service.ts      External integrations
conversation.schema.ts       Zod schemas + inferred types (pure contract)
conversation.dto.ts          API request/response types
conversation.prompt.ts       LLM system prompt text only (no schemas, no logic)
conversation.view.tsx        Feature views
useSomething.hook.ts         React hooks
message.types.ts             TypeScript types
```

## Variable Declarations

Prefer `const`. If a value depends on a condition, use a ternary, IIFE, or helper — don't reassign a `let`.

```ts
// ✅
const loaded = await (async () => {
  const existing = await findExisting(id);
  return existing ?? createNew(id);
})();

// ❌
let loaded;
if (condition) { loaded = await findExisting(id); } else { loaded = await createNew(id); }
```

## View / Hook / Page Separation

Presentation, logic, and routing are three separate concerns. Keep them in three different places — but be pragmatic about what counts as "logic."

- **Page** (`app/**/page.tsx`) — a shell. Resolves route params, fetches initial data via commands/repositories, renders a single view component. **No markup, no `<div>`, no Tailwind classes.**
- **View** (`*.view.tsx`) — primarily JSX. **At most one `.view.tsx` per feature folder** — the entry point called from the page. May contain trivial UI state (a disclosure toggle, a controlled input), small inline onClick wiring, and pure helper functions. **Should NOT contain substantial logic** — see below.
- **Component** (`*.component.tsx`) — a reusable DOM-manipulating piece (its own JSX). One component per file. Components scoped to a single view live in a `components/` subfolder under that feature (`ui/views/{feature}/components/`), mirroring the `hooks/` subfolder convention. Components shared across features live under `src/ui/components/`. Naming is `kebab-case.component.tsx`; the exported component is PascalCase.
- **Type** (`*.type.ts`) — a shared type or interface. One concept per file. Location follows scope: types crossing the server↔UI boundary live in `src/shared/`; UI-only types shared across multiple views live in `src/ui/types/`; UI-only types scoped to a single feature live in a `types/` subfolder alongside that feature (`ui/views/{feature}/types/`), mirroring the `components/` and `hooks/` subfolder convention. Naming is `kebab-case.type.ts`; the exported types are PascalCase.
- **Context** (`*.context.tsx`) — a React context provider, the context object itself, and any hook tightly coupled to it (`useThing()`). One context per file. Lives under `src/ui/components/` (shared) or alongside the consuming view. Naming is `kebab-case.context.tsx`; the exported provider is PascalCase (e.g. `CitationProvider`).
- **Util** (`*.util.ts`) — a pure helper function with no I/O and no framework dependencies. One concept per file. Lives under `src/server/lib/utils/` (server-only) or `src/shared/lib/utils/` (cross-runtime). Naming is `kebab-case.util.ts`.
- **Hook** (`use<Feature>.hook.ts`, under `ui/views/{feature}/hooks/`) — where substantial logic lives. Named `use<Feature>`, co-located with the view.
- **Layouts** (`app/**/layout.tsx`) may contain markup — they own cross-cutting chrome shared by multiple pages.

### What counts as "substantial logic" (extract to a hook)

- Real-time subscriptions (Supabase broadcast / `postgres_changes`, WebSocket, SSE)
- Multi-state flows or streaming state machines (status transitions: idle → streaming → complete → error)
- Orchestration of multiple hooks or calls (e.g. a workflow trigger that updates several pieces of state)
- Anything that would be testable or reusable on its own
- Anything that, if you read the view cold, makes the layout hard to see

### What can stay in the view

- A single `useState` for a local UI toggle
- A one-line `useEffect` (focus, scroll-into-view, a cheap mount check)
- Pure helper functions defined in the same file
- Inline event-handler wiring that calls hook-returned functions with small adaptations (e.g. `.catch(err => setErrorMessage(err.message))`)

The test: **would a reader have to understand the hook to understand what the view looks like?** If yes, too much logic in the view. If they can scan the JSX and know what renders without reading any effect bodies, the balance is right.

### Example (Todo app's `ramble.view.tsx` pattern)

```tsx
// ui/views/ramble/ramble.view.tsx — VIEW
'use client';

import { useRamble, type RambleInitialState } from '@/ui/views/ramble/hooks/useRamble.hook';

function instructionTitle(i: Instruction): string { /* pure helper, fine in view */ }

export function RambleView({ initialState }: { initialState: RambleInitialState }) {
  const { status, audioLevel, toggleListening, errorMessage, setErrorMessage } = useRamble({ initialState });
  return (
    <main>
      <Button onClick={() => toggleListening().catch((e) => setErrorMessage(e.message))}>
        {/* the *.catch inline is fine — it's just wiring */}
      </Button>
    </main>
  );
}
```

```ts
// ui/views/ramble/hooks/useRamble.hook.ts — HOOK: the state machine, VAD, parsing, etc.
'use client';

export function useRamble({ initialState }: { initialState: RambleInitialState }) {
  // Deepgram stream, VAD, parsing, execution queue — the actual meat
}
```

## React Hooks — Avoiding `useCallback` Chains

Cascading `useCallback` deps (wrapping one function forces another to wrap) are a smell.

1. Pass values as parameters instead of closing over state.
2. Use a `callbacksRef` pattern for handlers set once (WebSocket, Realtime channels).

`useCallback` with `[]` is fine — stable, no cascade.

## Authentication

Server actions: wrap with `withAuth` from `@/server/lib/utils/auth`. `userId` is injected as the first parameter.

```ts
export const createSubjectAction = withAuth(async (userId: string, seed: string) => {
  return createSubject(userId, seed);
});
```

For conditional/complex auth, call `requireAuth()` explicitly.

Protected pages should read the user via `findCurrentUser()` (returns `null`) or `getCurrentUser()` (throws). Both are cached per request via React `cache()`.

## Server Actions vs Direct Repository Calls

- **Server Actions** — mutations, operations with business logic, work involving external services, anything that needs `userId` injected.
- **Direct repository calls from server components** — simple reads that just hydrate a page.
- **Direct Supabase calls from client components** — real-time subscriptions and simple RLS-gated reads/writes.

Don't create a server action that just passes through to a repository — call the repo from the page.

## Agent Runtime

Long-running agent work (interview turns, discover, landscape, deep-research turns) currently runs as exported functions inside `*.command.ts`. Server actions trigger them via `ctx.waitUntil(...)` and return the entity id (e.g. `turnId`) synchronously so the client can subscribe to the broadcast channel. The function streams events on Supabase Realtime as it runs and persists final state to the DB on completion.

Migration to real Cloudflare Workflows under `workers/` (one `WorkflowEntrypoint` class per skill) is planned but deferred — there is no `workers/` directory today.

### Pattern

```ts
// src/server/domain/deep-research/deep-research.command.ts
export async function runDeepResearchTurn({ turnId, sessionId, userText }: RunTurnParams) {
  const supabase = supabaseAdmin();
  // Validate ownership before any write — supabaseAdmin() bypasses RLS.
  await assertSessionOwnedByCaller(supabase, sessionId);

  const messages = await loadTurnContext(sessionId);
  const channel = supabase.channel(`session:${sessionId}`);
  let seq = 0;

  const result = streamText({
    model: anthropic('claude-opus-4-7'),
    providerOptions: { anthropic: { thinking: { type: 'enabled', budgetTokens: 8000 } } },
    tools: { web_search },
    messages,
    onChunk: ({ chunk }) => {
      const ev = toTurnEvent(chunk, { turnId, seq: seq++ });
      if (ev) channel.send({ type: 'broadcast', event: 'event', payload: ev });
    },
  });

  const { text, reasoning, toolCalls } = await result.response;
  await persistTurn({ turnId, text, reasoning, toolCalls });
  channel.send({ type: 'broadcast', event: 'event', payload: { turnId, seq: seq++, type: 'complete' } });
}
```

### Rules

- Server actions trigger the function via `ctx.waitUntil(runX(...))` and return the entity id immediately. They do not block on LLM output.
- Externally-visible side effects (DB writes, LLM calls) should be idempotent where possible — even though we have no `step.do` checkpointing today, a future migration to Workflows will require it.
- Broadcast during the run; durable write on completion. Never rely on broadcast for durability.
- Agent functions use `supabaseAdmin()`. Although the captured cookie store may still be readable inside `waitUntil` via AsyncLocalStorage, JWT refresh writes fail post-response (`setAll` errors are swallowed in `supabaseUser()`), so the auth state is frozen at request-time and a long-running agent will break if the JWT expires mid-run. Always validate `user_id` matches the owning entity before any write.

## Supabase Realtime — Streaming Convention

Single transport for live agent output: **broadcast channel during the run + postgres_changes on completion**.

- **Channels are entity-scoped, long-lived.** Subscribe once on page mount — never per turn. Never per agent run. See `PLAN.md §3` for the channel naming table.
- **Every event carries a child id** (`turnId`, `topicId`, `landscapeId`) plus a monotonic `seq` so the client can route + detect gaps.
- **If the client drops mid-turn**, Realtime auto-reconnects; events in the gap are lost (ephemeral by design). The durable state lands via `postgres_changes` regardless.
- **Client composes two subscriptions** per entity page: one `broadcast` channel for live deltas, one `postgres_changes` subscription on the durable table filtered by entity id.
- **Broadcast channels default to `private: true`.** Construct with `{ config: { private: true } }` on both server sender and client subscriber, paired with a matching RLS policy on `realtime.messages` keyed off `realtime.topic()`. Public broadcasts are allowed only when the payload is already public by design (no per-user data) and the team has explicitly agreed to it.
- **Typed `postgres_changes` callbacks must use `RealtimePostgresChangesPayload<T>`** from `@supabase/supabase-js`. Never hand-roll the payload shape — it drifts from the library's contract (notably around `new` / `old` / `eventType` discrimination).

## Prompts Directory

Each rf skill in `/Users/marc/programing/perso/research-framwork/skills/*/SKILL.md` ports to its own folder under `src/prompts/{skill}/` with two files: `{skill}.prompt.ts` (system prompt text) and `{skill}.schema.ts` (structured-output contract). Keep them aligned with the source skill in spirit but feel free to diverge.

### `.prompt.ts` — system prompt text only

- Exports one or more `const` strings (e.g. `INIT_SUBJECT_SYSTEM_PROMPT`). That is all.
- **No** Zod schemas, **no** message builders, **no** helpers, **no** types derived from schemas, **no** imports beyond what's needed for the string itself (usually none).
- Think of it as a `.md` that happens to be typed — a reader should be able to copy-paste it into another runtime without pulling the rest of the repo.

### `.schema.ts` — structured-output contract

- Zod schemas + the types inferred from them (e.g. `agentStepSchema`, `AgentStep`). Imported by both the caller (the command) and any UI that renders the structured output.
- Pure — no I/O, no prompt text, no message construction.

### Message construction lives at the call site

Building `messages: CoreMessage[]` is domain logic: it pulls in entity state, history, per-turn context. That goes in the caller — the `.command.ts` that invokes the LLM. Do **not** put a `buildXxxMessages` function inside `.prompt.ts` or `.schema.ts`.

### Validating tool outputs at the boundary

Anthropic does **not** constrain-decode tool outputs against the `inputSchema` — the schema is *guidance* to the model, not enforcement. Drift happens, especially on `z.enum(...)` fields. Treat any `emitCall.input` (or other LLM-emitted structured payload) as untrusted and pass it through Zod before consuming it.

- **Always parse, never cast.** Use `mySchema.parse(emitCall.input)` at the boundary — never `emitCall.input as MyType`. A bare cast hides drift until it surfaces as a downstream type or DB error mid-run, often after partial state has been written.
- **Don't redefine schema-derived types.** Import the inferred type (`type X = z.infer<typeof xSchema>`) from `*.schema.ts` rather than re-declaring the same shape inline in a command. Local re-declarations silently fall out of sync when the schema changes (e.g. when an enum gains `.nullable()` for drift handling).
- **Use `.catch(default)` for soft enums** where drift should degrade gracefully instead of failing the run (e.g. category buckets, kind labels). Reserve hard `.parse()` failure for *structural* drift (missing required fields, wrong type, array bounds).

## When to Add a Server Action vs API Route

- **Server Action** — UI-driven mutations within this app.
- **API Route** — triggered by Cloudflare Workflows, called from external services, or needed by edge runtime. Co-locate `route.ts` with `route.dto.ts` for the shared request/response contract.

## UI Components & Styling

- **shadcn/ui** primitives under `src/ui/components/ui/*`. Install new ones with `npx shadcn@latest add <component>`.
- **Colors in OKLCH**, defined in `src/ui/css/colors.css` + `globals.css`. Use named Tailwind classes (`bg-ink-10`, `text-blue-70`) — never hex literals.
- Design tokens will be regenerated during Milestone 5. The current palette is placeholder.

## Database

### Table design rules

- Most fields **NOT NULL with defaults** — only nullable when genuinely optional in the business logic.
- Always include `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- Attach a `moddatetime` / `set_updated_at` trigger to every table with `updated_at`.
- Booleans: `NOT NULL DEFAULT true/false`. Arrays: `NOT NULL DEFAULT '{}'`. Avoid meaningless text defaults (`''`).

### Avoid `SELECT *`

- Type safety: explicit selects give you typed rows.
- RLS + column privileges may reject `*` where an explicit field list succeeds.

### Client selection

- `supabaseUser()` — user-context client, RLS applies. Default for server components and server actions.
- `supabaseAdmin()` — service role, bypasses RLS. Use in workflows, cross-user system operations, and system writes. **Always validate ownership in business logic when using it.**

### RLS

- Every user-owned table has RLS enabled and a policy keyed on `auth.uid()`.
- Use indexes on columns referenced by RLS predicates.
- See the `rls-conventions` skill for examples.

## Development Workflow

### First-time setup

```
npm install
cp .env.sample .env.local           # edit Google OAuth + ANTHROPIC_API_KEY
npm run db:start                     # starts local Supabase (Docker required)
```

Copy the `API URL` and keys from `npm run db:status` into `.env.local` (they're stable; do this once).

### Running locally

```
npm run db:start                     # Supabase (Postgres + Auth + Realtime)
npm run dev                          # Next.js (Turbopack)
npm run cf:preview                   # Cloudflare Workers preview (Miniflare)
```

Miniflare simulates Workers and Workflows locally — **no Cloudflare account needed for dev**.

### Schema changes

1. Modify schema via Supabase Studio at http://127.0.0.1:54323
2. `npm run db:migration:generate` — generate the migration file
3. `npm run db:types:generate` — regenerate `src/shared/lib/supabase/supabase.types.ts`
4. Commit migration + types together

### Editing vs creating migrations

**Default: always create a new migration file** via `npm run db:migration:new`. Once a migration is committed to git, treat it as immutable — staging/prod record it in `schema_migrations` and editing it causes history divergence that requires `supabase migration repair` to reconcile.

**Exception: uncommitted migrations.** If the migration you want to change is still in `git status` (modified or untracked, not yet committed), edit it in place and run `npm run db:reset`. The migration hasn't reached any remote, so iterating on it in-place is safe.

Decision rule:

```
git log --oneline -- supabase/migrations/<file>
# empty output → uncommitted → edit + db:reset
# has commits → committed → create new migration
```

### Rebasing with remote schema

- No conflicts → `npm run db:migration:up`
- Conflicts → delete your branch-only migration, `npm run db:reset`, re-apply via Studio, regenerate migration + types

## Testing

Deferred for MVP. Will return via Miniflare-backed integration tests post-MVP.

## Review Checklist

Single source of truth for `/review-code-change`. Each bullet is a rule to apply to a local diff. Explanations for each live in the relevant section above.

### Architecture

- Files use correct suffixes (`.command.ts`, `.repository.ts`, `.action.ts`, `.service.ts`, `.schema.ts`, `.prompt.ts`, `.view.tsx`, `.component.tsx`, `.context.tsx`, `.hook.ts`, `.type.ts`, `.util.ts`, etc.)
- Imports use `@/` alias — no relative paths or `src/` prefixes
- No namespace imports (`import * as X from …`); named exports only for shared modules. Exception: vendored shadcn/ui components may keep their upstream `import * as React` / `import * as RadixX` form.
- Commands don't call other commands
- Repositories don't call other repositories
- Services don't call commands (infra → domain is forbidden)
- Infra/vendor code lives under `src/server/infra/*`, not under `src/server/domain/*`
- Domain imports infra only via well-typed adapter interfaces

### Server layer

- Server actions use `withAuth()` or `requireAuth()`
- No server action that just passes through to a repository — call the repo directly from the page
- `supabaseUser()` by default; `supabaseAdmin()` only for cross-user/system work, paired with an explicit ownership check in the calling code
- Repository naming: `get${Name}()` throws when not found; `find${Name}()` returns `null`
- Repository file order: Find/Get → Create → Update/Upsert → Delete

### Code style

- Prefer `const` over `let` — use IIFEs, ternaries, or helpers instead of reassignment
- Avoid `useCallback` chains (cascading deps). Pass values as params, or use a `callbacksRef` for handlers set once. `useCallback` with `[]` is fine.

### Database

- No `SELECT *` in Supabase queries — select explicit fields
- `supabase.types.ts` is not manually edited
- Most fields are `NOT NULL` with defaults; only nullable when genuinely optional in the business logic (booleans default, arrays `'{}'`, avoid meaningless `''` defaults)
- New tables include `created_at` / `updated_at` TIMESTAMPTZ with `set_updated_at` / `moddatetime` trigger attached
- User-owned tables have RLS enabled and a policy keyed on `auth.uid()`, with indexes on the columns the policy references
- Migration edits target only uncommitted files (`git log --oneline -- <file>` empty). Any change to a committed migration is a new migration instead.

### Realtime

- Broadcast channels are `{ config: { private: true } }` by default on both sender and subscriber, with a matching RLS policy on `realtime.messages`. Public only when the use case explicitly requires it.
- `postgres_changes` callbacks are typed with `RealtimePostgresChangesPayload<T>` from `@supabase/supabase-js`, not hand-rolled payload shapes.

### Prompts

- `.prompt.ts` exports only `const` strings — no Zod, no helpers, no types, no message builders
- `.schema.ts` is pure — no I/O, no prompt text, no message construction
- Message construction (`messages: CoreMessage[]`) lives at the call site (`.command.ts`), not in `.prompt.ts` or `.schema.ts`
- LLM tool inputs (`emitCall.input` etc.) are validated with `schema.parse(...)` at the boundary — never `as Type` casts. Anthropic does not constrain-decode tool outputs, so drift must be caught explicitly.
- Types in commands are imported from `*.schema.ts` via `z.infer` — never re-declared locally with the same shape.
- Soft enums use `.catch(default)` for graceful degradation; structural fields rely on `.parse()` to throw on drift.

### Agent runtime

- Long-running agent work is exported from `*.command.ts` and triggered from server actions via `ctx.waitUntil(...)`. The action returns the entity id immediately; it does not block on LLM output.
- Agent functions use `supabaseAdmin()` and validate `user_id` against the owning entity before any write.
- Broadcast during the run; durable write on completion. Never rely on broadcast for durability.

### UI

- Pages (`app/**/page.tsx`) contain no markup — only data resolution + a single view render. Layouts may have markup.
- Each feature folder under `ui/views/{feature}/` has at most one `*.view.tsx` — the entry point called from the page. Sub-components scoped to that view live in `ui/views/{feature}/components/` (mirrors the `hooks/` subfolder), one component per file. Components shared across features live under `src/ui/components/`. UI-only types scoped to that view live in `ui/views/{feature}/types/` (one concept per file); UI-only types shared across multiple views live in `src/ui/types/`; types crossing the server/UI boundary live in `src/shared/`.
- Views (`*.view.tsx`) are primarily JSX. Substantial logic — real-time subscriptions (Supabase broadcast / `postgres_changes`, WebSocket), streaming state machines, multi-step flows, orchestration — must live in a co-located `use<Feature>.hook.ts` under `ui/views/{feature}/hooks/`. Trivial UI state (a disclosure toggle, a one-line `useEffect` for focus) can stay in the view. Test: would a reader need to read effect bodies to understand what the view renders?
- Hooks are named `use<Feature>.hook.ts`, co-located with the view, and export one `use<Feature>()` function.
- UI components prefer Shadcn — no unnecessary custom components
- Colors use OKLCH tokens via named Tailwind classes — no hex literals in JSX/CSS

### Secrets & config

- No secrets or hardcoded API keys
- `process.env` is only read inside `src/shared/config/*`
