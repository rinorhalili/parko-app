-- Parko Kosovo parking application schema.
-- Run in a Supabase PostgreSQL database with PostGIS enabled.

create extension if not exists pgcrypto;
create extension if not exists postgis;

do $$
begin
  create type public.user_role as enum ('USER', 'ADMIN');
exception when duplicate_object then null;
end $$;

-- Community roles are enforced in the database, never supplied by the client.
alter type public.user_role add value if not exists 'MODERATOR' before 'ADMIN';

do $$
begin
  create type public.spot_type as enum ('FREE', 'PAID_PUBLIC', 'PRIVATE', 'STREET_RISKY');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.spot_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.alert_type as enum ('SPIDER', 'POLICE', 'FULL', 'BLOCKED');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name varchar(200),
  email varchar(320) not null unique,
  phone_number varchar(40),
  role public.user_role not null default 'USER',
  karma_score integer not null default 0 check (karma_score >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username varchar(50) unique;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio varchar(500);
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.parking_spots (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles(id) on delete set null,
  title varchar(200) not null,
  description text,
  city varchar(100) not null,
  address varchar(300),
  type public.spot_type not null,
  status public.spot_status not null default 'PENDING',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location geography(Point, 4326) not null,
  price_per_hour numeric(5,2) check (price_per_hour is null or price_per_hour >= 0),
  zone varchar(50),
  sms_number varchar(20),
  is_covered boolean not null default false,
  is_suv_friendly boolean not null default true,
  street_view_url text,
  photo_urls text[],
  upvotes integer not null default 0 check (upvotes >= 0),
  downvotes integer not null default 0 check (downvotes >= 0),
  created_at timestamptz not null default now(),
  constraint parking_spots_free_price_check check (
    type <> 'FREE' or price_per_hour is null or price_per_hour = 0
  )
);

create table if not exists public.realtime_alerts (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid references public.parking_spots(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  alert_type public.alert_type not null,
  note text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location geography(Point, 4326) not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint realtime_alerts_expiry_check check (expires_at > created_at)
);

create table if not exists public.spot_reviews_vouches (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.parking_spots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_still_free boolean not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint one_review_vouch_per_user unique (spot_id, user_id)
);

create or replace function public.set_point_location()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  return new;
end;
$$;

drop trigger if exists parking_spots_set_location on public.parking_spots;
create trigger parking_spots_set_location
before insert or update of latitude, longitude on public.parking_spots
for each row execute function public.set_point_location();

drop trigger if exists realtime_alerts_set_location on public.realtime_alerts;
create trigger realtime_alerts_set_location
before insert or update of latitude, longitude on public.realtime_alerts
for each row execute function public.set_point_location();

create index if not exists parking_spots_location_gist
  on public.parking_spots using gist (location);
create index if not exists realtime_alerts_location_gist
  on public.realtime_alerts using gist (location);
create index if not exists parking_spots_status_idx on public.parking_spots (status);
create index if not exists parking_spots_city_idx on public.parking_spots (city);
create index if not exists parking_spots_submitted_by_idx on public.parking_spots (submitted_by);
create index if not exists realtime_alerts_spot_id_idx on public.realtime_alerts (spot_id);
create index if not exists realtime_alerts_reported_by_idx on public.realtime_alerts (reported_by);
create index if not exists realtime_alerts_expires_at_idx on public.realtime_alerts (expires_at);
create index if not exists spot_reviews_vouches_spot_id_idx on public.spot_reviews_vouches (spot_id);
create index if not exists spot_reviews_vouches_user_id_idx on public.spot_reviews_vouches (user_id);

create or replace function public.get_spots_in_bbox(
  min_lat float,
  max_lat float,
  min_lng float,
  max_lng float
)
returns table (
  id uuid,
  submitted_by uuid,
  title varchar,
  description text,
  city varchar,
  address varchar,
  type public.spot_type,
  status public.spot_status,
  latitude double precision,
  longitude double precision,
  location geography(Point, 4326),
  price_per_hour numeric(5,2),
  zone varchar,
  sms_number varchar,
  is_covered boolean,
  is_suv_friendly boolean,
  street_view_url text,
  photo_urls text[],
  upvotes integer,
  downvotes integer,
  created_at timestamptz,
  active_alert_count bigint
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    s.id, s.submitted_by, s.title, s.description, s.city, s.address,
    s.type, s.status, s.latitude, s.longitude, s.location,
    s.price_per_hour, s.zone, s.sms_number, s.is_covered, s.is_suv_friendly,
    s.street_view_url, s.photo_urls, s.upvotes, s.downvotes, s.created_at,
    count(a.id) filter (where a.expires_at > now()) as active_alert_count
  from public.parking_spots s
  left join public.realtime_alerts a
    on a.spot_id = s.id
   and a.expires_at > now()
  where s.status = 'APPROVED'
    and s.location && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  group by s.id
  order by s.location <-> st_setsrid(
    st_makepoint((min_lng + max_lng) / 2, (min_lat + max_lat) / 2), 4326
  )::geography;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'ADMIN'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'USER'::public.user_role
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name),
        email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant select on public.parking_spots, public.realtime_alerts, public.spot_reviews_vouches
  to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.parking_spots,
  public.realtime_alerts, public.spot_reviews_vouches to authenticated;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
revoke all on function public.handle_new_user() from public;
revoke all on function public.get_spots_in_bbox(float, float, float, float) from public;
grant execute on function public.get_spots_in_bbox(float, float, float, float) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.parking_spots enable row level security;
alter table public.realtime_alerts enable row level security;
alter table public.spot_reviews_vouches enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
for select to authenticated using ((select auth.uid()) = id or public.is_admin());
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
for update to authenticated
using ((select auth.uid()) = id or public.is_admin())
with check ((select auth.uid()) = id or public.is_admin());

drop policy if exists parking_spots_select_approved on public.parking_spots;
create policy parking_spots_select_approved on public.parking_spots
for select to anon, authenticated using (status = 'APPROVED' or submitted_by = (select auth.uid()) or public.is_admin());
drop policy if exists parking_spots_insert_own on public.parking_spots;
create policy parking_spots_insert_own on public.parking_spots
for insert to authenticated with check (submitted_by = (select auth.uid()) or public.is_admin());
drop policy if exists parking_spots_update_own_or_admin on public.parking_spots;
create policy parking_spots_update_own_or_admin on public.parking_spots
for update to authenticated
using (submitted_by = (select auth.uid()) or public.is_admin())
with check (submitted_by = (select auth.uid()) or public.is_admin());
drop policy if exists parking_spots_delete_own_or_admin on public.parking_spots;
create policy parking_spots_delete_own_or_admin on public.parking_spots
for delete to authenticated using (submitted_by = (select auth.uid()) or public.is_admin());

drop policy if exists realtime_alerts_select_active_or_owner on public.realtime_alerts;
create policy realtime_alerts_select_active_or_owner on public.realtime_alerts
for select to anon, authenticated
using (expires_at > now() or reported_by = (select auth.uid()) or public.is_admin());
drop policy if exists realtime_alerts_insert_own on public.realtime_alerts;
create policy realtime_alerts_insert_own on public.realtime_alerts
for insert to authenticated with check (reported_by = (select auth.uid()));
drop policy if exists realtime_alerts_update_own_or_admin on public.realtime_alerts;
create policy realtime_alerts_update_own_or_admin on public.realtime_alerts
for update to authenticated
using (reported_by = (select auth.uid()) or public.is_admin())
with check (reported_by = (select auth.uid()) or public.is_admin());
drop policy if exists realtime_alerts_delete_own_or_admin on public.realtime_alerts;
create policy realtime_alerts_delete_own_or_admin on public.realtime_alerts
for delete to authenticated using (reported_by = (select auth.uid()) or public.is_admin());

drop policy if exists spot_reviews_select_public on public.spot_reviews_vouches;
create policy spot_reviews_select_public on public.spot_reviews_vouches
for select to anon, authenticated using (true);
drop policy if exists spot_reviews_insert_own on public.spot_reviews_vouches;
create policy spot_reviews_insert_own on public.spot_reviews_vouches
for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists spot_reviews_update_own_or_admin on public.spot_reviews_vouches;
create policy spot_reviews_update_own_or_admin on public.spot_reviews_vouches
for update to authenticated
using (user_id = (select auth.uid()) or public.is_admin())
with check (user_id = (select auth.uid()) or public.is_admin());
drop policy if exists spot_reviews_delete_own_or_admin on public.spot_reviews_vouches;
create policy spot_reviews_delete_own_or_admin on public.spot_reviews_vouches
for delete to authenticated using (user_id = (select auth.uid()) or public.is_admin());

-- Development administrator. The trigger creates the profile for new users; this
-- upsert also repairs an existing auth user whose profile row is missing.
do $$
declare
  admin_id uuid;
begin
  select id
  into admin_id
  from auth.users
  where email = 'bledar@email.com'
  limit 1;

  if admin_id is null then
    insert into auth.users (
      id, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
      raw_user_meta_data, aud, role
    )
    values (
      gen_random_uuid(),
      'bledar@email.com',
      crypt('admin', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"role":"ADMIN","full_name":"Bledar"}'::jsonb,
      'authenticated',
      'authenticated'
    )
    returning id into admin_id;
  else
    update auth.users
    set encrypted_password = crypt('admin', gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = '{"role":"ADMIN","full_name":"Bledar"}'::jsonb
    where id = admin_id;
  end if;

  insert into public.profiles (id, full_name, email, role)
  select id, nullif(raw_user_meta_data ->> 'full_name', ''), email, 'ADMIN'::public.user_role
  from auth.users
  where id = admin_id
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = excluded.email,
    role = 'ADMIN'::public.user_role;
end
$$;

-- Demonstration data. submitted_by is null because auth.users is managed by Supabase.
insert into public.parking_spots (
  id, title, description, city, address, type, status, latitude, longitude,
  price_per_hour, zone, sms_number, is_covered, is_suv_friendly
)
values
  (
    'c1d6d93a-1f5b-4f4f-87d4-6cc5ddf3c101',
    'Dardania Public Parking',
    'Public parking near the Dardania neighborhood.',
    'Prishtina', 'Dardania, Prishtina', 'PAID_PUBLIC', 'APPROVED',
    42.6519, 21.1512, 0.50, 'Zone 1', '55123', false, true
  ),
  (
    'c1d6d93a-1f5b-4f4f-87d4-6cc5ddf3c102',
    'Underground Parking Center',
    'Covered underground parking in central Prishtina.',
    'Prishtina', 'City Center, Prishtina', 'PAID_PUBLIC', 'APPROVED',
    42.6626, 21.1636, 1.00, 'Zone 1', '55123', true, true
  ),
  (
    'c1d6d93a-1f5b-4f4f-87d4-6cc5ddf3c103',
    'Lakrishtë Street Risky',
    'Street parking; use caution and verify local restrictions.',
    'Prishtina', 'Lakrishtë, Prishtina', 'STREET_RISKY', 'APPROVED',
    42.6575, 21.1459, null, null, null, false, true
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  city = excluded.city,
  address = excluded.address,
  type = excluded.type,
  status = excluded.status,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  price_per_hour = excluded.price_per_hour,
  zone = excluded.zone,
  sms_number = excluded.sms_number,
  is_covered = excluded.is_covered,
  is_suv_friendly = excluded.is_suv_friendly;

-- Community domain ---------------------------------------------------------
-- These tables use auth.users as the identity provider and PostGIS for all
-- location-aware operations. Apply this file in the Supabase SQL editor.
do $$ begin
  create type public.parking_availability as enum ('AVAILABLE', 'OCCUPIED', 'UNKNOWN');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.content_report_status as enum ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.reaction_type as enum ('LIKE', 'HELPFUL', 'THANKS');
exception when duplicate_object then null; end $$;

create table if not exists public.community_parking_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  -- OSM ids are strings, so reports may target either an OSM parking feature
  -- or a user-submitted UUID parking_spot.
  external_parking_id text not null check (char_length(external_parking_id) between 1 and 200),
  status public.parking_availability not null,
  note varchar(500),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location geography(Point, 4326) not null,
  confidence smallint not null default 50 check (confidence between 0 and 100),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  constraint community_parking_reports_expiry check (expires_at > created_at)
);

create table if not exists public.street_alerts (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  kind public.alert_type not null check (kind in ('POLICE', 'SPIDER', 'FULL', 'BLOCKED')),
  street varchar(200) not null,
  zone varchar(100) not null,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  expires_at timestamptz not null default (now() + interval '45 minutes'),
  created_at timestamptz not null default now(),
  constraint street_alerts_expiry check (expires_at > created_at)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title varchar(180),
  content varchar(5000) not null check (char_length(trim(content)) > 0),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  parking_spot_id uuid references public.parking_spots(id) on delete set null,
  media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  content varchar(2000) not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  type public.reaction_type not null default 'LIKE',
  created_at timestamptz not null default now(),
  constraint reaction_target check ((post_id is not null) <> (comment_id is not null)),
  unique nulls not distinct (user_id, post_id, comment_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type varchar(40) not null,
  title varchar(180) not null,
  message varchar(1000) not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type varchar(30) not null check (target_type in ('POST', 'COMMENT', 'PARKING_REPORT', 'USER')),
  target_id uuid not null,
  reason varchar(500) not null,
  status public.content_report_status not null default 'OPEN',
  moderator_id uuid references public.profiles(id) on delete set null,
  resolution_note varchar(1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null check (delta between -100 and 100),
  reason varchar(180) not null,
  related_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action varchar(120) not null,
  target_type varchar(50),
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists community_reports_active_idx on public.community_parking_reports (external_parking_id, expires_at, created_at desc);
create index if not exists community_reports_location_gist on public.community_parking_reports using gist (location);
create index if not exists street_alerts_zone_active_idx on public.street_alerts (lower(zone), expires_at, created_at desc);
create index if not exists posts_feed_idx on public.posts (created_at desc, deleted_at);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);
create index if not exists comments_post_idx on public.comments (post_id, created_at, deleted_at);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, read_at, created_at desc);
create index if not exists content_reports_queue_idx on public.content_reports (status, created_at);

create or replace function public.set_community_report_location()
returns trigger language plpgsql set search_path = public, extensions as $$
begin
  new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  return new;
end; $$;
drop trigger if exists community_parking_reports_set_location on public.community_parking_reports;
create trigger community_parking_reports_set_location before insert or update of latitude, longitude
on public.community_parking_reports for each row execute function public.set_community_report_location();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at before update on public.posts for each row execute function public.touch_updated_at();
drop trigger if exists comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at before update on public.comments for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();

-- Reputation is server-side: a user cannot increment their own score directly.
create or replace function public.record_reputation(p_user_id uuid, p_delta integer, p_reason text, p_related_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.reputation_events(user_id, delta, reason, related_id)
  values (p_user_id, p_delta, left(p_reason, 180), p_related_id);
  update public.profiles set karma_score = greatest(0, karma_score + p_delta) where id = p_user_id;
end; $$;

create or replace function public.limit_community_report_rate()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from public.community_parking_reports
    where reporter_id = new.reporter_id
      and external_parking_id = new.external_parking_id
      and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Please wait before reporting this parking again' using errcode = 'P0001';
  end if;
  return new;
end; $$;
drop trigger if exists community_report_rate_limit on public.community_parking_reports;
create trigger community_report_rate_limit before insert on public.community_parking_reports
for each row execute function public.limit_community_report_rate();

create or replace function public.reward_parking_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.record_reputation(new.reporter_id, 1, 'Parking availability report', new.id);
  return new;
end; $$;
drop trigger if exists reward_new_parking_report on public.community_parking_reports;
create trigger reward_new_parking_report after insert on public.community_parking_reports
for each row execute function public.reward_parking_report();

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('MODERATOR', 'ADMIN') and is_active);
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, full_name, username)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'username', ''))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.community_parking_reports enable row level security;
alter table public.street_alerts enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.notifications enable row level security;
alter table public.content_reports enable row level security;
alter table public.reputation_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "active parking reports are visible" on public.community_parking_reports for select using (expires_at > now() or reporter_id = auth.uid() or public.is_moderator());
create policy "users create their parking reports" on public.community_parking_reports for insert to authenticated with check (reporter_id = auth.uid() and expires_at <= now() + interval '2 hours');
create policy "authors delete their parking reports" on public.community_parking_reports for delete to authenticated using (reporter_id = auth.uid() or public.is_moderator());
create policy "active alerts are visible" on public.street_alerts for select using (expires_at > now() or reporter_id = auth.uid() or public.is_moderator());
create policy "users create alerts" on public.street_alerts for insert to authenticated with check (reporter_id = auth.uid() and expires_at <= now() + interval '2 hours');
create policy "authors delete alerts" on public.street_alerts for delete to authenticated using (reporter_id = auth.uid() or public.is_moderator());
create policy "public posts are visible" on public.posts for select using (deleted_at is null or author_id = auth.uid() or public.is_moderator());
create policy "users create posts" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "authors edit posts" on public.posts for update to authenticated using (author_id = auth.uid() or public.is_moderator());
create policy "public comments are visible" on public.comments for select using (deleted_at is null or author_id = auth.uid() or public.is_moderator());
create policy "users create comments" on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy "authors edit comments" on public.comments for update to authenticated using (author_id = auth.uid() or public.is_moderator());
create policy "reactions are visible" on public.reactions for select using (true);
create policy "users manage their reactions" on public.reactions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read notifications" on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy "users update notifications" on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "users file content reports" on public.content_reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "moderators read content reports" on public.content_reports for select to authenticated using (reporter_id = auth.uid() or public.is_moderator());
create policy "moderators update content reports" on public.content_reports for update to authenticated using (public.is_moderator()) with check (public.is_moderator());
create policy "users read own reputation" on public.reputation_events for select to authenticated using (user_id = auth.uid() or public.is_moderator());
create policy "moderators read audit logs" on public.audit_logs for select to authenticated using (public.is_moderator());

-- Supabase Realtime only emits these safe, row-level-security-protected tables.
do $$ begin
  alter publication supabase_realtime add table public.community_parking_reports, public.street_alerts, public.notifications;
exception when duplicate_object then null; end $$;
