# LoreMore database

The initial migration creates nine user-owned tables and two private Storage buckets. It is an imperative migration: keep existing migration files immutable after deployment, and use `npx supabase migration new <name>` for subsequent changes. Local config targets Postgres 17; verify the hosted project's version before deployment.

## Data contract

| Table | Purpose and important fields |
| --- | --- |
| `profiles` | One optional profile per Auth user (`user_id` primary key), display name, IANA timezone, optional owner-prefixed avatar path. The client may upsert its own profile; signup does not depend on a profile trigger. |
| `moments` | `kind` is photo/note/voice; source is manual_import/share_extension/text_note/voice_memo. `captured_at` is an absolute timestamp. Titles, notes, transcripts, AI hypotheses, analysis state, and archive time are private. |
| `moment_media` | A moment's Storage object path, MIME type, dimensions/duration, and byte count. Only the `moments` bucket is valid here. |
| `daily_entries` | One entry per user and local calendar date, with the timezone used for that day, summary, reflection, and review time. |
| `projects` | Owner's project title, description, and archive time. |
| `moment_projects` | Many-to-many moment/project links, with matching owner enforced for both parents. |
| `interviews` | Prepared context and lifecycle for a day's text/Retell interview. Multiple attempts per day are allowed. |
| `interview_messages` | Ordered user/assistant/system messages for an interview; sequence numbers are unique per interview. |
| `stories` | Daily/weekly/project narrative drafts with a date range and optional day/project association. `privacy=publishable` does not make anything public. |

All child-parent references include `user_id`. A UUID guessed from another account cannot be attached to the current user's media, project links, interview, message, or story. Explicit SELECT/INSERT/UPDATE/DELETE grants and RLS USING/WITH CHECK clauses protect every table, independent of automatic Data API exposure. Anonymous clients receive no table access. Administrative service-role credentials intentionally bypass RLS and must stay server-side.

Moment/day indexes support local-day queries. Compute the user's local midnight boundaries in the app and query `captured_at >= start AND captured_at < next_midnight` using absolute timestamps; do not assume a day is always 24 hours across DST. The timezone columns store app-selected IANA names; the app must validate those names.

## Storage contract

Both `moments` (50 MiB, images/audio) and `profile-media` (5 MiB, images) are private. Object names must follow `<auth user UUID>/<unique filename or nested path>`. The same owner-prefix rules cover upload, SELECT/download/signing, UPDATE/upsert/rename, and DELETE. Restrictive boundary policies prevent other permissive Storage policies from widening access to these buckets or making them public.

Store object paths, not signed URLs. Owners can request expiring signed URLs; a signed URL is a bearer link, so anyone it is shared with can use it until expiration. Nothing is published by this migration. File size and MIME limits are enforced by Storage; MIME metadata alone is not content validation.

Deleting a moment cascades its media metadata and project links. Deleting a day cascades its interviews, messages, and associated stories. Deleting a project referenced by a story is restricted; archive it or explicitly unlink its stories first. Deleting an Auth user cascades application rows. **Database cascades do not remove Storage binaries:** future deletion/account-deletion code must remove files through the Storage API before deleting the corresponding records or user. Never delete Storage metadata directly in application code.

## Local validation

Install Node 24, run `npm ci`, and start a Docker-compatible engine. Then:

```sh
npm run db:start
npm run db:reset   # destructive ONLY to this project's disposable local database
npm run db:test
npm run db:test:api
npm run db:advisors
```

`db:test` invokes psql inside `supabase_db_loremore`, sets the actual `authenticated`/`anon` roles and JWT claims, checks isolation/constraints/cascades, then rolls all fixtures back. It deliberately tests permissive Storage-policy conflicts too. The CLI's `db query` cannot execute this multi-statement test script as a prepared statement.

`db:test:api` reads keys from the local CLI status in memory, refuses non-loopback URLs, creates two temporary confirmed users, and tests the real Auth, Data API, and Storage services. It covers private downloads, foreign uploads/overwrites/deletes, signed URL denial, owner upserts, bucket settings, and MIME restrictions. It removes test files using Storage APIs before deleting users. Neither test runner targets the hosted project, and no credentials are printed by the API test.

CI starts a fresh full Supabase stack, replays migrations, runs both suites, runs advisors, and removes the disposable stack. No GitHub secrets or hosted database access are needed.

When Docker is unavailable, `tests/support/standalone-postgres.sql` provides minimal Auth/Storage interfaces for preliminary tests in a brand-new throwaway vanilla Postgres cluster. Apply that support file, then the migration, then `tests/ownership.sql` with `psql -X -v ON_ERROR_STOP=1`. **Never apply the support file to Supabase.** This checks SQL/RLS behavior but cannot replace the real Storage API suite. Initial local checks ran on Postgres 14; CI uses Supabase Postgres 17.

## Hosted deployment

This PR does not deploy to the hosted project. After review, inspect its current schema, bucket names, and existing policies, confirm backups and its Postgres version, and apply the migration through the normal Supabase migration workflow. The migration makes any existing buckets named `moments` and `profile-media` private and applies its size/MIME limits; review that impact before deploying to a populated project. Verify advisors and two-account access again after deployment. Do not run reset, SQL fixtures, or the standalone support file against hosted data.

Source links: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage policies](https://supabase.com/docs/guides/storage/security/access-control), [local migrations](https://supabase.com/docs/guides/deployment/database-migrations).

## Photo imports and Today

The photo-import migration adds `moment_media.source_timestamp` and the authenticated, security-invoker `save_photo_import` RPC. The RPC checks the owner's uploaded file, then creates the moment and media together under the existing RLS policies. A stable UUID makes repeated saves idempotent; a failed media insert rolls back its moment. Apply both migrations before using the new client.

Today uses the device's local calendar day and orders by `captured_at`, then ID. Imports use the import time for that timeline; a native photo's literal EXIF date is preserved separately when available because it may lack a timezone. The picker normalizes to JPEG at a maximum 2048-pixel long edge and stores dimensions and byte count. It does not retain location metadata or the full-resolution original.

Storage paths are `<user UUID>/<import UUID>.jpg`. Private preview URLs expire after an hour and are renewed on refresh, focus, foreground, or periodic refresh. Upload progress is shown as preparation/upload/save stages, not an estimated byte percentage. Retry retains the same import in memory and never overwrites an existing object. An ambiguous save failure leaves the file available for retry; **Remove this import** removes its moment (if saved) and then its Storage object. Reconnect and retry removal if either operation fails.

Pending imports are not a durable background queue yet: keep the app open until completion. Force-quitting after upload but before save can leave an unreferenced private object; automated orphan cleanup and resumable background imports remain follow-up work. The API integration suite exercises the app's repository against local Supabase, including duplicate retries, signed previews, atomic rollback, foreign/anonymous denial, and removal.

`share_extension_source` adds a separate authenticated `save_shared_photo` RPC with the same transactional/idempotent ownership guarantees and `source=share_extension`. The existing `save_photo_import` signature remains compatible with older clients. API CI exercises both sources, duplicate retries, private access, and rollback after invalid media metadata. Native shares retain the original share timestamp when retrying across days; they appear on that day's timeline rather than being re-dated on retry.

## AI analysis

Apply `moment_analysis` after the earlier migrations. It creates private, service-only worker leases and rate counters plus service-only `claim_moment_analysis` / `finish_moment_analysis` RPCs. Both functions use invoker security and a fixed search path. Claims validate ownership, lock the parent, and enforce a two-minute lease, five attempts per moment, and 50 attempts per user per rolling 24 hours. Finishing requires the current lease token. Public AI context remains owner-editable journal data; private job state is authoritative for billing and retry protection.

Configure `OPENAI_API_KEY` and `OPENAI_VISION_MODEL` in the ignored `supabase/functions/.env` for local serving, or in hosted Edge Function secrets before deploying `analyze-moment`. The example uses `gpt-4.1-mini`, which supports image inputs and structured outputs. Supabase supplies its own URL and keys. Never copy the service-role or OpenAI key into Expo public variables. Keep JWT verification enabled. The function verifies the user with Auth, accepts only a moment UUID, downloads private media using that user's JWT, and uses the service role only for lease/completion RPCs.

The function acknowledges accepted work with HTTP 202 and runs provider work with `EdgeRuntime.waitUntil`. Local config uses `edge_runtime.policy = "per_worker"` to allow completion after the response. This is bounded background work, not a durable external job queue: runtime termination can leave a pending moment. After two minutes, the owner can retry and obtain a new lease. Automatic request recovery currently covers `not_requested` photos loaded by Today; pending/failed work is retried from moment detail.

Only JPEG/PNG/WebP images up to 12 MiB are analyzed. The provider request has a 45-second timeout, uses strict structured output, and disables response storage. Returned strings, confidence, questions, and project IDs are validated before saving; project suggestions must refer to a supplied owner project. Provider failures are sanitized and do not delete the photo. Failed attempts count toward limits. Live OpenAI billing/behavior has not been tested without a server key.

`npm run test:edge` tests the handler/provider adapter without real credentials. The SQL analysis suite verifies service-only permissions, leases, quotas, expired retries, title preservation, and stale completion. The local API suite checks simultaneous claims, client denial, completion visibility, and foreign-owner isolation through PostgREST. CI runs those tests on a disposable Supabase stack without calling OpenAI.
