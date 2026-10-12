-- Run after 005_fat_and_supplements.sql.
-- Sleep should be one editable entry per day, not an unbounded log -
-- without this, logging again the same day silently created a second row
-- instead of replacing the first, and which one showed as "latest" was
-- undefined.

-- If duplicate (member_id, logged_at) rows already exist, keep only the
-- most recent one before adding the constraint.
delete from sleep_logs a using sleep_logs b
where a.member_id = b.member_id
  and a.logged_at = b.logged_at
  and a.id < b.id;

alter table sleep_logs
  add constraint sleep_logs_member_day_key unique (member_id, logged_at);
