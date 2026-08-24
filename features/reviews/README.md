# Reviews — the carousel, the per-villa rating, and how a review gets written

**Status: the write path is live.** A guest whose stay has finished can rate it, edit that
rating, or withdraw it. Reviews are inserted by a `SECURITY DEFINER` function, never by an
RLS policy, and `public.reviews` is no longer readable from the browser at all — every read
goes through a function whose return type is the column allow-list.

| Migration | What it added |
|---|---|
| [`0005_reviews.sql`](../../supabase/migrations/0005_reviews.sql) | The table, and the argument against an `is_verified` column |
| [`0007_reviews_guest_id.sql`](../../supabase/migrations/0007_reviews_guest_id.sql) | `guest_ref` → `guest_id`, and `reviews_orphan_is_anonymised` |
| [`0008_guest_avatars.sql`](../../supabase/migrations/0008_guest_avatars.sql) | `author_avatar_path`, and the anonymise rule that goes with it |
| [`0018_reviews_write_path.sql`](../../supabase/migrations/0018_reviews_write_path.sql) | `booking_id`, the composite FK, `updated_at`, the closed read path, seven RPCs |

> ⚠️ **Migrations reach the database by hand**, through Dashboard → SQL Editor. Until `0018`
> is run, every review read fails with `PGRST202` (function not found) — including at build
> time, because the landing page queries reviews while prerendering.

## Contents

| Section | |
|---|---|
| [1. What "verified" means here](#1-what-verified-means-here) | and why there is no badge for it |
| [2. Why the table is closed to reads](#2-why-the-table-is-closed-to-reads) | and why it is not a column GRANT |
| [3. Who may review, and when](#3-who-may-review-and-when) | one status, no time limit |
| [4. Why the author's name lives on the review row](#4-why-the-authors-name-lives-on-the-review-row) | ⚠️ do not normalise this |
| [5. Editing and deleting](#5-editing-and-deleting) | and why a review is not a booking |
| [6. Caching](#6-caching) | two tags, and why both |
| [7. File map](#7-file-map) | |
| [8. Still ahead](#8-still-ahead) | |
| [9. Verification](#9-verification) | |

---

## 1. What "verified" means here

A review is meaningful when it comes from someone who actually stayed. In this schema that
is a **structural** property, not a flag: `reviews.booking_id` points at a real
`checked_out` booking, and `upsert_stay_review()` is the only thing that can set it.

`0005_reviews.sql` refused an `is_verified` boolean and said why — a hand-set boolean is a
second source of truth that can claim a stay with no evidence behind it.
`GUEST_PLANNING_TABLE.md` §8 counts that refusal as one of three (`is_verified`,
`guest_ref`, `is_paid`), and `PORTFOLIO-BREAKDOWN.md` §"No invented schema flags" states it
as a principle.

**That extends to a generated column, and it extends to the UI.** A
`verified boolean generated always as (booking_id is not null)` is still the same column: one
more place stating a fact the relationship already states. And a "Verified stay" badge would
be worse than redundant — every review written through the RPC has a booking by
construction, and `0018`'s backfill gave the seeded rows one too. A badge on 100% of cards
distinguishes nothing.

So what is `booking_id` actually for? Three things, per `GUEST_PLANNING_TABLE.md` §3:

1. `reviews_booking_id_key` caps a stay at one review
2. the composite FK stops `reviews.guest_id` / `reviews.stay_id` drifting away from the
   booking they claim to describe
3. a metric that does not exist yet — see [§8](#8-still-ahead)

### ⚠️ The composite FK carries `on update cascade`, and that is load-bearing

`GUEST_PLANNING_TABLE.md` §3 specifies the constraint but not its referential actions,
because it was written before the column existed. The default is wrong here.

`ACCOUNT-DELETION-POLICY.md` records that one `DELETE` on `auth.users` cascades to
`public.guests`, which fires `on delete set null` on **both** `reviews.guest_id` (`0007`)
and `bookings.guest_id` (`0009`). The FK sits across exactly those two columns, so the
referenced key changes mid-cascade — and `ON UPDATE NO ACTION` (the default) rejects that
while a referencing row still exists.

`on update cascade` lets it through, and produces the result `0007` already wants:
`reviews.guest_id` becomes NULL, `MATCH SIMPLE` then skips the check, and the review
survives anonymised.

**This makes the order in `features/auth/server-actions.ts` a hard dependency.** The
`anonymize` branch overwrites `author_display_name` to `'Former guest'` *before* deleting the
account, which is what keeps `reviews_orphan_is_anonymised` satisfied at the moment
`guest_id` empties. Do not reorder it.

`DELETE` stays `NO ACTION` on purpose: a booking is never deleted (`0009` spends its longest
comment on why a financial record is retained), so the constraint becomes one more piece of
evidence for that rule.

---

## 2. Why the table is closed to reads

`0005` opened `public.reviews` with `for select to anon, authenticated using (true)`, which
was correct while every column on it was public marketing copy. `booking_id` is not: it maps
a reservation id to the guest who made it and the villa they stayed at, and the anon key
ships to the browser.

`0018` therefore runs `revoke select on public.reviews from anon, authenticated`, and the
reads moved into functions.

### Not a column GRANT, and this is the part worth remembering

The obvious fix looks like `revoke select (booking_id)`. **It silently does nothing.** In
Postgres a table-level grant is unaffected by a column-level revoke, and Supabase grants
table-level SELECT to `anon` and `authenticated` by default. Making it work means revoking
the table grant and re-granting every other column by name — which breaks the day somebody
adds a column and forgets.

`0014_admin_staff_access.sql` already settled the doctrine for this project:

> Postgres RLS filters ROWS, not COLUMNS. […] What genuinely restricts columns is a function
> that only ever selects the columns it means to return.

So each RPC's **return type is the allow-list**, and `booking_id` appears in none of them.

### The RLS policy from 0005 is deliberately left in place

With the grant revoked it can never be reached — a missing privilege is checked before any
policy. It stays as the second layer: if a future migration ever restores SELECT, `using
(true)` is still the right row-level answer for public reviews, and its absence would mean
nothing was readable at all. **The grant is the gate; the policy is the net under it.**

### ⚠️ Consequences to know

- `service_role` is unaffected, and must stay that way: the account-deletion flow rewrites
  these rows through `createAdminClient()`, and `scripts/create-seed-accounts.mjs` reads them.
- Adding a `.from("reviews").select(...)` anywhere in the app will not fail loudly. It comes
  back as a permission error that reads like a broken query, and there is no table read to
  fall back to. `features/reviews/actions.ts` carries this warning at the top.

### What the closed read path bought back

Two comments in `actions.ts` had been asking for this:

- the carousel's one-review-per-author rule was an overfetch plus a JS dedupe loop, "because
  PostgREST has no `distinct on`". It is now `distinct on` inside `get_latest_reviews`.
- the stats row pulled a hundred `smallint`s to average in JS, because PostgREST's own
  aggregates "depend on a server flag that is not guaranteed to be on". Inside a function
  there is no such flag.

⚠️ One trap in `distinct on`: the dedupe key is **not** plain `guest_id`. `distinct on`
treats every NULL as equal, and a NULL `guest_id` means a deleted account — those are
different people, so collapsing them would drop real reviews. Keyed on
`coalesce(guest_id::text, 'anon:' || id)`, which is exactly what the JS did.

---

## 3. Who may review, and when

**One status: `checked_out`. No time limit.**

`checked_out` is the only value in the vocabulary that a real stay produced.
`0013_booking_lifecycle_cron.sql` writes it hourly, and that job is explicitly *forbidden*
from writing `checked_in` — a calendar cannot know whether anybody walked through the door.
So this is a fact somebody's arrival produced rather than a value nothing maintains.

`no_show` is excluded on purpose: paid for, but nobody was ever there, so there is no
experience to rate.

**No 14-day window**, unlike [Airbnb](https://www.airbnb.com/help/article/995), where both
parties have 14 days from checkout. That was a deliberate choice, and it is the reason
editing has to exist ([§5](#5-editing-and-deleting)) — a typo with no expiry would otherwise
be permanent.

Airbnb's **six category ratings** (cleanliness, accuracy, check-in, communication, location,
value — [help/1257](https://www.airbnb.com/help/article/1257)) were considered and declined
for now. `reviews.rating` is one whole-star column, and six more would be six columns empty
on all 100 seeded rows. See [§8](#8-still-ahead).

Where the rule is enforced, in order:

| Layer | What it does |
|---|---|
| `app/(auth)/account/trips/[bookingId]/page.tsx` | Omits the section entirely for any other status. Presentation only |
| `upsert_stay_review()` | Raises `SB017`. **This is the enforcement** |
| `reviews_matches_booking_fkey` | Makes a review that names a booking it does not match impossible |

The page hides rather than disabling: a dead control with no explanation is worse than none,
and `BookingStatusBadge` at the top of that page already says what state the reservation is in.

---

## 4. Why the author's name lives on the review row

`author_display_name`, `author_nationality` and `author_avatar_path` are denormalised copies
of `public.guests` columns. **This is a security decision, not laziness, and it must not be
"normalised" away.**

`public.guests` has no `anon` policy at all, because it holds phone numbers. A join from a
review to that table returns nothing for a signed-out visitor **without raising an error** —
so the name would simply be blank forever and look like an unfinished feature. `0005` and
`0008` both spell this out.

`upsert_stay_review()` copies all three at write time, which is what makes them a genuine
snapshot rather than three strings the browser supplied.

Two consequences, both accepted:

- **Editing a review does not refresh the author columns.** `0008` states the rule: "changing
  your photo does not update older review cards. A review is a record of a moment." An edit
  rewrites the words, not who the guest was when they wrote them.
- **`author_nationality` is `NOT NULL` while `guests.nationality` is nullable** — the signup
  form makes it optional. The empty string is this project's "no nationality" value; the
  anonymise branch already writes exactly that. So `upsert_stay_review` uses
  `coalesce(g.nationality, '')` rather than the column being made nullable, and
  `review-content.tsx` guards the render so an empty value does not leave a blank line.

---

## 5. Editing and deleting

One booking carries at most one review (`reviews_booking_id_key`), so **a second submission
for the same stay is an edit**, handled by `on conflict (booking_id) do update` inside
`upsert_stay_review()`. That is why there is no separate update action and no separate edit
component.

What the update deliberately does **not** touch:

- `created_at` — `0005` calls it "load-bearing, not an audit column": the landing carousel
  reads `order by created_at desc`, so fixing a typo must not reshuffle the section. That is
  what `updated_at` (and `reviews_touch_updated_at`, reusing `touch_updated_at()` from
  `0006`) is for.
- the three author columns — see [§4](#4-why-the-authors-name-lives-on-the-review-row).

**Deleting is a real `DELETE`**, and the contrast with bookings is the point: `0009` refuses
to delete a booking because it is a financial record with a retention obligation. A review is
an opinion — nothing depends on it and no law requires keeping it.

Removing it frees the booking to be reviewed again, since `reviews_booking_id_key` no longer
holds it. Intended: withdrawing a review should not lock somebody out of writing a better one.

---

## 6. Caching

Every public read tags **both** `STAYS_CACHE_TAG` and `REVIEWS_CACHE_TAG`:

- `STAYS_CACHE_TAG` keeps the catalogue webhook from `0017` clearing reviews exactly as it
  did before this feature existed.
- `REVIEWS_CACHE_TAG` is the narrow door the write path uses, so posting one review does not
  drop the whole four-villa catalogue — which is cached for an hour and did not change.

Reviews ride on `STAYS_CACHE_PROFILE` (hours in production, seconds in development). What
makes a new review appear immediately is not a short interval but `updateTag` — **not**
`revalidateTag`: this is read-your-own-writes, so the next render must wait for fresh data
rather than being served the stale average. Same call, same reason, as `payAndBook()`.

⚠️ **`getOwnBookingReview()` is never cached.** It reads cookies, and a cache entry there
would be one guest's review handed to whoever asked next. It is wrapped in React's `cache`
instead, which dedupes within a single render — the distinction `features/auth/actions.ts`
draws.

---

## 7. File map

| File | |
|---|---|
| `actions.ts` | Reads. Public ones cached and anonymous; the guest's own uncached and session-bound |
| `server-actions.ts` | `saveStayReview`, `removeStayReview`. The only writes |
| `types.ts` | `Review`, `ReviewStats`, `StayRatingSummary`, `ReviewFormState` |
| `components/rating-stars.tsx` | Whole stars, 1–5. One review's rating |
| `components/rating-summary.tsx` | ★ + a fractional average. Villa-level |
| `components/rating-input.tsx` | The 1–5 picker. Five real radios behind the stars |
| `components/review-form.tsx` | Write/edit form, inside a dialog |
| `components/review-prompt.tsx` | The panel on a reservation page |
| `components/stay-review-item.tsx` | One review in a static list |
| `components/stay-reviews-section.tsx` | The villa's review section |
| `components/stay-reviews-modal.tsx` | "Show all reviews" |
| `components/reviews-section.tsx` + `reviews-header.tsx` + `reviews-panel.tsx` | Landing page |
| `components/review-carousel.tsx` + `review-viewport.tsx` + `review-card.tsx` | The vertical carousel |
| `components/review-content.tsx` | Author block, shared by card and list |

### Why `RatingSummary` is not five partially-filled stars

`RatingStars` renders `Array.from({ length: rating })`, which only works for the whole
numbers one review carries. An average is fractional, and rounding 4.5 and 5.0 to the same
five stars flattens the only distinction the number exists to make. One star acts as the unit
and the number carries the precision — which is how Airbnb prints it too.

### Why `StayReviewItem` exists instead of reusing `ReviewCard`

`ReviewCard` carries a `phase` prop and `animate-review-enter` / `animate-review-exit`
classes, because the carousel mounts one card at a time and slides it in. A grid renders
every card at once, so inheriting that would mean carrying animation state nothing drives.
`ReviewContent` and `RatingStars` **are** reused — the author block and the stars must look
identical in both places.

---

## 8. Still ahead

1. **The third landing-page stat.** `GUEST_PLANNING_TABLE.md` §3 argues that "reviews
   collected ÷ bookings already checked out" is a better figure than the current
   `Recommend` (% rated 4 or better). It is not built: counting `checked_out` bookings needs
   another `SECURITY DEFINER` function granted to `anon`, since `bookings` is closed. Its own
   phase, one function and one verification block.
2. **Category ratings.** Airbnb's six ([help/1257](https://www.airbnb.com/help/article/1257)).
   If they are ever added, the shape is six **nullable** `smallint` columns on `reviews` —
   not a child table, and not `NOT NULL`, because the 100 seeded rows have no values for them
   and never will. `RatingInput` would become six of itself; `reviews.rating` stays the
   overall figure and must **not** become an average of the six (Airbnb's overall is a
   separate question too).
3. **Pagination inside "show all".** The stay page fetches a fixed ceiling
   (`STAY_REVIEWS_LIMIT`, 50) and the dialog shows what it got. `get_stay_reviews` already
   takes an offset for the day a villa passes it — the fix then is paging in the dialog, not
   a bigger constant.
4. **Moderation.** Still an open question, as it was in `GUEST_PLANNING_TABLE.md` §7: who
   approves a review, and whether that needs a state column. Nothing today stands between a
   guest's words and the landing page.
5. **Avatars on review cards.** `author_avatar_path` has existed since `0008` and is returned
   by the RPCs, but `ReviewContent` still draws a Phosphor icon. The seam is complete on both
   sides; nothing has uploaded a photo yet.

---

## 9. Verification

There is no test runner in this repo — verification is manual, as
`PORTFOLIO-BREAKDOWN.md` §7 records. Blocks 1–8 at the foot of
[`0018_reviews_write_path.sql`](../../supabase/migrations/0018_reviews_write_path.sql) carry
runnable SQL with expected output. The application-side checks:

1. **`npx tsc --noEmit`** and **`pnpm lint`** — no `typecheck` script exists, so call `tsc`
   directly.
2. **`pnpm build`** is the strongest single check of the closed read path. The landing page
   calls `getLatestReviews()` and `getReviewStats()` at **build** time with the anon key, and
   `/stays/[stayId]` prerenders every villa through `generateStaticParams()`. A green build
   proves `revoke select` plus the `anon` grants are consistent. `PGRST202` means `0018` has
   not been run; `42501` means a grant was missed.
3. **The write path** needs a real session. Find an eligible booking:

   ```sql
   select b.id, s.slug, u.email
   from public.bookings b
   join public.stays s on s.id = b.stay_id
   join auth.users u   on u.id = b.guest_id
   where b.status = 'checked_out'
   order by b.end_date desc
   limit 5;
   ```

   Sign in as that guest (`SEED_ACCOUNT_PASSWORD`), open `/account/trips/{id}`, post a
   review, then confirm:

   ```sql
   select rating, quote, booking_id, created_at, updated_at
   from public.reviews where booking_id = {id};
   ```

   Edit it and re-run: `quote` changes, `updated_at` moves, `created_at` does **not**.
4. **The cases that must fail.** `upsert_stay_review` against somebody else's booking →
   `SB016`; against a `confirmed` booking → `SB017`; a 10-character quote → `23514`.
5. ⚠️ **Account deletion still works.** This is the check that gates `0018` — see
   [§1](#1-what-verified-means-here). Block 8 of the migration has the procedure. A foreign
   key violation there means `on update cascade` is wrong and nothing should be built on top
   of it.
