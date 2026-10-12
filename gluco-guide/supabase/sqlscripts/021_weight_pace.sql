-- Run after 020_tracked_areas.sql.
-- The weight goal pace each person picked. Null means the default for
-- their BMI (gentle within the healthy range, steady outside it). The
-- existing members update policy already covers this column.
alter table members add column weight_pace text check (weight_pace in ('gentle', 'steady', 'faster'));
