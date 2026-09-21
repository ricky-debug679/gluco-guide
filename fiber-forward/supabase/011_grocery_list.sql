-- Run after 010_opennutrition_foods.sql.
-- A shared household grocery list (planned items before shopping), distinct
-- from grocery_scans (a log of items already scanned/bought). Household-
-- scoped rather than member-scoped like every other table so far — a
-- shopping list is naturally shared by the whole family, not private to
-- one person.

create table grocery_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  checked boolean not null default false,
  added_by_member_id uuid references members(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table grocery_list_items enable row level security;

create policy "household members can manage the grocery list"
  on grocery_list_items for all
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
