-- LoreMore's private data foundation. Ownership is enforced in both RLS and FKs.
-- No public publishing policy exists; 'publishable' is only an editorial state.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  timezone text not null default 'UTC' check (btrim(timezone) <> ''),
  avatar_path text check (avatar_path is null or (
    split_part(avatar_path, '/', 1) = user_id::text
    and length(avatar_path) > 37 and avatar_path !~ '(^|/)\.\.?(/|$)')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('photo', 'note', 'voice')),
  source text not null check (source in ('manual_import', 'share_extension', 'text_note', 'voice_memo')),
  captured_at timestamptz not null default now(),
  title text check (char_length(title) <= 300),
  note text,
  transcript text,
  analysis_status text not null default 'not_requested'
    check (analysis_status in ('not_requested', 'pending', 'complete', 'failed')),
  ai_context jsonb not null default '{}'::jsonb check (jsonb_typeof(ai_context) = 'object'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);
create index moments_user_captured_idx on public.moments (user_id, captured_at, id);

create table public.moment_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  moment_id uuid not null,
  bucket_id text not null default 'moments' check (bucket_id = 'moments'),
  object_path text not null check (
    split_part(object_path, '/', 1) = user_id::text
    and length(object_path) > 37 and object_path !~ '(^|/)\.\.?(/|$)'),
  mime_type text not null check (btrim(mime_type) <> ''),
  size_bytes bigint check (size_bytes >= 0),
  width integer check (width > 0),
  height integer check (height > 0),
  duration_seconds numeric check (duration_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, moment_id) references public.moments(user_id, id) on delete cascade,
  unique (bucket_id, object_path)
);
create index moment_media_parent_idx on public.moment_media (user_id, moment_id);

create table public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date date not null,
  timezone text not null default 'UTC' check (btrim(timezone) <> ''),
  summary text,
  reflection text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date),
  unique (user_id, id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table public.moment_projects (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  moment_id uuid not null,
  project_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, moment_id, project_id),
  foreign key (user_id, moment_id) references public.moments(user_id, id) on delete cascade,
  foreign key (user_id, project_id) references public.projects(user_id, id) on delete cascade
);
create index moment_projects_project_idx on public.moment_projects (user_id, project_id);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  daily_entry_id uuid not null,
  provider text not null default 'text' check (provider in ('text', 'retell')),
  status text not null default 'prepared' check (status in ('prepared', 'in_progress', 'completed', 'failed', 'cancelled')),
  prepared_context jsonb not null default '{}'::jsonb check (jsonb_typeof(prepared_context) = 'object'),
  started_at timestamptz,
  ended_at timestamptz check (ended_at >= started_at),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, daily_entry_id) references public.daily_entries(user_id, id) on delete cascade,
  unique (user_id, id)
);
create index interviews_day_idx on public.interviews (user_id, daily_entry_id);

create table public.interview_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  interview_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null check (btrim(content) <> ''),
  sequence integer not null check (sequence >= 0),
  created_at timestamptz not null default now(),
  foreign key (user_id, interview_id) references public.interviews(user_id, id) on delete cascade,
  unique (interview_id, sequence)
);
create index interview_messages_parent_idx on public.interview_messages (user_id, interview_id);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  daily_entry_id uuid,
  project_id uuid,
  kind text not null check (kind in ('daily', 'weekly', 'project')),
  period_start date not null,
  period_end date not null,
  title text not null default '' check (char_length(title) <= 300),
  body text not null default '',
  status text not null default 'draft' check (status in ('draft', 'ready')),
  privacy text not null default 'private' check (privacy in ('private', 'publishable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (kind <> 'daily' or period_start = period_end),
  foreign key (user_id, daily_entry_id) references public.daily_entries(user_id, id) on delete cascade,
  -- Archive projects, or explicitly unlink their stories before deleting a project.
  foreign key (user_id, project_id) references public.projects(user_id, id)
);
create index stories_period_idx on public.stories (user_id, period_start desc);
create index stories_day_idx on public.stories (user_id, daily_entry_id);
create index stories_project_idx on public.stories (user_id, project_id);

-- Explicit grants work regardless of the project's automatic Data API exposure setting.
-- All table policies constrain both the existing row and its proposed replacement.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'moments', 'moment_media', 'daily_entries', 'projects',
    'moment_projects', 'interviews', 'interview_messages', 'stories'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', table_name);
    execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    if table_name not in ('moment_projects', 'interview_messages') then
      execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name);
    end if;
  end loop;
end;
$$;
grant usage on schema public to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('moments', 'moments', false, 52428800, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif',
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/aac'
  ]),
  ('profile-media', 'profile-media', false, 5242880, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif'
  ])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Paths are <authenticated user UUID>/<unique filename or nested path>.
-- All operations (including upload upsert and rename) require the same owner prefix.
create policy loremore_owner_objects on storage.objects
for all to authenticated
using (
  bucket_id in ('moments', 'profile-media')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name !~ '(^|/)\.\.?(/|$)'
)
with check (
  bucket_id in ('moments', 'profile-media')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name !~ '(^|/)\.\.?(/|$)'
);

-- Existing unrelated permissive policies must never widen access to these buckets.
create policy loremore_object_boundary on storage.objects as restrictive
for all to anon, authenticated
using (
  bucket_id not in ('moments', 'profile-media') or (
    (storage.foldername(name))[1] = (select auth.uid())::text
    and name !~ '(^|/)\.\.?(/|$)'
  )
)
with check (
  bucket_id not in ('moments', 'profile-media') or (
    (storage.foldername(name))[1] = (select auth.uid())::text
    and name !~ '(^|/)\.\.?(/|$)'
  )
);

-- Bucket settings are administrative, never writable from a public client.
create policy loremore_bucket_boundary on storage.buckets as restrictive
for all to anon, authenticated
using (id not in ('moments', 'profile-media'))
with check (id not in ('moments', 'profile-media'));
