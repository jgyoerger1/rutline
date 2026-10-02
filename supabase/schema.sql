-- Rutline: accounts and sync
-- Run this once in the Supabase SQL editor (Database > SQL Editor > New query > paste > Run).
-- Safe to re-run; everything is "if not exists" or "create or replace".

create extension if not exists pgcrypto;

-- ---------- profiles: one row per user, holds synced settings ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  settings jsonb not null default '{}'::jsonb,
  settings_updated_at bigint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles are private" on public.profiles;
create policy "profiles are private" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- synced_at: server write time, used as the pull cursor ----------
create or replace function public.touch_synced_at()
returns trigger language plpgsql as $$
begin
  new.synced_at = now();
  return new;
end $$;

-- ---------- waypoints ----------
create table if not exists public.waypoints (
  uid uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text,
  lat double precision,
  lon double precision,
  data jsonb not null default '{}'::jsonb,
  client_updated_at bigint not null default 0,
  deleted_at bigint,
  synced_at timestamptz not null default now()
);
create index if not exists waypoints_user_synced on public.waypoints (user_id, synced_at);
alter table public.waypoints enable row level security;
drop policy if exists "own waypoints" on public.waypoints;
create policy "own waypoints" on public.waypoints
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists waypoints_touch on public.waypoints;
create trigger waypoints_touch before insert or update on public.waypoints
  for each row execute function public.touch_synced_at();

-- ---------- trails ----------
create table if not exists public.trails (
  uid uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text,
  data jsonb not null default '{}'::jsonb,
  client_updated_at bigint not null default 0,
  deleted_at bigint,
  synced_at timestamptz not null default now()
);
create index if not exists trails_user_synced on public.trails (user_id, synced_at);
alter table public.trails enable row level security;
drop policy if exists "own trails" on public.trails;
create policy "own trails" on public.trails
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists trails_touch on public.trails;
create trigger trails_touch before insert or update on public.trails
  for each row execute function public.touch_synced_at();

-- ---------- photos (metadata; bytes live in the photos storage bucket) ----------
create table if not exists public.photos (
  uid uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  waypoint_uid uuid,
  data jsonb not null default '{}'::jsonb,
  client_updated_at bigint not null default 0,
  deleted_at bigint,
  synced_at timestamptz not null default now()
);
create index if not exists photos_user_synced on public.photos (user_id, synced_at);
create index if not exists photos_waypoint on public.photos (waypoint_uid);
alter table public.photos enable row level security;
drop policy if exists "own photos" on public.photos;
create policy "own photos" on public.photos
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop trigger if exists photos_touch on public.photos;
create trigger photos_touch before insert or update on public.photos
  for each row execute function public.touch_synced_at();

-- ---------- storage bucket for photo bytes: private, one folder per user ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "photos read own" on storage.objects;
create policy "photos read own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos write own" on storage.objects;
create policy "photos write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos update own" on storage.objects;
create policy "photos update own" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos delete own" on storage.objects;
create policy "photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- account deletion from inside the app (Apple requires it) ----------
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from storage.objects where bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
