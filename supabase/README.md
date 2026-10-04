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
