-- Run after 014_weight_goal.sql.
-- Stores the AI-researched description/usage/timing for a custom ("something
-- else") fiber supplement, so it's only fetched once (on Save) rather than
-- re-requested every time the page loads.

alter table fiber_supplement_settings add column custom_description text;
alter table fiber_supplement_settings add column custom_usage text;
alter table fiber_supplement_settings add column custom_timing text;
