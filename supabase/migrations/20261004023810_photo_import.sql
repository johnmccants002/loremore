-- Preserve the source's literal timestamp: EXIF often has no timezone.
alter table public.moment_media add column source_timestamp text
  check (char_length(source_timestamp) <= 100);

-- A single transaction prevents half-created timeline cards. IDs are supplied by
-- the client so repeating a request after a lost response is safe.
create function public.save_photo_import(
  p_id uuid, p_captured_at timestamptz, p_size_bytes bigint,
  p_width integer, p_height integer, p_source_timestamp text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  photo_path text := owner_id::text || '/' || p_id::text || '.jpg';
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'moments' and name = photo_path) then
    raise exception 'Upload the photo before saving its moment';
  end if;
  insert into public.moments(id, user_id, kind, source, captured_at)
    values(p_id, owner_id, 'photo', 'manual_import', p_captured_at)
    on conflict (id) do nothing;
  if not exists (select 1 from public.moments where id = p_id and user_id = owner_id
      and kind = 'photo' and source = 'manual_import' and captured_at = p_captured_at) then
    raise exception 'Import ID is already in use';
  end if;
  insert into public.moment_media(id, user_id, moment_id, object_path, mime_type,
      size_bytes, width, height, source_timestamp)
    values(p_id, owner_id, p_id, photo_path, 'image/jpeg', p_size_bytes,
      p_width, p_height, p_source_timestamp)
    on conflict (id) do nothing;
  if not exists (select 1 from public.moment_media where id = p_id and user_id = owner_id
      and moment_id = p_id and object_path = photo_path) then
    raise exception 'Media ID is already in use';
  end if;
  return p_id;
end;
$$;
revoke all on function public.save_photo_import(uuid,timestamptz,bigint,integer,integer,text) from public, anon;
grant execute on function public.save_photo_import(uuid,timestamptz,bigint,integer,integer,text) to authenticated;
