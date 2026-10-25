-- Server-owned leases and quotas are outside the exposed API schema. Clients
-- cannot forge completion, reset retry counters, or take over a worker lease.
create table private.moment_analysis_jobs (
  moment_id uuid primary key,
  user_id uuid not null,
  token uuid not null default gen_random_uuid(),
  status text not null check (status in ('pending','complete','failed')),
  started_at timestamptz not null default now(),
  attempts integer not null default 0,
  foreign key (user_id,moment_id) references public.moments(user_id,id) on delete cascade
);
create index moment_analysis_jobs_user_idx on private.moment_analysis_jobs(user_id);
create table private.analysis_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  requests integer not null default 0
);
alter table private.moment_analysis_jobs enable row level security;
alter table private.analysis_limits enable row level security;
revoke all on private.moment_analysis_jobs, private.analysis_limits from public, anon, authenticated;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.moment_analysis_jobs, private.analysis_limits to service_role;

create function public.claim_moment_analysis(p_moment_id uuid, p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  job private.moment_analysis_jobs;
  limits private.analysis_limits;
  media public.moment_media;
  new_token uuid := gen_random_uuid();
begin
  -- Lock the parent first: this serializes duplicate claims, including the first.
  perform 1 from public.moments where id=p_moment_id and user_id=p_user_id
    and kind='photo' and archived_at is null for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  select * into media from public.moment_media where moment_id=p_moment_id and user_id=p_user_id
    and bucket_id='moments' and mime_type in ('image/jpeg','image/png','image/webp') order by created_at,id limit 1;
  if not found then return jsonb_build_object('status','not_found'); end if;
  select * into job from private.moment_analysis_jobs where moment_id=p_moment_id for update;
  if found then
    if job.status='complete' then return jsonb_build_object('status','complete'); end if;
    if job.status='pending' and job.started_at > now()-interval '2 minutes' then return jsonb_build_object('status','pending'); end if;
    if job.attempts >= 5 then
      update public.moments set analysis_status='failed', ai_context=jsonb_build_object('error_code','attempt_limit') where id=p_moment_id;
      return jsonb_build_object('status','attempt_limit');
    end if;
  end if;
  insert into private.analysis_limits(user_id) values(p_user_id) on conflict do nothing;
  select * into limits from private.analysis_limits where user_id=p_user_id for update;
  if limits.window_start <= now()-interval '1 day' then
    update private.analysis_limits set window_start=now(),requests=0 where user_id=p_user_id;
    limits.requests := 0;
  end if;
  if limits.requests >= 50 then
    update public.moments set analysis_status='failed', ai_context=jsonb_build_object('error_code','daily_limit') where id=p_moment_id;
    return jsonb_build_object('status','daily_limit');
  end if;
  update private.analysis_limits set requests=requests+1 where user_id=p_user_id;
  insert into private.moment_analysis_jobs(moment_id,user_id,token,status,attempts)
    values(p_moment_id,p_user_id,new_token,'pending',1)
    on conflict (moment_id) do update set token=excluded.token,status='pending',started_at=now(),attempts=private.moment_analysis_jobs.attempts+1;
  update public.moments set analysis_status='pending', ai_context=jsonb_build_object('started_at',now()) where id=p_moment_id;
  return jsonb_build_object('status','claimed','token',new_token,'path',media.object_path);
end;
$$;

create function public.finish_moment_analysis(p_moment_id uuid, p_user_id uuid, p_token uuid, p_context jsonb, p_success boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_context) <> 'object' or octet_length(p_context::text)>16000 then raise exception 'Invalid analysis'; end if;
  -- Use the same parent-then-job lock order as claim to avoid deadlocks.
  perform 1 from public.moments where id=p_moment_id and user_id=p_user_id and archived_at is null for update;
  if not found then return false; end if;
  -- Match the lease, so a late worker cannot overwrite a newer retry.
  update private.moment_analysis_jobs set status=case when p_success then 'complete' else 'failed' end
    where moment_id=p_moment_id and user_id=p_user_id and token=p_token and status='pending';
  if not found then return false; end if;
  update public.moments set analysis_status=case when p_success then 'complete' else 'failed' end,
    ai_context=p_context,
    title=case when p_success and title is null then left(p_context->>'title',300) else title end
    where id=p_moment_id and user_id=p_user_id and archived_at is null;
  return found;
end;
$$;
revoke all on function public.claim_moment_analysis(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_moment_analysis(uuid,uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.claim_moment_analysis(uuid,uuid) to service_role;
grant execute on function public.finish_moment_analysis(uuid,uuid,uuid,jsonb,boolean) to service_role;
