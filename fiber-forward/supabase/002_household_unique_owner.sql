-- Run after schema.sql. Prevents a race (e.g. React StrictMode's double-invoke
-- in dev) from ever creating two households for the same account.
alter table households
  add constraint households_owner_user_id_key unique (owner_user_id);

-- Same idea for members: one row per (household, auth_user_id), so the
-- "create my own member row on first login" step is safely idempotent too.
alter table members
  add constraint members_household_auth_user_key unique (household_id, auth_user_id);
