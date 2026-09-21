-- Run after 008_sleep_update_policy.sql.
-- food_logs only had insert/select policies. There was no way to remove a
-- mistakenly-added entry (e.g. tapping several search results in a row),
-- and RLS would have silently blocked the delete anyway.

create policy "delete own logs, or household owner for unauthenticated member"
  on food_logs for delete
  using (
    exists (
      select 1 from members m
      join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );
