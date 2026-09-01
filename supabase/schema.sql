-- Parko Kosovo parking application schema.
-- Run in a Supabase PostgreSQL database with PostGIS enabled.

create extension if not exists pgcrypto;
create extension if not exists postgis;

do $$
begin
  create type public.user_role as enum ('USER', 'ADMIN');
exception when duplicate_object then null;
end $$;

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

grant select on public.parking_spots, public.realtime_alerts, public.spot_reviews_vouches
  to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.parking_spots,
  public.realtime_alerts, public.spot_reviews_vouches to authenticated;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
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
