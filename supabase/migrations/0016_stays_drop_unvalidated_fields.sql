-- 0016_stays_drop_unvalidated_fields.sql
-- Drops five `stays` columns that were free text (or hardcoded) and never
-- validated against anything, in favour of data that already exists and is
-- already constrained.
--
-- Run after 0015_staff_catalog_writes.sql. Idempotent: safe to re-run.
--
-- ---------------------------------------------------------------------------
-- Why these five
-- ---------------------------------------------------------------------------
-- `bed_type_label` / `bed_type_note` / `capacity_label` were free text typed
-- by hand in the admin panel, with no check against the real `capacity`
-- column — ADMIN-PANEL-CONTEXT.md already flagged this exact risk:
-- `capacity_label` could promise "sleeps 8" while `capacity = 4` blocks the
-- booking stepper at 4. The detail page now renders `capacity`/`beds`/`area`
-- directly instead — three smallint columns that are already `> 0`-checked
-- by `stays_capacity_pos` (0001) and already trusted on the listing grid
-- (StayCard).
--
-- `airport_code` / `airport_city` were hardcoded to 'DPS' / 'Denpasar' for
-- every villa in the catalogue, with no lookup table backing them — not
-- meaningfully per-villa data. The "by air" travel card now renders generic
-- copy instead of a per-villa airport name/link.
--
-- `lat` / `lng` are NOT touched here — those stay manually set, just via a
-- geocoding-assisted flow in the admin panel rather than typed blind. See
-- STAYS-INPUT-DECISIONS.md.

alter table public.stays
    drop column if exists bed_type_label,
    drop column if exists bed_type_note,
    drop column if exists capacity_label,
    drop column if exists airport_code,
    drop column if exists airport_city;

-- Expect: 5 fewer columns, everything else on `stays` untouched.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'stays'
order by ordinal_position;
