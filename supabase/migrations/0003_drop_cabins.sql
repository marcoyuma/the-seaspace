-- 0003_drop_cabins.sql
-- Retires the `cabins` table left over from the tutorial build.
--
-- ⚠️ DESTRUCTIVE — run LAST, and only after the verification block in
-- supabase/README.md passes. Nothing else in this migration set depends on it,
-- so there is no cost to leaving it unrun for a while.
--
-- BEFORE RUNNING:
--   1. Dashboard → Table Editor → cabins → Export → CSV, and keep the file.
--      Supabase has no undo for a dropped table.
--   2. Note the storage path in the `image` column — the old bucket is NOT
--      touched here (see the commented block at the bottom).
--
-- `cabins` was never reachable from the app: _legacy/data-service.js calls
-- supabase.from("cabins") 13 times but never imports a client, so every one of
-- those calls throws. Dropping the table changes no running behaviour.

-- Uncomment to keep an in-database snapshot instead of relying on the CSV.
-- create table if not exists public.cabins_archived_20260807 as
--     select * from public.cabins;

drop table if exists public.cabins cascade;

-- The old cabin photos still sit in whatever bucket the `image` column pointed
-- at. Storage objects are billed and are not removed by dropping the table.
-- Inspect first, then delete from Dashboard → Storage:
--
--   select bucket_id, count(*), pg_size_pretty(sum((metadata->>'size')::bigint))
--   from storage.objects
--   where bucket_id <> 'stays'
--   group by bucket_id;
