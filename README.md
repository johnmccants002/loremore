# LoreMore

Environment scaffolding for Supabase project `mkfkevnncrxmtnbgwzup`. The app, Xcode project, and Edge Functions have not been created yet.

## Local setup

- `.env.example` documents local server/tooling settings. `.env` is the ignored local copy, with a generated development `APP_SECRET`.
- `ios/Configuration/Secrets.example.xcconfig` contains only the Supabase URL and public client key options. Its ignored `Secrets.xcconfig` copy is ready to fill in.
- `supabase/functions/.env.example` contains custom Edge Function settings. The ignored `.env` beside it has a separate generated development secret.

API keys, bundle identifiers, model IDs, provider credentials, and the public website URL are intentionally blank. Get the client key from [Supabase API Keys](https://supabase.com/dashboard/project/mkfkevnncrxmtnbgwzup/settings/api-keys). Prefer `SUPABASE_PUBLISHABLE_KEY`; `SUPABASE_ANON_KEY` is a legacy alternative. MCP authentication does not populate application API keys.

On a fresh checkout, copy each example to its corresponding local filename and generate fresh application secrets. Local `.env` files are not automatically loaded by every runtime; the server must explicitly load the intended file.

## iOS integration

When creating the Xcode project, include the client xcconfig in the app and share-extension build configurations, then expose only the URL and selected public key to Swift through explicit Info.plist build-setting substitutions. The xcconfig alone does not wire values into a running app. Choose the Apple bundle IDs when creating the targets; the root `.env` does not configure Xcode.

Never add the root `.env`, Edge Function `.env`, service-role key, AI keys, voice credentials, or webhook secrets to target resources or client build settings. Public client keys are extractable from apps; access to user data must be enforced through database and Storage policies.

## Edge Functions

The Edge Function template deliberately excludes `SUPABASE_*` variables. Supabase supplies its own connection credentials in this runtime and reserves that prefix for hosted secrets. Custom bucket settings use `LOREMORE_MOMENTS_BUCKET` and `LOREMORE_PROFILE_BUCKET`; the Supabase webhook setting uses `LOREMORE_SUPABASE_WEBHOOK_SECRET`.

Local Edge Functions load `supabase/functions/.env`. Hosted functions require their custom secrets to be configured separately in the dashboard or CLI. Do not upload the root `.env` as an Edge Function secrets file. Development and production should have separate secrets; the two local files are independent and are not synchronized.

Bucket names are configuration only: no buckets, policies, webhooks, deployments, or database changes have been created. Optional provider and webhook fields should remain blank until their integrations exist.

References: [API keys](https://supabase.com/docs/guides/getting-started/api-keys) and [Edge Function environment variables](https://supabase.com/docs/guides/functions/secrets).
