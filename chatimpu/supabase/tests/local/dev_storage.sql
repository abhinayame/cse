-- LOCAL TEST STACK ONLY (not a migration): lets the dev gateway ask Postgres whether the caller's JWT
-- may write/read/delete an object, so the real storage.objects RLS policies decide.
create or replace function public.dev_storage_insert(p_bucket text, p_name text) returns boolean language plpgsql security invoker as $$
begin insert into storage.objects (bucket_id, name, owner) values (p_bucket, p_name, auth.uid()); return true; end $$;
create or replace function public.dev_storage_can_read(p_bucket text, p_name text) returns boolean language sql stable security invoker as $$
  select exists (select 1 from storage.objects where bucket_id = p_bucket and name = p_name) $$;
create or replace function public.dev_storage_delete(p_bucket text, p_names text[]) returns setof text language sql security invoker as $$
  delete from storage.objects where bucket_id = p_bucket and name = any(p_names) returning name $$;
create or replace function public.dev_bucket_public(p_bucket text) returns boolean language sql stable security definer as $$
  select coalesce((select public from storage.buckets where id = p_bucket), false) $$;
create unique index if not exists dev_objects_uniq on storage.objects (bucket_id, name);
grant execute on function public.dev_storage_insert, public.dev_storage_can_read, public.dev_storage_delete, public.dev_bucket_public to anon, authenticated, service_role;
notify pgrst, 'reload schema';
