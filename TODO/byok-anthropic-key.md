# BYO Anthropic key — settings page + first-login onboarding

## Problem

Today the app uses a single shared `ANTHROPIC_API_KEY` from `serverConfig` for every user (see `src/shared/config/server.config.ts` and the `anthropicModel()` factory in `src/server/infra/anthropic/anthropic.client.ts`). That doesn't scale beyond personal use — each user should bring their own key, billed to their own Anthropic account.

`CLAUDE.md` already calls this out:

> Use `resolveModelClient(userId)` (once implemented) to support BYOK; fall back to `ANTHROPIC_API_KEY` from `serverConfig`.

This TODO is the concrete plan.

## Two surfaces

### A. Settings page

`/settings` (or `/account/api-keys`). One field: Anthropic API key. Save button. Plus:

- **Link** to https://console.anthropic.com/settings/keys with one-line instructions ("Create a key with the `Claude API` scope").
- **Validation on save**: ping Anthropic with a 1-token `messages` request before persisting. Reject the save if the key is invalid or has insufficient permission. Do NOT persist unverified keys.
- **Status badge**: "Key on file (last 4: …xyz, validated 2 days ago)" or "No key on file".
- **Replace key** flow: same form; new key replaces old.
- **Remove key** button: clears the row (user falls back to no-LLM-access state — most flows error until a new key is entered).

### B. First-login onboarding (gating)

If a user has no key on file when they sign in, force a key entry before they can use any LLM-driven feature. Reuse the settings-page form component — render it inside a modal or a single-step onboarding flow on whatever route they hit. Do NOT redirect them to `/settings`; the goal is "drop in the key and continue with what you were doing".

Two acceptable shapes:

1. **Modal blocking the destination route.** Hits `/subjects/foo/topics/bar`, sees `ApiKeyGate` modal, fills it, modal dismisses, page renders.
2. **Single-step onboarding route** at `/welcome` (or similar) that the middleware redirects to. After successful save, redirects back to the original `?next=` URL.

(1) is faster to build and less context-switchy for the user. Recommend (1).

The shared component is something like `<ApiKeyForm onSaved={...} />` — the settings page wraps it with chrome, the gate wraps it in a modal.

## Security copy on the page

The form should display, prominently:

- "This key is stored encrypted in our database. We use it ONLY to call Anthropic on your behalf — never for analytics, never logged, never shared."
- "**Set a spending limit** on your Anthropic console (https://console.anthropic.com/settings/limits) before pasting the key here. Recommended: $20–50/month for casual use."
- "**Scope**: create a dedicated key for this app rather than reusing one. Revoke it from the Anthropic console if you stop using us."
- "We will never email you the key. If support asks for it, they're not us."

## DB shape

New column on `public.users` (or a dedicated `public.user_api_keys` table — depends on whether we'll have multiple provider keys per user later):

Single-key form (start here):
```sql
ALTER TABLE public.users
  ADD COLUMN anthropic_api_key_encrypted bytea,
  ADD COLUMN anthropic_api_key_last_four text,
  ADD COLUMN anthropic_api_key_validated_at timestamptz;
```

Encryption: app-side AES-GCM using Web Crypto (works on Cloudflare Workers + Node). Master key `BYOK_MASTER_KEY` (32-byte AES-256, base64-encoded) lives as a Cloudflare Worker secret in prod (`wrangler secret put BYOK_MASTER_KEY`) and `.env.local` in dev. Read once in `src/shared/config/server.config.ts` per the env-vars-only-in-config rule.

Encryption helpers in a new `src/server/lib/utils/byok-crypto.util.ts`:
- `encryptUserKey(plaintext: string): Promise<Uint8Array>` — returns `iv || ciphertext || authTag`
- `decryptUserKey(ciphertext: Uint8Array): Promise<string>`

Decryption flow (`resolveModelClient(userId)` in `src/server/infra/anthropic/anthropic.client.ts`):
1. `supabaseAdmin()` reads `users.anthropic_api_key_encrypted` (bytea)
2. `decryptUserKey(...)` with the master key
3. Returns `createAnthropic({ apiKey: decrypted })`
4. Throws if no key on file (middleware catches → renders gate modal)

We deliberately do NOT decrypt at the database layer (`pgsodium` / Supabase Vault) — adds deployment complexity, doesn't run on Workers, and the master key still lives somewhere. App-side Web Crypto is portable and has the same threat model.

RLS: `users` is already RLS-gated. Add a column-level grant so even a user reading their own row can't `select` the encrypted column directly — only `resolveModelClient` (running as service role via `supabaseAdmin()`) reads it.

Future-proof form (defer until needed):
```sql
CREATE TABLE public.user_api_keys (
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL,             -- 'anthropic', 'openai', 'gemini', ...
  key_encrypted bytea NOT NULL,
  key_last_four text NOT NULL,
  validated_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);
```

## Server wiring

- New command `setUserAnthropicKey(userId, rawKey)` — validates against Anthropic, encrypts, persists.
- New command `getUserAnthropicKey(userId)` — returns decrypted key, called only from `resolveModelClient(userId)`. Throws if no key on file.
- Update `anthropicModel()` factory to accept a `userId` and route through `resolveModelClient(userId)`. Fallback to `serverConfig.anthropic.apiKey` only if a `BYOK_REQUIRED=false` env var is set (dev convenience).
- Update all four commands (`landscapes`, `deep-research`, `discover`, `init-interview`) to thread `userId` into `anthropicModel(userId)`. They already have `userId` in their input shapes — minor plumbing.
- Server action that powers the save: `saveAnthropicKeyAction(formData)` — wrapped with `withAuth`, validates, persists, returns `{ ok: true, lastFour }` or `{ error: ... }`.

## Middleware gate

Extend `src/middleware.ts` to also check whether the authenticated user has a key on file. If not, and the request is for any LLM-driven page, set a flag (`?needsKey=1`) the layout reads to render the modal. Don't 302 — the user continues to the page they wanted, just with a blocking modal layered on.

## Open questions

- **Key rotation cadence**: do we prompt users to re-validate periodically? (e.g. ping the key once a week and mark `validated_at`; if validation fails, re-show the modal). Suggest yes — keys get revoked, billing gets shut off, and a stale key produces a confusing mid-stream error.
- **Multi-provider future**: do we plan to support OpenAI / Gemini? If so, jump straight to the `user_api_keys` table; if not, the single-column form is fine. Status: not planned for v1, single column is OK.
- **Revoke-on-delete**: when a user deletes their account, do we make any attempt to revoke their key on Anthropic's side? Probably not — they own the key, they revoke it. We just delete our copy.
- **Encryption-at-rest key rotation**: if `BYOK_ENCRYPTION_KEY` is rotated, all stored keys become unreadable. Plan: dual-write during rotation (encrypt with new, keep old until validated), or accept that rotation forces every user to re-enter. Defer this concern.

## Out of scope here

- Anything other than Anthropic (no OpenAI/Gemini multi-provider yet)
- Per-key spending controls inside our app (we point users at Anthropic's own limits)
- Org-level shared keys (only personal keys for now)
