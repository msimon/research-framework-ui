# Research Framework UI

Web UI around the [rf](../research-framwork) research framework. Run the same pipeline — `init-subject → discover → landscape → deep-research` — from anywhere, with persistent state and shareable runs.

**Status:** scaffold. See [PLAN.md](PLAN.md) for milestones; [DEVELOPMENT.md](DEVELOPMENT.md) for engineering rules; [AGENTS.md](AGENTS.md) for LLM collaborator directives.

## Stack

- Next.js 16 (App Router, React 19, Turbopack)
- Supabase (Postgres, Auth with Google OAuth, Realtime)
- Cloudflare Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)
- Cloudflare Workflows — uniform runtime for all agent skills
- Vercel AI SDK + Anthropic (Claude Opus 4.7) with extended thinking
- shadcn/ui + Tailwind, Biome, Zod

## Quickstart

Prerequisites: Node 20+, Docker (for local Supabase), npm.

```bash
npm install
cp .env.sample .env.local            # edit: Google OAuth + ANTHROPIC_API_KEY
npm run db:start                     # starts local Supabase (Postgres + Auth + Realtime)
npm run db:types:generate            # regenerate types (run after any schema change)
npm run dev                          # Next.js on http://localhost:3000
```

For Cloudflare Workers + Workflows locally (Miniflare — no CF account required):

```bash
npm run cf:preview
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Next.js production build |
| `npm run check` / `check:fix` | Biome lint + format |
| `npm run db:start` / `db:stop` / `db:reset` / `db:status` | Local Supabase lifecycle |
| `npm run db:migration:new <name>` | Create a blank migration |
| `npm run db:migration:generate` | Diff local DB into a new migration |
| `npm run db:migration:up` | Apply pending migrations |
| `npm run db:types:generate` | Regenerate `supabase.types.ts` |
| `npm run cf:preview` | Run via Miniflare (local Workers) |
| `npm run cf:deploy` | Deploy to Cloudflare |
| `npm run cf:typegen` | Regenerate Wrangler env types |

## Structure

```
src/
├── app/                  Next.js entry points (pages, server actions, API routes, auth)
├── server/
│   ├── domain/           Business logic — commands, repositories, execution
│   ├── infra/            Vendor adapters (Cloudflare, Anthropic, web search, ...)
│   └── lib/              Shared backend utilities (auth, currentUser, llm)
├── ui/
│   ├── components/       shadcn primitives + shared components
│   ├── css/              OKLCH tokens, globals
│   └── views/            Feature views (self-contained)
└── shared/
    ├── config/           Zod env parsing — ONLY place that reads process.env
    └── lib/supabase/     Client/server/proxy helpers + generated types
workers/                  Cloudflare Workflow classes
prompts/                  Ported rf skill prompts
supabase/                 config.toml, migrations/, seed.sql
```

## Related repos (absolute paths)

| Repo | Path |
|---|---|
| rf plugin (prompt + workflow source) | `/Users/marc/programing/perso/research-framwork` |
| Todo (scaffolding reference) | `/Users/marc/programing/perso/Todo` |
