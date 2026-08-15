-- 0013_booking_lifecycle_cron.sql
-- The job that moves a booking's status, and the three transitions it is
-- allowed to make.
--
-- Run after 0012_booking_arrival_and_payment.sql. Idempotent: safe to re-run.
--
-- ⚠️ PREREQUISITE: pg_cron must be enabled first, in the Supabase dashboard
-- under Database → Extensions. `create extension` below will succeed once it is
-- available; on a project where it is not, this whole file can be skipped and
-- the application keeps working — status simply stops advancing again, which is
-- exactly the state described below.
--
-- ---------------------------------------------------------------------------
-- The hole this closes, which was documented long before it was filled
-- ---------------------------------------------------------------------------
-- Three separate files already recorded that nothing advances `status`:
--
--   GUEST_PLANNING_TABLE.md: "it goes stale on its own — the seeded checked_in
--     rows drift out of their window within about a week, because nothing
--     advances a status column without a job to do it. That will be just as
--     true of real bookings."
--   supabase/README.md, block K: "that is not a bug in the data — it is what a
--     status column means without a job to advance it."
--   0009_bookings.sql: status "cannot be checked against the calendar (CHECK
--     requires IMMUTABLE and now() is not)".
--
-- This is that job. Note what it does NOT change: `status` is still not
-- derived. 0009 refused to compute status from the calendar, and that refusal
-- stands — a stored value written by a scheduled job is a record of something
-- that happened, while a derived one would silently rewrite history every time
-- the clock moved. The difference is visible the moment a row is corrected by
-- hand: a stored value stays corrected.
--
-- ---------------------------------------------------------------------------
-- ⚠️ Nothing here ever writes 'checked_in'
-- ---------------------------------------------------------------------------
-- Arrival is a real-world event. The calendar knows a stay was *supposed* to
-- start; it cannot know whether anyone walked through the door, which is the
-- exact argument 0009 used to keep `status` as a column instead of deriving it.
-- 'checked_in' has one author: the guest, through check_in_booking() in 0012.
--
-- That is why 'no_show' had to exist. Without it this job would have to call a
-- paid, never-occupied stay 'checked_out' — a sentence the guest can read on
-- their own trips page, and a number that would quietly destroy the only
-- question this column answers: how many bookings actually became stays.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- advance_booking_lifecycle
-- ---------------------------------------------------------------------------
-- Returns a one-row summary rather than void, so the verification block (and
-- anyone running it by hand) can see what it did instead of guessing.
--
-- Every date comparison uses the villa's own day, the same clock create_booking
-- and check_in_booking use. Running hourly from a UTC scheduler is fine
-- precisely because the function does not care when it is called: each rule is
-- a set-based statement over current state, so a missed run costs lateness, not
-- correctness.
create or replace function public.advance_booking_lifecycle()
returns table (checked_out int, swept int, no_shows int)
language plpgsql
-- SECURITY DEFINER because the caller is pg_cron, and because the table has no
-- UPDATE policy for anybody at all (0011 §1). Empty search_path for the reason
-- 0010 spells out.
security definer
set search_path = ''
as $$
declare
    v_today       date := (now() at time zone 'Asia/Makassar')::date;
    v_checked_out int;
    v_swept       int;
    v_no_shows    int;
begin
    -- 1. They stayed, and the stay is over.
    --
    -- `end_date <= today` and not `<`: end_date is the departure day, they are
    -- out by 11:00 AM, and the villa turns over to the next guest that
    -- afternoon. Waiting a further day would leave a room "occupied" while
    -- somebody else is already in it.
    update public.bookings
    set status = 'checked_out'
    where status = 'checked_in'
      and end_date <= v_today;
    get diagnostics v_checked_out = row_count;

    -- 2. The sweeper. A booking created but never settled is a payment that
    -- died between create_booking() and settle_booking_payment() — the process
    -- was killed, the tab was closed mid-charge, the provider never answered.
    --
    -- It matters because that row is holding dates: bookings_no_overlap counts
    -- everything that is not cancelled, so an abandoned hold blocks a villa
    -- forever. Thirty minutes is far longer than any payment takes and far
    -- shorter than a guest would tolerate seeing the nights unavailable.
    --
    -- This is the mechanism features/booking/README.md §13 specified as "a
    -- sweeper that cancels unsettled bookings older than N minutes".
    update public.bookings
    set status = 'cancelled'
    where status = 'confirmed'
      and paid_at is null
      and created_at < now() - interval '30 minutes';
    get diagnostics v_swept = row_count;

    -- 3. Paid for, stay is over, never arrived.
    --
    -- Deliberately last: rule 2 has already removed the unpaid holds, so
    -- anything left here is a real booking somebody paid for and did not use.
    -- `paid_at is not null` is therefore belt and braces, and worth keeping —
    -- it is what stops a future change to rule 2 turning abandoned checkouts
    -- into no-shows.
    update public.bookings
    set status = 'no_show'
    where status = 'confirmed'
      and paid_at is not null
      and end_date <= v_today;
    get diagnostics v_no_shows = row_count;

    return query select v_checked_out, v_swept, v_no_shows;
end;
$$;

revoke all on function public.advance_booking_lifecycle() from public;
-- No grant to `anon` or `authenticated`. Nobody calls this from the
-- application; pg_cron runs it as the owner, and a human runs it from the SQL
-- Editor with the service role.

-- ---------------------------------------------------------------------------
-- The schedule
-- ---------------------------------------------------------------------------
-- Hourly, on the hour. A booking's status is never more than an hour behind
-- reality, which is well inside the precision the product claims anywhere (the
-- guest-facing labels are "Completed" and "Not checked in", not timestamps).
-- More often would be a query per minute against a table this size for no
-- perceivable gain.
--
-- Unscheduled first so re-running this file replaces the job rather than
-- failing on a duplicate name.
select cron.unschedule('advance-booking-lifecycle')
where exists (select 1 from cron.job where jobname = 'advance-booking-lifecycle');

select cron.schedule(
    'advance-booking-lifecycle',
    '0 * * * *',
    $$select public.advance_booking_lifecycle()$$
);

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- The job exists and is active. Expect one row, schedule '0 * * * *'.
select jobid, jobname, schedule, active, command
from cron.job
where jobname = 'advance-booking-lifecycle';

-- Run it by hand. On a freshly seeded database the four 'checked_in' rows have
-- long since ended, so the first run reports them and later runs report zeroes.
select * from public.advance_booking_lifecycle();

-- What the table looks like afterwards. 'checked_in' should only ever hold
-- stays that are genuinely happening right now.
select status, count(*), min(start_date) as earliest, max(end_date) as latest
from public.bookings
group by status
order by status;

-- ⚠️ A 'checked_in' row whose end_date is in the past means this job has not
-- run — pg_cron disabled, or the schedule removed. Expect 0 rows.
select id, start_date, end_date, status
from public.bookings
where status = 'checked_in'
  and end_date <= (now() at time zone 'Asia/Makassar')::date;

-- The last few runs, when something looks wrong. `status` here is pg_cron's own
-- word for whether the job succeeded, not bookings.status.
select jobid, start_time, end_time, status, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'advance-booking-lifecycle')
order by start_time desc
limit 10;
