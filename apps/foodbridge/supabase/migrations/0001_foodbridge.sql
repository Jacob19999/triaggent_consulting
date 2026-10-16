-- FoodBridge operational schema. App state only: shelves registered in the app, their
-- monthly reports, requests, alert follow-up and saved scenarios. No sponsor microdata,
-- no block_geoid and no Map the Meal Gap table is stored here (CLAUDE.md, D-021, D-050).
--
-- Apply once: Supabase dashboard → SQL Editor → paste this file → Run.
-- Then promote your first manager (see the end of this file).

create extension if not exists pgcrypto;

-- ---------- Profiles and roles ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'pending' check (role in ('pending', 'manager', 'shelf')),
  shelf_id uuid,
  created_at timestamptz not null default now()
);

-- New users start as 'pending'. Roles are never read from sign-up metadata, which the
-- user controls; only a manager (or the service key) assigns them.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

create or replace function public.my_shelf_id()
returns uuid language sql stable security definer set search_path = public as $$
  select shelf_id from public.profiles where id = auth.uid() and role = 'shelf';
$$;

-- ---------- Shelves ----------

create table if not exists public.shelves (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  county_fips text not null check (county_fips ~ '^27[0-9]{3}$'),
  type text not null default 'brick_and_mortar'
    check (type in ('brick_and_mortar', 'mobile', 'outreach', 'campus', 'tribal')),
  capacity_households integer check (capacity_households is null or capacity_households between 0 and 1000000),
  storage_lbs integer check (storage_lbs is null or storage_lbs between 0 and 100000000),
  hours text check (hours is null or length(hours) <= 200),
  contact_name text check (contact_name is null or length(contact_name) <= 120),
  active boolean not null default true,
  is_demo boolean not null default false,
  priority_status text check (priority_status in ('urgent', 'support', 'monitor', 'stable')),
  manager_note text check (manager_note is null or length(manager_note) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_shelf_fk,
  add constraint profiles_shelf_fk foreign key (shelf_id) references public.shelves (id) on delete set null;

-- ---------- Monthly reports ----------

create table if not exists public.shelf_reports (
  id uuid primary key default gen_random_uuid(),
  shelf_id uuid not null references public.shelves (id) on delete cascade,
  month text not null check (month ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  households integer not null check (households between 0 and 10000000),
  individuals integer not null check (individuals between 0 and 10000000),
  children integer not null default 0 check (children >= 0),
  adults integer not null default 0 check (adults >= 0),
  seniors integer not null default 0 check (seniors >= 0),
  pounds_distributed integer not null check (pounds_distributed between 0 and 1000000000),
  pounds_received integer check (pounds_received is null or pounds_received >= 0),
  inventory_lbs integer check (inventory_lbs is null or inventory_lbs >= 0),
  volunteer_hours integer check (volunteer_hours is null or volunteer_hours >= 0),
  turned_away integer check (turned_away is null or turned_away >= 0),
  notes text check (notes is null or length(notes) <= 2000),
  submitted_at timestamptz not null default now(),
  submitted_by uuid references auth.users (id) on delete set null,
  unique (shelf_id, month)
);

create index if not exists shelf_reports_shelf_month on public.shelf_reports (shelf_id, month);

-- ---------- Requests from shelves ----------

create table if not exists public.shelf_requests (
  id uuid primary key default gen_random_uuid(),
  shelf_id uuid not null references public.shelves (id) on delete cascade,
  kind text not null check (kind in ('food', 'volunteers', 'funding', 'transport', 'equipment', 'other')),
  urgency text not null default 'normal' check (urgency in ('low', 'normal', 'high')),
  message text not null check (length(message) between 1 and 2000),
  pounds_requested integer check (pounds_requested is null or pounds_requested >= 0),
  status text not null default 'open' check (status in ('open', 'in_progress', 'fulfilled', 'declined')),
  response text check (response is null or length(response) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Alert follow-up and saved scenarios ----------

create table if not exists public.alert_states (
  alert_key text primary key check (length(alert_key) <= 200),
  status text not null check (status in ('open', 'acknowledged', 'resolved')),
  note text check (note is null or length(note) <= 2000),
  shelf_id uuid references public.shelves (id) on delete cascade,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  kind text not null check (kind in ('new_shelf', 'allocation')),
  payload jsonb not null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Row-level security ----------

alter table public.profiles enable row level security;
alter table public.shelves enable row level security;
alter table public.shelf_reports enable row level security;
alter table public.shelf_requests enable row level security;
alter table public.alert_states enable row level security;
alter table public.scenarios enable row level security;

drop policy if exists "profiles: self or manager read" on public.profiles;
create policy "profiles: self or manager read" on public.profiles for select
  using (id = auth.uid() or public.is_manager());
drop policy if exists "profiles: manager write" on public.profiles;
create policy "profiles: manager write" on public.profiles for update
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists "shelves: read own or all for manager" on public.shelves;
create policy "shelves: read own or all for manager" on public.shelves for select
  using (public.is_manager() or id = public.my_shelf_id());
drop policy if exists "shelves: manager insert" on public.shelves;
create policy "shelves: manager insert" on public.shelves for insert with check (public.is_manager());
drop policy if exists "shelves: manager or own update" on public.shelves;
create policy "shelves: manager or own update" on public.shelves for update
  using (public.is_manager() or id = public.my_shelf_id())
  with check (public.is_manager() or id = public.my_shelf_id());
drop policy if exists "shelves: manager delete" on public.shelves;
create policy "shelves: manager delete" on public.shelves for delete using (public.is_manager());

-- A shelf user may not change its own priority status or manager note.
create or replace function public.guard_shelf_manager_fields()
returns trigger language plpgsql as $$
begin
  if not public.is_manager() and auth.role() = 'authenticated' then
    new.priority_status := old.priority_status;
    new.manager_note := old.manager_note;
    new.is_demo := old.is_demo;
    new.county_fips := old.county_fips;
  end if;
  return new;
end;
$$;
drop trigger if exists shelves_guard on public.shelves;
create trigger shelves_guard before update on public.shelves
  for each row execute function public.guard_shelf_manager_fields();

drop policy if exists "reports: read own or all for manager" on public.shelf_reports;
create policy "reports: read own or all for manager" on public.shelf_reports for select
  using (public.is_manager() or shelf_id = public.my_shelf_id());
drop policy if exists "reports: write own or manager" on public.shelf_reports;
create policy "reports: write own or manager" on public.shelf_reports for insert
  with check (public.is_manager() or shelf_id = public.my_shelf_id());
drop policy if exists "reports: update own or manager" on public.shelf_reports;
create policy "reports: update own or manager" on public.shelf_reports for update
  using (public.is_manager() or shelf_id = public.my_shelf_id())
  with check (public.is_manager() or shelf_id = public.my_shelf_id());
drop policy if exists "reports: manager delete" on public.shelf_reports;
create policy "reports: manager delete" on public.shelf_reports for delete using (public.is_manager());

drop policy if exists "requests: read own or manager" on public.shelf_requests;
create policy "requests: read own or manager" on public.shelf_requests for select
  using (public.is_manager() or shelf_id = public.my_shelf_id());
drop policy if exists "requests: create own or manager" on public.shelf_requests;
create policy "requests: create own or manager" on public.shelf_requests for insert
  with check (public.is_manager() or shelf_id = public.my_shelf_id());
drop policy if exists "requests: manager update" on public.shelf_requests;
create policy "requests: manager update" on public.shelf_requests for update
  using (public.is_manager()) with check (public.is_manager());

drop policy if exists "alerts: read own or manager" on public.alert_states;
create policy "alerts: read own or manager" on public.alert_states for select
  using (public.is_manager() or shelf_id = public.my_shelf_id());
drop policy if exists "alerts: write own or manager" on public.alert_states;
create policy "alerts: write own or manager" on public.alert_states for insert
  with check (public.is_manager() or shelf_id = public.my_shelf_id());
drop policy if exists "alerts: update own or manager" on public.alert_states;
create policy "alerts: update own or manager" on public.alert_states for update
  using (public.is_manager() or shelf_id = public.my_shelf_id())
  with check (public.is_manager() or shelf_id = public.my_shelf_id());

drop policy if exists "scenarios: manager all" on public.scenarios;
create policy "scenarios: manager all" on public.scenarios for all
  using (public.is_manager()) with check (public.is_manager());

-- ---------- Bootstrap ----------
-- 1. Sign in once through the app's /login page with your email.
-- 2. Then run (with your address):
--    update public.profiles set role = 'manager' where email = 'you@example.org';
-- Shelf users are invited from the app (Manager → Shelves → Invite), which links them
-- to their shelf with the server-side secret key.
