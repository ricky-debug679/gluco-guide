-- Run after 015_fiber_custom_research.sql.
-- fiber_supplement_logs only had select/insert policies (same gap food_logs
-- had before 009_food_log_delete.sql) — "mark as taken" worked (insert),
-- but tapping again to undo silently deleted zero rows (RLS blocked it with
-- no error), so the button never reverted back to "Mark as taken".

create policy "delete own supplement doses, or household owner for unauthenticated member"
  on fiber_supplement_logs for delete
  using (
    exists (
      select 1 from members m
      join households h on h.id = m.household_id
      where m.id = member_id
        and (m.auth_user_id = auth.uid() or (h.owner_user_id = auth.uid() and m.auth_user_id is null))
    )
  );
