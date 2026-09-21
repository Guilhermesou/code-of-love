-- Código do Amor — esquema Supabase (nuvem opcional)
-- Rode este script uma vez no SQL Editor do seu projeto em supabase.com.

create table if not exists public.surprises (
  id uuid primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  slug text not null unique,
  draft jsonb not null,
  public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists surprises_owner_idx on public.surprises (owner, updated_at desc);

alter table public.surprises enable row level security;

create policy "owner reads own surprises"
  on public.surprises for select
  using (auth.uid() = owner);

create policy "anyone reads public surprises"
  on public.surprises for select
  using (public = true);

create policy "owner inserts own surprises"
  on public.surprises for insert
  with check (auth.uid() = owner);

create policy "owner updates own surprises"
  on public.surprises for update
  using (auth.uid() = owner)
  with check (auth.uid() = owner);

create policy "owner deletes own surprises"
  on public.surprises for delete
  using (auth.uid() = owner);

-- Storage: bucket público para mídia (fotos, áudio, vídeo).
-- Leitura é pública (necessária para abrir um link compartilhado sem login);
-- escrita é restrita à própria pasta do usuário ("<user_id>/...").
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "anyone reads media"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "owner uploads own media"
  on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner updates own media"
  on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner deletes own media"
  on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
