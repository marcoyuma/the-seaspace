-- 0004_stays_featured.sql
-- Marks which stays appear in the landing-page preview section.
--
-- Before this, the landing page carried its own hardcoded FEATURED_STAYS array in
-- features/stays/components/stays-preview-section.tsx — two entries that had drifted out of
-- sync with the catalogue (both were labelled "Tuscan Twilight Villa" while showing photos
-- of two different villas). Moving the choice into the database removes the second source
-- of truth and lets a non-developer change it.
--
-- Idempotent: safe to re-run.

alter table public.stays
    add column if not exists is_featured boolean not null default false;

-- Partial index: the landing page only ever asks for the featured rows, and there will
-- always be far fewer of those than the full catalogue.
create index if not exists stays_is_featured_idx
    on public.stays (id) where is_featured;

-- Seed the current selection. Matches the two photos the hardcoded array was already
-- showing (villa 1 and villa 4), so the landing page looks unchanged after the migration —
-- only the wrong labels get fixed.
update public.stays set is_featured = slug in ('tuscan-twilight-villa', 'coastal-arch-retreat');

-- Expect exactly 2 rows: tuscan-twilight-villa, coastal-arch-retreat
select slug, name, is_featured from public.stays order by id;
