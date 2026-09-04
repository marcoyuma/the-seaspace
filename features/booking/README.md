# Booking — from picking dates to walking through the door

**Status: the whole path is live.** A signed-in guest picks dates, carries them to a
checkout page in the URL, chooses how they will pay and how they will get in, pays (a
*simulated* payment — no money moves, no card is collected), lands on their own
reservation with a door code, and scans that code to check themselves in. An hourly
database job closes stays, releases abandoned holds and marks no-shows.

Bookings are inserted by a `SECURITY DEFINER` function, never by an RLS policy, and two
bookings can no longer overlap: that is a database constraint.

| Migration | What it added |
|---|---|
| [`0009_bookings.sql`](../../supabase/migrations/0009_bookings.sql) | The table |
| [`0010_stay_availability.sql`](../../supabase/migrations/0010_stay_availability.sql) | The read RPC — which dates are taken |
| [`0011_booking_writes.sql`](../../supabase/migrations/0011_booking_writes.sql) | The write RPCs, and the overlap constraint |
| [`0012_booking_arrival_and_payment.sql`](../../supabase/migrations/0012_booking_arrival_and_payment.sql) | Arrival method, access code, the payment record, `no_show`, the door RPCs |
| [`0013_booking_lifecycle_cron.sql`](../../supabase/migrations/0013_booking_lifecycle_cron.sql) | The hourly job that advances `status` |

[`seed/0005_bookings_current_seed.sql`](../../supabase/seed/0005_bookings_current_seed.sql)
supplies 24 near-term bookings. ⚠️ It is now destructive — see §12.

> ⚠️ **Migrations reach the database by hand**, through Dashboard → SQL Editor. `0013` also
> needs `pg_cron` switched on first, under Database → Extensions. Until `0012` is run,
> `Confirm and pay` fails with PGRST202; if `0013` is never run, everything still works and
> `status` simply stops advancing.

## Contents

| Section | |
|---|---|
| [1. The shape of the flow](#1-the-shape-of-the-flow) | every step, and where each one is enforced |
| [2. The exclusive end date](#2-the-exclusive-end-date) | ⚠️ the easiest thing here to get wrong |
| [3. Why an RPC and not an RLS policy](#3-why-an-rpc-and-not-an-rls-policy) | for reads **and** for writes |
| [4. The selection travels in the URL](#4-the-selection-travels-in-the-url) | and nothing in it is trusted |
| [5. The payment is simulated — on purpose](#5-the-payment-is-simulated--on-purpose) | what was chosen over Stripe, and the seam that survives |
| [6. Why the booking is written before the payment](#6-why-the-booking-is-written-before-the-payment) | the row is the lock |
| [7. Overlap is now a database rule](#7-overlap-is-now-a-database-rule) | 0009 §3 reversed, deliberately |
| [8. Arrival: one credential, two doors](#8-arrival-one-credential-two-doors) | self check-in, the lock box, and why `anon` may open a door |
| [9. What moves `status`, and what deliberately does not](#9-what-moves-status-and-what-deliberately-does-not) | the hourly job, and the one transition it may never make |
| [10. Adults, children, infants, pets](#10-adults-children-infants-pets) | four controls, one column |
| [11. Free cancellation](#11-free-cancellation) | which Airbnb rule, and why that one |
| [12. Two clocks, and which one wins](#12-two-clocks-and-which-one-wins) | a prerendering trap, plus the server's answer |
| [13. Why seed 0005 deletes before it inserts](#13-why-seed-0005-deletes-before-it-inserts) | ⚠️ and why it must never run now |
| [14. File map](#14-file-map) | |
| [15. Still ahead](#15-still-ahead) | |

---

## 1. The shape of the flow

| Step | Where | What actually guards it |
|---|---|---|
| Pick dates and party size | `booking-panel.tsx` + the modal, on the stay page | The calendar only offers free days (§7) |
| Carry the selection to checkout | The query string of `/stays/{slug}/book` | Nothing — it is user input, see §4 |
| Review, choose how to pay and how to get in | `app/(stay-list)/stays/[stayId]/book/page.tsx` | Signed-in check (page **and** `proxy.ts`), availability re-read, capacity, past dates |
| Write the booking | `payAndBook()` → `create_booking()` | The database: capacity, past dates, identity, the price snapshot, both method vocabularies, and `bookings_no_overlap` |
| Settle the payment | `settle_booking_payment()` | Ownership, "not already settled", and "a payment has a receipt" |
| Read it back | `/account/trips`, `/account/trips/{id}` | The `guests read their own bookings` RLS policy |
| Walk in | `/checkin/{code}` → `check_in_booking()` | The code itself, plus paid and in-window (§8) |
| Close the stay | `advance_booking_lifecycle()`, hourly | §9 |

Every check appears at least twice on purpose: once in the application, so a guest gets a
sentence they can act on, and once in the database, because the application is not what
enforces anything. A Server Action is a public HTTP endpoint and the checkout page is a
URL anyone can type.

## 2. The exclusive end date

⚠️ **`bookings.end_date` is the check-out day, not the last night.** A stay of
`[Aug 10, Aug 13)` occupies the nights of the 10th, 11th and 12th. The 13th is free from
11:00 AM for the next guest. `0009_bookings.sql` spells this out, the seed's overlap check
relies on it, and so does the exclusion constraint in `0011`
(`daterange(start_date, end_date, '[)')`).

Three consequences, and all three are easy to miss:

1. **Occupied days are `start … end - 1`.** Greying out `end_date` as well makes every
   booking look one day longer than it is, and a calendar with a few adjacent bookings
   slowly loses days that were never taken. The subtraction happens in exactly one place —
   `expandBlockedDays()` in [`lib/dates.ts`](lib/dates.ts) — and must not be re-derived
   anywhere else. `rangeIsFree()`, which the checkout page uses, stops before `checkOut`
   for the same reason.
2. **A booked day can still be a valid departure.** If the next booking starts on the 20th,
   a guest arriving on the 17th may check out on the 20th: they leave in the morning, the
   next party arrives in the afternoon. That is normal turnover, not a clash. The calendar
   implements it as `checkoutOnlyDay` — the single blocked day that stays clickable once an
   arrival has been chosen.
3. **The door code stops working on `end_date`, not after it.** `check_in_booking()` tests
   `today >= end_date` and refuses. Arriving on your departure day is not arriving.

## 3. Why an RPC and not an RLS policy

`0009_bookings.sql` states the rule: *"No `anon` policy exists, and none may be added."* A
booking row carries the price paid, free-text guest notes and the guest's uuid, and the anon
key ships to the browser — so any `SELECT` policy for `anon` publishes all of it. PostgREST
has no column allow-list that RLS can lean on; `select *` is always one request away.

**Reading availability.** A date picker does not need a row. It needs two dates:

```sql
create or replace function public.get_stay_booked_ranges(p_slug text)
returns table (start_date date, end_date date)
language sql stable security definer set search_path = ''
```

The **return type is the allow-list**, enforced by the type system rather than by a policy
someone could widen later. `get_check_in_invite()` in `0012` is the same idea applied to a
door: villa, location, two dates, one boolean.

**Writing a booking.** Auth exists, so the obvious move would be an `INSERT` policy with
`with check (auth.uid() = guest_id)`. `0011` refuses it, and the reason is worth knowing
because the policy looks perfectly safe:

> RLS authorises **rows**, not **values**. The policy proves *who* is booking. Nothing in
> it can check *what* they wrote — the guest holds a real session and the anon key, so a
> crafted `POST /rest/v1/bookings` could set `unit_price_per_night = 1`.

So the insert is a `SECURITY DEFINER` function too, and this time the **parameter list** is
the allow-list: slug, two dates, a headcount, a note, and the two method choices. Price is
not a parameter, and neither is the access code — both are produced inside the function. A
credential the caller supplies is a credential the caller chooses.

`set search_path = ''` is mandatory on every one of them, not tidy: on a `SECURITY DEFINER`
function an unqualified `bookings` could resolve to a table the caller created in their own
schema, and it would run with the owner's rights.

The net result is that `public.bookings` has **exactly one policy** — guests reading their
own rows. Every write goes through a function or the service role.

## 4. The selection travels in the URL

`Reserve` is a link, not a button:

```
/stays/coastal-arch-retreat/book?checkIn=2026-09-16&checkOut=2026-09-17&adults=2
```

Chosen over a store, a cookie or a draft row because it makes the checkout page an ordinary
URL: bookmarkable, shareable, survives a reload, opens in a new tab, and survives the round
trip through `/login` (`proxy.ts` puts the **whole** path *and query string* into `next` —
without the query string a guest would sign in and land on an empty checkout).

⚠️ **No price ever appears in these parameters**, and everything that does appear is
untrusted:

| Value | Re-derived by |
|---|---|
| Dates | `parseCheckoutParams()` — real calendar days, ordered, at least one night. Then `create_booking` again |
| Headcount | The page, against `stays.capacity`. Then `create_booking`, which is where the cross-table rule 0009 could not express finally lives |
| Price | Never sent. The page quotes from the catalogue; the database snapshots from `stays` |
| Who is booking | Never sent. `auth.uid()` inside the function, from the verified JWT |

**The two method choices are not in the URL.** They are made *on* the checkout page, so
they ride in the form and go straight to `create_booking` as parameters.

## 5. The payment is simulated — on purpose

No money moves, no card number is ever collected, and the page says so twice.

What was weighed:

| Option | Why not |
|---|---|
| Stripe Checkout (test mode) | Strongest signal on a CV, but needs a webhook, a signing secret and a tunnel for local dev. A demo whose bookings silently stop completing whenever the webhook is not running is worse than an honest simulation |
| Midtrans Snap sandbox | Fits the rupiah pricing, same operational weight as Stripe, fiddlier sandbox |
| A card form that accepts test numbers | A demo site that asks for a card number will eventually be given a real one |
| **A simulated provider with a real provider's shape** | ✅ what this is |

The *shape* a provider imposes is what the rest of the system has to be built around, and
that part is real here:

| A real provider | Here |
|---|---|
| The booking is created before the charge, holding the dates | Same — §6 |
| The call is slow and can fail | `SETTLEMENT_DELAY_MS`, plus a decline path |
| Success returns an opaque reference | `DEMO-GOPAY-3F7K2Q`, stored in `payment_reference` |
| Settlement is a separate step | `settle_booking_payment()` |

Swapping in Stripe is therefore: replace `chargeDemoPayment()` in
[`lib/payment-gateway.ts`](lib/payment-gateway.ts) with a PaymentIntent call, and move the
`settle_booking_payment()` call into a webhook route. Nothing else changes shape.

**The payment record.** `0012` added two columns, once there was something true to put in
them:

| Column | Set by | Note |
|---|---|---|
| `payment_method` | `create_booking()` | ⚠️ Its CHECK holds **exactly** the ids in [`lib/payment-methods.ts`](lib/payment-methods.ts). One vocabulary, no mapping function to forget to update |
| `payment_reference` | `settle_booking_payment()` | The receipt, shown on the reservation |

A separate `booking_payments` table was considered and declined: by construction there is at
most one attempt per booking, because a declined payment cancels the booking and the guest
starts over. A 1:1 relation pretending to be 1:N is a join with no second row to find.

The invariant is only half a constraint, and the missing half is documented rather than
faked. `check (payment_reference is null or paid_at is not null)` — a receipt implies a
payment — holds for every row. The reverse (*a payment implies a receipt*) cannot: seed
`0004` stamps `paid_at` on 140 rows where, in its own words, *"no money changed hands,
nobody stayed anywhere"*. Back-filling invented receipts to satisfy a constraint would be
putting fiction into a financial record to make a rule look tidy. That direction is
enforced by `settle_booking_payment()` instead (SB014), which is the only thing that can
ever set `paid_at`.

**The decline path is reachable on purpose.** A checkbox on the form — *"Simulate a
declined payment"* — is the only way to trigger it. A demo that can only succeed never
demonstrates that failure is handled.

## 6. Why the booking is written before the payment

The order in `payAndBook()` is not the intuitive one:

1. `create_booking()` inserts the row, `status = 'confirmed'`, `paid_at` **null**.
2. The payment is attempted.
3. `settle_booking_payment()` stamps `paid_at` and the reference, or sets
   `status = 'cancelled'`.

**The row is the lock.** `bookings_no_overlap` is a database constraint, so from step 1 no
one else can take those nights. Charging first would leave the dates open for the entire
provider round-trip — exactly the window the constraint was added to close — and a payment
that succeeds against dates somebody else just took is far worse than a payment that never
started.

A failed payment therefore **cancels rather than deletes**: `'cancelled'` sits outside the
constraint's `where` clause, so the dates are released immediately, and the attempt stays
on the record. Deleting a financial row is what 0009's `on delete restrict` /
`on delete set null` comments spend their length refusing to do.

⚠️ **Steps 1–3 are not one transaction, and cannot be** — step 2 leaves the database. The
failure mode is a `confirmed` booking with `paid_at` null if the process dies mid-flight.
That is precisely the state a real provider's pending payments sit in, it is rendered
honestly (*Payment pending*, with an explanation, on the trip page), and **the sweeper in
`0013` now resolves it**: thirty minutes later the hold is cancelled and the nights go back
on the market.

## 7. Overlap is now a database rule

`0009_bookings.sql` §3 recorded that an `exclude using gist` constraint had been considered
and declined: overlap was prevented at the input path. **That decision is reversed in
`0011`, deliberately and in writing**, because it only held while nothing wrote:

```sql
alter table public.bookings add constraint bookings_no_overlap
    exclude using gist (
        stay_id                               with =,
        daterange(start_date, end_date, '[)') with &&
    ) where (status <> 'cancelled');
```

- `btree_gist` is required because `stay_id with =` is an equality test on a `bigint`, and
  GiST has no built-in operator class for that.
- The `where` clause keeps the constraint agreeing with `get_stay_booked_ranges()` and with
  the seed's own overlap check — all three treat a cancellation as releasing its dates. A
  constraint that disagreed with the picker would reject bookings the calendar had just
  offered. Note that `no_show` is **not** excluded: a guest who paid and never came still
  had the villa.
- Two guests submitting the same nights leave one winner and one `23P01`, which
  `server-actions.ts` turns into *"Someone booked those exact nights while you were on this
  page."*

The picker and the checkout page still check availability first. That is for the message,
not for the safety: a read-time check is not a lock, and it never was.

## 8. Arrival: one credential, two doors

Until `0012` a booking recorded that somebody had paid for some nights and then said
nothing at all about arriving. Two methods now exist, chosen **before** the booking is made
— "how do I get in" is something you want settled before you pay:

| `check_in_method` | What it is | Who it is for |
|---|---|---|
| `smart-lock` | Scan the code at the door | Nobody to meet, no keys to collect, no arrival time to agree on. The guest who booked a private villa to be private in |
| `lock-box` | The same code, on a mechanical keypad | Works with a flat phone, no signal and no power. It is the backup, which is the entire reason it is offered |

⚠️ **There is one `access_code` per booking and it opens both.** No second column, no second
secret. `check_in_method` is a *preference*, not an authorisation: the UI emphasises the
chosen one and shows the other underneath, because a guest whose phone died at the reader
needs the keypad digits in front of them, not an explanation of what they picked two weeks
ago. Two credentials for one lock would be two things to rotate, two to leak and two to
keep in sync, in exchange for nothing a guest can perceive.

The code is eight uppercase hex characters (`A3F72C9B`), minted by `create_booking()` inside
a retry loop against a unique index. Hex is not an aesthetic choice: it contains no `O`/`0`
or `I`/`1` pair to misread off a screen and type into a keypad in the dark.

**Why `anon` may open a door.** Both `get_check_in_invite()` and `check_in_booking()` are
granted to `anon`, and that is the design:

> A door code is a door code. The partner on the earlier flight, the guest whose session
> expired somewhere over the Java Sea, the friend collecting the keys — all of them hold
> the code, and none of them can be asked to log in on a doorstep at midnight. Requiring a
> session is exactly the friction self check-in exists to remove.

What that costs is bounded by construction, not by trust:

- `get_check_in_invite()`'s **return type is the allow-list** — villa, location, two dates,
  and whether check-in already happened. No price, no guest, no notes, not even the id.
- `check_in_booking()` performs one transition on one row. Somebody holding a stranger's
  code can mark that stay as begun. They cannot read it, move it, cancel it or pay for it.
- The code is 4.3 billion values wide and is never listed anywhere.

**⚠️ The QR opens a page; it does not check anyone in.** `/checkin/{code}` is a `GET`, and
prefetchers, chat previews and antivirus scanners all follow those. The page renders a
button that POSTs to a Server Action. A URL that acted on sight would check a guest in from
a WhatsApp preview of their own booking, hours before they landed.

Scanning twice is not an error. `check_in_booking()` returns success for a booking that is
already `checked_in`, because the guest is already inside and a red banner would send them
looking for a problem that is not there.

The QR itself is rendered to an SVG **on the server** and inlined into the HTML
([`lib/qr.ts`](lib/qr.ts)), so the page ships no encoder and makes no image request. Error
correction is `M` rather than the default `L`: this one gets scanned off a phone screen in
a doorway at night, at an angle, with a fingerprint across it.

## 9. What moves `status`, and what deliberately does not

Three files had already recorded that nothing did — `GUEST_PLANNING_TABLE.md`
(*"it goes stale on its own… nothing advances a status column without a job to do it"*),
`supabase/README.md` block K, and `0009` itself. `ADMIN-PANEL-CONTEXT.md` separately puts
`bookings` **outside the admin panel's authority entirely**, so that job could never have
lived there.

`advance_booking_lifecycle()` in `0013` is that job, scheduled hourly with `pg_cron`:

| From | To | When | Why that rule |
|---|---|---|---|
| `checked_in` | `checked_out` | `end_date <= today` | They stayed; the stay ended. `<=` because they are out by 11:00 AM and the next guest arrives that afternoon |
| `confirmed`, unpaid | `cancelled` | older than 30 minutes | The §6 sweeper. That row is holding dates behind a payment that never completed |
| `confirmed`, paid | `no_show` | `end_date <= today` | Paid for, never arrived |

**⚠️ Nothing in that job ever writes `checked_in`.** Arrival is a real-world event. The
calendar knows a stay was *supposed* to start; it cannot know whether anyone walked through
the door — which is the exact argument `0009` used to keep `status` as a column instead of
deriving it. `checked_in` has one author: the guest, at the door.

That is also why `no_show` had to be added as a fifth status. Without it the job would have
to call a paid, never-occupied stay `checked_out` — a sentence the guest can read on their
own trips page, and a number that would quietly destroy the only question this column exists
to answer: how many bookings actually became stays.

**This reverses nothing in `0009`.** That migration refused to *derive* `status`, and it
still is not derived: a stored value written by a scheduled job is a record of something
that happened, and stays corrected if somebody corrects it. A derived one would rewrite
history every time the clock moved.

If `pg_cron` is never enabled, the application is unaffected — `status` simply goes stale
again, exactly as documented before this job existed.

## 10. Adults, children, infants, pets

The reference design has four counters. `bookings` has one `num_guests` column. The four are
kept and the mapping is made explicit rather than pretending the schema is richer than it is:

| Control | Where it goes |
|---|---|
| Adults | `num_guests`, floor of 1 (`bookings_guests_pos` would reject 0 anyway) |
| Children | `num_guests` |
| Infants | nowhere — excluded by the same rule the footnote states |
| Pets | nowhere, and the control is **permanently disabled** |

`guestsBooked()` in [`types.ts`](types.ts) is that mapping, in one function, and it is what
the Server Action sends as `p_num_guests`. `adults + children` is capped at `stays.capacity`
in three places now: the stepper, the checkout page, and `create_booking` (SB001), which is
the only one that counts.

Pets is rendered rather than dropped because *"Pets aren't allowed"* is itself the
information a guest came for. It is disabled because there is no column for a pet.

## 11. Free cancellation

Airbnb runs several cancellation policies at once. The one adopted here is **Flexible**: a
full refund if the guest cancels at least 24 hours before check-in. It was picked over the
alternatives because it always has something to show — Moderate's five-day rule disappears
entirely on a booking made this week, and the 48-hours-after-booking grace period is
measured from a booking time this phase does not record.

The deadline is `check-in − 1 day`, computed by `freeCancellationDeadline()` in
[`lib/dates.ts`](lib/dates.ts), and rendered as *"Free cancellation before Aug 17."*

Airbnb measures the 24 hours against the 3:00 PM local check-in time. This site stores
`date`, not `timestamptz` (`0009` explains why), so the deadline rounds to the whole day
before arrival — the same answer for every hour a guest would realistically cancel at, and
never more generous than the rule it is adapting.

**Cancelling late is allowed, and costs the refund.** Closing the window at the deadline
would hold dates nobody is coming for — a villa released the day before arrival can still be
sold. So there are two outcomes, and the dialog names which one applies before the guest
commits. Only `confirmed` bookings, and only while the arrival day has not passed: the door
opens *on* `start_date`, so the check-in day still belongs to the booking.

`withinFreeCancellation()` is the comparison, and it is **strict** — the deadline day is
already outside the window. `cancel_booking()` mirrors it in SQL and rejects a mismatch in
either direction, so neither an unearned refund nor a missed one can be written.

⚠️ [`0019_booking_cancellation.sql`](../../supabase/migrations/0019_booking_cancellation.sql)
is where the reasoning lives: the two columns and why each constraint is one-directional, the
three SQLSTATEs, the four precedents behind the arrival-day boundary, and who decides the
refund. `cancelBooking()` in [`server-actions.ts`](server-actions.ts) writes last rather than
first — the reverse of `payAndBook()` §6 — because the safe failure here is "still booked".

## 12. Two clocks, and which one wins

**On the client**, the stay detail page is prerendered — `generateStaticParams()` builds all
four at build time. So "today" computed during render would be **frozen at build time**, and
would also disagree with the browser's clock at hydration. Two bugs, one cause.

`useToday()` in [`components/booking-panel.tsx`](components/booking-panel.tsx) uses
`useSyncExternalStore` with a server snapshot of `null`: the clock is an external system,
and this is the one hook allowed to return a different value on the server than in the
browser. `null` is invisible in practice — the modal starts closed and the summary starts
empty.

**On the server**, the browser's clock is not evidence. `propertyTodayISO()` answers with
the day at the *villas* — `Asia/Makassar`, WITA — because Vercel's clock is UTC and a guest
in Jakarta booking at 07:00 would otherwise be told the day had already started. Three
database functions compare against `(now() at time zone 'Asia/Makassar')::date`:
`create_booking`, `check_in_booking` and `advance_booking_lifecycle`. ⚠️ **All four of those
clocks must not drift apart.**

## 13. Why seed 0005 deletes before it inserts

`0004_bookings_seed.sql` anchors its 24 non-historical rows to `current_date` — *the date
the seed ran on*. A seed database is not rebuilt weekly, so a few weeks later every
"upcoming" booking is in the past and the calendar renders with nothing marked.

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

⚠️ **This file is now dangerous, twice over.** Real bookings made through the app are
`confirmed`, `checked_in` or `no_show` — all of which are `<> 'checked_out'`, so re-running
`0005` deletes them. It was already documented as *"must never run against a database with
a real checkout flow"*; that database now exists.

## 14. File map

| File | Role |
|---|---|
| [`actions.ts`](actions.ts) | Reads. `getStayBookedRanges()` (cached, anonymous client), `getGuestBookings()` / `getGuestBooking()` (**never** cached, session client), `getCheckInInvite()` (never cached, anonymous by necessity) |
| [`server-actions.ts`](server-actions.ts) | The mutations: `payAndBook()`, `checkIn()` and `cancelBooking()` |
| [`types.ts`](types.ts) | `BookedRange`, `GuestCounts`, `DateSelection`, `BookingStatus`, `GuestBooking`, `CheckInInvite`, `guestsBooked()` |
| [`lib/dates.ts`](lib/dates.ts) | All calendar arithmetic. No dependency — see below |
| [`lib/checkout-params.ts`](lib/checkout-params.ts) | Builds and re-parses the checkout URL |
| [`lib/payment-methods.ts`](lib/payment-methods.ts) | The payment radio list. Safe in the browser bundle |
| [`lib/payment-gateway.ts`](lib/payment-gateway.ts) | The simulated provider. Server-side only |
| [`lib/check-in-methods.ts`](lib/check-in-methods.ts) | The arrival radio list, and the instruction each one shows later |
| [`lib/access-code.ts`](lib/access-code.ts) | Formatting and URLs for the door code. Never generates one |
| [`lib/qr.ts`](lib/qr.ts) | The QR, as an inline SVG. Server-side only |
| [`components/booking-panel.tsx`](components/booking-panel.tsx) | Owns the picker's state; `Reserve` links to checkout |
| [`components/booking-modal.tsx`](components/booking-modal.tsx) | The centred overlay: header, date fields, two calendars, guest stepper, footer |
| [`components/month-calendar.tsx`](components/month-calendar.tsx) | One month grid. Stateless — both months take the same props |
| [`components/date-field.tsx`](components/date-field.tsx) | A typed `MM/DD/YYYY` box |
| [`components/guest-stepper.tsx`](components/guest-stepper.tsx) | The four counters |
| [`components/booking-summary.tsx`](components/booking-summary.tsx) | The priced block, on the stay page and again at checkout |
| [`components/checkout-form.tsx`](components/checkout-form.tsx) | Four steps: pay, get in, note, confirm |
| [`components/checkout-recap.tsx`](components/checkout-recap.tsx) | The villa and the quote, beside the form |
| [`components/arrival-instructions.tsx`](components/arrival-instructions.tsx) | The door panel: QR, code, both methods, the check-in button |
| [`components/check-in-button.tsx`](components/check-in-button.tsx) | The POST that opens the door. Used from two pages |
| [`components/trip-card.tsx`](components/trip-card.tsx) | One row of `/account/trips` |
| [`components/booking-status-badge.tsx`](components/booking-status-badge.tsx) | `status` **and** `paid_at` → one honest label |

Routes:

- `app/(stay-list)/stays/[stayId]/book/page.tsx` — checkout. Dynamic: reads `searchParams`
  and the session.
- `app/(auth)/account/trips/page.tsx` — the list.
- `app/(auth)/account/trips/[bookingId]/page.tsx` — one reservation, and the page a guest
  lands on after paying.
- `app/checkin/[code]/page.tsx` — what the QR opens. ⚠️ Deliberately **outside** `(auth)`
  and outside `proxy.ts`'s protected list; see §8.

Touched outside this folder:

- [`proxy.ts`](../../proxy.ts) — `/stays/{slug}/book` is protected, and `next` carries the
  query string. `/checkin/*` is **not** protected, on purpose.
- [`app/layout.tsx`](../../app/layout.tsx) — `ChromeGate` reads `usePathname()`, which on a
  route with an unknown dynamic segment (`/account/trips/[bookingId]`, `/checkin/[code]`) is
  request-time data sitting **above** `app/loading.tsx`. It needed its own `<Suspense>`, or
  the build fails with *"Uncached data was accessed outside of `<Suspense>`"*.
- [`features/home/components/faq-section.tsx`](../home/components/faq-section.tsx) — entry 5
  was a verbatim duplicate of entry 2. It is now the arrival question.
- [`app/(auth)/account/page.tsx`](<../../app/(auth)/account/page.tsx>) — a link to Trips.
- [`features/stays/components/stay-info-section.tsx`](../stays/components/stay-info-section.tsx) —
  passes `staySlug` to `BookingPanel`.
- [`lib/supabase.ts`](../../lib/supabase.ts) — `BOOKINGS_CACHE_TAG` / `BOOKINGS_CACHE_PROFILE`.

**Dependencies.** One, `qrcode`, used only in a Server Component. **No date library** — the
project had no date dependency, the picker needs about ten operations, and `Intl` already
ships in every runtime. Two rules make the hand-rolled version safe: a calendar day is
always a `yyyy-mm-dd` **string** (Postgres's own format, sorts correctly with `<`, safe as a
`Set` key), and any `Date` is built at **local noon** — `new Date("2026-08-18")` parses as
UTC midnight, which is the previous day everywhere west of Greenwich.

**Cache tags.** `payAndBook()` calls `updateTag('bookings:{slug}')`, not `revalidateTag`.
The guest has just changed the calendar they came from, so the next render must *wait* for
fresh data rather than be served the stale one — the read-your-own-writes case `updateTag`
exists for.

**One word this site never uses: "host".** Seaspace is one company, not a marketplace —
*"welcoming guests since 1962"*, *"our concierge"*, *"our events team"*. The people who
prepare a villa are **the villa team**, and guest notes are addressed to them.

## 15. Still ahead

- [ ] **Nothing tells a guest their stay was marked `no_show`.** The trips page states it
      plainly if they look, but a booking that quietly went unused is exactly the kind of
      thing an email exists for — and this project has no working mail sender
      (see `features/auth/README.md`).
- [ ] **The access code is shown from the moment of booking.** Real operators release door
      credentials closer to arrival. Doing that here means either a release window on the
      read, or rotating the code — a decision, not a tweak.
- [ ] `reviews.booking_id` and the composite foreign key from `GUEST_PLANNING_TABLE.md` §3 —
      still the missing half of "verified review". The composite unique key it targets has
      been sitting in `0009` since the table was created. **A `checked_out` booking is now a
      real thing** (§9), so "did this person actually stay" has an answer for the first time.
