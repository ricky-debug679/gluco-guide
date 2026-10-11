-- GlucoGuide — initial schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query > paste > Run).

create extension if not exists "pgcrypto";

-- One household per account holder (the person who set up the app).
create table households (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My household',
  created_at timestamptz not null default now()
);

-- A person being tracked. auth_user_id is set only if that person has their
-- own login (e.g. a teen managing their own account); it's null for a family
-- member the household owner is tracking on their behalf (e.g. a grandparent
-- without their own account).
create table members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  relationship text not null default 'family', -- 'self' | 'family'
  goal text,
  avatar_color text not null default 'sage',
  created_at timestamptz not null default now()
);

create table food_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  logged_at timestamptz not null default now(),
  name text not null,
  portion text,
  fiber_g numeric not null default 0,
  protein_g numeric not null default 0,
  carb_g numeric not null default 0,
  source text not null default 'search', -- 'photo' | 'search'
  shared_with_household boolean not null default true
);

create table water_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  logged_at timestamptz not null default now(),
  cups integer not null default 1,
  shared_with_household boolean not null default true
);

create table fiber_supplement_settings (
  member_id uuid primary key references members(id) on delete cascade,
  kind text not null default 'psyllium', -- 'psyllium' | 'barley' | 'acacia' | 'custom'
  custom_name text,
  dose_time time not null default '14:30',
  updated_at timestamptz not null default now()
);

create table fiber_supplement_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  taken_at timestamptz not null default now(),
  shared_with_household boolean not null default true
);

create table grocery_scans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  barcode text,
  brand text,
  product_name text not null,
  fiber_g numeric,
  protein_g numeric,
  net_carb_g numeric,
  shared_with_household boolean not null default true
);

-- Lab results are the most sensitive data in the app: shared_with_household
-- defaults to false here, unlike everywhere else above. A person has to
-- explicitly opt in per reading.
create table biometric_readings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  metric_key text not null, -- 'glucose' | 'a1c' | 'chol' | ...
  value numeric not null,
  recorded_at date not null default current_date,
  shared_with_household boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table households enable row level security;
alter table members enable row level security;
alter table food_logs enable row level security;
alter table water_logs enable row level security;
alter table fiber_supplement_settings enable row level security;
alter table fiber_supplement_logs enable row level security;
alter table grocery_scans enable row level security;
alter table biometric_readings enable row level security;

-- A household is visible/manageable only by its owner.
create policy "household owner has full access"
  on households for all
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- A member row is visible to: the household owner, or the member themself
-- (if they have their own login).
create policy "household owner or the member themself can see the member row"
  on members for select
  using (
    auth_user_id = auth.uid()
    or exists (select 1 from households h where h.id = household_id and h.owner_user_id = auth.uid())
  );

create policy "household owner manages member rows"
  on members for insert
  with check (exists (select 1 from households h where h.id = household_id and h.owner_user_id = auth.uid()));

create policy "household owner or the member themself can update the member row"
  on members for update
  using (
    auth_user_id = auth.uid()
    or exists (select 1 from households h where h.id = household_id and h.owner_user_id = auth.uid())
  );

-- Shared helper logic, repeated per table: a row is visible to the household
-- owner if shared_with_household is true, OR to the member themself always,
-- OR to the household owner always when the member has no login of their own
-- (nothing to keep it private from in that case).
create policy "read own logs, or shared logs, or logs for an unauthenticated member"
  on food_logs for select
  using (
    exists (
      select 1 from members m
      join households h on h.id = m.household_id
      where m.id = member_id
        and (
          m.auth_user_id = auth.uid()
          or (h.owner_user_id = auth.uid() and (food_logs.shared_with_household or m.auth_user_id is null))
        )
    )
  );

create policy "write own logs, or household owner writes for an unauthenticated member"
  on food_logs for insert
  with check (
    exists (
      select 1 from members m
      join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );

create policy "read own water logs, or shared, or unauthenticated member"
  on water_logs for select
  using (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and (water_logs.shared_with_household or m.auth_user_id is null)))
    )
  );

create policy "write own water logs, or household owner for unauthenticated member"
  on water_logs for insert
  with check (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );

create policy "read own supplement settings, or household manages for unauthenticated member"
  on fiber_supplement_settings for select
  using (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );

create policy "write own supplement settings, or household manages for unauthenticated member"
  on fiber_supplement_settings for all
  using (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  )
  with check (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );

create policy "read own supplement doses, or shared, or unauthenticated member"
  on fiber_supplement_logs for select
  using (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and (fiber_supplement_logs.shared_with_household or m.auth_user_id is null)))
    )
  );

create policy "write own supplement doses, or household owner for unauthenticated member"
  on fiber_supplement_logs for insert
  with check (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );

create policy "read own grocery scans, or shared, or unauthenticated member"
  on grocery_scans for select
  using (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and (grocery_scans.shared_with_household or m.auth_user_id is null)))
    )
  );

create policy "write own grocery scans, or household owner for unauthenticated member"
  on grocery_scans for insert
  with check (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );

-- Biometric readings: the strictest table. Defaults to NOT shared (see
-- shared_with_household default above) — a household owner only sees a
-- reading for an authenticated member if that member explicitly opted in.
create policy "read own biometric readings, or explicitly shared, or unauthenticated member"
  on biometric_readings for select
  using (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and (biometric_readings.shared_with_household or m.auth_user_id is null)))
    )
  );

create policy "write own biometric readings, or household owner for unauthenticated member"
  on biometric_readings for insert
  with check (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );
