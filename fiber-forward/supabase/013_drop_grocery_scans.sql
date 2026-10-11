-- Run after 012_grocery_lists_favorites.sql.
-- grocery_scans ("Add to scan history" on the Scan tab) was write-only —
-- nothing in the app ever read it back, so there was no way to actually see
-- a scan history. Replaced by adding scanned/photographed items straight
-- into the grocery list instead, which already has a real History tab.

drop table if exists grocery_scans;
