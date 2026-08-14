-- 0005_bookings_current_seed.sql
-- 24 near-term bookings — one stay in progress, four ahead and one cancelled
-- per villa — re-anchored to the day this file runs.
--
-- Run after seed/0004_bookings_seed.sql. Needs migration 0010 only in the sense
-- that nothing can see the result without it.
--
-- ---------------------------------------------------------------------------
-- This file is RE-RUNNABLE, and that is the point
-- ---------------------------------------------------------------------------
-- 0004 is idempotent the usual way: gated on the table being empty, so a second
-- run is a no-op. That is wrong for this data. Its 'today'-anchored rows were
-- pinned to current_date at the moment 0004 ran, and a seed database is not
-- re-created weekly — so a few weeks later every "future" booking sits in the
-- past and the availability calendar renders with nothing marked at all.
--
-- So this file DELETES its own rows and writes them again. Run it whenever the
-- calendar looks empty; the whole near-term block moves forward to today.
--
-- ---------------------------------------------------------------------------
-- What "its own rows" means, and why the rule is safe
-- ---------------------------------------------------------------------------
--     delete from public.bookings where status <> 'checked_out';
--
-- That reads as blunt. It is exact, and the invariant behind it is worth
-- stating because the next person to add a seed can break it:
--
--   * 0004 Part A — all 100 rows are 'checked_out' (they stand behind a review
--     that was already written, so the stay necessarily ended).
--   * 0004 Part B 'past' block — 16 rows, all 'checked_out'.
--   * 0004 Part B 'today' block — 24 rows, none 'checked_out'. Exactly the
--     stale data this file replaces.
--
-- So `status <> 'checked_out'` selects the drifting rows and nothing else, and
-- the 116 historical rows are never touched. ⚠️ If a later seed ever adds a
-- non-checked_out row it does NOT own, this DELETE will eat it — change the
-- rule then, do not widen it.
--
-- No real reservation has ever existed in this database, so nothing here
-- deletes anything a person made. Once a checkout flow exists, this file must
-- not run against that database.
--
-- ---------------------------------------------------------------------------
-- Honesty, same as 0004
-- ---------------------------------------------------------------------------
-- Placeholders in the correct shape. No money changed hands and `paid_at`
-- records a date with no payment behind it.

-- ---------------------------------------------------------------------------
-- Refuse to run out of order
-- ---------------------------------------------------------------------------
-- Without this the DELETE would happily empty a table that 0004 never filled,
-- and the INSERT would join against auth.users, find nothing, and write zero
-- rows — leaving a database that looks seeded and has no bookings at all.
do $$
declare
    historical int;
    accounts   int;
begin
    select count(*) into historical
      from public.bookings
     where status = 'checked_out';

    if historical < 116 then
        raise exception
            'Expected at least 116 checked_out bookings from seed/0004, found %. Run seed/0004_bookings_seed.sql first.',
            historical;
    end if;

    -- The 24 guests below are the same accounts 0004 Part B used, so they are
    -- guaranteed to exist — unless create-seed-accounts.mjs was never run
    -- against this project, in which case say so here rather than writing 0 rows.
    select count(*) into accounts
      from auth.users
     where email in (
        'tanya.pillai@example.com',     'james.whitfield@example.com',
        'linnea.kallio@example.com',    'amara.lindqvist@example.com',
        'dimitri.katsaros@example.com', 'kristoffer.dahl@example.com',
        'carlos.viera@example.com',     'mei.lin.chow@example.com',
        'noor.haddad@example.com',      'priya.raghunathan@example.com',
        'stefan.bauer@example.com',     'beatriz.alves@example.com',
        'emil.rasmussen@example.com',   'yuki.morishima@example.com',
        'hana.kowalski@example.com',    'adriana.lopes@example.com',
        'connor.flanagan@example.com',  'martin.novak@example.com',
        'leila.farahani@example.com',   'valentina.rossi@example.com',
        'siobhan.kelly@example.com',    'yusuf.demir@example.com',
        'nadia.benali@example.com',     'victor.nguyen@example.com'
     );

    if accounts <> 24 then
        raise exception
            'Expected 24 seed accounts in auth.users, found %. Run scripts/create-seed-accounts.mjs first.',
            accounts;
    end if;
end $$;

begin;

-- Everything this file owns, from whichever run put it there.
delete from public.bookings where status <> 'checked_out';

with
-- ---------------------------------------------------------------------------
-- The anchor
-- ---------------------------------------------------------------------------
-- current_date - 2, so the 'checked_in' row is genuinely mid-stay rather than
-- starting today.
--
-- The greatest() is not paranoia. Part A's dates come from review timestamps,
-- and 0002_reviews_seed.sql places its newest review only a few days back — so
-- on a freshly seeded project a Part A stay can still be ending this week. Two
-- days before today would then land inside it, and there is no exclusion
-- constraint to catch that (0009 §3). Taking the latest checked_out check-out
-- as a floor makes the collision impossible instead of unlikely.
--
-- The DELETE above has already run, so max(end_date) here sees only the 116
-- historical rows.
anchor as (
    select greatest(
        current_date - 2,
        coalesce((select max(end_date) from public.bookings), current_date - 2)
    ) as day
),

-- ---------------------------------------------------------------------------
-- The rows
-- ---------------------------------------------------------------------------
-- Written out rather than generated, and joined to guests through
-- auth.users.email exactly as 0004 does: public.guests has no email column, and
-- its id is a per-project random uuid that cannot live in a portable seed file.
--
-- Offsets are days from the anchor and are spaced by hand so no two stays at
-- the same villa overlap — the check at the bottom of this file is the only
-- thing that will catch a mistake. The gaps between blocks are 2-3 days wide on
-- purpose: wide enough that a short range is still selectable, tight enough
-- that "you cannot check out past the next booking" is actually exercisable in
-- the picker.
--
-- The shape per villa, which is what makes the calendar worth looking at:
--   1 checked_in  starting at the anchor      — a stay in progress
--   2 confirmed   inside the next fortnight   — the near-term strike-outs
--   1 confirmed   around three weeks out
--   1 confirmed   around five weeks out       — lands in the second month
--   1 cancelled   in between                  — its dates stay SELECTABLE, and
--                                               that is the assertion it exists
--                                               to make
--
-- num_guests never exceeds the villa's capacity (6 / 8 / 4 / 6). paid_lead and
-- booked_lead are days before check-in; booked_lead is always the larger, since
-- a reservation is made before it is paid for. NULL paid_lead means never
-- charged: two of the four confirmed stays per villa, plus every cancellation.
extra_seed (
    email, stay_slug, start_offset, nights, num_guests,
    status, paid_lead, booked_lead, guest_notes
) as (
    values
    -- -----------------------------------------------------------------------
    -- Tuscan Twilight Villa — Ubud (capacity 6)
    -- -----------------------------------------------------------------------
    ('tanya.pillai@example.com',      'tuscan-twilight-villa',  0, 4, 5, 'checked_in',  12, 40,
        $n$Travelling with a nine-month-old — could the crib be set up before we arrive?$n$),
    ('james.whitfield@example.com',   'tuscan-twilight-villa',  6, 3, 4, 'confirmed',    9, 35, null),
    ('linnea.kallio@example.com',     'tuscan-twilight-villa', 12, 2, 2, 'confirmed', null, 20, null),
    ('amara.lindqvist@example.com',   'tuscan-twilight-villa', 21, 3, 6, 'confirmed',   14, 45,
        $n$Third stay with you — the room at the end of the garden corridor if it is free.$n$),
    ('dimitri.katsaros@example.com',  'tuscan-twilight-villa', 34, 5, 3, 'confirmed', null, 30, null),
    ('kristoffer.dahl@example.com',   'tuscan-twilight-villa', 27, 2, 4, 'cancelled', null, 55, null),

    -- -----------------------------------------------------------------------
    -- Coastal Arch Retreat — Uluwatu (capacity 8)
    -- -----------------------------------------------------------------------
    ('carlos.viera@example.com',      'coastal-arch-retreat',   0, 3, 7, 'checked_in',  20, 52,
        $n$Arriving on the late flight, close to 11pm — airport transfer needed.$n$),
    ('mei.lin.chow@example.com',      'coastal-arch-retreat',   5, 3, 5, 'confirmed',   15, 44,
        $n$Two of the bedrooms as twins please, we are two families sharing.$n$),
    ('noor.haddad@example.com',       'coastal-arch-retreat',  13, 2, 3, 'confirmed', null, 26, null),
    ('priya.raghunathan@example.com', 'coastal-arch-retreat',  22, 4, 8, 'confirmed',   25, 65, null),
    ('stefan.bauer@example.com',      'coastal-arch-retreat',  35, 5, 6, 'confirmed', null, 28, null),
    ('beatriz.alves@example.com',     'coastal-arch-retreat',  29, 2, 4, 'cancelled', null, 48, null),

    -- -----------------------------------------------------------------------
    -- Riverside Stone Lodge — Canggu (capacity 4)
    -- -----------------------------------------------------------------------
    -- 3 nights, not 2. At 2 it would end exactly on current_date, and
    -- get_stay_booked_ranges drops anything with end_date <= today — so the
    -- in-progress stay would vanish from the calendar the moment it was seeded.
    ('emil.rasmussen@example.com',    'riverside-stone-lodge',  0, 3, 4, 'checked_in',  10, 32,
        $n$Any chance of an early check-in? We land at six in the morning.$n$),
    ('yuki.morishima@example.com',    'riverside-stone-lodge',  7, 3, 2, 'confirmed',    5, 18,
        $n$I have two calls to take — is the desk within reach of the router?$n$),
    ('hana.kowalski@example.com',     'riverside-stone-lodge', 11, 2, 3, 'confirmed', null, 24, null),
    ('adriana.lopes@example.com',     'riverside-stone-lodge', 20, 3, 4, 'confirmed',   20, 58, null),
    ('connor.flanagan@example.com',   'riverside-stone-lodge', 33, 4, 2, 'confirmed', null, 21, null),
    ('martin.novak@example.com',      'riverside-stone-lodge', 26, 3, 3, 'cancelled', null, 44, null),

    -- -----------------------------------------------------------------------
    -- Cliffside Ocean Villa — Nusa Penida (capacity 6)
    -- -----------------------------------------------------------------------
    ('leila.farahani@example.com',    'cliffside-ocean-villa',  0, 4, 6, 'checked_in',  22, 56,
        $n$Please book the villa driver for the whole stay — we would rather not take scooters.$n$),
    ('valentina.rossi@example.com',   'cliffside-ocean-villa',  6, 2, 4, 'confirmed',   11, 37, null),
    ('siobhan.kelly@example.com',     'cliffside-ocean-villa', 14, 3, 2, 'confirmed', null, 23, null),
    ('yusuf.demir@example.com',       'cliffside-ocean-villa', 23, 2, 5, 'confirmed',   16, 48,
        $n$We are booking the fast boat from Sanur ourselves and should arrive mid-afternoon.$n$),
    ('nadia.benali@example.com',      'cliffside-ocean-villa', 36, 5, 3, 'confirmed', null, 27, null),
    ('victor.nguyen@example.com',     'cliffside-ocean-villa', 28, 3, 4, 'cancelled', null, 50, null)
),

extra_bookings as (
    select
        s.id                                as stay_id,
        u.id                                as guest_id,
        (a.day + e.start_offset)            as start_date,
        (a.day + e.start_offset + e.nights) as end_date,
        e.num_guests::smallint              as num_guests,
        -- Copied from the catalogue, which is only correct because these four
        -- prices have never changed. NOT a licence to re-join bookings to stays
        -- for a price later — that is the whole reason the column exists.
        s.price_per_night                   as unit_price_per_night,
        s.discount                          as discount_per_night,
        e.status                            as status,
        e.paid_lead                         as paid_lead,
        e.booked_lead                       as booked_lead,
        e.guest_notes                       as guest_notes
    from extra_seed e
    cross join anchor a
    join public.stays s on s.slug  = e.stay_slug
    join auth.users  u on u.email = e.email
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
    case when b.paid_lead is null then null
         else (b.start_date - b.paid_lead)::timestamptz end,
    -- created_at is when the reservation was MADE, always earlier than payment
    -- and earlier still than the stay itself.
    (b.start_date - b.booked_lead)::timestamptz,
    b.guest_notes
from extra_bookings b;

-- The joins above are inner joins on slug and email. A typo in either drops the
-- row without a word, and the DELETE has already run — so a silent miss would
-- leave the calendar emptier than before this file was invoked. Fail loudly
-- inside the transaction instead, while the rollback still costs nothing.
do $$
declare
    written int;
begin
    select count(*) into written
      from public.bookings
     where status <> 'checked_out';

    if written <> 24 then
        raise exception
            'Expected to write 24 near-term bookings, wrote %. A stay_slug or an email above does not match.',
            written;
    end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- Deliberately the same queries as 0004, so the two files agree on what a
-- healthy bookings table looks like.

-- Unchanged from 0004, and that is the assertion: this file replaces its own
-- rows one for one rather than accumulating.
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

-- What the calendar will actually render. Expect 5 rows per villa (the
-- cancellation is excluded), the first straddling today, the last about six
-- weeks out.
select s.slug, r.start_date, r.end_date, (r.end_date - r.start_date) as nights
from public.stays s
cross join lateral public.get_stay_booked_ranges(s.slug) r
order by s.slug, r.start_date;
