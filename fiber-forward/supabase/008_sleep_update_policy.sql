-- Run after 007_profile_and_calories.sql.
-- Editing today's sleep entry uses an upsert (insert ... on conflict do
-- update), but sleep_logs only had insert/select policies from
-- 004_fiber_dose_and_wellness.sql. Without an update policy, RLS silently
-- blocked the update half of the upsert, so re-saving the same day failed.

create policy "update own sleep logs, or household owner for unauthenticated member"
  on sleep_logs for update
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
