-- 0005_reviews.sql
-- Guest reviews for the landing-page carousel and its aggregate stats row.
--
-- Replaces the REVIEWS array that lived in features/home/components/reviews.tsx.
-- Run FIFTH, after 0001_stays_schema.sql (this references public.stays).
-- Idempotent: safe to re-run.
--
-- ---------------------------------------------------------------------------
-- On "verified" — read this before adding a column for it
-- ---------------------------------------------------------------------------
-- There is deliberately NO `is_verified` boolean here. A hand-set flag is a
-- second source of truth that can disagree with reality: a row can claim to be
-- verified with no evidence of a stay behind it, and nothing prevents that.
--
-- Verification belongs in the structure instead. Once public.bookings exists,
-- this table gains `booking_id references public.bookings(id)` and a review is
-- verified exactly when `booking_id is not null` — derived from a foreign key,
-- which cannot lie. See GUEST_PLANNING_TABLE.md for the full target shape.
--
-- Until then this project has no verification mechanism at all (there is no
-- auth and no bookings table), and the seeded rows are placeholders shaped like
-- the real thing. That is a known, deliberate gap — not an oversight.

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
    id         bigint      generated always as identity primary key,

    -- Load-bearing, not an audit column: the landing-page carousel reads
    -- `order by created_at desc limit 8`, so this is what decides which
    -- reviews a visitor actually sees. Backdating a row reorders the section.
    created_at timestamptz not null default now(),

    -- The villa being reviewed. Nullable so a general testimonial about the
    -- property can exist without naming one stay.
    --
    -- `set null`, not `cascade` (unlike stay_images / stay_amenities): a guest's
    -- words keep their value as a testimonial even after a villa is delisted,
    -- so delisting must not delete them.
    stay_id    bigint      references public.stays(id) on delete set null,

    -- Stable author slug, repeated across every review the same person writes.
    -- This is the bridge to the future public.guests table: one guest, many
    -- rows here, and `select distinct guest_ref` is what seeds guests during
    -- that migration. Not unique, on purpose.
    guest_ref  text        not null,

    -- Denormalised display fields — a security decision, not laziness.
    --
    -- Reviews are read with the anon key, which ships to the browser. Keeping
    -- the rendered name and nationality on the review row means the public read
    -- path never touches a table holding emails and phone numbers. Do NOT
    -- "normalise" these into a join against guests later: one wrong
    -- `select using (true)` policy there leaks every guest's PII.
    author_display_name text not null,   -- short form, e.g. 'Amara L.'
    author_nationality  text not null,   -- e.g. 'Swedish' — a nationality, not a city

    -- Whole stars only. The UI renders `Array.from({ length: rating })`, so a
    -- fractional value would silently round down to fewer stars.
    rating     smallint    not null,

    quote      text        not null,

    -- Mirrors stays_slug_format: guest_ref becomes a natural key in guests, and
    -- a loose format there turns into duplicate guests during the backfill.
    constraint reviews_guest_ref_format check (guest_ref ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint reviews_rating_range     check (rating between 1 and 5),
    -- Upper bound is a layout constraint: the carousel measures each card with
    -- a ResizeObserver and animates the box to that height. An unbounded quote
    -- makes the section jump by hundreds of pixels between steps.
    constraint reviews_quote_len        check (char_length(quote) between 20 and 500)
);

-- Serves the carousel query directly (`order by created_at desc limit 8`).
create index if not exists reviews_recent_idx
    on public.reviews (created_at desc);

-- For per-villa reads on the stay detail page, which do not exist yet.
create index if not exists reviews_stay_id_idx
    on public.reviews (stay_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Same stance as the catalogue tables: anyone may read, nobody may write.
-- Writes go through the service role key, which bypasses RLS, so no
-- insert/update/delete policy is defined. A write policy only makes sense once
-- auth exists and can prove who is writing.
alter table public.reviews enable row level security;

drop policy if exists "reviews are publicly readable" on public.reviews;

create policy "reviews are publicly readable"
    on public.reviews for select to anon, authenticated using (true);
