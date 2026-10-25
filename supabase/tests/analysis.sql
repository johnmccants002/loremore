-- Disposable local database only: fixtures and mutations roll back.
begin;
insert into auth.users(id,email) values ('a1000000-0000-4000-8000-000000000001','analysis@loremore.test');
insert into public.moments(id,user_id,kind,source,title) values
 ('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','photo','manual_import',null),
 ('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','photo','share_extension','My own title');
insert into public.moment_media(user_id,moment_id,object_path,mime_type) values
 ('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001/one.jpg','image/jpeg'),
 ('a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001/two.jpg','image/jpeg');
do $$
begin
 if has_function_privilege('authenticated','public.claim_moment_analysis(uuid,uuid)','execute')
 or has_function_privilege('anon','public.finish_moment_analysis(uuid,uuid,uuid,jsonb,boolean)','execute')
 or has_table_privilege('authenticated','private.moment_analysis_jobs','select')
 or has_table_privilege('authenticated','private.analysis_limits','update') then raise exception 'Server-only analysis access leaked'; end if;
end $$;
set local role service_role;
do $$
declare
 owner_id uuid := 'a1000000-0000-4000-8000-000000000001';
 target_id uuid := 'a2000000-0000-4000-8000-000000000001';
 other_id uuid := 'a2000000-0000-4000-8000-000000000002';
 first_claim jsonb;
 retry_claim jsonb;
begin
 if public.claim_moment_analysis(target_id,'a1000000-0000-4000-8000-000000000002')->>'status' <> 'not_found' then raise exception 'Foreign owner accepted'; end if;
 first_claim := public.claim_moment_analysis(target_id,owner_id);
 if first_claim->>'status' <> 'claimed' then raise exception 'First claim failed'; end if;
 if public.claim_moment_analysis(target_id,owner_id)->>'status' <> 'pending' then raise exception 'Duplicate charged'; end if;
 if (select requests from private.analysis_limits where user_id=owner_id) <> 1 then raise exception 'Duplicate consumed quota'; end if;
 update private.moment_analysis_jobs set started_at=now()-interval '3 minutes' where moment_id='a2000000-0000-4000-8000-000000000001';
 retry_claim := public.claim_moment_analysis(target_id,owner_id);
 if retry_claim->>'status' <> 'claimed' or retry_claim->>'token'=first_claim->>'token' then raise exception 'Stale lease not replaced'; end if;
 if public.finish_moment_analysis(target_id,owner_id,(first_claim->>'token')::uuid,'{"title":"stale"}',true) then raise exception 'Stale result accepted'; end if;
 if not public.finish_moment_analysis(target_id,owner_id,(retry_claim->>'token')::uuid,'{"title":"Suggested title"}',true) then raise exception 'Completion failed'; end if;
 if public.claim_moment_analysis(target_id,owner_id)->>'status' <> 'complete' then raise exception 'Completed job recharged'; end if;
 if (select title from public.moments where id=target_id) <> 'Suggested title' then raise exception 'Generated title missing'; end if;
 first_claim := public.claim_moment_analysis(other_id,owner_id);
 perform public.finish_moment_analysis(other_id,owner_id,(first_claim->>'token')::uuid,'{"title":"Do not replace"}',true);
 if (select title from public.moments where id=other_id) <> 'My own title' then raise exception 'User title overwritten'; end if;
 update private.moment_analysis_jobs set status='failed',attempts=5 where moment_id=other_id;
 if public.claim_moment_analysis(other_id,owner_id)->>'status' <> 'attempt_limit' then raise exception 'Attempt limit bypassed'; end if;
 update private.moment_analysis_jobs set attempts=1 where moment_id=other_id;
 update private.analysis_limits set requests=50 where user_id=owner_id;
 if public.claim_moment_analysis(other_id,owner_id)->>'status' <> 'daily_limit' then raise exception 'Daily limit bypassed'; end if;
 update private.analysis_limits set window_start=now()-interval '2 days' where user_id=owner_id;
 if public.claim_moment_analysis(other_id,owner_id)->>'status' <> 'claimed' then raise exception 'Daily quota did not reset'; end if;
 update public.moments set archived_at=now() where id=target_id;
 if public.claim_moment_analysis(target_id,owner_id)->>'status' <> 'not_found' then raise exception 'Archived photo accepted'; end if;
end $$;
rollback;
