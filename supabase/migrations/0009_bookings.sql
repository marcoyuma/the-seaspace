-- 0009_bookings.sql
-- Reservations: which guest stayed in which villa, when, and for how much.
--
-- Run after 0001_stays_schema.sql (references public.stays) and 0006_guests.sql
-- (references public.guests). Idempotent: safe to re-run.
--
-- ---------------------------------------------------------------------------
-- What this table finally makes possible, and what it still does not
-- ---------------------------------------------------------------------------
-- 0005_reviews.sql refused an `is_verified` column on the grounds that
-- verification must be derived from a booking, not asserted by a flag. This
-- table is the missing half of that argument — but only the half. `reviews`
-- does NOT gain `booking_id` here, so there is still no verification mechanism.
-- That is a separate migration, together with the composite foreign key
-- specified in GUEST_PLANNING_TABLE.md §3.
--
-- Nothing in the application reads this table yet. There is no auth, no
-- checkout route (`/stays/{slug}/book` is linked from stay-info-section.tsx and
-- currently 404s), and no write path. Rows arrive from seed/0004 only.
--
-- ---------------------------------------------------------------------------
-- Shape credit, and where it deliberately diverges
-- ---------------------------------------------------------------------------
-- The column list started from the Wild Oasis course schema and was translated
-- rather than copied. The differences are decisions, not oversights:
--
--   camelCase          -> snake_case      (every other table here)
--   cabinId            -> stay_id         (cabins was dropped in 0003)
--   timestamp dates    -> date            (see below)
--   numNights column   -> generated       (cannot contradict the dates)
--   cabinPrice total   -> rate + total    (a total cannot reconstruct a rate)
--   hasBreakfast/extrasPrice -> dropped   (the site advertises breakfast as
--                                          included; a paid add-on column would
--                                          contradict its own marketing copy)
--   isPaid boolean     -> paid_at         (records when, not merely whether)
--   observations       -> guest_notes     (no admin creates bookings here)
--   no RLS             -> RLS             (the anon key ships to the browser)

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
    id         bigint      generated always as identity primary key,

    -- When the reservation was MADE. The stay itself is start_date/end_date;
    -- confusing the two turns "booked 30 days in advance" into "stayed today".
    created_at timestamptz not null default now(),

    -- `restrict`, and it is the odd one out on purpose. stay_images and
    -- stay_amenities cascade because they are descriptions of a villa; reviews
    -- set null because a testimonial outlives the villa it describes. A booking
    -- is neither — it is a financial record, and one that cannot answer "stayed
    -- where" is worthless for the tax retention that makes it a record at all.
    --
    -- Consequence for the admin panel: a villa that has ever been booked can no
    -- longer be DELETEd. Retiring it needs an unlist/archive column, which does
    -- not exist yet. Documented in ADMIN-PANEL-CONTEXT.md so it does not surface
    -- there as an unexplained foreign key violation.
    stay_id  bigint not null references public.stays(id)  on delete restrict,

    -- `set null`, not cascade, and this one is legally load-bearing: booking and
    -- invoice records generally must be retained for tax purposes, and that
    -- obligation outranks an erasure request. A cascade would delete financial
    -- records that are not allowed to be deleted.
    -- See GUEST_PLANNING_TABLE.md §7 and ACCOUNT-DELETION-POLICY.md §6.
    guest_id uuid            references public.guests(id) on delete set null,

    -- `date`, not timestamp. Check-in is 3:00 PM and check-out 11:00 AM for
    -- every villa (faq-section.tsx) — that is a property-wide policy, not a
    -- per-row fact, so storing it 140 times would be storing the same constant
    -- over and over while inviting timezone ambiguity. The day a booking can
    -- carry its own early check-in, this becomes two extra time columns rather
    -- than a type change.
    start_date date not null,

    -- The check-out day, NOT the last night. A stay of [10th, 13th) occupies
    -- the nights of the 10th, 11th and 12th, and the 13th is free from 11:00 AM
    -- for the next guest. Same-day turnover is normal, so two bookings meeting
    -- at this boundary do not overlap.
    end_date   date not null,

    -- Generated, not stored by hand: a nights count that can disagree with its
    -- own dates is the same second-source-of-truth mistake this schema has
    -- refused three times already. `date - date` yields an integer in Postgres,
    -- which is what makes this expressible at all.
    num_nights integer generated always as (end_date - start_date) stored,

    num_guests smallint not null,

    -- Snapshot of what was actually charged, taken when the booking is made.
    -- stays.price_per_night may change at any time; joining back to it later
    -- would silently rewrite the price of every past stay.
    unit_price_per_night integer not null,
    discount_per_night   integer not null default 0,

    -- Note this repeats `(end_date - start_date)` rather than using num_nights:
    -- Postgres forbids a generated column from reading another generated
    -- column. Not a style choice, and not a candidate for "simplification".
    total_price integer generated always as
        ((unit_price_per_night - discount_per_night) * (end_date - start_date)) stored,

    -- Kept as a column, unlike every boolean this schema has rejected, because
    -- check-in and check-out are real-world events that nothing else records.
    -- They cannot be derived: a stay whose end_date has passed may have been a
    -- no-show, and a cancellation says nothing about the calendar.
    --
    -- 'unconfirmed' from the course schema is deliberately absent — there it
    -- means "booked but not yet checked in", which 'confirmed' already covers.
    status text not null default 'confirmed',

    -- Replaces `isPaid boolean`. Strictly more informative: the boolean is
    -- `paid_at is not null`, while the reverse cannot be recovered. NULL means
    -- unpaid, and stays NULL on a cancellation that was never charged.
    paid_at timestamptz,

    -- Special requests typed by the guest at checkout — the only author this
    -- product has. The course's `observations` is a staff note, and
    -- ADMIN-PANEL-CONTEXT.md rules out an admin touching bookings at all, so
    -- that column would have had no way to ever be filled.
    guest_notes text,

    constraint bookings_dates_ordered check (end_date > start_date),
    constraint bookings_guests_pos    check (num_guests > 0),
    constraint bookings_price_pos     check (unit_price_per_night > 0),
    -- Mirrors stays_discount_ok, so a snapshot can never be more generous than
    -- the catalogue rule that produced it.
    constraint bookings_discount_ok   check (discount_per_night >= 0
                                             and discount_per_night < unit_price_per_night),
    constraint bookings_status_known  check (status in
        ('confirmed', 'checked_in', 'checked_out', 'cancelled'))
);

-- ---------------------------------------------------------------------------
-- Two invariants that are NOT enforced here, and why
-- ---------------------------------------------------------------------------
-- 1. `num_guests <= stays.capacity` — a cross-table rule, which CHECK cannot
--    express. It would need a trigger; for now the booking form enforces it and
--    verification block K in supabase/README.md proves the data obeys it.
--
-- 2. `status` versus the calendar — 'checked_out' ought to imply end_date is in
--    the past. CHECK constraints must be IMMUTABLE and now() is not, so
--    Postgres rejects this outright. Also verified in block K.
--
-- 3. No two bookings for the same villa may overlap. Deliberately NOT a
--    database constraint: overlap is prevented at the input path, where the
--    date picker only offers free dates. An `exclude using gist` constraint was
--    considered and declined by the project owner.
--    ⚠️ The consequence is worth stating: two guests submitting the same dates
--    simultaneously are both accepted, because a read-time check is not a lock.
--    If that ever matters, the fix is btree_gist + an exclusion constraint here,
--    not more validation in the form. The seed data is genuinely overlap-free
--    and block K asserts it, so the invariant stays checkable meanwhile.

-- ---------------------------------------------------------------------------
-- Composite key for the review foreign key that comes next
-- ---------------------------------------------------------------------------
-- Redundant today: `id` alone is already unique, so this adds no new rule. It
-- exists to be the target of the composite FK in GUEST_PLANNING_TABLE.md §3:
--
--     alter table public.reviews add constraint reviews_matches_booking_fkey
--         foreign key (booking_id, guest_id, stay_id)
--         references public.bookings (id, guest_id, stay_id);
--
-- which is what stops reviews.guest_id / reviews.stay_id from drifting away
-- from the booking they claim to describe. Landing it here costs one index and
-- reduces the next migration to a single ALTER on reviews.
alter table public.bookings drop constraint if exists bookings_id_guest_stay_key;

alter table public.bookings add constraint bookings_id_guest_stay_key
    unique (id, guest_id, stay_id);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- "My trips", newest stay first.
create index if not exists bookings_guest_id_idx
    on public.bookings (guest_id, start_date desc);

-- Not decoration. Because overlap is prevented at the input path rather than by
-- a constraint, every render of the booking form asks "which dates are already
-- taken for this villa" — the one query that must not be a sequential scan.
create index if not exists bookings_stay_dates_idx
    on public.bookings (stay_id, start_date);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Follows public.guests, NOT the catalogue tables. A booking row carries prices
-- paid, free-text guest notes, and — read in bulk — the occupancy calendar of
-- every villa. The anon key ships to the browser, so one policy copied across
-- from 0001_stays_schema.sql would publish all three.
--
-- No `anon` policy exists, and none may be added.
--
-- No INSERT/UPDATE/DELETE policy either: there is no checkout flow yet, and a
-- write policy is only expressible once auth can prove who is booking. Seeds
-- and fixes go through the service role key, which bypasses RLS.
--
-- This application has exactly one role — `authenticated` IS the guest. The
-- admin panel is a separate repository using the service role key, not a role
-- in this database, so there is no admin policy here by design.
alter table public.bookings enable row level security;

drop policy if exists "guests read their own bookings" on public.bookings;

-- Accepted consequence: once guest_id is nulled by an account deletion, the row
-- becomes invisible to every role except the service role. That is the intent —
-- the record is retained for tax purposes, not for browsing.
create policy "guests read their own bookings"
    on public.bookings for select to authenticated
    using (auth.uid() = guest_id);

-- Expect 0 before seed/0004_bookings_seed.sql runs, 140 after.
select count(*) as bookings from public.bookings;
