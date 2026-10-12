-- Run after 003_exercise_logs.sql.

-- Lets a custom fiber supplement still count toward the daily fiber ring.
alter table fiber_supplement_settings add column custom_fiber_g numeric;

create table sleep_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  logged_at date not null default current_date,
  hours numeric not null check (hours >= 0 and hours <= 24),
  quality text, -- 'poor' | 'okay' | 'good' | 'great'
  shared_with_household boolean not null default true
);

create table wellness_activity_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  logged_at timestamptz not null default now(),
  activity text not null, -- 'meditation' | 'mindfulness' | 'journaling' | 'gratitude' | 'breathing' | 'custom'
  custom_label text,
  duration_minutes integer,
  shared_with_household boolean not null default true
);

alter table sleep_logs enable row level security;
alter table wellness_activity_logs enable row level security;

create policy "read own sleep logs, or shared, or unauthenticated member"
  on sleep_logs for select
  using (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and (sleep_logs.shared_with_household or m.auth_user_id is null)))
    )
  );

create policy "write own sleep logs, or household owner for unauthenticated member"
  on sleep_logs for insert
  with check (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );

create policy "read own wellness logs, or shared, or unauthenticated member"
  on wellness_activity_logs for select
  using (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and (wellness_activity_logs.shared_with_household or m.auth_user_id is null)))
    )
  );

create policy "write own wellness logs, or household owner for unauthenticated member"
  on wellness_activity_logs for insert
  with check (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );
