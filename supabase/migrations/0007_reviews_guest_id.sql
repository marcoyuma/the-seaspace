-- 0007_reviews_guest_id.sql
-- Turns reviews.guest_ref (a text slug) into reviews.guest_id (a real foreign key).
--
-- Run SEVENTH — but NOT straight after 0006. The accounts must exist first:
--
--     0006_guests.sql
--     node --env-file=.env.local scripts/create-seed-accounts.mjs
--     0007_reviews_guest_id.sql   <-- this file
--
-- Idempotent: safe to re-run. Running it too early aborts with a clear message
-- instead of silently leaving 100 ownerless reviews behind.
--
-- ---------------------------------------------------------------------------
-- What "backfill" means here
-- ---------------------------------------------------------------------------
-- The 100 existing review rows predate public.guests. Adding a column gives
-- them all NULL in it; backfilling is the one-off UPDATE that fills those NULLs
-- from data already present (guest_ref). Reviews written after this migration
-- arrive with guest_id already set and never touch guest_ref — which is why the
-- column is dropped at the end.

-- ---------------------------------------------------------------------------
-- The column
-- ---------------------------------------------------------------------------
-- `on delete set null`, not cascade: when a guest deletes their account they
-- choose whether the review survives anonymised or goes with them. The
-- "survives" branch needs this column to be nullable, which is why it is not
-- NOT NULL despite every row having a value the moment this migration ends.
-- See ACCOUNT-DELETION-POLICY.md.
alter table public.reviews
    add column if not exists guest_id uuid references public.guests(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------------
-- Joined on the email scripts/create-seed-accounts.mjs derives from guest_ref
-- ('amara-lindqvist' -> 'amara.lindqvist@example.com'). That derivation is
-- duplicated here on purpose: guests deliberately has no guest_ref column, so
-- the email is the only bridge between a seeded review and its account. Change
-- the rule in one place and this join stops matching.
--
-- Wrapped in dynamic SQL because this migration drops guest_ref further down.
-- A plain UPDATE would fail to *parse* on a second run — Postgres resolves
-- column names before executing, so the statement would error even though the
-- guard around it is false. EXECUTE defers that resolution to run time.
do $$
begin
    if exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name   = 'reviews'
           and column_name  = 'guest_ref'
    ) then
        execute $backfill$
            update public.reviews r
               set guest_id = u.id
              from auth.users u
             where u.email = replace(r.guest_ref, '-', '.') || '@example.com'
               and r.guest_id is null
        $backfill$;
    end if;
end $$;

-- Fail loudly rather than half-migrating. An ownerless review would not surface
-- anywhere in the UI — the landing page never reads guest_id — so without this
-- check a partial run would stay invisible until something much later depended
-- on it.
do $$
declare
    orphans int;
begin
    select count(*) into orphans from public.reviews where guest_id is null;

    if orphans > 0 then
        raise exception
            'Backfill incomplete: % reviews still have no guest_id. Run scripts/create-seed-accounts.mjs first, then re-run this migration.',
            orphans;
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- Retire guest_ref
-- ---------------------------------------------------------------------------
-- Its whole job was to name an owner while public.guests did not exist. That
-- job is done, and a second way of saying who wrote a review is a second thing
-- that can disagree. The reviews_guest_ref_format constraint goes with it.
--
-- No application change is needed: REVIEW_SELECT in features/reviews/actions.ts
-- never selected this column.
alter table public.reviews drop column if exists guest_ref;

create index if not exists reviews_guest_id_idx on public.reviews (guest_id);

-- ---------------------------------------------------------------------------
-- Make the nullability mean exactly one thing
-- ---------------------------------------------------------------------------
-- guest_id is nullable only so a deleted account can leave its review behind.
-- This constraint says so in the schema: an ownerless review MUST already be
-- anonymised. Any bug that clears guest_id without overwriting the displayed
-- identity is rejected by the database rather than quietly leaving a review
-- attributed to a person who asked to be forgotten.
--
-- Overwriting matters legally, not just tidily: cutting the foreign key while
-- leaving 'Amara L.' and 'Swedish' in place produces *pseudonymised* data,
-- which is still personal data under GDPR. Only truly anonymised data falls
-- outside it. See ACCOUNT-DELETION-POLICY.md.
alter table public.reviews drop constraint if exists reviews_orphan_is_anonymised;

alter table public.reviews add constraint reviews_orphan_is_anonymised
    check (guest_id is not null or author_display_name = 'Former guest');

-- Expect: 100 | 0 | 62
select count(*)                                     as reviews,
       count(*) filter (where guest_id is null)     as ownerless,
       count(distinct guest_id)                     as distinct_guests
from public.reviews;
