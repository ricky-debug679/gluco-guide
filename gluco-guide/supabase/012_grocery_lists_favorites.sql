-- Run after 011_grocery_list.sql.
-- Splits the single running grocery list into dated "trips" (grocery_lists),
-- adds a favorites list, and persists each item's AI verdict so history and
-- the healthy-vs-caution trend can be read back without re-calling the AI.

create table grocery_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);

alter table grocery_lists enable row level security;

create policy "household members can manage grocery lists"
  on grocery_lists for all
  using (
    exists (
      select 1 from households h
      where h.id = household_id
        and (
          h.owner_user_id = auth.uid()
          or exists (select 1 from members m where m.household_id = h.id and m.auth_user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from households h
      where h.id = household_id
        and (
          h.owner_user_id = auth.uid()
          or exists (select 1 from members m where m.household_id = h.id and m.auth_user_id = auth.uid())
        )
    )
  );

-- One default list per household with existing items, so nothing already on
-- a list gets orphaned by the new not-null list_id column below.
insert into grocery_lists (household_id, label, created_at)
select distinct household_id, 'My list', now()
from grocery_list_items
where exists (select 1 from grocery_list_items gli where gli.household_id = grocery_list_items.household_id);

alter table grocery_list_items add column list_id uuid references grocery_lists(id) on delete cascade;
alter table grocery_list_items add column verdict text; -- 'good' | 'caution', set after an analysis
alter table grocery_list_items add column note text;

update grocery_list_items gli
set list_id = gl.id
from grocery_lists gl
where gl.household_id = gli.household_id and gli.list_id is null;

alter table grocery_list_items alter column list_id set not null;

create table grocery_favorites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

alter table grocery_favorites enable row level security;

create policy "household members can manage favorites"
  on grocery_favorites for all
  using (
    exists (
      select 1 from households h
      where h.id = household_id
        and (
          h.owner_user_id = auth.uid()
          or exists (select 1 from members m where m.household_id = h.id and m.auth_user_id = auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from households h
      where h.id = household_id
        and (
          h.owner_user_id = auth.uid()
          or exists (select 1 from members m where m.household_id = h.id and m.auth_user_id = auth.uid())
        )
    )
  );
