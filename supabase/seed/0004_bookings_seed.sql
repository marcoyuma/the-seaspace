-- 0004_bookings_seed.sql
-- 140 bookings across the four villas: 100 that stand behind the seeded
-- reviews, and 40 that produced no review at all.
--
-- Run after 0009_bookings.sql, and it needs TWO earlier steps to have happened:
-- seed/0001_stays_seed.sql (joined by slug) and migration 0007 (which fills
-- reviews.guest_id). The guard below refuses to run otherwise.
-- Idempotent: the insert is gated on the table being empty, so re-running is a
-- no-op rather than a second copy.
--
-- ---------------------------------------------------------------------------
-- What this data is, honestly
-- ---------------------------------------------------------------------------
-- Placeholders in the correct shape, like the reviews before them. No money
-- changed hands, nobody stayed anywhere, and `paid_at` records a date with no
-- payment behind it. Real rows will arrive through a checkout flow that does
-- not exist yet. Do not present these as trading figures.
--
-- ---------------------------------------------------------------------------
-- Why the first 100 are derived from public.reviews, and why that is not a
-- precedent
-- ---------------------------------------------------------------------------
-- In reality a booking comes first and a review follows it. This file
-- reconstructs the arrow backwards, because reviews were seeded a phase
-- earlier and already hold the guest, the villa and the date each review was
-- written. The alternative — retyping those 100 triples here — is a second
-- copy that can drift away from 0002_reviews_seed.sql without anything
-- noticing.
--
-- So this is a ONE-OFF RECONSTRUCTION, the same species as the backfill in
-- 0007, and valid for the same reason: it runs once, against data that exists
-- nowhere else. GUEST_PLANNING_TABLE.md §4 already forbids the sibling mistake
-- (`select distinct … from reviews` to enumerate guests). Reviews are not a
-- source of bookings; they are, exactly once, the only surviving record of
-- which placeholder stay each placeholder review describes.
--
-- Part B below is an explicit list precisely so the file does not read as
-- "bookings are a function of reviews". They are not, and the 40 rows with no
-- review attached are the proof.

-- ---------------------------------------------------------------------------
-- Refuse to run out of order
-- ---------------------------------------------------------------------------
-- Without this the insert below would join against nothing and quietly write
-- ZERO rows. Nothing in the UI reads bookings yet, so a silent miss would stay
-- invisible until something much later depended on it — the same failure mode
-- 0007 raises `Backfill incomplete` for.
do $$
declare
    owned int;
begin
    -- Already seeded: the insert is a no-op anyway, so do not second-guess the
    -- state of reviews (an account deletion may legitimately have nulled one).
    if exists (select 1 from public.bookings) then
        return;
    end if;

    -- Both columns, not just guest_id. reviews.stay_id is nullable (a general
    -- testimonial names no villa, and delisting a villa nulls it), while
    -- bookings.stay_id is NOT NULL — so such a review cannot become a booking.
    -- The inner join below would drop it without complaint; this counts it here
    -- instead, where the number is still visible.
    select count(*) into owned
      from public.reviews
     where guest_id is not null
       and stay_id  is not null;

    if owned <> 100 then
        raise exception
            'Expected 100 reviews with both a guest_id and a stay_id, found %. Run seed/0002_reviews_seed.sql and migration 0007_reviews_guest_id.sql first.',
            owned;
    end if;
end $$;

begin;

with
-- ---------------------------------------------------------------------------
-- Part A — the 100 stays that produced a review
-- ---------------------------------------------------------------------------
-- Check-out lands one day before the review was written: people write while it
-- is still fresh, and it keeps every booking strictly earlier than its review.
--
-- ⚠️ THE 2-4 NIGHT RANGE IS NOT A TASTE DECISION. 0002_reviews_seed.sql spaces
-- `days_ago` exactly 4 days apart within each villa. With check-out at
-- (days_ago - 1), a stay of n nights occupies [d-1-n, d-1) and the next older
-- one ends at (d-5) — so any n <= 4 clears it, and n = 4 meets it exactly at
-- the boundary, which is same-day turnover and perfectly normal. Widen this
-- range and the seed starts double-booking villas.
--
-- The proof holds for ANY value in {2,3,4}, which matters: `r.id` comes out of
-- a join, so its ordering is not guaranteed and must not be relied on.
-- `::int` is not decoration: reviews.id is bigint, and Postgres has no
-- `date - bigint` operator (bigint -> integer is not an implicit cast), so
-- without it the statement fails to resolve rather than misbehaving quietly.
review_stays as (
    select
        r.stay_id,
        r.guest_id,
        r.created_at,
        (2 + (r.id % 3))::int as nights
    from public.reviews r
    where r.guest_id is not null
      -- bookings.stay_id is NOT NULL; the guard above already refuses to run if
      -- this drops anything, so it can never silently shrink the 100.
      and r.stay_id is not null
),

review_bookings as (
    select
        rs.stay_id                                      as stay_id,
        rs.guest_id                                     as guest_id,
        (rs.created_at::date - 1) - rs.nights           as start_date,
        (rs.created_at::date - 1)                       as end_date,
        -- Bigger parties on the shorter stays; never above what the villa
        -- sleeps (capacities are 6 / 8 / 4 / 6), never below 2.
        greatest(2, s.capacity - (rs.nights - 2))::smallint as num_guests,
        -- Copied from the catalogue, which is only correct because these four
        -- prices have never changed. It is NOT a licence to re-join bookings to
        -- stays for a price later — that is the whole reason the column exists.
        -- Inventing a different price history would be worse than having none.
        s.price_per_night                               as unit_price_per_night,
        s.discount                                      as discount_per_night,
        'checked_out'::text                             as status,
        14                                              as paid_lead,   -- days before check-in
        30                                              as booked_lead, -- days before check-in
        null::text                                      as guest_notes
    from review_stays rs
    join public.stays s on s.id = rs.stay_id
),

-- ---------------------------------------------------------------------------
-- Part B — 40 bookings that produced no review
-- ---------------------------------------------------------------------------
-- Written out rather than generated, and joined to guests through
-- auth.users.email exactly as seed/0003 does: public.guests deliberately has no
-- email column, and its id is a per-project random uuid that cannot live in a
-- portable seed file.
--
-- This is what makes count(bookings) > count(reviews), which
-- GUEST_PLANNING_TABLE.md §3 calls a real metric rather than a gap to close:
-- reviews collected ÷ bookings already checked out.
--
-- `anchor` picks the reference date, and the two are NOT interchangeable:
--
--   'past'  -> pinned to the oldest review, 10 days clear of it. Part A's dates
--              come from review timestamps, so if reviews were seeded weeks ago
--              their whole block sits further back than today suggests. Pinning
--              these to current_date instead would drift into Part A and start
--              double-booking villas whenever the two seeds run on different
--              days.
--   'today' -> pinned to current_date. Safe unconditionally: Part A always ends
--              in the past, and these are the in-progress and future stays.
--
-- Offsets are spaced by hand so no two stays at the same villa overlap. There
-- is no exclusion constraint to catch a mistake here — see 0009 — so the check
-- at the bottom of this file is the only thing that will.
extra_seed (
    email, stay_slug, anchor, start_offset, nights, num_guests,
    status, paid_lead, booked_lead, guest_notes
) as (
    values
    -- -----------------------------------------------------------------------
    -- Tuscan Twilight Villa — Ubud (capacity 6)
    -- -----------------------------------------------------------------------
    ('hollie.marsden@example.com',    'tuscan-twilight-villa', 'past',  -87, 4, 2, 'checked_out', 14, 45, null),
    ('jonas.weber@example.com',       'tuscan-twilight-villa', 'past',  -65, 3, 4, 'checked_out', 10, 38, null),
    ('petra.horvath@example.com',     'tuscan-twilight-villa', 'past',  -39, 5, 6, 'checked_out', 21, 60, null),
    ('marcus.oyelaran@example.com',   'tuscan-twilight-villa', 'past',  -15, 3, 3, 'checked_out',  7, 25, null),
    ('tanya.pillai@example.com',      'tuscan-twilight-villa', 'today',  -2, 5, 5, 'checked_in',  12, 40,
        $n$Travelling with a nine-month-old — could the crib be set up before we arrive?$n$),
    ('james.whitfield@example.com',   'tuscan-twilight-villa', 'today',   6, 4, 4, 'confirmed',    9, 35, null),
    ('linnea.kallio@example.com',     'tuscan-twilight-villa', 'today',  24, 3, 2, 'confirmed', null, 20, null),
    -- Amara has two reviews already; this is her third stay. Returning guests
    -- are the point of keeping guest → bookings a 1─N relation.
    ('amara.lindqvist@example.com',   'tuscan-twilight-villa', 'today',  55, 6, 6, 'confirmed',   30, 70,
        $n$Third stay with you — the room at the end of the garden corridor if it is free.$n$),
    ('dimitri.katsaros@example.com',  'tuscan-twilight-villa', 'today',  96, 4, 3, 'confirmed', null, 30, null),
    ('kristoffer.dahl@example.com',   'tuscan-twilight-villa', 'today',  38, 3, 4, 'cancelled', null, 55, null),

    -- -----------------------------------------------------------------------
    -- Coastal Arch Retreat — Uluwatu (capacity 8)
    -- -----------------------------------------------------------------------
    ('sofia.lindberg@example.com',    'coastal-arch-retreat',  'past',  -82, 5, 6, 'checked_out', 18, 50, null),
    ('ravi.chandrasekar@example.com', 'coastal-arch-retreat',  'past',  -57, 4, 8, 'checked_out', 14, 42, null),
    ('margot.dubois@example.com',     'coastal-arch-retreat',  'past',  -32, 3, 4, 'checked_out',  9, 30, null),
    ('samuel.adeyemi@example.com',    'coastal-arch-retreat',  'past',   -7, 3, 5, 'checked_out', 11, 33, null),
    ('carlos.viera@example.com',      'coastal-arch-retreat',  'today',  -3, 6, 7, 'checked_in',  20, 52,
        $n$Arriving on the late flight, close to 11pm — airport transfer needed.$n$),
    ('mei.lin.chow@example.com',      'coastal-arch-retreat',  'today',   5, 5, 5, 'confirmed',   15, 44,
        $n$Two of the bedrooms as twins please, we are two families sharing.$n$),
    ('noor.haddad@example.com',       'coastal-arch-retreat',  'today',  21, 4, 3, 'confirmed', null, 26, null),
    ('priya.raghunathan@example.com', 'coastal-arch-retreat',  'today',  48, 7, 8, 'confirmed',   25, 65, null),
    ('stefan.bauer@example.com',      'coastal-arch-retreat',  'today',  88, 5, 6, 'confirmed', null, 28, null),
    ('beatriz.alves@example.com',     'coastal-arch-retreat',  'today',  33, 4, 4, 'cancelled', null, 48, null),

    -- -----------------------------------------------------------------------
    -- Riverside Stone Lodge — Canggu (capacity 4)
    -- -----------------------------------------------------------------------
    ('connor.flanagan@example.com',   'riverside-stone-lodge', 'past',  -75, 3, 2, 'checked_out',  8, 28, null),
    ('andres.quintero@example.com',   'riverside-stone-lodge', 'past',  -51, 2, 4, 'checked_out', 12, 36, null),
    ('wei.zhang@example.com',         'riverside-stone-lodge', 'past',  -26, 4, 3, 'checked_out', 16, 40, null),
    ('keiko.arata@example.com',       'riverside-stone-lodge', 'past',   -5, 2, 2, 'checked_out',  6, 22, null),
    ('emil.rasmussen@example.com',    'riverside-stone-lodge', 'today',  -1, 4, 4, 'checked_in',  10, 32,
        $n$Any chance of an early check-in? We land at six in the morning.$n$),
    ('yuki.morishima@example.com',    'riverside-stone-lodge', 'today',   7, 2, 2, 'confirmed',    5, 18,
        $n$I have two calls to take — is the desk within reach of the router?$n$),
    ('hana.kowalski@example.com',     'riverside-stone-lodge', 'today',  19, 3, 3, 'confirmed', null, 24, null),
    ('adriana.lopes@example.com',     'riverside-stone-lodge', 'today',  44, 4, 4, 'confirmed',   20, 58, null),
    ('connor.flanagan@example.com',   'riverside-stone-lodge', 'today',  79, 3, 2, 'confirmed', null, 21, null),
    ('martin.novak@example.com',      'riverside-stone-lodge', 'today',  30, 2, 3, 'cancelled', null, 44, null),

    -- -----------------------------------------------------------------------
    -- Cliffside Ocean Villa — Nusa Penida (capacity 6)
    -- -----------------------------------------------------------------------
    ('zara.ibrahim@example.com',      'cliffside-ocean-villa', 'past',  -79, 4, 5, 'checked_out', 13, 39, null),
    ('henrik.nilsson@example.com',    'cliffside-ocean-villa', 'past',  -62, 5, 3, 'checked_out', 17, 47, null),
    ('rachel.goldstein@example.com',  'cliffside-ocean-villa', 'past',  -37, 3, 6, 'checked_out',  9, 31, null),
    ('felipe.cardenas@example.com',   'cliffside-ocean-villa', 'past',   -9, 4, 4, 'checked_out', 15, 43, null),
    ('leila.farahani@example.com',    'cliffside-ocean-villa', 'today',  -4, 7, 6, 'checked_in',  22, 56,
        $n$Please book the villa driver for the whole stay — we would rather not take scooters.$n$),
    ('valentina.rossi@example.com',   'cliffside-ocean-villa', 'today',   8, 5, 4, 'confirmed',   11, 37, null),
    ('siobhan.kelly@example.com',     'cliffside-ocean-villa', 'today',  27, 4, 2, 'confirmed', null, 23, null),
    ('yusuf.demir@example.com',       'cliffside-ocean-villa', 'today',  60, 6, 5, 'confirmed',   28, 68,
        $n$We are booking the fast boat from Sanur ourselves and should arrive mid-afternoon.$n$),
    ('nadia.benali@example.com',      'cliffside-ocean-villa', 'today', 102, 5, 3, 'confirmed', null, 27, null),
    ('victor.nguyen@example.com',     'cliffside-ocean-villa', 'today',  45, 3, 4, 'cancelled', null, 50, null)
),

past_anchor as (
    select (min(created_at)::date - 10) as anchor_day from public.reviews
),

extra_bookings as (
    select
        s.id                                            as stay_id,
        u.id                                            as guest_id,
        (case when e.anchor = 'past' then p.anchor_day else current_date end
            + e.start_offset)                           as start_date,
        (case when e.anchor = 'past' then p.anchor_day else current_date end
            + e.start_offset + e.nights)                as end_date,
        e.num_guests::smallint                          as num_guests,
        s.price_per_night                               as unit_price_per_night,
        s.discount                                      as discount_per_night,
        e.status                                        as status,
        e.paid_lead                                     as paid_lead,
        e.booked_lead                                   as booked_lead,
        e.guest_notes                                   as guest_notes
    from extra_seed e
    cross join past_anchor p
    join public.stays s on s.slug   = e.stay_slug
    join auth.users  u on u.email  = e.email
)

insert into public.bookings (
    stay_id, guest_id, start_date, end_date, num_guests,
    unit_price_per_night, discount_per_night, status, paid_at, created_at, guest_notes
)
select
    b.stay_id,
    b.guest_id,
    b.start_date,
    b.end_date,
    b.num_guests,
    b.unit_price_per_night,
    b.discount_per_night,
    b.status,
    -- Midnight, because the only thing actually known here is the day. Adding a
    -- plausible-looking hour would be inventing precision this data has not got.
    -- NULL where nothing was ever charged: unpaid future stays, and every
    -- cancellation.
    case when b.paid_lead is null then null
         else (b.start_date - b.paid_lead)::timestamptz end,
    -- created_at is when the reservation was MADE, always earlier than payment
    -- and earlier still than the stay itself.
    (b.start_date - b.booked_lead)::timestamptz,
    b.guest_notes
from (
    select * from review_bookings
    union all
    select * from extra_bookings
) b
-- Both parts go through ONE statement so this guard sees a single snapshot,
-- taken at statement start. Split into two INSERTs, the second would find the
-- table already non-empty — populated by the first — and silently skip Part B.
where not exists (select 1 from public.bookings);

commit;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- Expect: 140 | 116 | 4 | 16 | 4 | 128
select count(*)                                       as bookings,
       count(*) filter (where status = 'checked_out') as checked_out,
       count(*) filter (where status = 'checked_in')  as checked_in,
       count(*) filter (where status = 'confirmed')   as confirmed,
       count(*) filter (where status = 'cancelled')   as cancelled,
       count(paid_at)                                 as paid
from public.bookings;

-- No two stays at the same villa may overlap. There is no exclusion constraint
-- enforcing this (0009 explains why), so this query is the only thing standing
-- between the seed and a double-booked villa. Cancellations release their dates
-- and are excluded, exactly as a constraint's WHERE clause would have done.
-- Expect: 0 rows.
select a.id as booking_a, b.id as booking_b, a.stay_id,
       a.start_date, a.end_date, b.start_date, b.end_date
from public.bookings a
join public.bookings b
  on  b.stay_id = a.stay_id
  and b.id > a.id
  and daterange(a.start_date, a.end_date, '[)') && daterange(b.start_date, b.end_date, '[)')
where a.status <> 'cancelled'
  and b.status <> 'cancelled';

-- num_guests <= capacity cannot be a CHECK constraint (it spans two tables), so
-- it is asserted here instead. Expect: 0 rows.
select b.id, b.num_guests, s.capacity, s.slug
from public.bookings b
join public.stays s on s.id = b.stay_id
where b.num_guests > s.capacity;

-- Every review has a stay that plausibly precedes it. Expect: 100.
select count(*) as reviews_with_a_matching_stay
from public.reviews r
where exists (
    select 1 from public.bookings b
     where b.guest_id = r.guest_id
       and b.stay_id  = r.stay_id
       and b.end_date <= r.created_at::date
);
