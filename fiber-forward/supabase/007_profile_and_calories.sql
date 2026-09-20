-- Run after 006_sleep_one_per_day.sql.

alter table members add column height_cm numeric;
alter table members add column weight_kg numeric;
alter table members add column age integer;
alter table members add column biological_sex text; -- 'male' | 'female' - used only for the calorie estimate
alter table members add column activity_level text; -- 'sedentary' | 'light' | 'active'

alter table food_logs add column calories_kcal numeric not null default 0;
