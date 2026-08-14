-- 0010_stay_availability.sql
-- The one thing about a booking that is public: the dates it occupies.
--
-- Run after 0009_bookings.sql. Idempotent: safe to re-run.
--
-- ---------------------------------------------------------------------------
-- Why a function and not a policy
-- ---------------------------------------------------------------------------
-- 0009 states it plainly: "No `anon` policy exists, and none may be added."
-- The reason is that a booking row carries prices paid, free-text guest notes,
-- and the guest's own uuid — and the anon key ships to the browser, so any
-- SELECT policy for `anon` publishes all of it. PostgREST has no column
-- allow-list that RLS can lean on; `select *` is always one request away.
--
-- A date picker does not need a row. It needs two dates. So the read path is a
-- SECURITY DEFINER function whose RETURN TYPE is the allow-list: two `date`
-- columns and nothing else, enforced by the type system rather than by a policy
-- someone could widen later. The table stays closed to `anon` exactly as 0009
-- requires; this does not reopen it.
--
-- The trade-off, recorded rather than hidden: occupancy per villa becomes
-- public. That is not a leak — it is what "these dates are unavailable" means,
-- and every accommodation site on the internet shows it. What stays private is
-- WHO is staying, WHAT they paid, and WHAT they asked for.
--
-- ---------------------------------------------------------------------------
-- The one thing a caller must get right
-- ---------------------------------------------------------------------------
-- `end_date` is EXCLUSIVE — see 0009's comment on the column. A range of
-- [10th, 13th) occupies the nights of the 10th, 11th and 12th, and the 13th is
-- a perfectly valid check-in for the next guest. A picker that greys out
-- end_date makes every booking look one day longer than it is and slowly eats
-- the calendar. features/booking/lib/dates.ts is where that subtraction lives.

create or replace function public.get_stay_booked_ranges(p_slug text)
returns table (start_date date, end_date date)
language sql
-- STABLE, not VOLATILE: no writes, and the result cannot change within a single
-- statement, which lets the planner call it once instead of per row.
stable
-- SECURITY DEFINER is what lets an anonymous caller past RLS. It is also why
-- the next line is mandatory rather than tidy: with a caller-controlled
-- search_path, an unqualified `bookings` could be resolved to a table the
-- caller created in a schema of their own, running it with the owner's rights.
-- An empty path forbids unqualified resolution outright, so every name below is
-- schema-qualified.
security definer
set search_path = ''
as $$
    select b.start_date, b.end_date
    from public.bookings b
    join public.stays s on s.id = b.stay_id
    where s.slug = p_slug
      -- A cancellation releases its dates. Mirrors the WHERE clause of the
      -- overlap check in seed/0004, so the picker and the seed's own definition
      -- of "occupied" cannot drift apart.
      and b.status <> 'cancelled'
      -- Yesterday's stay cannot block tomorrow's selection, and the picker
      -- disables the past anyway. Keeps the payload from growing by 140 rows
      -- that no caller can act on.
      and b.end_date > current_date
    -- Hits bookings_stay_dates_idx (stay_id, start_date), which 0009 added for
    -- precisely this query.
    order by b.start_date;
$$;

-- EXECUTE is granted to PUBLIC by default on a new function — which on a
-- SECURITY DEFINER function is the whole hazard. Revoke first, then hand it back
-- to the two roles that should have it. `service_role` needs no grant: it is a
-- superuser-equivalent and bypasses this anyway.
revoke all on function public.get_stay_booked_ranges(text) from public;
grant execute on function public.get_stay_booked_ranges(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- Every villa's forward calendar. Expect a handful of rows each, all with
-- end_date > today. Empty for a villa means genuinely nothing is booked ahead —
-- run seed/0005_bookings_current_seed.sql if all four come back empty.
select s.slug, r.start_date, r.end_date, (r.end_date - r.start_date) as nights
from public.stays s
cross join lateral public.get_stay_booked_ranges(s.slug) r
order by s.slug, r.start_date;

-- The function must never hand back two ranges that overlap, or the picker will
-- be asked to grey out the same day twice and the seed has a real bug.
-- Expect: 0 rows.
select s.slug, a.start_date, a.end_date, b.start_date, b.end_date
from public.stays s
cross join lateral public.get_stay_booked_ranges(s.slug) a
cross join lateral public.get_stay_booked_ranges(s.slug) b
where a.start_date < b.start_date
  and daterange(a.start_date, a.end_date, '[)')
   && daterange(b.start_date, b.end_date, '[)');

-- The table itself must still be shut. Run this from the SQL Editor with the
-- role switched to `anon` (or from the app with the anon key):
--     select count(*) from public.bookings;              -- expect 0 rows
--     select * from public.get_stay_booked_ranges('coastal-arch-retreat');
-- The first returning anything other than 0 means an anon policy was added
-- somewhere and 0009's rule has been broken.
