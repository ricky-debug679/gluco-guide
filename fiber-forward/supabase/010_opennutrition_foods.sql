-- Run after 009_food_log_delete.sql.
-- A local, searchable copy of the OpenNutrition dataset (~326k foods,
-- combining USDA, Canadian Nutrient File, FRIDA, and AUSNUT) replaces the
-- live USDA API call in Log a Meal search — same USDA data plus more,
-- served from our own database with no external API dependency.
--
-- This table only holds public reference data (no user data, no PII), so
-- it's readable by anyone, including signed-out sessions.
--
-- After running this file, import the CSV chunks from
-- scripts/opennutrition/chunk_01.csv .. chunk_06.csv via Supabase Studio:
-- Table Editor -> opennutrition_foods -> Insert -> "Import data from CSV".

create table opennutrition_foods (
  id text primary key,
  name text not null,
  calories_kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carb_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric not null default 0
);

create extension if not exists pg_trgm;
create index opennutrition_foods_name_trgm_idx on opennutrition_foods using gin (name gin_trgm_ops);

alter table opennutrition_foods enable row level security;

create policy "anyone can read the food database"
  on opennutrition_foods for select
  using (true);
