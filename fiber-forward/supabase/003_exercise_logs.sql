-- Run after 002_household_unique_owner.sql.
create table exercise_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  logged_at timestamptz not null default now(),
  activity text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  shared_with_household boolean not null default true
);

alter table exercise_logs enable row level security;

create policy "read own exercise logs, or shared, or unauthenticated member"
  on exercise_logs for select
  using (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and (exercise_logs.shared_with_household or m.auth_user_id is null)))
    )
  );

create policy "write own exercise logs, or household owner for unauthenticated member"
  on exercise_logs for insert
  with check (
    exists (
      select 1 from members m join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );
