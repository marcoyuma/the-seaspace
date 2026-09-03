-- 0019_booking_cancellation.sql
-- The guest's own hand on 'cancelled'.
--
-- Run after 0018_reviews_write_path.sql. Idempotent: safe to re-run.
--
-- ---------------------------------------------------------------------------
-- What this migration is answering
-- ---------------------------------------------------------------------------
-- 'cancelled' has been a valid status since 0009, and two things have been
-- writing it ever since 0011: a declined payment (settle_booking_payment) and
-- the hourly sweeper that clears abandoned holds (0013). Both are the system
-- cancelling on the guest's behalf. Neither is the guest deciding.
--
-- features/booking/README.md §11 has carried the refund policy since it was
-- written — Airbnb's "Flexible": a full refund if the guest cancels at least 24
-- hours before check-in — and ended with "Cancelling is still not built".
-- This is the half that was missing.
--
-- ---------------------------------------------------------------------------
-- Cancelling late is allowed, and costs the refund
-- ---------------------------------------------------------------------------
-- The obvious alternative was to close the window at the deadline: past it, no
-- cancellation at all. That was refused because it holds dates nobody is coming
-- for. A villa released the day before arrival can still be sold; a villa
-- locked behind a disabled button cannot. The refund rule decides what happens
-- to the money, not whether a guest may change their mind.
--
-- So there are two outcomes, not one, and this function is what decides which:
-- the application asks for a refund or does not, and is told it was wrong if it
-- disagrees (SB020).
--
-- ---------------------------------------------------------------------------
-- Which bookings, and until when
-- ---------------------------------------------------------------------------
-- 'confirmed' only, and only while the arrival day has not passed.
--
-- 'checked_in' means the guest scanned the code at the door and is inside the
-- villa. Ending that is not cancelling, it is leaving early, and it raises a
-- question nothing here answers: what is owed for the nights already used.
-- 'checked_out', 'no_show' and 'cancelled' are finished. One status in, one
-- transition out.
--
-- `start_date < today` is this codebase's definition of "past", and it is
-- already settled in four places rather than being chosen here:
--
--   create_booking (0011)            if p_start < v_today  -> SB002. Booking
--                                    FOR today is valid.
--   check_in_booking (0012)          the door opens ON start_date.
--   advance_booking_lifecycle (0013) 'confirmed' becomes 'no_show' only once
--                                    end_date has passed, not start_date.
--   verification block K             hunts `confirmed and start_date <
--   (supabase/README.md)             current_date` as an anomaly.
--
-- The check-in day therefore still belongs to the booking, and SB021 begins the
-- day after it.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
-- Both NULLABLE, and both stay NULL on most cancelled rows. That is correct
-- rather than incomplete — see the constraints below.
alter table public.bookings
    add column if not exists cancelled_at     timestamptz,
    add column if not exists refund_reference text;

comment on column public.bookings.cancelled_at is
    'When the guest cancelled. NULL on cancellations the system made for them — seed 0004, a declined payment, or the 0013 sweeper.';
comment on column public.bookings.refund_reference is
    'The provider''s refund receipt. NULL unless the cancellation landed before the deadline on a booking that was actually paid.';

-- Why a timestamp and not a boolean, when this project has refused booleans
-- four times (is_verified, guest_ref, is_paid, and a pets column): `status =
-- 'cancelled'` already answers "was it cancelled". What nothing records is
-- WHEN — and that is the fact which decides whether money was owed. Same
-- reasoning that turned isPaid into paid_at in GUEST_PLANNING_TABLE.md: record
-- the moment and the boolean is `cancelled_at is not null`; record the boolean
-- and the moment is gone for good.

-- One direction only, and the missing half is deliberate — the same shape as
-- bookings_reference_matches_payment in 0012.
--
-- `cancelled_at is null or status = 'cancelled'` holds for every row. The
-- reverse (every cancelled booking carries a timestamp) cannot: seed 0004, the
-- decline path in settle_booking_payment() and the 0013 sweeper all produce
-- cancelled rows with nothing truthful to stamp. Back-filling an invented
-- timestamp so a constraint looks symmetric is exactly the fiction 0012 refused
-- when it declined to invent receipts for 140 seeded rows.
alter table public.bookings drop constraint if exists bookings_cancelled_at_matches_status;
alter table public.bookings add constraint bookings_cancelled_at_matches_status
    check (cancelled_at is null or status = 'cancelled');

-- A refund receipt implies a guest-initiated cancellation of a booking that was
-- actually charged. Both halves matter: cancelled_at rules out a refund on a
-- system cancellation, and paid_at rules out refunding a booking that never
-- paid — 0009's "NULL means unpaid, and stays NULL on a cancellation that was
-- never charged".
alter table public.bookings drop constraint if exists bookings_refund_matches_cancellation;
alter table public.bookings add constraint bookings_refund_matches_cancellation
    check (refund_reference is null
           or (cancelled_at is not null and paid_at is not null));

-- ---------------------------------------------------------------------------
-- 2. cancel_booking
-- ---------------------------------------------------------------------------
-- Three new SQLSTATEs join the set declared in 0011 §4 and extended by 0012 §3
-- and 0018. SB015-SB018 belong to the reviews write path; the sequence is
-- global across this database, so the next free numbers are these:
--
--   SB019  the booking is not 'confirmed', so there is nothing to cancel
--   SB020  the refund the caller asked for is not the refund that is owed
--   SB021  the arrival day has passed
--
-- SB006 is reused rather than given a new number: "no booking for this guest"
-- is the same fact settle_booking_payment() already raises it for, and one
-- message covers both.
--
-- ---------------------------------------------------------------------------
-- Who decides the refund
-- ---------------------------------------------------------------------------
-- The application decides whether to ISSUE one, because only it can call the
-- provider. This function decides whether that was ALLOWED, because only the
-- database is authoritative about paid_at and the calendar. Both directions are
-- checked, and both are bugs rather than guest error:
--
--   a receipt on a booking owed nothing  the guest is being given money back
--                                        that the policy did not promise
--   no receipt on a booking owed one     the guest is losing a refund the
--                                        policy did promise
--
-- Unlike 0012's paid/receipt pair, neither half here has to be left to a
-- comment: paid_at and start_date are both sitting in the row, so the rule is
-- fully checkable and is checked.
--
-- The deadline is `start_date - 1` with a STRICT `<`, mirroring
-- freeCancellationDeadline() and withinFreeCancellation() in
-- features/booking/lib/dates.ts. Airbnb measures its 24 hours against a 3:00 PM
-- check-in; this site stores date, not timestamptz (0009 explains why), so the
-- deadline day itself falls INSIDE the no-refund window rather than outside it.
-- That keeps the rounding from ever promising a refund the rule it adapts would
-- refuse. If one of the two comparisons ever moves, the other has to move
-- with it.
--
-- `(now() at time zone 'Asia/Makassar')::date` is the fourth clock in the set
-- README §12 warns must not drift apart, alongside create_booking,
-- check_in_booking and advance_booking_lifecycle.
create or replace function public.cancel_booking(
    p_booking_id       bigint,
    p_refund_reference text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_guest_id  uuid := auth.uid();
    v_today     date := (now() at time zone 'Asia/Makassar')::date;
    v_booking   record;
    v_reference text := nullif(btrim(coalesce(p_refund_reference, '')), '');
    v_owed      boolean;
begin
    select b.id, b.status, b.paid_at, b.start_date
    into v_booking
    from public.bookings b
    where b.id = p_booking_id
      -- Ownership is the WHERE clause, not a separate check: a booking that is
      -- not the caller's is indistinguishable from one that does not exist,
      -- which is also what stops this becoming a way to probe for booking ids.
      -- Same doctrine as settle_booking_payment() in 0012.
      and b.guest_id = v_guest_id;

    if not found then
        raise exception 'No booking % for this guest', p_booking_id
            using errcode = 'SB006';
    end if;

    if v_booking.status <> 'confirmed' then
        raise exception 'Booking % is % and cannot be cancelled',
                        p_booking_id, v_booking.status
            using errcode = 'SB019';
    end if;

    if v_today > v_booking.start_date then
        raise exception 'Booking % arrived on % and can no longer be cancelled',
                        p_booking_id, v_booking.start_date
            using errcode = 'SB021';
    end if;

    -- Nothing charged means nothing to give back, whatever the calendar says.
    v_owed := v_booking.paid_at is not null
              and v_today < v_booking.start_date - 1;

    if v_owed and v_reference is null then
        raise exception 'Booking % is owed a full refund and none was issued',
                        p_booking_id
            using errcode = 'SB020';
    end if;

    if not v_owed and v_reference is not null then
        raise exception 'Booking % is owed no refund, but one was issued',
                        p_booking_id
            using errcode = 'SB020';
    end if;

    -- One statement, so the row can never be half-cancelled. The dates leave the
    -- market at the same instant the status changes: bookings_no_overlap is
    -- `where (status <> 'cancelled')`, so this update releases them (0011 §5).
    update public.bookings
    set status           = 'cancelled',
        cancelled_at     = now(),
        refund_reference = v_reference
    where id = p_booking_id;

    -- Returned rather than left for the caller to re-derive. The application
    -- wrote the sentence the guest is about to read from its own arithmetic;
    -- this is the database confirming that arithmetic was right.
    return v_owed;
end;
$$;

-- EXECUTE is granted to PUBLIC by default on a new function, which on a
-- SECURITY DEFINER function is the whole hazard. Revoke first, then hand it
-- back deliberately.
revoke all on function public.cancel_booking(bigint, text) from public;

-- `authenticated` only, and never `anon`. 0012 §5 spends a paragraph
-- establishing what somebody holding a stranger's door code can do: "they can
-- mark that stay as begun. They cannot read it, move it, cancel it or pay for
-- it." This is the function that would make the last clause false.
grant execute on function public.cancel_booking(bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- The two new constraints. Expect both, and note that each is a one-sided OR
-- rather than an equivalence — that is the point, not an oversight.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.bookings'::regclass
  and conname in ('bookings_cancelled_at_matches_status',
                  'bookings_refund_matches_cancellation')
order by conname;

-- SECURITY DEFINER with an empty search_path, and exactly one signature.
-- Expect prosecdef = true, proconfig = {search_path=}, and 1 row.
select proname, prosecdef, proconfig
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'cancel_booking';

-- Existing cancellations keep their NULLs. Seed 0004's cancelled rows and
-- anything the 0013 sweeper has cleared were never guest decisions, so there is
-- no moment to stamp. Expect with_moment = 0 until a guest cancels one.
select count(*) filter (where status = 'cancelled')                            as cancelled,
       count(*) filter (where status = 'cancelled' and cancelled_at is not null) as with_moment,
       count(*) filter (where refund_reference is not null)                     as refunded
from public.bookings;

-- The guard rails, proved here rather than through the UI. Each must raise the
-- code named, and none of them may change a row. Run signed in as a guest who
-- owns at least one booking of each kind.
--     select public.cancel_booking(<another guest's booking>, null);   -- SB006
--     select public.cancel_booking(<a checked_out booking>, null);     -- SB019
--     select public.cancel_booking(<a booking inside 24h>, 'DEMO-X');  -- SB020
--     select public.cancel_booking(<a far-out paid booking>, null);    -- SB020
--     select public.cancel_booking(<a booking that already began>, null); -- SB021

-- Cancelled dates really are released, so a cancelled booking must never collide
-- with the booking that took its place. Expect 0 rows, same as block D in
-- supabase/README.md.
select a.id, b.id, a.stay_id
from public.bookings a
join public.bookings b
  on a.stay_id = b.stay_id and a.id < b.id
 and daterange(a.start_date, a.end_date, '[)')
  && daterange(b.start_date, b.end_date, '[)')
where a.status <> 'cancelled' and b.status <> 'cancelled';
