# Create-subject failures are silent

## Symptom

Two related failure modes, both invisible to the user:

1. **`createSubjectAction` throws.** If `createSubjectDraft(...)` throws (DB constraint violation, repo error, etc.), the throw propagates out of the server action. On the client, `subject-new-form.view.tsx:18-19` does `const result = await createSubjectAction(formData); if (result && 'error' in result) setError(result.error)`. When the action throws, `result` is `undefined`, the guard falls through, and `error` stays `null`. The "Creating…" button resets to "Start interview" and the user has no idea anything went wrong.

2. **`triggerFirstInterviewStep` fails inside `ctx.waitUntil`.** The action redirects to `/subjects/new?id=<subjectId>` BEFORE the background interview-first-step finishes. If that background call throws (e.g. the recent Anthropic schema-validator bug), the catch block in `subject.action.ts:36-38` only logs to console — the subject row is created with `status: 'interviewing'` but never gets a first turn. The interview page renders `InterviewView`, which sits forever waiting for a turn that never arrives.

## Reproduction

1. **Mode 1:** force `createSubjectDraft` to throw (e.g. temporarily make `ensureUniqueSlug` throw, or violate the user_id FK). Submit the form. → Form silently resets, no error.
2. **Mode 2:** force `triggerFirstInterviewStep` to throw (we just hit this naturally with the `output_config.format.schema` minItems / maxItems errors). Submit the form. → Redirect to `/subjects/new?id=...` succeeds, page loads with empty interview state, button stays disabled / no first agent message ever appears.

## Suspected cause

- **Mode 1:** server action throws → Next.js routes the throw to its error boundary, but the form's `await` returns `undefined` rather than `{ error }`. The shape contract (`{ error: string } | undefined`) doesn't accommodate "the action exploded".
- **Mode 2:** the action returns success the moment the subject row is created, before the background work finishes. The subject's `status` stays `'interviewing'` even when the background work fails because nothing flips it to `'failed'` on error. There's already a `failSubjectInterview(subjectId)` in `subjects.command.ts` that sets `status: 'failed'` — it's not wired into the `.catch` in `subject.action.ts:36-38`.

## Recommended fix

**Mode 1 — surface server-action throws to the client:**
- Wrap `createSubjectDraft(...)` in try/catch inside `createSubjectAction`. On catch, return `{ error: <message> }`. Keep the existing zod-failure branch's shape so the client only has one path to handle.

**Mode 2 — flip the subject to `failed` when the background step explodes:**
- In `subject.action.ts:36-38`, replace `console.error(...)` in the catch with `await failSubjectInterview(subject.id)` (plus the log, so we keep diagnostic signal). The subject row's status moves to `'failed'`.
- In `interview.view.tsx` (or wherever `InterviewView` reads status), surface a clear error state when `subject.status === 'failed'` — message + "Try again" button that goes back to `/subjects/new`.

Both fixes together close the silent-failure loop: hard errors during the action surface inline on the form, background errors surface on the interview page.

## Out of scope

- Automatic retry of the first interview step.
- Generic "background-job-failed" UI pattern reusable across landscape, deep-research, etc. — fix this one concretely first; generalize once we have a second case.
- Deleting the orphan subject row when the background step fails. Keeping it as `failed` is fine; the user can decide whether to retry or discard.
