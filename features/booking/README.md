# Booking — what the date picker does today, and what it deliberately does not

**Status: read and select only. Nothing is written.** A visitor can open one modal from the
stay detail page, see which dates are already taken, pick a range and a party size, and read
back a priced summary with a free-cancellation date. Then it stops. There is no `INSERT` policy
on `public.bookings`, no checkout route, no payment, and the `Reserve` button is rendered
disabled on purpose. The database side is
[`supabase/migrations/0010_stay_availability.sql`](../../supabase/migrations/0010_stay_availability.sql)
(one function) and
[`supabase/seed/0005_bookings_current_seed.sql`](../../supabase/seed/0005_bookings_current_seed.sql)
(24 near-term bookings, re-runnable). The table itself came earlier, in `0009_bookings.sql`.

## Contents

| Section | |
|---|---|
| [1. What this phase is](#1-what-this-phase-is) | scope, and the three things it is not |
| [2. The exclusive end date](#2-the-exclusive-end-date) | ⚠️ the easiest thing here to get wrong |
| [3. Why an RPC and not an RLS policy](#3-why-an-rpc-and-not-an-rls-policy) | |
| [4. Why seed 0005 deletes before it inserts](#4-why-seed-0005-deletes-before-it-inserts) | and the invariant that makes it safe |
| [5. ⚠️ The picker is still the only thing preventing overlaps](#5-️-the-picker-is-still-the-only-thing-preventing-overlaps) | |
| [6. Adults, children, infants, pets](#6-adults-children-infants-pets) | four controls, one column |
| [7. Free cancellation](#7-free-cancellation) | which Airbnb rule, and why that one |
| [8. Today is resolved on the client](#8-today-is-resolved-on-the-client) | a prerendering trap |
| [9. File map](#9-file-map) | |
| [10. Still ahead](#10-still-ahead) | |

---

## 1. What this phase is

Before it, `public.bookings` held 140 rows and **nothing in the application read them**. The
stay detail page showed a `Book room` pill pointing at `/stays/{slug}/book` — a route that has
never existed. A visitor had no way to find out that a villa was already occupied.

After it, the same pill opens a modal containing the calendar and the guest stepper together,
and closing it leaves a summary above the CTA.

Three things it is explicitly **not**:

| Not | Why not |
|---|---|
| A write path | `bookings` has no `INSERT` policy, and a write policy is only expressible once auth can prove who is booking. `0009_bookings.sql` says so. |
| A `/book` route | Picking dates happens in place. If a real checkout page arrives it can read the selection; nothing here assumes a second page. |
| A lock on those dates | Selecting is not reserving. See §5. |

The `Reserve` button is disabled with the line *"Reservations aren't live yet."* underneath it.
An enabled button that silently does nothing is worse than one that admits it. Enable it in
`booking-panel.tsx` the moment the write path lands.

## 2. The exclusive end date

⚠️ **`bookings.end_date` is the check-out day, not the last night.** A stay of
`[Aug 10, Aug 13)` occupies the nights of the 10th, 11th and 12th. The 13th is free from
11:00 AM for the next guest. `0009_bookings.sql` spells this out and the seed's overlap check
relies on it (`daterange(start_date, end_date, '[)')`).

Two consequences the UI has to honour, and both are easy to miss:

1. **Occupied days are `start … end - 1`.** Greying out `end_date` as well makes every booking
   look one day longer than it is, and a calendar with a few adjacent bookings slowly loses
   days that were never taken. The subtraction happens in exactly one place —
   `expandBlockedDays()` in [`lib/dates.ts`](lib/dates.ts) — and must not be re-derived
   anywhere else.
2. **A booked day can still be a valid departure.** If the next booking starts on the 20th, a
   guest arriving on the 17th may check out on the 20th: they leave in the morning, the next
   party arrives in the afternoon. That is normal turnover, not a clash. The calendar
   implements it as `checkoutOnlyDay` — the single blocked day that stays clickable once an
   arrival has been chosen. Drop that and every boundary quietly costs a night.

## 3. Why an RPC and not an RLS policy

`0009_bookings.sql` states the rule: *"No `anon` policy exists, and none may be added."* A
booking row carries the price paid, free-text guest notes and the guest's uuid, and the anon key
ships to the browser — so any `SELECT` policy for `anon` publishes all of it. PostgREST has no
column allow-list that RLS can lean on; `select *` is always one request away.

A date picker does not need a row. It needs two dates. So the read path is:

```sql
create or replace function public.get_stay_booked_ranges(p_slug text)
returns table (start_date date, end_date date)
language sql stable security definer set search_path = ''
```

The **return type is the allow-list**, enforced by the type system rather than by a policy that
someone could widen later. `set search_path = ''` is mandatory, not tidy: on a `SECURITY
DEFINER` function an unqualified `bookings` could be resolved to a table the caller created in
their own schema, and it would run with the owner's rights.

What this does make public is per-villa occupancy. That is not a leak — it is what "these dates
are unavailable" means, and every accommodation site shows it. What stays private is **who** is
staying, **what** they paid and **what** they asked for.

Verification block **L** in [`supabase/README.md`](../../supabase/README.md) asserts both halves:
the table returns 0 rows to `anon`, and the function returns exactly two keys.

## 4. Why seed 0005 deletes before it inserts

`0004_bookings_seed.sql` anchors its 24 non-historical rows to `current_date` — *the date the
seed ran on*. A seed database is not rebuilt weekly, so a few weeks later every "upcoming"
booking is in the past and the calendar renders with nothing marked.

So `0005` is **refresh-on-rerun**, not gated on an empty table:

```sql
delete from public.bookings where status <> 'checked_out';
```

That reads as blunt. It is exact, and the invariant is worth writing down because the next
person to add a seed can break it:

| Source | Rows | Status |
|---|---|---|
| `0004` Part A — the stays behind the reviews | 100 | all `checked_out` |
| `0004` Part B, `'past'` anchor | 16 | all `checked_out` |
| `0004` Part B, `'today'` anchor | 24 | none `checked_out` — the drifting block |

So `status <> 'checked_out'` selects the stale rows and nothing else, and the 116 historical
rows are never touched. The counts after a run are unchanged from `0004`:
`140 | 116 | 4 | 16 | 4 | 128`, which is itself the assertion that the file replaces rather
than accumulates.

⚠️ **If a later seed adds a non-`checked_out` row it does not own, this `DELETE` will eat it.**
Change the rule then; do not widen it. And once a real checkout flow exists, this file must
never run against that database.

The anchor is `greatest(current_date - 2, max(end_date))` rather than plain `current_date - 2`.
Part A's dates come from review timestamps and the newest review is only days old, so on a
freshly seeded project a historical stay can still be ending this week — two days before today
would land inside it, and there is no exclusion constraint to catch that.

## 5. ⚠️ The picker is still the only thing preventing overlaps

`0009_bookings.sql` §3 records that an `exclude using gist` constraint was considered and
declined: overlap is prevented at the input path. This phase builds that input path, and it
does its half — a range can only ever be carved out of one contiguous free block, because
everything past the next booked day is disabled the moment an arrival is chosen.

**A read-time check is not a lock.** Two guests submitting the same dates at the same moment
would both be accepted. That has no consequences today because nothing writes, but it is the
first thing the write path has to answer. The fix, if it ever matters, is `btree_gist` plus an
exclusion constraint on the table — not more validation in the form.

## 6. Adults, children, infants, pets

The reference design has four counters. `bookings` has one `num_guests` column. The four are
kept and the mapping is made explicit rather than pretending the schema is richer than it is:

| Control | Where it goes |
|---|---|
| Adults | `num_guests`, floor of 1 (`bookings_guests_pos` would reject 0 anyway) |
| Children | `num_guests` |
| Infants | nowhere — excluded by the same rule the footnote states |
| Pets | nowhere, and the control is **permanently disabled** |

`guestsBooked()` in [`types.ts`](types.ts) is that mapping, in one function, so the write path
cannot invent a different one. `adults + children` is capped at `stays.capacity`, which is also
where the footnote's number comes from.

Pets is rendered rather than dropped because *"Pets aren't allowed"* is itself the information
a guest came for. It is disabled because there is no column for a pet, and an enabled control
would promise storage that does not exist.

## 7. Free cancellation

Airbnb runs several cancellation policies at once. The one adopted here is **Flexible**: a full
refund if the guest cancels at least 24 hours before check-in. It was picked over the
alternatives because it always has something to show — Moderate's five-day rule disappears
entirely on a booking made this week, and the 48-hours-after-booking grace period is measured
from a booking time this phase does not record.

The deadline is therefore `check-in − 1 day`, computed by `freeCancellationDeadline()` in
[`lib/dates.ts`](lib/dates.ts), and rendered as *"Free cancellation before Aug 17."*

Airbnb measures the 24 hours against the 3:00 PM local check-in time. This site stores `date`,
not `timestamptz` (`0009` explains why), so the deadline rounds to the whole day before arrival
— the same answer for every hour a guest would realistically cancel at, and never more generous
than the rule it is adapting.

## 8. Today is resolved on the client

The stay detail page is prerendered — `generateStaticParams()` builds all four at build time.
So "today" computed during render would be **frozen at build time**, and would also disagree
with the browser's clock at hydration. Two bugs, one cause.

`useToday()` in [`components/booking-panel.tsx`](components/booking-panel.tsx) uses
`useSyncExternalStore` with a server snapshot of `null`: the clock is an external system, and
this is the one hook allowed to return a different value on the server than in the browser. It
returns `null` on the server and the real day after hydration, with no effect involved — which
also keeps it clear of the `react-hooks/set-state-in-effect` rule this project's lint enforces.

`null` is invisible in practice: the modal starts closed and the summary starts empty.

## 9. File map

| File | Role |
|---|---|
| [`actions.ts`](actions.ts) | `getStayBookedRanges(slug)` — the RPC call. `"use cache"` with the `minutes` profile, tagged `bookings` and `bookings:{slug}` |
| [`types.ts`](types.ts) | `BookedRange`, `GuestCounts`, `DateSelection`, `guestsBooked()` |
| [`lib/dates.ts`](lib/dates.ts) | All calendar arithmetic. No dependency — see below |
| [`components/booking-panel.tsx`](components/booking-panel.tsx) | Owns every piece of state. The only thing the stays feature imports |
| [`components/booking-modal.tsx`](components/booking-modal.tsx) | The centred overlay: header, date fields, two calendars, guest stepper, footer |
| [`components/month-calendar.tsx`](components/month-calendar.tsx) | One month grid. Stateless — both months take the same props |
| [`components/date-field.tsx`](components/date-field.tsx) | A typed `MM/DD/YYYY` box |
| [`components/guest-stepper.tsx`](components/guest-stepper.tsx) | The four counters |
| [`components/booking-summary.tsx`](components/booking-summary.tsx) | The priced block above the CTA |

Touched outside this folder:

- [`app/(stay-list)/stays/[stayId]/page.tsx`](<../../app/(stay-list)/stays/[stayId]/page.tsx>) —
  fetches availability alongside the stay, in parallel.
- [`features/stays/components/stay-info-section.tsx`](../stays/components/stay-info-section.tsx) —
  the `PillLink` to the dead `/book` route became `<BookingPanel>`. Still a Server Component.
- [`features/stays/types.ts`](../stays/types.ts) and [`actions.ts`](../stays/actions.ts) — gained
  `discountPerNight`, mapped from the existing `stays.discount` column. It is `0` for all four
  villas, which is why the headline price line still prints `pricePerNight` directly; the
  summary is the only reader that subtracts it.
- [`ui/pill-styles.tsx`](../../ui/pill-styles.tsx) and [`ui/pill-button.tsx`](../../ui/pill-button.tsx) —
  `PillLink`'s visuals were extracted so a CTA can be a `<button>`. `PillLink` is unchanged to
  look at.
- [`lib/supabase.ts`](../../lib/supabase.ts) — `BOOKINGS_CACHE_TAG` / `BOOKINGS_CACHE_PROFILE`.

**No date library.** The project had no date dependency, the picker needs about eight
operations, and `Intl` already ships in every runtime. Two rules make the hand-rolled version
safe: a calendar day is always a `yyyy-mm-dd` **string** (Postgres's own format, sorts
correctly with `<`, safe as a `Set` key), and any `Date` is built at **local noon** —
`new Date("2026-08-18")` parses as UTC midnight, which is the previous day everywhere west of
Greenwich.

## 10. Still ahead

- [ ] An `INSERT` policy on `bookings`, expressible once a booking can prove who is making it.
- [ ] The `Reserve` action: snapshot `price_per_night` and `discount` into the row (do **not**
      re-read the catalogue later — that is the whole reason those columns exist), write
      `num_guests` from `guestsBooked()`, and revalidate the `bookings:{slug}` cache tag.
- [ ] A decision on the overlap race in §5 before that action ships.
- [ ] `reviews.booking_id` and the composite foreign key from `GUEST_PLANNING_TABLE.md` §3 —
      still the missing half of "verified review", and unaffected by anything here.
- [ ] Guest notes. The column exists and the modal has no field for it.
