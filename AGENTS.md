# Project Context

- **Stack:** Next.js 16 (App Router, React 19, Turbopack), Supabase (Postgres + Auth + Realtime), Cloudflare Workers via `@opennextjs/cloudflare`, Vercel AI SDK + Anthropic (Claude Opus 4.7), shadcn/ui + Tailwind, Biome, Zod
- **Package manager:** npm (never yarn)
- **Lint & format:** `npm run check:fix` (Biome)
- **Tests:** deferred for MVP
- **Database:** `npm run db:start` | `npm run db:reset` | `npm run db:migration:new` | `npm run db:migration:up` | `npm run db:types:generate`
- **Cloudflare:** `npm run cf:preview` (local via Miniflare) | `npm run cf:deploy` | `npm run cf:typegen`
- **Product scope & architecture:** see [PLAN.md](PLAN.md)
- **Engineering rules:** see [DEVELOPMENT.md](DEVELOPMENT.md)

## Source repos referenced during development

| Name | Path | Role |
|---|---|---|
| **rf plugin** | `/Users/marc/programing/perso/research-framwork` | Source of prompts and workflow semantics |
| **Todo** | `/Users/marc/programing/perso/Todo` | Scaffolding reference — do not copy Todo-specific logic |

# LLM Agent Directives

## Communication Style

- **Direct and concise** — skip filler ("That's a great question", "I apologize, but...")
- **Focus on substance** — address technical issues directly without hedging
- **Clear corrections** — when code is incorrect, state it and explain the fix
- **Constructive criticism** — point out problems and give actionable solutions

## Technical Responsibilities

- **Code review mindset** — actively identify security, perf, maintainability, and architectural issues
- **Question unclear requirements** — ask rather than assume
- **Suggest improvements** — recommend better patterns, libraries, or approaches when you see an opening
- **Verify assumptions** — double-check constraints before implementing
- **Architecture diagrams** — the `architecture-diagrams` skill is loaded automatically when drawing flows or system graphs

## Confirmation Protocol

**Ask for confirmation before:**

- Major architectural changes or refactoring
- Deleting significant code or files
- Database schema modifications
- Changes that could break existing functionality
- When multiple valid approaches exist and the choice isn't obvious
- Complex features where requirements might be misunderstood

**Proceed directly with:**

- Simple bug fixes and typo corrections
- Adding imports, dependencies, or basic setup
- Formatting, linting, or style fixes
- Small additions with clear, unambiguous requirements
- Minor refactoring that doesn't change behavior

# Development Rules

## Required reading

- `DEVELOPMENT.md` — all rules that apply to engineers apply to you. Key sections for code review: **Domain Layer Rules**, **Import Conventions**, **Naming Conventions**, **Supabase Realtime — Streaming Convention**, **Supabase Client Selection**, and **Database Table Design Rules**.
- `PLAN.md` — product scope, milestones, and the unified agent architecture.
- `README.md` — setup + context.

## Code review

- The `review-code-change` skill is loaded automatically when reviewing local code changes, or invoke manually with `/review-code-change`.
- Milestones 3.5 and 5.5 are dedicated code-review checkpoints — run `/review-code-change` across the work in preceding milestones and fix everything reported before moving on.

## Package Management

- Always use npm. Even if another lockfile appears, prefer npm.
- Before adding a runtime dep, check whether it belongs in `dependencies` (shipped) or `devDependencies` (tooling only).

## Agent runtime

- Long-running agent work currently runs as exported functions inside `*.command.ts`, triggered from server actions via `ctx.waitUntil(...)`.
- Agent functions use `supabaseAdmin()` — always validate ownership before writing.
- Server actions trigger long-running agent work via `ctx.waitUntil` and return the entity id immediately. They do not block on LLM output.
- Migration to real Cloudflare Workflows under `workers/` is planned but deferred — there is no `workers/` directory today.

## Streaming (Supabase Realtime)

- Single transport: **broadcast during run + postgres_changes on completion**. Never SSE, never WebSocket-from-Worker.
- Channels are **entity-scoped and long-lived** (`session:<id>`, `landscape:<id>`, `subject:<id>`, `interview:<id>`). Subscribe **once on page mount**, never per turn.
- Every event carries the child id (`turnId`, `topicId`, ...) plus a monotonic `seq`.
- Extended thinking is enabled day-one — surface `reasoning` deltas as separate events, persist to `*_md` columns on completion.

## LLM / AI SDK

- Model IDs live in `src/shared/config/config.base.ts`. Don't hardcode strings elsewhere.
- Use `resolveModelClient(userId)` (once implemented) to support BYOK; fall back to `ANTHROPIC_API_KEY` from `serverConfig`.
- All `process.env` reads happen in `src/shared/config/*` — import from `serverConfig` / `publicConfig` everywhere else.

## Database

- The `database-workflow` skill is loaded automatically when creating tables, migrations, or schema changes.
- The `rls-conventions` skill is loaded automatically when generating or reviewing RLS policies.
- Every user-owned table must have RLS enabled with a policy keyed on `auth.uid()` transitively.
- Follow the table design rules in `DEVELOPMENT.md` (NOT NULL + defaults, `created_at`/`updated_at` + trigger, explicit selects).

## Prompts

- Port each rf skill (`SKILL.md`) to a `.prompt.ts` module under `prompts/`. Keep prompts pure — no I/O, no Supabase calls.
- Prompts are called from commands or services.
