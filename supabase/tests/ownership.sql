-- Run ONLY against a disposable local database. All fixtures roll back.
begin;
create schema loremore_test;
grant usage on schema loremore_test to anon, authenticated;
create function loremore_test.assert(ok boolean, message text) returns void
language plpgsql security invoker as $$
begin
  if ok is distinct from true then raise exception 'Assertion failed: %', message; end if;
end;
$$;
create function loremore_test.denied(query text, expected_state text, message text) returns void
language plpgsql security invoker as $$
begin
  begin
    execute query;
  exception when others then
    if sqlstate = expected_state then return; end if;
    raise exception 'Wrong SQLSTATE for %: expected %, got % (%)', message, expected_state, sqlstate, sqlerrm;
  end;
  raise exception 'Expected rejection: %', message;
end;
$$;
insert into auth.users(id, email) values
  ('10000000-0000-0000-0000-000000000001', 'alice@loremore.test'),
  ('10000000-0000-0000-0000-000000000002', 'bob@loremore.test'),
  ('10000000-0000-0000-0000-000000000003', 'cascade@loremore.test');
select loremore_test.assert((select count(*) = 2 from storage.buckets where id in ('moments','profile-media') and not public), 'both buckets private');
select loremore_test.assert((select count(*) = 9 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('profiles','moments','moment_media','daily_entries','projects','moment_projects','interviews','interview_messages','stories') and c.relrowsecurity and c.relforcerowsecurity), 'all nine tables enforce RLS');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);


insert into public.profiles(user_id, display_name) values ('10000000-0000-0000-0000-000000000003', 'Owner 3');
insert into public.moments(id, kind, source, title) values ('20000000-0000-0000-0000-000000000003','photo','manual_import','First moment');
insert into public.moment_media(id, moment_id, object_path, mime_type, size_bytes) values ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003/photo.png','image/png',100);
insert into public.daily_entries(id, entry_date) values ('40000000-0000-0000-0000-000000000003','2026-10-03');
insert into public.projects(id, title) values ('50000000-0000-0000-0000-000000000003','My project');
insert into public.moment_projects(moment_id, project_id) values ('20000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003');
insert into public.interviews(id, daily_entry_id) values ('60000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003');
insert into public.interview_messages(id, interview_id, role, content, sequence) values ('70000000-0000-0000-0000-000000000003','60000000-0000-0000-0000-000000000003','user','A meaningful day',0);
insert into public.stories(id, daily_entry_id, project_id, kind, period_start, period_end) values ('80000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000003','daily','2026-10-03','2026-10-03');
insert into storage.objects(bucket_id,name,owner_id) values ('moments','10000000-0000-0000-0000-000000000003/photo.png','10000000-0000-0000-0000-000000000003'), ('profile-media','10000000-0000-0000-0000-000000000003/avatar.png','10000000-0000-0000-0000-000000000003');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);


insert into public.profiles(user_id, display_name) values ('10000000-0000-0000-0000-000000000001', 'Owner 1');
insert into public.moments(id, kind, source, title) values ('20000000-0000-0000-0000-000000000001','photo','manual_import','First moment');
insert into public.moment_media(id, moment_id, object_path, mime_type, size_bytes) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001/photo.png','image/png',100);
insert into public.daily_entries(id, entry_date) values ('40000000-0000-0000-0000-000000000001','2026-10-03');
insert into public.projects(id, title) values ('50000000-0000-0000-0000-000000000001','My project');
insert into public.moment_projects(moment_id, project_id) values ('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001');
insert into public.interviews(id, daily_entry_id) values ('60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001');
insert into public.interview_messages(id, interview_id, role, content, sequence) values ('70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','user','A meaningful day',0);
insert into public.stories(id, daily_entry_id, project_id, kind, period_start, period_end) values ('80000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','daily','2026-10-03','2026-10-03');
insert into storage.objects(bucket_id,name,owner_id) values ('moments','10000000-0000-0000-0000-000000000001/photo.png','10000000-0000-0000-0000-000000000001'), ('profile-media','10000000-0000-0000-0000-000000000001/avatar.png','10000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);


insert into public.profiles(user_id, display_name) values ('10000000-0000-0000-0000-000000000002', 'Owner 2');
insert into public.moments(id, kind, source, title) values ('20000000-0000-0000-0000-000000000002','photo','manual_import','First moment');
insert into public.moment_media(id, moment_id, object_path, mime_type, size_bytes) values ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002/photo.png','image/png',100);
insert into public.daily_entries(id, entry_date) values ('40000000-0000-0000-0000-000000000002','2026-10-03');
insert into public.projects(id, title) values ('50000000-0000-0000-0000-000000000002','My project');
insert into public.moment_projects(moment_id, project_id) values ('20000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002');
insert into public.interviews(id, daily_entry_id) values ('60000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002');
insert into public.interview_messages(id, interview_id, role, content, sequence) values ('70000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000002','user','A meaningful day',0);
insert into public.stories(id, daily_entry_id, project_id, kind, period_start, period_end) values ('80000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','daily','2026-10-03','2026-10-03');
insert into storage.objects(bucket_id,name,owner_id) values ('moments','10000000-0000-0000-0000-000000000002/photo.png','10000000-0000-0000-0000-000000000002'), ('profile-media','10000000-0000-0000-0000-000000000002/avatar.png','10000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select loremore_test.assert((select count(*) = 1 from public.profiles), 'profiles: only own row visible to user 1');
select loremore_test.denied($q$update public.profiles set user_id='10000000-0000-0000-0000-000000000002' where user_id='10000000-0000-0000-0000-000000000001'$q$, '42501', 'profiles: cannot transfer ownership');
select loremore_test.denied($q$insert into public.profiles select (jsonb_populate_record(null::public.profiles, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000002'))).* from public.profiles t limit 1$q$, '42501', 'profiles: cannot insert as other owner');
with changed as (update public.profiles set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'profiles: cross-user update matches nothing');
with changed as (delete from public.profiles where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'profiles: cross-user delete matches nothing');
with changed as (update public.profiles set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'profiles: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.profiles', 'TRUNCATE'), 'profiles: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.moments), 'moments: only own row visible to user 1');
select loremore_test.denied($q$update public.moments set user_id='10000000-0000-0000-0000-000000000002' where user_id='10000000-0000-0000-0000-000000000001'$q$, '42501', 'moments: cannot transfer ownership');
select loremore_test.denied($q$insert into public.moments select (jsonb_populate_record(null::public.moments, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000002'))).* from public.moments t limit 1$q$, '42501', 'moments: cannot insert as other owner');
with changed as (update public.moments set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moments: cross-user update matches nothing');
with changed as (delete from public.moments where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moments: cross-user delete matches nothing');
with changed as (update public.moments set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'moments: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.moments', 'TRUNCATE'), 'moments: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.moment_media), 'moment_media: only own row visible to user 1');
select loremore_test.denied($q$update public.moment_media set user_id='10000000-0000-0000-0000-000000000002' where user_id='10000000-0000-0000-0000-000000000001'$q$, '42501', 'moment_media: cannot transfer ownership');
select loremore_test.denied($q$insert into public.moment_media select (jsonb_populate_record(null::public.moment_media, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000002'))).* from public.moment_media t limit 1$q$, '42501', 'moment_media: cannot insert as other owner');
with changed as (update public.moment_media set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moment_media: cross-user update matches nothing');
with changed as (delete from public.moment_media where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moment_media: cross-user delete matches nothing');
with changed as (update public.moment_media set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'moment_media: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.moment_media', 'TRUNCATE'), 'moment_media: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.daily_entries), 'daily_entries: only own row visible to user 1');
select loremore_test.denied($q$update public.daily_entries set user_id='10000000-0000-0000-0000-000000000002' where user_id='10000000-0000-0000-0000-000000000001'$q$, '42501', 'daily_entries: cannot transfer ownership');
select loremore_test.denied($q$insert into public.daily_entries select (jsonb_populate_record(null::public.daily_entries, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000002'))).* from public.daily_entries t limit 1$q$, '42501', 'daily_entries: cannot insert as other owner');
with changed as (update public.daily_entries set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'daily_entries: cross-user update matches nothing');
with changed as (delete from public.daily_entries where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'daily_entries: cross-user delete matches nothing');
with changed as (update public.daily_entries set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'daily_entries: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.daily_entries', 'TRUNCATE'), 'daily_entries: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.projects), 'projects: only own row visible to user 1');
select loremore_test.denied($q$update public.projects set user_id='10000000-0000-0000-0000-000000000002' where user_id='10000000-0000-0000-0000-000000000001'$q$, '42501', 'projects: cannot transfer ownership');
select loremore_test.denied($q$insert into public.projects select (jsonb_populate_record(null::public.projects, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000002'))).* from public.projects t limit 1$q$, '42501', 'projects: cannot insert as other owner');
with changed as (update public.projects set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'projects: cross-user update matches nothing');
with changed as (delete from public.projects where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'projects: cross-user delete matches nothing');
with changed as (update public.projects set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'projects: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.projects', 'TRUNCATE'), 'projects: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.moment_projects), 'moment_projects: only own row visible to user 1');
select loremore_test.denied($q$update public.moment_projects set user_id='10000000-0000-0000-0000-000000000002' where user_id='10000000-0000-0000-0000-000000000001'$q$, '42501', 'moment_projects: cannot transfer ownership');
select loremore_test.denied($q$insert into public.moment_projects select (jsonb_populate_record(null::public.moment_projects, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000002'))).* from public.moment_projects t limit 1$q$, '42501', 'moment_projects: cannot insert as other owner');
with changed as (update public.moment_projects set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moment_projects: cross-user update matches nothing');
with changed as (delete from public.moment_projects where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moment_projects: cross-user delete matches nothing');
with changed as (update public.moment_projects set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'moment_projects: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.moment_projects', 'TRUNCATE'), 'moment_projects: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.interviews), 'interviews: only own row visible to user 1');
select loremore_test.denied($q$update public.interviews set user_id='10000000-0000-0000-0000-000000000002' where user_id='10000000-0000-0000-0000-000000000001'$q$, '42501', 'interviews: cannot transfer ownership');
select loremore_test.denied($q$insert into public.interviews select (jsonb_populate_record(null::public.interviews, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000002'))).* from public.interviews t limit 1$q$, '42501', 'interviews: cannot insert as other owner');
with changed as (update public.interviews set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'interviews: cross-user update matches nothing');
with changed as (delete from public.interviews where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'interviews: cross-user delete matches nothing');
with changed as (update public.interviews set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'interviews: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.interviews', 'TRUNCATE'), 'interviews: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.interview_messages), 'interview_messages: only own row visible to user 1');
select loremore_test.denied($q$update public.interview_messages set user_id='10000000-0000-0000-0000-000000000002' where user_id='10000000-0000-0000-0000-000000000001'$q$, '42501', 'interview_messages: cannot transfer ownership');
select loremore_test.denied($q$insert into public.interview_messages select (jsonb_populate_record(null::public.interview_messages, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000002'))).* from public.interview_messages t limit 1$q$, '42501', 'interview_messages: cannot insert as other owner');
with changed as (update public.interview_messages set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'interview_messages: cross-user update matches nothing');
with changed as (delete from public.interview_messages where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'interview_messages: cross-user delete matches nothing');
with changed as (update public.interview_messages set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'interview_messages: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.interview_messages', 'TRUNCATE'), 'interview_messages: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.stories), 'stories: only own row visible to user 1');
select loremore_test.denied($q$update public.stories set user_id='10000000-0000-0000-0000-000000000002' where user_id='10000000-0000-0000-0000-000000000001'$q$, '42501', 'stories: cannot transfer ownership');
select loremore_test.denied($q$insert into public.stories select (jsonb_populate_record(null::public.stories, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000002'))).* from public.stories t limit 1$q$, '42501', 'stories: cannot insert as other owner');
with changed as (update public.stories set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'stories: cross-user update matches nothing');
with changed as (delete from public.stories where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'stories: cross-user delete matches nothing');
with changed as (update public.stories set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'stories: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.stories', 'TRUNCATE'), 'stories: no truncate grant');
select loremore_test.assert((select count(*)=2 from storage.objects where bucket_id in ('moments','profile-media')), 'only own media objects visible');
select loremore_test.denied($q$insert into storage.objects(bucket_id,name) values ('moments','10000000-0000-0000-0000-000000000002/attack.png')$q$, '42501', 'foreign prefix upload blocked');
select loremore_test.denied($q$update storage.objects set name='10000000-0000-0000-0000-000000000002/moved.png' where bucket_id='moments'$q$, '42501', 'object ownership transfer blocked');
insert into storage.objects(bucket_id,name) values ('moments','10000000-0000-0000-0000-000000000001/photo.png') on conflict (bucket_id,name) do update set metadata='{"updated":true}';
with changed as (update storage.buckets set public=true where id in ('moments','profile-media') returning 1) select loremore_test.assert((select count(*)=0 from changed), 'client cannot publish buckets');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select loremore_test.assert((select count(*) = 1 from public.profiles), 'profiles: only own row visible to user 2');
select loremore_test.denied($q$update public.profiles set user_id='10000000-0000-0000-0000-000000000001' where user_id='10000000-0000-0000-0000-000000000002'$q$, '42501', 'profiles: cannot transfer ownership');
select loremore_test.denied($q$insert into public.profiles select (jsonb_populate_record(null::public.profiles, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000001'))).* from public.profiles t limit 1$q$, '42501', 'profiles: cannot insert as other owner');
with changed as (update public.profiles set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'profiles: cross-user update matches nothing');
with changed as (delete from public.profiles where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'profiles: cross-user delete matches nothing');
with changed as (update public.profiles set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'profiles: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.profiles', 'TRUNCATE'), 'profiles: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.moments), 'moments: only own row visible to user 2');
select loremore_test.denied($q$update public.moments set user_id='10000000-0000-0000-0000-000000000001' where user_id='10000000-0000-0000-0000-000000000002'$q$, '42501', 'moments: cannot transfer ownership');
select loremore_test.denied($q$insert into public.moments select (jsonb_populate_record(null::public.moments, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000001'))).* from public.moments t limit 1$q$, '42501', 'moments: cannot insert as other owner');
with changed as (update public.moments set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moments: cross-user update matches nothing');
with changed as (delete from public.moments where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moments: cross-user delete matches nothing');
with changed as (update public.moments set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'moments: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.moments', 'TRUNCATE'), 'moments: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.moment_media), 'moment_media: only own row visible to user 2');
select loremore_test.denied($q$update public.moment_media set user_id='10000000-0000-0000-0000-000000000001' where user_id='10000000-0000-0000-0000-000000000002'$q$, '42501', 'moment_media: cannot transfer ownership');
select loremore_test.denied($q$insert into public.moment_media select (jsonb_populate_record(null::public.moment_media, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000001'))).* from public.moment_media t limit 1$q$, '42501', 'moment_media: cannot insert as other owner');
with changed as (update public.moment_media set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moment_media: cross-user update matches nothing');
with changed as (delete from public.moment_media where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moment_media: cross-user delete matches nothing');
with changed as (update public.moment_media set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'moment_media: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.moment_media', 'TRUNCATE'), 'moment_media: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.daily_entries), 'daily_entries: only own row visible to user 2');
select loremore_test.denied($q$update public.daily_entries set user_id='10000000-0000-0000-0000-000000000001' where user_id='10000000-0000-0000-0000-000000000002'$q$, '42501', 'daily_entries: cannot transfer ownership');
select loremore_test.denied($q$insert into public.daily_entries select (jsonb_populate_record(null::public.daily_entries, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000001'))).* from public.daily_entries t limit 1$q$, '42501', 'daily_entries: cannot insert as other owner');
with changed as (update public.daily_entries set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'daily_entries: cross-user update matches nothing');
with changed as (delete from public.daily_entries where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'daily_entries: cross-user delete matches nothing');
with changed as (update public.daily_entries set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'daily_entries: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.daily_entries', 'TRUNCATE'), 'daily_entries: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.projects), 'projects: only own row visible to user 2');
select loremore_test.denied($q$update public.projects set user_id='10000000-0000-0000-0000-000000000001' where user_id='10000000-0000-0000-0000-000000000002'$q$, '42501', 'projects: cannot transfer ownership');
select loremore_test.denied($q$insert into public.projects select (jsonb_populate_record(null::public.projects, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000001'))).* from public.projects t limit 1$q$, '42501', 'projects: cannot insert as other owner');
with changed as (update public.projects set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'projects: cross-user update matches nothing');
with changed as (delete from public.projects where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'projects: cross-user delete matches nothing');
with changed as (update public.projects set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'projects: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.projects', 'TRUNCATE'), 'projects: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.moment_projects), 'moment_projects: only own row visible to user 2');
select loremore_test.denied($q$update public.moment_projects set user_id='10000000-0000-0000-0000-000000000001' where user_id='10000000-0000-0000-0000-000000000002'$q$, '42501', 'moment_projects: cannot transfer ownership');
select loremore_test.denied($q$insert into public.moment_projects select (jsonb_populate_record(null::public.moment_projects, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000001'))).* from public.moment_projects t limit 1$q$, '42501', 'moment_projects: cannot insert as other owner');
with changed as (update public.moment_projects set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moment_projects: cross-user update matches nothing');
with changed as (delete from public.moment_projects where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'moment_projects: cross-user delete matches nothing');
with changed as (update public.moment_projects set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'moment_projects: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.moment_projects', 'TRUNCATE'), 'moment_projects: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.interviews), 'interviews: only own row visible to user 2');
select loremore_test.denied($q$update public.interviews set user_id='10000000-0000-0000-0000-000000000001' where user_id='10000000-0000-0000-0000-000000000002'$q$, '42501', 'interviews: cannot transfer ownership');
select loremore_test.denied($q$insert into public.interviews select (jsonb_populate_record(null::public.interviews, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000001'))).* from public.interviews t limit 1$q$, '42501', 'interviews: cannot insert as other owner');
with changed as (update public.interviews set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'interviews: cross-user update matches nothing');
with changed as (delete from public.interviews where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'interviews: cross-user delete matches nothing');
with changed as (update public.interviews set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'interviews: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.interviews', 'TRUNCATE'), 'interviews: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.interview_messages), 'interview_messages: only own row visible to user 2');
select loremore_test.denied($q$update public.interview_messages set user_id='10000000-0000-0000-0000-000000000001' where user_id='10000000-0000-0000-0000-000000000002'$q$, '42501', 'interview_messages: cannot transfer ownership');
select loremore_test.denied($q$insert into public.interview_messages select (jsonb_populate_record(null::public.interview_messages, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000001'))).* from public.interview_messages t limit 1$q$, '42501', 'interview_messages: cannot insert as other owner');
with changed as (update public.interview_messages set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'interview_messages: cross-user update matches nothing');
with changed as (delete from public.interview_messages where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'interview_messages: cross-user delete matches nothing');
with changed as (update public.interview_messages set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'interview_messages: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.interview_messages', 'TRUNCATE'), 'interview_messages: no truncate grant');
select loremore_test.assert((select count(*) = 1 from public.stories), 'stories: only own row visible to user 2');
select loremore_test.denied($q$update public.stories set user_id='10000000-0000-0000-0000-000000000001' where user_id='10000000-0000-0000-0000-000000000002'$q$, '42501', 'stories: cannot transfer ownership');
select loremore_test.denied($q$insert into public.stories select (jsonb_populate_record(null::public.stories, to_jsonb(t) || jsonb_build_object('user_id','10000000-0000-0000-0000-000000000001'))).* from public.stories t limit 1$q$, '42501', 'stories: cannot insert as other owner');
with changed as (update public.stories set user_id=user_id where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'stories: cross-user update matches nothing');
with changed as (delete from public.stories where user_id='10000000-0000-0000-0000-000000000001' returning 1) select loremore_test.assert((select count(*)=0 from changed), 'stories: cross-user delete matches nothing');
with changed as (update public.stories set user_id=user_id where user_id='10000000-0000-0000-0000-000000000002' returning 1) select loremore_test.assert((select count(*)=1 from changed), 'stories: own update succeeds');
select loremore_test.assert(not has_table_privilege(current_user, 'public.stories', 'TRUNCATE'), 'stories: no truncate grant');
select loremore_test.assert((select count(*)=2 from storage.objects where bucket_id in ('moments','profile-media')), 'only own media objects visible');
select loremore_test.denied($q$insert into storage.objects(bucket_id,name) values ('moments','10000000-0000-0000-0000-000000000001/attack.png')$q$, '42501', 'foreign prefix upload blocked');
select loremore_test.denied($q$update storage.objects set name='10000000-0000-0000-0000-000000000001/moved.png' where bucket_id='moments'$q$, '42501', 'object ownership transfer blocked');
insert into storage.objects(bucket_id,name) values ('moments','10000000-0000-0000-0000-000000000002/photo.png') on conflict (bucket_id,name) do update set metadata='{"updated":true}';
with changed as (update storage.buckets set public=true where id in ('moments','profile-media') returning 1) select loremore_test.assert((select count(*)=0 from changed), 'client cannot publish buckets');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select loremore_test.denied($q$insert into public.moment_media(moment_id,object_path,mime_type) values ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001/new.png','image/png')$q$, '23503', 'media cannot point to foreign moment');
select loremore_test.denied($q$insert into public.moment_projects(moment_id,project_id) values ('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002')$q$, '23503', 'foreign project link');
select loremore_test.denied($q$insert into public.moment_projects(moment_id,project_id) values ('20000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001')$q$, '23503', 'foreign moment link');
select loremore_test.denied($q$insert into public.interviews(daily_entry_id) values ('40000000-0000-0000-0000-000000000002')$q$, '23503', 'foreign interview day');
select loremore_test.denied($q$insert into public.interview_messages(interview_id,role,content,sequence) values ('60000000-0000-0000-0000-000000000002','user','intrusion',1)$q$, '23503', 'foreign interview transcript');
select loremore_test.denied($q$update public.stories set daily_entry_id='40000000-0000-0000-0000-000000000002'$q$, '23503', 'foreign story day');
select loremore_test.denied($q$update public.stories set project_id='50000000-0000-0000-0000-000000000002'$q$, '23503', 'foreign story project');
select loremore_test.denied($q$update public.moment_media set object_path='10000000-0000-0000-0000-000000000002/image.png'$q$, '23514', 'foreign media path');
select loremore_test.denied($q$update public.profiles set avatar_path='10000000-0000-0000-0000-000000000002/avatar.png'$q$, '23514', 'foreign avatar path');
select loremore_test.denied($q$update public.moment_media set size_bytes=-1$q$, '23514', 'negative media size');
select loremore_test.denied($q$update public.moments set ai_context='[]'$q$, '23514', 'analysis must be object');
select loremore_test.denied($q$update public.stories set privacy='public'$q$, '23514', 'publishing not implemented');
select loremore_test.denied($q$insert into storage.objects(bucket_id,name) values ('moments','10000000-0000-0000-0000-000000000001/../10000000-0000-0000-0000-000000000002/attack.png')$q$, '42501', 'path traversal rejected');
update public.stories set privacy='publishable';
update public.moments set updated_at='2000-01-01'; select loremore_test.assert((select updated_at > '2000-01-01' from public.moments), 'updated_at generated by database');
reset role;
create policy loremore_test_broad_objects on storage.objects for all to anon, authenticated using (true) with check (true);
create policy loremore_test_broad_buckets on storage.buckets for all to anon, authenticated using (true) with check (true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select loremore_test.assert((select count(*)=2 from storage.objects where bucket_id in ('moments','profile-media')), 'broad policy cannot widen object reads');
select loremore_test.denied($q$insert into storage.objects(bucket_id,name) values ('moments','10000000-0000-0000-0000-000000000002/bypass.png')$q$, '42501', 'broad policy cannot widen writes');
with changed as (update storage.buckets set public=true where id in ('moments','profile-media') returning 1) select loremore_test.assert((select count(*)=0 from changed), 'broad policy cannot publish buckets');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select loremore_test.denied('select * from public.profiles', '42501', 'profiles: anon has no access');
select loremore_test.denied('select * from public.moments', '42501', 'moments: anon has no access');
select loremore_test.denied('select * from public.moment_media', '42501', 'moment_media: anon has no access');
select loremore_test.denied('select * from public.daily_entries', '42501', 'daily_entries: anon has no access');
select loremore_test.denied('select * from public.projects', '42501', 'projects: anon has no access');
select loremore_test.denied('select * from public.moment_projects', '42501', 'moment_projects: anon has no access');
select loremore_test.denied('select * from public.interviews', '42501', 'interviews: anon has no access');
select loremore_test.denied('select * from public.interview_messages', '42501', 'interview_messages: anon has no access');
select loremore_test.denied('select * from public.stories', '42501', 'stories: anon has no access');
select loremore_test.assert((select count(*)=0 from storage.objects where bucket_id in ('moments','profile-media')), 'anon cannot read private objects even with broad policy');
select loremore_test.denied($q$insert into storage.objects(bucket_id,name) values ('moments','10000000-0000-0000-0000-000000000001/anon.png')$q$, '42501', 'anon cannot upload');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

with changed as (delete from public.stories returning 1) select loremore_test.assert((select count(*)=1 from changed), 'stories: owner delete succeeds');
with changed as (delete from public.interview_messages returning 1) select loremore_test.assert((select count(*)=1 from changed), 'interview_messages: owner delete succeeds');
with changed as (delete from public.interviews returning 1) select loremore_test.assert((select count(*)=1 from changed), 'interviews: owner delete succeeds');
with changed as (delete from public.moment_projects returning 1) select loremore_test.assert((select count(*)=1 from changed), 'moment_projects: owner delete succeeds');
with changed as (delete from public.moment_media returning 1) select loremore_test.assert((select count(*)=1 from changed), 'moment_media: owner delete succeeds');
with changed as (delete from public.moments returning 1) select loremore_test.assert((select count(*)=1 from changed), 'moments: owner delete succeeds');
with changed as (delete from public.projects returning 1) select loremore_test.assert((select count(*)=1 from changed), 'projects: owner delete succeeds');
with changed as (delete from public.daily_entries returning 1) select loremore_test.assert((select count(*)=1 from changed), 'daily_entries: owner delete succeeds');
with changed as (delete from public.profiles returning 1) select loremore_test.assert((select count(*)=1 from changed), 'profiles: owner delete succeeds');
-- Physical object deletion is tested through Storage API, not direct SQL.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select loremore_test.assert((select count(*)=1 from public.profiles), 'profiles: other owner deletion has no effect');
select loremore_test.assert((select count(*)=1 from public.moments), 'moments: other owner deletion has no effect');
select loremore_test.assert((select count(*)=1 from public.moment_media), 'moment_media: other owner deletion has no effect');
select loremore_test.assert((select count(*)=1 from public.daily_entries), 'daily_entries: other owner deletion has no effect');
select loremore_test.assert((select count(*)=1 from public.projects), 'projects: other owner deletion has no effect');
select loremore_test.assert((select count(*)=1 from public.moment_projects), 'moment_projects: other owner deletion has no effect');
select loremore_test.assert((select count(*)=1 from public.interviews), 'interviews: other owner deletion has no effect');
select loremore_test.assert((select count(*)=1 from public.interview_messages), 'interview_messages: other owner deletion has no effect');
select loremore_test.assert((select count(*)=1 from public.stories), 'stories: other owner deletion has no effect');
delete from public.moments where id='20000000-0000-0000-0000-000000000002';
select loremore_test.assert((select count(*)=0 from public.moment_media), 'moment delete cascades metadata'); select loremore_test.assert((select count(*)=0 from public.moment_projects), 'moment delete cascades links');
delete from public.daily_entries; select loremore_test.assert((select count(*)=0 from public.interviews), 'day delete cascades interview'); select loremore_test.assert((select count(*)=0 from public.interview_messages), 'day delete cascades transcript'); select loremore_test.assert((select count(*)=0 from public.stories), 'day delete cascades story');
reset role; delete from auth.users where id='10000000-0000-0000-0000-000000000002';
-- User 3 still has the entire graph: verify full account cascading as one statement.
delete from auth.users where id='10000000-0000-0000-0000-000000000003';
select loremore_test.assert((select count(*)=0 from public.profiles), 'profiles: account deletion cascades remaining data');
select loremore_test.assert((select count(*)=0 from public.moments), 'moments: account deletion cascades remaining data');
select loremore_test.assert((select count(*)=0 from public.moment_media), 'moment_media: account deletion cascades remaining data');
select loremore_test.assert((select count(*)=0 from public.daily_entries), 'daily_entries: account deletion cascades remaining data');
select loremore_test.assert((select count(*)=0 from public.projects), 'projects: account deletion cascades remaining data');
select loremore_test.assert((select count(*)=0 from public.moment_projects), 'moment_projects: account deletion cascades remaining data');
select loremore_test.assert((select count(*)=0 from public.interviews), 'interviews: account deletion cascades remaining data');
select loremore_test.assert((select count(*)=0 from public.interview_messages), 'interview_messages: account deletion cascades remaining data');
select loremore_test.assert((select count(*)=0 from public.stories), 'stories: account deletion cascades remaining data');
rollback;
select 'LoreMore ownership, constraints, grants, cascades, and Storage policy checks passed.' as result;
