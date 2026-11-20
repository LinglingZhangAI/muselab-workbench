-- Run once in the SQL Editor of your FREE Supabase project. Safe to rerun.
begin;
create table if not exists public.muselab_documents (
 key text primary key,
 value jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.muselab_state (
 key text primary key,
 value text not null,
 revision uuid not null default gen_random_uuid(),
 updated_at timestamptz not null default now()
);
alter table public.muselab_documents enable row level security;
alter table public.muselab_state enable row level security;
revoke all on public.muselab_documents,public.muselab_state from anon,authenticated;
grant all on public.muselab_documents,public.muselab_state to service_role;

-- Serialize comparisons inside PostgreSQL, including concurrent first writes.
create or replace function public.muselab_save_state(p_key text,p_value text,p_expected text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_revision text; next_revision uuid;
begin
 if not (p_key in ('muselab-notes:v1','muselab-folders:v1','muselab-note-folders:v1','eagle-prompt-library:v1','muselab-whiteboard:v1')
  or p_key ~ '^muselab-timeline:v2:[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
  raise exception 'Invalid state key';
 end if;
 if octet_length(p_value)>25165824 then raise exception 'State too large'; end if;
 if jsonb_typeof(p_value::jsonb) <> (case when p_key='muselab-whiteboard:v1' then 'object' else 'array' end) then
  raise exception 'Invalid state value';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key,0));
 select revision::text into current_revision from public.muselab_state where key=p_key;
 if coalesce(current_revision,'')<>coalesce(p_expected,'') then return jsonb_build_object('saved',false); end if;
 next_revision=gen_random_uuid();
 insert into public.muselab_state(key,value,revision) values(p_key,p_value,next_revision)
 on conflict(key) do update set value=excluded.value,revision=excluded.revision,updated_at=now();
 return jsonb_build_object('saved',true,'revision',next_revision);
end;
$$;
revoke all on function public.muselab_save_state(text,text,text) from public,anon,authenticated;
grant execute on function public.muselab_save_state(text,text,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('muselab-media','muselab-media',false,5242880,array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict(id) do nothing;
commit;
notify pgrst, 'reload schema';
select to_regclass('public.muselab_documents') as documents_table,
 to_regclass('public.muselab_state') as state_table,
 (select name from storage.buckets where id='muselab-media' and public=false) as private_bucket;
