-- Código do Amor — setup and re-runnable migration from the original schema.
-- Deploy shared-surprise before switching the frontend. See README.md.
begin;

create table if not exists public.surprises (
  id uuid primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  draft jsonb not null,
  public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.surprises add column if not exists published_draft jsonb;
alter table public.surprises add column if not exists published_at timestamptz;
-- Preserve existing published stories and their links as a frozen snapshot.
update public.surprises
set published_draft = draft, published_at = updated_at
where public = true and published_draft is null;

create index if not exists surprises_owner_idx on public.surprises (owner, updated_at desc);
alter table public.surprises enable row level security;
revoke all on public.surprises from anon;
grant select, insert, update, delete on public.surprises to authenticated;
grant all on public.surprises to service_role;

drop policy if exists "anyone reads public surprises" on public.surprises;
drop policy if exists "owner reads own surprises" on public.surprises;
drop policy if exists "owner inserts own surprises" on public.surprises;
drop policy if exists "owner updates own surprises" on public.surprises;
drop policy if exists "owner deletes own surprises" on public.surprises;
create policy "owner reads own surprises" on public.surprises for select to authenticated
  using ((select auth.uid()) = owner);
create policy "owner inserts own surprises" on public.surprises for insert to authenticated
  with check ((select auth.uid()) = owner);
create policy "owner updates own surprises" on public.surprises for update to authenticated
  using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy "owner deletes own surprises" on public.surprises for delete to authenticated
  using ((select auth.uid()) = owner);

-- New uploads are private and immutable. The legacy public bucket is retained:
-- making it private here would break existing exports/links that reference it.
insert into storage.buckets (id, name, public, file_size_limit)
values ('surprise-media', 'surprise-media', false, 41943040)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "owner uploads own media" on storage.objects;
drop policy if exists "owner updates own media" on storage.objects;
drop policy if exists "owner deletes own media" on storage.objects;
drop policy if exists "owner reads private media" on storage.objects;
drop policy if exists "owner inserts private media" on storage.objects;
drop policy if exists "owner deletes private media" on storage.objects;
create policy "owner reads private media" on storage.objects for select to authenticated
  using (bucket_id = 'surprise-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner inserts private media" on storage.objects for insert to authenticated
  with check (bucket_id = 'surprise-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "owner deletes private media" on storage.objects for delete to authenticated
  using (bucket_id = 'surprise-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- No UPDATE policy: new content gets a new hash instead of replacing live media.
commit;
