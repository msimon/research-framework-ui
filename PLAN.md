# Research Framework UI — Plan

Web UI around the `rf` research framework, running the same pipeline (minus pitch/slides) so research can be done from anywhere and shared. MVP covers `init-subject → discover/add-topics → landscape → deep-research (+ resume)`. Synthesize, solution, and pitch are out of scope for MVP.

## 0. Source repos (absolute paths)

| Name | Path | Role |
|---|---|---|
| **rf plugin** | `/Users/marc/programing/perso/research-framwork` | Source of prompts and workflow semantics. Port `skills/*/SKILL.md` → `prompts/*.ts`. Templates in `templates/subject/` inform the DB schema and default content. |
| **Todo** | `/Users/marc/programing/perso/Todo` | Source of framework scaffolding. See §6 for exact files to copy. Next.js 16 + Supabase + Clean Architecture reference. |
| **this repo** | `/Users/marc/programing/perso/research-framwork-ui` | Target. Currently empty. |

## 1. Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 + App Router + shadcn/ui + Tailwind |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare` |
| DB / Auth / Realtime | Supabase (new project, Google OAuth) |
| LLM abstraction | Vercel AI SDK (`ai`, `@ai-sdk/anthropic`) |
| Model | Claude Opus 4.7 everywhere (for now) |
| Tools | Anthropic `web_search` (neutral interface to swap later) |
| Agent runtime | Cloudflare Workflows (all skills) |
| Streaming | Supabase Realtime — broadcast channel per turn + postgres_changes on completion |
| Observability | Sentry |
| Tests | deferred; Miniflare when we invest |
| Design | generated later via `gstack-design-*` skills |

### Decisions

- **Shared API key** from env (`ANTHROPIC_API_KEY`); BYOK ready in code via `resolveModelClient(userId)` + `user_api_keys` table (unused in MVP).
- **Read-only UI** for markdown files — skills are the sole writers. No edit affordances in MVP.
- **Local-first** — entire stack must run on localhost (`next dev` + `supabase start` + `wrangler dev`).
- **Desktop-first**, single prod env, `*.workers.dev` subdomain until a domain lands.
- **No rate limiting** in MVP (friends-only; add when abused).

## 2. Data model (Postgres)

```
subjects(id, user_id, slug, title, seed_problem_statement,
         framing jsonb, understanding_md, lexicon_md, open_questions_md,
         status, created_at, updated_at)

topics(id, subject_id, slug, title, pitch, rationale, parent_topic_id,
       status ['discovered'|'landscape'|'deep-N'], sort_order, timestamps)

landscapes(id, topic_id, content_md,
           status ['pending'|'streaming'|'complete'|'failed'],
           workflow_instance_id, timestamps)

sessions(id, topic_id, seed_question, status ['active'|'closed'],
         summary_md, turn_count, last_turn_at,
         created_at, closed_at)

turns(id, session_id, turn_number, role,
      user_text, findings_md, my_read_md, followup_question,
      reasoning_md nullable, tool_calls jsonb, model_used,
      workflow_instance_id, status ['streaming'|'complete'|'failed'],
      timestamps)

sources(id, topic_id, turn_id nullable, url, title, snippet, retrieved_at)

init_interview_turns(id, subject_id, turn_number, agent_step jsonb,
                     user_answer jsonb, created_at)

user_api_keys(user_id PK, anthropic_key_encrypted, openai_key_encrypted,
              updated_at)   -- BYOK-ready, unused in MVP

usage_events(id, user_id, event_type, model,
             input_tokens, output_tokens, cost_usd_millionths, created_at)
```

- RLS: all rows filtered by `subjects.user_id = auth.uid()` transitively.
- Standard `created_at` / `updated_at` + `moddatetime` triggers.

## 3. Agent architecture

**All skills run as Cloudflare Workflows.** One uniform primitive — no Durable Objects. Each Workflow broadcasts events to a **durable-entity-scoped** Supabase Realtime channel as it runs and writes the final state to the DB on completion.

**Channel naming (entity-scoped, long-lived).** The channel is tied to the thing the user is looking at — not the individual workflow run — so the client subscribes once on page mount and never misses events due to subscribe-after-start races:

| Page | Channel | Events |
|---|---|---|
| `/subjects/new` (interview) | `interview:<subjectId>` | step-by-step question generation |
| `/subjects/[slug]` (discover) | `subject:<subjectId>` | topics as they're enumerated |
| `/subjects/[slug]/topics/[t]/landscape` | `landscape:<landscapeId>` | streamed landscape markdown |
| `/subjects/[slug]/topics/[t]/sessions/[s]` | `session:<sessionId>` | all turns for this deep-research session |

Every event payload carries the relevant child id (`turnId`, `topicId`, etc.) so the client can route to the correct UI region.

| Skill | Workflow | Steps |
|---|---|---|
| `init-subject` interview (per question) | `InitInterviewWorkflow` | load-session → generate-next-question → persist |
| `discover` / `add-topics` | `DiscoverWorkflow` | research → enumerate-topics → persist |
| `landscape` | `LandscapeWorkflow` | search → synthesize → persist |
| `deep-research` turn | `DeepResearchTurnWorkflow` | load-context → agent-loop (stream) → persist |

`resume` is not a workflow — re-fetches session state from the DB. No special primitive needed.

### Unified flow

```
Client                     Route handler        Workflow                    Supabase
  |                            |                    |                          |
  |-- (page mount) ------------------------------------------------->          |
  |   subscribe channel:session:<id>                                           |
  |   subscribe postgres_changes turns WHERE session_id=<id>                   |
  |                            |                    |                          |
  |-- POST /turn ------------->|                    |                          |
  |                            |-- INSERT turn ---->|                          |
  |                            |-- trigger workflow-->                         |
  |<-- turnId -----------------|                    |                          |
  |                                                 |                          |
  |                                                 |-- agent loop:            |
  |                                                 |   broadcast {turnId,text}|
  |<----------------------------------------------- |------------------------  |
  |                                                 |   broadcast {turnId,    }|
  |                                                 |             reasoning}   |
  |<----------------------------------------------- |------------------------  |
  |                                                 |   broadcast {turnId,    }|
  |                                                 |             tool_call}   |
  |<----------------------------------------------- |------------------------  |
  |                                                 |   ...                    |
  |                                                 |-- UPDATE turn (done) --->|
  |<-- postgres_changes (final row) ------------------------------------------|
```

### Event schema (broadcast payload)

Events are published to the entity channel (e.g. `session:<sessionId>`) and carry the child id so the client can route. Deep-research example:

```ts
type TurnEvent = {
  turnId: string;                                                           // routes event to the right turn bubble
  seq: number;                                                              // monotonic per turn — lets the client detect gaps
} & (
  | { type: 'text'; delta: string }                                         // THE ANSWER — streamed response text
  | { type: 'reasoning'; delta: string }                                    // extended thinking — enabled in MVP
  | { type: 'tool_call'; id: string; name: string; input: unknown }         // e.g. web_search({ query: '...' })
  | { type: 'tool_result'; id: string; output: unknown; durationMs: number }
  | { type: 'error'; message: string }
  | { type: 'complete' }                                                    // marker — final row arrives via postgres_changes
);
```

Analogous shapes for `LandscapeEvent` (`landscapeId`), `DiscoverEvent` (`subjectId`, plus `topicId` for per-topic events), `InterviewEvent` (`subjectId`, `stepId`).

Client accumulates `text` deltas into the message bubble. `reasoning` deltas go into a collapsible "Show thinking" section (rendered live as they stream). `tool_call` + `tool_result` render as inline chips. `complete` signals the UI that the durable row update is about to land.

### Extended thinking

Enabled from day one for all Opus 4.7 calls. Surfaced as streaming `reasoning` events (separate from `text`) and persisted to `turns.reasoning_md` when the workflow completes. UI shows a collapsible "Thinking…" block that auto-expands while streaming and collapses on completion.

### Client subscriptions (uniform across skills)

Subscribed **once on page mount**, not per-turn. Survives multiple turns within the same page.

```ts
// Live events for everything happening in this session
supabase.channel(`session:${sessionId}`)
  .on('broadcast', { event: 'event' }, ({ payload }) => {
    const ev = payload as TurnEvent;
    routeToTurn(ev.turnId, ev);  // append delta / update UI for that turn
  })
  .subscribe();

// Final state + cross-device sync
supabase.channel(`turns:session:${sessionId}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'turns', filter: `session_id=eq.${sessionId}` },
      onTurnRowChange)
  .subscribe();
```

### Server-side (inside a Workflow step)

```ts
const channel = supabase.channel(`session:${sessionId}`);
let seq = 0;

const result = streamText({
  model: anthropic('claude-opus-4-7'),
  providerOptions: { anthropic: { thinking: { type: 'enabled', budgetTokens: 8000 } } },
  tools: { web_search },
  messages,
  onChunk: ({ chunk }) => {
    const event = toTurnEvent(chunk, { turnId, seq: seq++ });  // 'text' | 'reasoning' | 'tool_call' | 'tool_result'
    if (event) channel.send({ type: 'broadcast', event: 'event', payload: event });
  },
});

const { text, reasoning, toolCalls } = await result.response;

await supabase.from('turns').update({
  findings_md: /* parsed from text */,
  my_read_md: /* parsed from text */,
  followup_question: /* parsed from text */,
  reasoning_md: reasoning ?? null,
  tool_calls: toolCalls,
  status: 'complete',
}).eq('id', turnId);

channel.send({ type: 'broadcast', event: 'event', payload: { turnId, seq: seq++, type: 'complete' } });
```

### Reconnect mid-turn

- Channel is subscribed on page mount, so there's no subscribe-after-start race within a normal turn.
- If the client drops connection mid-turn, Supabase Realtime auto-reconnects and rejoins the channel; events emitted during the gap are lost (ephemeral by design).
- `seq` on each event lets the client detect gaps — currently just surfaces a small "reconnected" indicator; we don't backfill missed deltas.
- Final row lands via postgres_changes regardless, so the durable result is never lost.
- UX impact: brief "..." during the gap, then resumption; acceptable for MVP.

### LLM client resolver (BYOK-ready)
```ts
async function resolveModelClient(userId: string) {
  const userKey = await getUserApiKey(userId);       // null in MVP
  const apiKey = userKey ?? env.ANTHROPIC_API_KEY;
  return anthropic({ apiKey });
}
```

## 4. Page inventory

| Route | Purpose | Key content |
|---|---|---|
| `/` | Landing / redirect to `/subjects` | Hero, sign-in |
| `/login` | Google OAuth entry | Single button |
| `/auth/callback` | Supabase OAuth callback | — |
| `/subjects` | User's subjects list | Cards (title, seed, status, last activity) + "New" |
| `/subjects/new` | Generative init-subject | Streamed questions as forms, free-text escape hatch |
| `/subjects/[slug]` | Subject home | Framing · Understanding preview · Open questions · Lexicon glance · Topics list · "Discover more" |
| `/subjects/[slug]/understanding` | Full `00-understanding.md` | Read-only rendered markdown |
| `/subjects/[slug]/lexicon` | Full `00-lexicon.md` | Read-only + grep/filter |
| `/subjects/[slug]/questions` | Full `00-open-questions.md` | Read-only |
| `/subjects/[slug]/topics/[topicSlug]` | Topic home | Landscape preview · Sessions list · "Start deep-research" · Sources |
| `/subjects/[slug]/topics/[topicSlug]/landscape` | Full landscape | Streaming markdown while workflow runs |
| `/subjects/[slug]/topics/[topicSlug]/sessions/[sessionId]` | Deep-research chat | Turn history · Composer · Live research indicators · Stopping-rule prompts · Close button |
| `/settings` | Profile + (future) BYOK | Google account info · API key input (disabled) |

## 5. Prompt port

Each `SKILL.md` in `/research-framwork/skills/*` ports to a TS template under `prompts/`. Kept aligned with the plugin spiritually but free to diverge. Example targets:

- `prompts/init-subject.ts` — adaptive-interview system prompt + per-turn structured-output schema (generative UI)
- `prompts/discover.ts` — enumerate 15–30 topics with pitch + rationale
- `prompts/add-topics.ts` — mine a thread → 5–10 children
- `prompts/landscape.ts` — substantive overview, cites sources
- `prompts/deep-research.ts` — turn prompt (Findings / My read / one follow-up)

## 6. Extraction checklist (Todo → research-framwork-ui)

**Copy as-is:** `.gitignore`, `.prettierignore`, `.stylelintrc.json`, `.vscode/`, `biome.json`, `components.json`, `next-env.d.ts`, `postcss.config.mjs`, `tsconfig.json`, `vitest.{unit,integration}.config.ts`.

**Copy with small edits:**
- `package.json` — drop deepgram/openai/ramble deps, add `ai`, `@ai-sdk/anthropic`, `@opennextjs/cloudflare`, `wrangler`, `agents`, `zod`
- `next.config.ts` — OpenNext Cloudflare setup
- `AGENTS.md`, `DEVELOPMENT.md` — keep framework rules, strip Todo specifics, add Cloudflare + AI SDK + streaming sections
- `README.md` — rewrite
- `.env.sample` — add `ANTHROPIC_API_KEY`, Supabase keys, Cloudflare bindings
- Drop `vercel.json`; add `wrangler.jsonc`

**Source — copy:**
- `src/shared/config/*` (all 6)
- `src/shared/lib/supabase/{client,server,proxy,supabase.types}.ts`
- `src/server/lib/utils/{auth,currentUser}.ts`
- `src/server/domain/users/*`, `auth/auth.types.ts`
- `src/app/auth/*`
- `src/app/{layout.tsx,providers.tsx,global-error.tsx,not-found.tsx,favicon.ico,fonts.ts,globals.css}`
- `src/app/(app)/layout.tsx` (adapt), `(app)/settings/page.tsx` as template
- `src/ui/components/ui/*` (shadcn primitives)
- `src/ui/css/{colors,globals}.css` — keep scaffold; regenerate OKLCH via design skill later
- `src/ui/views/auth/auth-required.view.tsx`
- `src/shared/lib/sentry/*`, `instrumentation*.ts`
- `supabase/{config.toml,seed.sql}` + baseline migration `20260224161000_template_baseline_users_auth.sql`
- `scripts/{generate-migration,prepare-supabase-test,run-integration-tests}.mjs`
- `.claude/skills/{commit,database-workflow,enter-worktree,leave-worktree,review-code-change,rls-conventions,architecture-diagrams}`
- `docs/{adr,architecture}/` empty scaffolds

**Drop:** ramble, tasks, categories, trash, home views; deepgram; openai ramble prompt; Todo-specific migrations; Todo-specific ADRs.

**New:**
- `src/server/lib/llm/` — `resolveModelClient(userId)`, AI SDK wrappers
- `src/server/lib/tools/web-search.ts` — neutral interface, Anthropic impl
- `src/server/domain/{subjects,topics,landscapes,sessions,research}/`
- `src/server/infra/cloudflare/` — Workflow bindings and trigger helpers
- `workers/` — Cloudflare Workflows: `InitInterviewWorkflow`, `DiscoverWorkflow`, `LandscapeWorkflow`, `DeepResearchTurnWorkflow`
- `prompts/` — ported skill prompts

## 7. Milestones

| # | Milestone | Scope |
|---|---|---|
| **0** | **Scaffold (local-only)** | Copy framework, Next.js + Supabase + wrangler dev run locally together, "Hello world" page behind auth |
| **1** | **Subjects + Generative Interview** | `subjects` + `init_interview_turns` + RLS, `InitInterviewWorkflow`, `/subjects` + `/subjects/new` |
| **2** | **Discover + Topics** | `topics` table, `DiscoverWorkflow`, `/subjects/[slug]` with streamed topics, `add-topics` parent/child |
| **3** | **Landscape** | `landscapes` + `sources` tables, `LandscapeWorkflow`, landscape page with streaming markdown |
| **3.5** | **Code review** | Run `/review-code-change` across everything in milestones 0–3; fix all reported issues before moving on |
| **4** | **Deep-research** | `sessions` + `turns` tables, `DeepResearchTurnWorkflow`, Supabase broadcast chat, `resume`, auto-promote insights on close |
| **5** | **Design pass** | UI redesign via `gstack-design-consultation` + `gstack-design-shotgun`; empty/loading/error states |
| **5.5** | **Code review** | Run `/review-code-change` across milestones 4–5; fix all reported issues |
| **Post-MVP** | | `synthesize` · `solution` · BYOK · rate limits · markdown editing · Miniflare tests |

## 8. Outstanding prerequisites (user)

**For local dev (Milestones 0–5):** none. Miniflare simulates Workers / Workflows locally; `supabase start` runs DB + Auth locally. No Cloudflare account required yet.

**Before first deploy (after MVP):**
- Cloudflare account (Workers plan TBD — verify Workflows tier at deploy time)
- Supabase cloud project
- Google OAuth client for the prod domain
- No custom domain needed; `*.workers.dev` is fine

Scaffolding proceeds locally in parallel.
