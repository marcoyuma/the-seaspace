-- 0011_booking_writes.sql
-- The write path: how a reservation actually gets made, and why none of it is
-- an RLS policy.
--
-- Run after 0009_bookings.sql and 0010_stay_availability.sql. Idempotent: safe
-- to re-run.
--
-- ---------------------------------------------------------------------------
-- 1. Why there is still no INSERT policy on public.bookings
-- ---------------------------------------------------------------------------
-- 0009 left the table closed and said a write policy becomes expressible "once
-- auth can prove who is booking". Auth exists now, so the obvious move would be:
--
--     create policy "guests book for themselves" on public.bookings
--         for insert to authenticated with check (auth.uid() = guest_id);
--
-- That policy is wrong, and the reason is worth writing down because it looks
-- perfectly safe. The anon key ships to the browser and the guest holds a real
-- session, so the guest can POST to /rest/v1/bookings directly. The policy
-- checks WHO is booking. It cannot check WHAT they wrote — nothing stops a
-- crafted request from inserting unit_price_per_night = 1, or num_guests = 40,
-- or dates in 1998. RLS authorises rows, not values.
--
-- So the insert goes through a SECURITY DEFINER function instead, exactly like
-- the read path in 0010, and for the same structural reason: the function's
-- PARAMETER LIST is the allow-list. A caller may choose a villa, two dates, a
-- headcount and a note. Price is not a parameter — it is read from
-- public.stays inside the function, which is also what makes it a genuine
-- snapshot in 0009's sense rather than a number the browser supplied.
--
-- The rule from 0009 therefore stands unchanged: no anon policy, and now no
-- INSERT/UPDATE policy either. Every write to this table goes through the two
-- functions below or through the service role.
--
-- ---------------------------------------------------------------------------
-- 2. The cross-table invariant that CHECK could not express
-- ---------------------------------------------------------------------------
-- 0009 recorded two invariants it could not enforce. The first —
-- `num_guests <= stays.capacity` — needed a trigger because a CHECK constraint
-- cannot read another table. A function that already has to look up the stay to
-- snapshot its price can check capacity in the same lookup, so that invariant
-- moves out of "the form enforces it" and into the database. See create_booking.
--
-- The second (status versus the calendar) is untouched and stays untouched:
-- it needs now(), and now() is not IMMUTABLE.

-- ---------------------------------------------------------------------------
-- 3. Overlap becomes a database rule
-- ---------------------------------------------------------------------------
-- 0009 §3 declined an exclusion constraint on the grounds that overlap is
-- prevented at the input path. That was true while nothing wrote. It stops
-- being true the moment two browsers can submit at once: the date picker reads
-- availability, the guest thinks for a minute, and a read-time check is not a
-- lock. Both submissions are accepted and the villa is double-booked.
--
-- This is the one race a booking system cannot shrug off, so the decision is
-- reversed here deliberately rather than quietly: the constraint below IS the
-- lock. Two concurrent inserts for the same nights now leave one winner and one
-- 23P01, which features/booking/server-actions.ts turns into "those dates were
-- just taken".
--
-- `where (status <> 'cancelled')` is what makes it agree with the rest of the
-- system: get_stay_booked_ranges() and seed/0004's overlap check both treat a
-- cancellation as releasing its dates. A constraint that disagreed with the
-- picker would reject bookings the calendar had just offered.
--
-- btree_gist is required because `stay_id with =` is an equality test on a
-- bigint, and GiST has no built-in operator class for that.
create extension if not exists btree_gist;

alter table public.bookings drop constraint if exists bookings_no_overlap;

-- ⚠️ This ALTER fails if the existing rows already overlap. That is the point —
-- verification block K in supabase/README.md asserts the seed is overlap-free,
-- so a failure here means real data needs looking at, not that the constraint
-- needs relaxing.
alter table public.bookings add constraint bookings_no_overlap
    exclude using gist (
        stay_id                                    with =,
        daterange(start_date, end_date, '[)')      with &&
    ) where (status <> 'cancelled');

-- ---------------------------------------------------------------------------
-- 4. create_booking — the only way a guest can add a row
-- ---------------------------------------------------------------------------
-- Errors are raised with custom SQLSTATEs rather than plain messages, because
-- the application matches on them (PostgREST forwards the code verbatim as
-- `error.code`) and message text is not an API:
--
--   SB001  headcount exceeds the villa's capacity
--   SB002  arrival is in the past
--   SB003  no session — auth.uid() is null
--   SB004  no such stay
--   SB005  signed in, but no public.guests row
--
-- 23P01 (the exclusion constraint above) is left to bubble up as itself.
create or replace function public.create_booking(
    p_slug        text,
    p_start       date,
    p_end         date,
    p_num_guests  smallint,
    p_guest_notes text default null
)
returns bigint
language plpgsql
-- VOLATILE (the default) — it writes.
-- SECURITY DEFINER for the reason in §1: the table has no INSERT policy for
-- anyone, so the caller's own rights are never enough. And with a definer
-- function, an empty search_path is mandatory rather than tidy — see 0010.
security definer
set search_path = ''
as $$
declare
    v_guest_id  uuid   := auth.uid();
    v_stay      record;
    -- The villa's local day, not the server's. On Vercel the server clock is
    -- UTC, and a guest in Jakarta booking at 07:00 on the 3rd would be told the
    -- 3rd is in the past. Bali is WITA (UTC+8); Asia/Makassar is its zone.
    v_today     date   := (now() at time zone 'Asia/Makassar')::date;
    v_booking_id bigint;
begin
    if v_guest_id is null then
        raise exception 'A booking must be made by a signed-in guest'
            using errcode = 'SB003';
    end if;

    -- The FK on guest_id would catch a missing row anyway, but as a foreign key
    -- violation nobody can act on. This is the "trigger never fired" case that
    -- app/(auth)/account/page.tsx also has copy for.
    if not exists (select 1 from public.guests g where g.id = v_guest_id) then
        raise exception 'No guest profile exists for this account'
            using errcode = 'SB005';
    end if;

    -- The price snapshot's source, and the capacity check's, in one lookup.
    select s.id, s.price_per_night, s.discount, s.capacity
    into v_stay
    from public.stays s
    where s.slug = p_slug;

    if not found then
        raise exception 'No stay with slug %', p_slug using errcode = 'SB004';
    end if;

    if p_start < v_today then
        raise exception 'Check-in % is in the past', p_start
            using errcode = 'SB002';
    end if;

    if p_num_guests > v_stay.capacity then
        raise exception '% guests exceeds the villa capacity of %',
            p_num_guests, v_stay.capacity
            using errcode = 'SB001';
    end if;

    -- Everything else is already a table constraint: end_date > start_date,
    -- num_guests > 0, and the discount bounds. Re-checking them here would be a
    -- second copy of a rule that is already enforced, which is how two copies
    -- start disagreeing.
    insert into public.bookings (
        stay_id, guest_id, start_date, end_date, num_guests,
        unit_price_per_night, discount_per_night, status, guest_notes
    )
    values (
        v_stay.id, v_guest_id, p_start, p_end, p_num_guests,
        v_stay.price_per_night, v_stay.discount,
        -- 'confirmed' with paid_at still NULL: the row exists, so the exclusion
        -- constraint is already holding these dates against anyone else, but
        -- nothing has been charged yet. settle_booking_payment() closes it.
        'confirmed',
        nullif(btrim(coalesce(p_guest_notes, '')), '')
    )
    returning id into v_booking_id;

    return v_booking_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. settle_booking_payment — the second half of the same transaction-in-spirit
-- ---------------------------------------------------------------------------
-- Why the booking is inserted BEFORE payment is attempted: the row is the lock.
-- Charging first and inserting afterwards means the dates are unheld for the
-- whole time the payment provider is thinking, which is precisely the window
-- the exclusion constraint was added to close — and a payment that succeeds
-- against dates somebody else just took is far worse than a payment that never
-- started.
--
-- A failed payment therefore cancels rather than deletes: 'cancelled' is
-- outside the exclusion constraint's WHERE clause, so the dates are released
-- immediately, and the attempt stays on the record. Deleting a financial row is
-- what 0009's `on delete restrict`/`set null` reasoning spends its whole comment
-- refusing to do.
--
-- Again a function and not an UPDATE policy: a policy scoped to
-- `auth.uid() = guest_id` would let a guest rewrite their own dates, price or
-- status by hand. This function can only ever do one of two things.
--
--   SB006  the booking does not belong to the caller, or does not exist
--   SB007  it has already been settled
create or replace function public.settle_booking_payment(
    p_booking_id bigint,
    p_paid       boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_guest_id uuid := auth.uid();
    v_status   text;
    v_paid_at  timestamptz;
begin
    select b.status, b.paid_at
    into v_status, v_paid_at
    from public.bookings b
    where b.id = p_booking_id
      -- Ownership is the WHERE clause, not a separate check: a booking that is
      -- not the caller's is indistinguishable from one that does not exist,
      -- which is also what stops this becoming a way to probe for booking ids.
      and b.guest_id = v_guest_id;

    if not found then
        raise exception 'No booking % for this guest', p_booking_id
            using errcode = 'SB006';
    end if;

    if v_paid_at is not null or v_status <> 'confirmed' then
        raise exception 'Booking % has already been settled', p_booking_id
            using errcode = 'SB007';
    end if;

    if p_paid then
        update public.bookings set paid_at = now() where id = p_booking_id;
    else
        -- paid_at deliberately stays NULL. 0009: "NULL means unpaid, and stays
        -- NULL on a cancellation that was never charged."
        update public.bookings set status = 'cancelled' where id = p_booking_id;
    end if;
end;
$$;

-- EXECUTE is granted to PUBLIC by default, which on a SECURITY DEFINER function
-- is the whole hazard. Revoke, then hand it back to the one role that should
-- have it — `anon` gets nothing here, unlike get_stay_booked_ranges.
revoke all on function public.create_booking(text, date, date, smallint, text) from public;
revoke all on function public.settle_booking_payment(bigint, boolean)          from public;

grant execute on function public.create_booking(text, date, date, smallint, text) to authenticated;
grant execute on function public.settle_booking_payment(bigint, boolean)          to authenticated;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- The constraint exists and is the right kind. Expect one row, contype 'x'.
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.bookings'::regclass
  and conname = 'bookings_no_overlap';

-- The table is still closed to writes for everyone but the functions.
-- Expect exactly one policy: "guests read their own bookings", cmd = SELECT.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'bookings';

-- Both functions must be SECURITY DEFINER with an empty search_path.
-- Expect prosecdef = true and proconfig = {search_path=} for both.
select proname, prosecdef, proconfig
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('create_booking', 'settle_booking_payment');

-- The overlap rule, proven rather than assumed. Run as an ordinary signed-in
-- guest from the app, or here with the role switched:
--
--     select public.create_booking('coastal-arch-retreat',
--         current_date + 400, current_date + 402, 2::smallint, null);
--     -- run the same statement twice: the second must fail with 23P01
--
-- Clean up afterwards with the service role:
--     delete from public.bookings where start_date > current_date + 300;
