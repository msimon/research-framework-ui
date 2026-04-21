# Development

Clean Architecture over Next.js 16 + Supabase + Cloudflare. See `PLAN.md` for product scope and the agent architecture; this file is the engineering rulebook.

## TL;DR — Key Rules

1. Entry points (`app/`) delegate to commands (`server/domain/`) — never contain business logic
2. Commands never call other commands; repositories never call other repositories
3. Vendor/external integrations go in `src/server/infra/*`, not `domain/`
4. Cloudflare Workflows live in `workers/` and are the sole runtime for long-running agent work
5. Use file suffixes: `.command.ts`, `.repository.ts`, `.action.ts`, `.service.ts`, `.view.tsx`, `.dto.ts`, `.prompt.ts`, `.workflow.ts`
6. Imports always use `@/` alias — no relative paths
7. `process.env` is only read inside `src/shared/config/*`
8. No `SELECT *` — select explicit fields for type safety and RLS compatibility
9. Use `supabaseUser()` by default; `supabaseAdmin()` only for cross-user/system operations
10. Run `npm run check:fix` to fix lint and format (Biome)
11. All colors in OKLCH; use shadcn components and Tailwind utilities
12. Prefer `const` over `let` — use IIFEs, ternaries, or helpers instead of reassignment
13. Stream agent output via Supabase Realtime broadcast + final row via `postgres_changes`. No SSE.

## Directory Structure

```
src/
├── app/                            # Next.js App Router — entry points only
│   ├── _actions/                   # Server Actions ('use server')
│   ├── api/                        # Route handlers (trigger workflows, small reads)
│   ├── auth/                       # OAuth callback + sign-out
│   ├── (app)/                      # Authed layout + routes
│   └── page.tsx                    # Landing (redirects to /subjects if signed in)
├── server/
│   ├── domain/{feature}/           # Business logic
│   │   ├── {feature}.command.ts    # Public entry points called by actions/routes
│   │   ├── {feature}.execution.ts  # Optional: extracted internal workflows
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
workers/                            # Cloudflare Workflow classes (e.g. DeepResearchTurnWorkflow)
supabase/                           # config.toml, migrations/, seed.sql
```

## Domain Layer Rules

- **Commands**: execute business operations, coordinate repositories and services. Commands **never** call other commands (but may call repositories from other domains).
- **Execution files** (optional): internal workflows extracted from commands for clarity/reuse. Commands remain the public entry points.
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
conversation.workflow.ts     Cloudflare Workflow class
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

## Cloudflare Workflows — Agent Runtime

All long-running agent work (interview turns, discover, landscape, deep-research turns) runs as a Cloudflare Workflow. One uniform primitive — no Durable Objects, no direct server-action-runs-the-LLM.

### Why Workflows

- Durable state survives restarts/deploys (each `step.do` checkpoint is cached).
- One runtime for every skill → one mental model.
- Event streaming stays decoupled from the HTTP response — the route handler returns immediately with a `turnId`, the workflow does the work, the client listens on a Supabase channel.

### Pattern

```ts
// workers/deep-research-turn.workflow.ts
export class DeepResearchTurnWorkflow extends WorkflowEntrypoint<Env, TurnParams> {
  async run(event: WorkflowEvent<TurnParams>, step: WorkflowStep) {
    const { turnId, sessionId, userText } = event.payload;

    const messages = await step.do('load-context', () => loadTurnContext(sessionId));

    await step.do('agent-loop', async () => {
      const supabase = supabaseAdmin();
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
    });
  }
}
```

### Rules

- One workflow class per skill. Bind in `wrangler.jsonc`, trigger via a route handler.
- Workflows are **idempotent per step** — wrap any externally-visible side effect (DB write, LLM call) in `step.do(...)`.
- Broadcast during the run; durable write on completion. Never rely on broadcast for durability.
- Workflows use `supabaseAdmin()` (no user cookies inside a worker). Always validate `user_id` matches the owning entity before writing.

## Supabase Realtime — Streaming Convention

Single transport for live agent output: **broadcast channel during the run + postgres_changes on completion**.

- **Channels are entity-scoped, long-lived.** Subscribe once on page mount — never per turn. Never per workflow-run. See `PLAN.md §3` for the channel naming table.
- **Every event carries a child id** (`turnId`, `topicId`, `landscapeId`) plus a monotonic `seq` so the client can route + detect gaps.
- **If the client drops mid-turn**, Realtime auto-reconnects; events in the gap are lost (ephemeral by design). The durable state lands via `postgres_changes` regardless.
- **Client composes two subscriptions** per entity page: one `broadcast` channel for live deltas, one `postgres_changes` subscription on the durable table filtered by entity id.

## Prompts Directory

Each rf skill in `/Users/marc/programing/perso/research-framwork/skills/*/SKILL.md` ports to its own folder under `src/prompts/{skill}/` with two files: `{skill}.prompt.ts` (system prompt text) and `{skill}.schema.ts` (structured-output contract). Keep them aligned with the source skill in spirit but feel free to diverge.

### `.prompt.ts` — system prompt text only

- Exports one or more `const` strings (e.g. `INIT_SUBJECT_SYSTEM_PROMPT`). That is all.
- **No** Zod schemas, **no** message builders, **no** helpers, **no** types derived from schemas, **no** imports beyond what's needed for the string itself (usually none).
- Think of it as a `.md` that happens to be typed — a reader should be able to copy-paste it into another runtime without pulling the rest of the repo.

### `.schema.ts` — structured-output contract

- Zod schemas + the types inferred from them (e.g. `agentStepSchema`, `AgentStep`). Imported by both the caller (workflow/command) and any UI that renders the structured output.
- Pure — no I/O, no prompt text, no message construction.

### Message construction lives at the call site

Building `messages: CoreMessage[]` is domain logic: it pulls in entity state, history, per-turn context. That goes in the caller — typically the `.workflow.ts` or `.command.ts` that invokes the LLM. Do **not** put a `buildXxxMessages` function inside `.prompt.ts` or `.schema.ts`.

## When to Add a Server Action vs API Route

- **Server Action** — UI-driven mutations within this app.
- **API Route** — triggered by Cloudflare Workflows, called from external services, or needed by edge runtime. Co-locate `route.ts` with `route.dto.ts` for the shared request/response contract.

## UI Components & Styling

- **shadcn/ui** primitives under `src/ui/components/ui/*`. Install new ones with `npx shadcn@latest add <component>`.
- **Colors in OKLCH**, defined in `src/ui/css/colors.css` + `globals.css`. Use named Tailwind classes (`bg-ink-10`, `text-blue-70`) — never hex literals.
- Design tokens will be regenerated via the `gstack-design-*` skills during Milestone 5. The current palette is placeholder.

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

### Rebasing with remote schema

- No conflicts → `npm run db:migration:up`
- Conflicts → delete your branch-only migration, `npm run db:reset`, re-apply via Studio, regenerate migration + types

## Testing

Deferred for MVP. Will return via Miniflare-backed integration tests post-MVP.

## Key Rules (Repeat)

1. **Entry points** (`app/`, `workers/`) delegate to business logic (`server/domain/`)
2. **Commands** never call other commands; **services** never call commands
3. **Workflows** own all long-running agent work; broadcast during run, persist on completion
4. **Channels are entity-scoped and subscribed once** — never per turn
5. **File suffixes** make purpose obvious
6. **Repositories** live next to the commands they support
