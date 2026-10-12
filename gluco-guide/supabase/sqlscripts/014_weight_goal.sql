-- Run after 013_drop_grocery_scans.sql.
-- Lets a member set a target weight with a 1-week or 1-month deadline from
-- the Profile tab. goal_start_weight_kg snapshots weight_kg at the moment
-- the goal is set, so the progress bar stays accurate even if weight_kg is
-- edited later for unrelated reasons.

alter table members add column target_weight_kg numeric;
alter table members add column goal_start_weight_kg numeric;
alter table members add column goal_set_at date;
alter table members add column goal_deadline date;
