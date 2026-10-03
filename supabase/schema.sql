-- Rutline: accounts, sync and camps
-- Run this in the Supabase SQL editor (Database > SQL Editor > New query > paste > Run).
-- Safe to re-run; everything is "if not exists" or "create or replace". Re-run it after app updates.

create extension if not exists pgcrypto;

-- ============================================================
-- profiles: one row per user, holds synced settings and a display name
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  settings jsonb not null default '{}'::jsonb,
  settings_updated_at bigint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists display_name text;
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

-- synced_at: server write time, used as the pull cursor
create or replace function public.touch_synced_at()
returns trigger language plpgsql as $$
begin
  new.synced_at = now();
  return new;
end $$;

-- ============================================================
-- camps: a shared map between friends
-- ============================================================
create table if not exists public.camps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.camp_members (
  camp_id uuid not null references public.camps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (camp_id, user_id)
);

-- Security definer so policies can ask "am I a member" without recursing into RLS
create or replace function public.is_camp_member(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.camp_members m where m.camp_id = cid and m.user_id = auth.uid());
$$;

alter table public.camps enable row level security;
alter table public.camp_members enable row level security;
drop policy if exists "camps visible to members" on public.camps;
create policy "camps visible to members" on public.camps for select to authenticated using (public.is_camp_member(id));
drop policy if exists "members see roster" on public.camp_members;
create policy "members see roster" on public.camp_members for select to authenticated using (public.is_camp_member(camp_id));
-- All writes to camps and memberships go through the functions below.

create or replace function public.new_invite_code()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
begin
  for i in 1..8 loop
    code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return code;
end $$;

create or replace function public.create_camp(p_name text)
returns public.camps language plpgsql security definer set search_path = public as $$
declare
  c public.camps;
  code text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Give the camp a name'; end if;
  loop
    code := public.new_invite_code();
    exit when not exists (select 1 from public.camps where invite_code = code);
  end loop;
  insert into public.camps (name, invite_code, created_by) values (trim(p_name), code, auth.uid()) returning * into c;
  insert into public.camp_members (camp_id, user_id, role) values (c.id, auth.uid(), 'owner');
  return c;
end $$;

create or replace function public.join_camp(p_code text)
returns public.camps language plpgsql security definer set search_path = public as $$
declare
  c public.camps;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into c from public.camps where invite_code = upper(trim(coalesce(p_code, '')));
  if not found then raise exception 'No camp has that code'; end if;
  insert into public.camp_members (camp_id, user_id) values (c.id, auth.uid()) on conflict do nothing;
  return c;
end $$;

create or replace function public.leave_camp(p_camp uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  next_owner uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from public.camp_members where camp_id = p_camp and user_id = auth.uid();
  -- take my shared rows back private
  update public.waypoints set camp_id = null where camp_id = p_camp and user_id = auth.uid();
  update public.trails set camp_id = null where camp_id = p_camp and user_id = auth.uid();
  update public.photos set camp_id = null where camp_id = p_camp and user_id = auth.uid();
  if not exists (select 1 from public.camp_members where camp_id = p_camp) then
    delete from public.camps where id = p_camp;
  elsif not exists (select 1 from public.camp_members where camp_id = p_camp and role = 'owner') then
    select user_id into next_owner from public.camp_members where camp_id = p_camp order by joined_at limit 1;
    update public.camp_members set role = 'owner' where camp_id = p_camp and user_id = next_owner;
    update public.camps set created_by = next_owner where id = p_camp;
  end if;
end $$;

create or replace function public.rename_camp(p_camp uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.camps where id = p_camp and created_by = auth.uid()) then raise exception 'Only the camp owner can rename it'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Give the camp a name'; end if;
  update public.camps set name = trim(p_name) where id = p_camp;
end $$;

create or replace function public.rotate_invite_code(p_camp uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  code text;
begin
  if not exists (select 1 from public.camps where id = p_camp and created_by = auth.uid()) then raise exception 'Only the camp owner can change the code'; end if;
  loop
    code := public.new_invite_code();
    exit when not exists (select 1 from public.camps where invite_code = code);
  end loop;
  update public.camps set invite_code = code where id = p_camp;
  return code;
end $$;

create or replace function public.remove_member(p_camp uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.camps where id = p_camp and created_by = auth.uid()) then raise exception 'Only the camp owner can remove members'; end if;
  if p_user = auth.uid() then raise exception 'Use leave camp instead'; end if;
  delete from public.camp_members where camp_id = p_camp and user_id = p_user;
  update public.waypoints set camp_id = null where camp_id = p_camp and user_id = p_user;
  update public.trails set camp_id = null where camp_id = p_camp and user_id = p_user;
  update public.photos set camp_id = null where camp_id = p_camp and user_id = p_user;
end $$;

create or replace function public.my_camps()
returns table (id uuid, name text, invite_code text, role text, member_count bigint, created_by uuid)
language sql security definer stable set search_path = public as $$
  select c.id, c.name, c.invite_code, m.role,
         (select count(*) from public.camp_members x where x.camp_id = c.id) as member_count,
         c.created_by
  from public.camps c
  join public.camp_members m on m.camp_id = c.id and m.user_id = auth.uid()
  order by c.name;
$$;

create or replace function public.camp_roster(p_camp uuid)
returns table (user_id uuid, display_name text, email text, role text, joined_at timestamptz)
language plpgsql security definer stable set search_path = public as $$
begin
  if not public.is_camp_member(p_camp) then raise exception 'Not a member of that camp'; end if;
  return query
    select m.user_id, p.display_name, p.email, m.role, m.joined_at
    from public.camp_members m
    left join public.profiles p on p.id = m.user_id
    where m.camp_id = p_camp
    order by m.joined_at;
end $$;

-- ============================================================
-- waypoints
-- ============================================================
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
alter table public.waypoints add column if not exists camp_id uuid references public.camps (id) on delete set null;
create index if not exists waypoints_user_synced on public.waypoints (user_id, synced_at);
create index if not exists waypoints_camp_synced on public.waypoints (camp_id, synced_at);
alter table public.waypoints enable row level security;
drop policy if exists "own waypoints" on public.waypoints;
drop policy if exists "waypoints read" on public.waypoints;
drop policy if exists "waypoints insert" on public.waypoints;
drop policy if exists "waypoints update" on public.waypoints;
drop policy if exists "waypoints delete" on public.waypoints;
create policy "waypoints read" on public.waypoints for select to authenticated
  using (user_id = auth.uid() or (camp_id is not null and public.is_camp_member(camp_id)));
create policy "waypoints insert" on public.waypoints for insert to authenticated
  with check (user_id = auth.uid() and (camp_id is null or public.is_camp_member(camp_id)));
create policy "waypoints update" on public.waypoints for update to authenticated
  using (user_id = auth.uid() or (camp_id is not null and public.is_camp_member(camp_id)))
  with check (user_id = auth.uid() or camp_id is null or public.is_camp_member(camp_id));
create policy "waypoints delete" on public.waypoints for delete to authenticated using (user_id = auth.uid());
drop trigger if exists waypoints_touch on public.waypoints;
create trigger waypoints_touch before insert or update on public.waypoints
  for each row execute function public.touch_synced_at();

-- ============================================================
-- trails
-- ============================================================
create table if not exists public.trails (
  uid uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text,
  data jsonb not null default '{}'::jsonb,
  client_updated_at bigint not null default 0,
  deleted_at bigint,
  synced_at timestamptz not null default now()
);
alter table public.trails add column if not exists camp_id uuid references public.camps (id) on delete set null;
create index if not exists trails_user_synced on public.trails (user_id, synced_at);
create index if not exists trails_camp_synced on public.trails (camp_id, synced_at);
alter table public.trails enable row level security;
drop policy if exists "own trails" on public.trails;
drop policy if exists "trails read" on public.trails;
drop policy if exists "trails insert" on public.trails;
drop policy if exists "trails update" on public.trails;
drop policy if exists "trails delete" on public.trails;
create policy "trails read" on public.trails for select to authenticated
  using (user_id = auth.uid() or (camp_id is not null and public.is_camp_member(camp_id)));
create policy "trails insert" on public.trails for insert to authenticated
  with check (user_id = auth.uid() and (camp_id is null or public.is_camp_member(camp_id)));
create policy "trails update" on public.trails for update to authenticated
  using (user_id = auth.uid() or (camp_id is not null and public.is_camp_member(camp_id)))
  with check (user_id = auth.uid() or camp_id is null or public.is_camp_member(camp_id));
create policy "trails delete" on public.trails for delete to authenticated using (user_id = auth.uid());
drop trigger if exists trails_touch on public.trails;
create trigger trails_touch before insert or update on public.trails
  for each row execute function public.touch_synced_at();

-- ============================================================
-- photos (metadata; bytes live in the photos storage bucket)
-- ============================================================
create table if not exists public.photos (
  uid uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  waypoint_uid uuid,
  data jsonb not null default '{}'::jsonb,
  client_updated_at bigint not null default 0,
  deleted_at bigint,
  synced_at timestamptz not null default now()
);
alter table public.photos add column if not exists camp_id uuid references public.camps (id) on delete set null;
alter table public.photos add column if not exists path text;
alter table public.photos add column if not exists thumb_path text;
update public.photos set path = data->>'path', thumb_path = data->>'thumbPath' where path is null and data ? 'path';
create index if not exists photos_user_synced on public.photos (user_id, synced_at);
create index if not exists photos_camp_synced on public.photos (camp_id, synced_at);
create index if not exists photos_waypoint on public.photos (waypoint_uid);
create index if not exists photos_path on public.photos (path);
create index if not exists photos_thumb_path on public.photos (thumb_path);
alter table public.photos enable row level security;
drop policy if exists "own photos" on public.photos;
drop policy if exists "photos read" on public.photos;
drop policy if exists "photos insert" on public.photos;
drop policy if exists "photos update" on public.photos;
drop policy if exists "photos delete" on public.photos;
create policy "photos read" on public.photos for select to authenticated
  using (user_id = auth.uid() or (camp_id is not null and public.is_camp_member(camp_id)));
create policy "photos insert" on public.photos for insert to authenticated
  with check (user_id = auth.uid() and (camp_id is null or public.is_camp_member(camp_id)));
create policy "photos update" on public.photos for update to authenticated
  using (user_id = auth.uid() or (camp_id is not null and public.is_camp_member(camp_id)))
  with check (user_id = auth.uid() or camp_id is null or public.is_camp_member(camp_id));
create policy "photos delete" on public.photos for delete to authenticated using (user_id = auth.uid());
drop trigger if exists photos_touch on public.photos;
create trigger photos_touch before insert or update on public.photos
  for each row execute function public.touch_synced_at();

-- Photos follow their pin in and out of a camp
create or replace function public.photos_follow_camp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.camp_id is distinct from old.camp_id then
    update public.photos set camp_id = new.camp_id where waypoint_uid = new.uid;
  end if;
  return new;
end $$;
drop trigger if exists waypoints_share_photos on public.waypoints;
create trigger waypoints_share_photos after update of camp_id on public.waypoints
  for each row execute function public.photos_follow_camp();

-- ============================================================
-- storage bucket for photo bytes: private, one folder per user, camp members may read shared ones
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "photos read own" on storage.objects;
create policy "photos read own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos read shared" on storage.objects;
create policy "photos read shared" on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and exists (
      select 1 from public.photos p
      where (p.path = name or p.thumb_path = name)
        and p.camp_id is not null
        and public.is_camp_member(p.camp_id)
    )
  );
drop policy if exists "photos write own" on storage.objects;
create policy "photos write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos update own" on storage.objects;
create policy "photos update own" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos delete own" on storage.objects;
create policy "photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- account deletion from inside the app (Apple requires it)
-- The app removes the user's photo files through the Storage API first; Supabase does not
-- allow deleting storage objects from inside a function. Deleting the auth user cascades
-- to profiles, memberships, waypoints, trails and photos rows.
-- ============================================================
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
