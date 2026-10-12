-- Run after 017_water_logs_delete_policy.sql.
-- Ranked food search for Log a Meal. The app used to sort matches
-- alphabetically, so "milk" returned branded desserts like
-- "\"Milk\" & Cookies ... by Ben & Jerry's" ahead of plain milk.
--
-- Every word must appear, in any order. Ranking, best first:
--   0  the exact name, or its plural ("Apples")
--   1  generic names where the search is the main food: food names put it
--      last, before any comma or "by Brand" ("Whole Milk", "Milk, whole"),
--      unlike "Milk Tea" or "Rice Cakes"
--   2  generic names starting with the search as a whole word
--   3  generic names with the search as a whole word anywhere
--   4-5  the same for "... by Brand" products
--   6  any other match ("Eggnog" for "egg")
-- Shorter names win within a tier.

create or replace function search_foods(q text, max_results int default 15)
returns setof opennutrition_foods
language plpgsql
stable
as $$
declare
  typed_words text[];
  like_words text[];
  phrase text;
  normalized text;
  sql text;
begin
  normalized := regexp_replace(lower(trim(q)), '\s+', ' ', 'g');
  if normalized = '' then
    return;
  end if;
  typed_words := string_to_array(normalized, ' ');

  -- Longest word first: it's the most selective one to drive the trigram index.
  select array_agg(replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') order by length(w) desc)
  into like_words
  from unnest(typed_words) as w;

  select string_agg(regexp_replace(w, '([.*+?^${}()|\[\]\\])', '\\\1', 'g'), '\s+' order by i)
  into phrase
  from unnest(typed_words) with ordinality as u(w, i);

  sql := 'select f.* from opennutrition_foods f where f.name ilike $1';
  for i in 2 .. coalesce(array_length(like_words, 1), 1) loop
    sql := sql || format(' and f.name ilike %L', '%' || like_words[i] || '%');
  end loop;
  sql := sql || $order$
    order by
      case
        when lower(f.name) in ($2, $2 || 's', $2 || 'es') then 0
        when f.name not ilike '% by %' and f.name ~* $5 then 1
        when f.name not ilike '% by %' and f.name ilike $3 and f.name ~* $4 then 2
        when f.name not ilike '% by %' and f.name ~* $4 then 3
        when f.name ~* $5 then 4
        when f.name ~* $4 then 5
        else 6
      end,
      length(f.name),
      f.name
    limit $6
  $order$;

  -- EXECUTE plans with the actual search text, so the trigram index is used.
  return query execute sql
  using
    '%' || like_words[1] || '%',
    normalized,
    replace(replace(replace(normalized, '\', '\\'), '%', '\%'), '_', '\_') || '%',
    '\m' || phrase || '(s|es)?\M',
    '\m' || phrase || '(s|es)?\s*($|,|\s+by\s)',
    greatest(1, least(max_results, 50));
end;
$$;

grant execute on function search_foods(text, int) to anon, authenticated;
