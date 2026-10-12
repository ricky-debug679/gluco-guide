-- Run after 016_fiber_logs_delete_policy.sql.
-- water_logs only had select/insert policies — the same gap food_logs had
-- before 009_food_log_delete.sql and fiber_supplement_logs had before
-- 016_fiber_logs_delete_policy.sql. "Remove a cup" calls .delete(), which
-- RLS silently blocked (0 rows affected, no error), so the button never
-- actually removed anything.

create policy "delete own water logs, or household owner for unauthenticated member"
  on water_logs for delete
  using (
    exists (
      select 1 from members m
      join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );
