-- Run after 004_fiber_dose_and_wellness.sql.

alter table food_logs add column fat_g numeric not null default 0;

-- A supplement the member has chosen to track (from a recommendation or
-- fully custom). One row per supplement, not per dose.
create table supplements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  name text not null,
  dosage text, -- free text, e.g. "2000 IU/day" - as prescribed, not a fixed unit
  recommendation_key text, -- 'vitamin_d' | 'magnesium' | 'chromium' | 'zinc' | 'b1' | null (custom)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table supplement_logs (
  id uuid primary key default gen_random_uuid(),
  supplement_id uuid not null references supplements(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  taken_at timestamptz not null default now(),
  shared_with_household boolean not null default true
);

alter table supplements enable row level security;
alter table supplement_logs enable row level security;

create policy "read own supplements, or household manages for unauthenticated member"
  on supplements for select
  using (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );

create policy "write own supplements, or household manages for unauthenticated member"
  on supplements for all
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

create policy "read own supplement logs, or shared, or unauthenticated member"
  on supplement_logs for select
  using (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and (supplement_logs.shared_with_household or m.auth_user_id is null)))
    )
  );

create policy "write own supplement logs, or household owner for unauthenticated member"
  on supplement_logs for all
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
