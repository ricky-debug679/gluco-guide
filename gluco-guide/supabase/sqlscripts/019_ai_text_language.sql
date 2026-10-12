-- Run after 018_search_foods.sql.
-- Records which language saved AI text was written in, so the app can
-- translate it when the user switches languages. Existing rows start as
-- null ("unknown") and get translated and stamped the first time they're shown.

alter table fiber_supplement_settings add column content_language text;
alter table grocery_list_items add column note_language text;
