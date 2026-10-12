-- Run after 019_ai_text_language.sql.
-- Which optional areas (water & fiber, exercise, mind & sleep, supplements)
-- each person chose to track. Null means everything is on, so existing
-- accounts keep seeing all of them. The existing members update policy
-- already covers this column.
alter table members add column tracked_areas text[];
