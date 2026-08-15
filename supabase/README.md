# Supabase — runbook

Database + storage for the **stays** feature. The schema here mirrors the
`Stay` / `StayImage` / `Amenity` types in [`features/stays/types.ts`](../features/stays/types.ts),
minus `ferryUrl` (dropped) and with nested objects flattened into columns.

> **Status: this is now the live data source.** The dummy catalogue that used
> to sit in `features/stays/data.ts` is gone; [`features/stays/api.ts`](../features/stays/api.ts)
> queries these tables directly. Steps 4–5 below are kept as a historical record
> of how the photos got into Storage — they are not re-runnable.

## Contents

| File | Role |
|---|---|
| `migrations/0001_stays_schema.sql` | 4 tables, constraints, indexes, RLS |
| `migrations/0002_storage_bucket.sql` | `stays` bucket (public) + policy |
| `seed/0001_stays_seed.sql` | 4 villas, 17 amenities, 35 relation rows |
| `migrations/0003_drop_cabins.sql` | ⚠️ Destructive — run last |
| `migrations/0004_stays_featured.sql` | `is_featured` column driving the landing-page preview |
| `migrations/0005_reviews.sql` | `reviews` table + RLS, behind the landing-page review carousel |
| `seed/0002_reviews_seed.sql` | 100 placeholder reviews by 62 guests across the 4 villas |
| `migrations/0006_guests.sql` | `guests` (1:1 with `auth.users`) + signup trigger + RLS |
| `migrations/0007_reviews_guest_id.sql` | `reviews.guest_id` FK, backfill, drops `guest_ref` |
| `seed/0003_guests_full_name.sql` | Full names for the 62 seeded guests |
| `migrations/0008_guest_avatars.sql` | `avatar_path` columns + `guests` bucket + storage policies |
| `migrations/0009_bookings.sql` | `bookings` table + RLS. The half of "verified review" that exists |
| `seed/0004_bookings_seed.sql` | 140 bookings: 100 behind the seeded reviews, 40 with no review |
| `migrations/0010_stay_availability.sql` | `get_stay_booked_ranges()` — the only public read into `bookings` |
| `seed/0005_bookings_current_seed.sql` | ⚠️♻️ Re-runnable and now destructive — re-anchors the 24 near-term bookings to today, and eats real ones |
| `migrations/0011_booking_writes.sql` | `create_booking()` / `settle_booking_payment()` + the overlap constraint. The write path |
| `migrations/0012_booking_arrival_and_payment.sql` | Door codes, arrival method, the payment record, `no_show`, the two check-in functions |
| `migrations/0013_booking_lifecycle_cron.sql` | The hourly `pg_cron` job that advances `status`. Needs `pg_cron` enabled first |

All eighteen SQL files are **idempotent**, but not all in the same sense. Seventeen are no-ops
on a second run. `seed/0005_bookings_current_seed.sql` is **refresh-on-rerun**: it deletes the
rows it owns and writes them again against today's date. That was harmless while nothing wrote
to `bookings` — ⚠️ since step 19 it also deletes real reservations. See steps 18 and 19.

---

## Setup

1. Create a project at [supabase.com](https://supabase.com) (nearest region: Singapore).
2. Fill in `.env.local` at the repo root. Four variables; where to find each
   value is explained in that file's own comments. This file is gitignored —
   **never** commit it.
3. **Switch "Confirm email" OFF** (Dashboard → Authentication → Providers →
   Email). The signup trigger in `0006` keys on `email_confirmed_at`; with
   confirmation off Supabase stamps it immediately, so registration completes
   without any mail being sent. This project has no working mail sender — the
   full account of what was tried is in
   [features/auth/README.md](../features/auth/README.md),
   which is also where the steps to turn confirmation back on live.

   The **seeded** accounts are unaffected either way: step 7 creates them with
   `auth.admin.createUser({ email_confirm: true })`, which stamps the column
   directly and never reads this setting. That is exactly why seed accounts
   cannot be used to check it — verify with `mailer_autoconfirm` instead
   (`true` means confirmation is off).
4. Make sure dependencies are installed: `pnpm install`.

---

## Execution order

### 1–5. SQL

Open **Dashboard → SQL Editor → New query**, paste the file's contents,
**Run**. One file per run, in order:

1. `migrations/0001_stays_schema.sql`
2. `migrations/0002_storage_bucket.sql`
3. `seed/0001_stays_seed.sql` → its last line should print `4 | 17 | 6 | 35`
4. `migrations/0005_reviews.sql`
5. `seed/0002_reviews_seed.sql` → prints `100 | 62 | 4.66`, then `32`

> Steps 4–5 must come after step 3: the review seed joins `public.stays` by
> slug, so an unseeded catalogue silently inserts **zero** reviews (the join
> matches nothing) and the landing page then hides the section entirely.
>
> `npm run build` fails with `PGRST205 · Could not find the table
> 'public.reviews'` until step 4 has run — the landing page queries the table
> at build time.

> If step 2 fails with `must be owner of table objects`, just skip the policy
> block. A `public` bucket is already enough to read images; that policy only
> widens `list` access.

### 6–10. Guest identity, accounts, and avatars

**The script in the middle is not optional, and the order is not negotiable.**
`0007` backfills `reviews.guest_id` from accounts that only exist after step 7,
and it raises `Backfill incomplete` rather than half-migrating if you skip it.

6. `migrations/0006_guests.sql` → prints `0` (no accounts yet)
7. `node --env-file=.env.local scripts/create-seed-accounts.mjs`
   → `created: 62   skipped: 0   failed: 0`, then
   `public.guests now holds 62 rows`.
   Re-running prints `created: 0   skipped: 62`.
8. `migrations/0007_reviews_guest_id.sql` → prints `100 | 0 | 62`
9. `seed/0003_guests_full_name.sql` → prints `62 | 62 | 0`
10. `migrations/0008_guest_avatars.sql` → prints `62 | 0 | 100 | 0`

> `public.guests` filling up during step 7 without the script ever writing to it
> **is** the proof that the trigger works — the script only touches
> `auth.admin`.

> Step 9 is a separate file rather than part of the script because the trigger
> fills a row **once, at creation** (`on conflict (id) do nothing`). Re-running
> the script with richer metadata changes nothing, and editing
> `raw_user_meta_data` does not flow through either — so the only way to give
> the existing rows a `full_name` is an explicit `UPDATE`.
> `phone` deliberately stays NULL; see `GUEST_PLANNING_TABLE.md` §5.5.

> Step 7 needs `SUPABASE_SERVICE_ROLE_KEY` and `SEED_ACCOUNT_PASSWORD` in
> `.env.local`. It reads the 62 authors out of `public.reviews` rather than from
> a retyped list, so it must run while `reviews.guest_ref` still exists — that
> is, before step 8, which drops it.

### 11–12. Villa photo upload — historical, already done

The 21 villa photos were compressed and uploaded once by a throwaway script
(`scripts/upload-stays-images.mts`), which has since been deleted along with its
source images in `public/villas/`. It read the originals from the repo, so it
cannot run again — and there is no reason to: the bucket is populated.

Recorded for reference, the pipeline was: resize longest edge ≤ 2560px → WebP
q80 → 16px blur thumbnail as base64 → upload with `cacheControl: 31536000`.
Result: **75286 KB → 6089 KB (92% smaller)** across 21 files.

Anything that adds photos from now on — the admin panel in particular — must
reproduce that pipeline exactly, because `blur_data_url`, `width` and `height`
are not optional: `<Image placeholder="blur">` throws at runtime without them.
The full contract, with a self-contained `sharp` example, is in
[`../ADMIN-PANEL-CONTEXT.md`](../ADMIN-PANEL-CONTEXT.md).

### 13. Verify

Run **every** block below. Blocks A–J must pass before step 14; block K covers steps 15–16
and only applies once those have run.

### 14. Drop the old table

Only after verification passes:

- `migrations/0003_drop_cabins.sql` — **export a CSV of `cabins` first**, there's no undo.

### 15–16. Bookings

Numbered last because this is the newest phase, not because it depends on the ones before it.
Its real prerequisites are only **step 3** (villas seeded — the seed joins `stays` by slug) and
**step 8** (`reviews.guest_id` filled). Steps 9–14 are irrelevant to it.

15. `migrations/0009_bookings.sql` → prints `0` (nothing seeded yet)
16. `seed/0004_bookings_seed.sql` → prints `140 | 116 | 4 | 16 | 4 | 128`, then **0 rows**
    three times, then `100`

> Run out of order and step 16 stops with
> `Expected 100 reviews with both a guest_id and a stay_id, found 0`. That guard exists because
> the insert joins `public.reviews`: without it an early run would write **zero** bookings and
> report no error at all, and nothing in the UI reads this table yet to make the miss visible.

> **This does not make reviews verified.** `reviews.booking_id` and the composite foreign key
> from `GUEST_PLANNING_TABLE.md` §3 are a separate migration that has not been written. The
> table exists; the link does not.

> Dates in the seed are relative — the 100 review-backed stays are anchored to each review's
> own timestamp, and the 40 extras to either the oldest review or `current_date`. Nothing goes
> stale, and the two seeds may run days apart without colliding.

> ⚠️ That last claim is half true, and step 18 exists because of it. "Anchored to
> `current_date`" means *the date step 16 ran on*. Weeks later those 24 rows are all in the
> past, and the availability calendar on the stay page renders with nothing marked.

### 17–18. Availability

What turns `bookings` from a table nobody reads into the date picker on the stay detail page.
Prerequisites: **step 15** for 17, and **step 16** for 18.

17. `migrations/0010_stay_availability.sql` → the forward calendar per villa, then **0 rows**
    (no overlaps)
18. `seed/0005_bookings_current_seed.sql` → prints `140 | 116 | 4 | 16 | 4 | 128`, then **0 rows**
    twice, then 5 rows per villa

> **Step 18 is the one to re-run.** Whenever the calendar looks empty — which it will, a few
> weeks after any run — run this file again and the whole near-term block moves forward to
> today. The counts above stay identical, because it replaces its own rows rather than adding
> to them.
>
> What "its own rows" means: every booking that is **not** `checked_out`. All 116 historical
> rows from step 16 are `checked_out` and are never touched; all 24 near-term rows are not.
> ⚠️ A later seed that adds a non-`checked_out` row it does not own would be eaten by this.

> Run 18 before 17 and it works, but 17's verification queries have nothing to show. Run 18
> before 16 and it stops with `Expected at least 116 checked_out bookings from seed/0004`.

### 19–21. The write path, the door, and the lifecycle

What turns the date picker into an actual reservation. Prerequisites: **step 17**.

19. `migrations/0011_booking_writes.sql` → the `bookings_no_overlap` constraint, one SELECT
    policy and nothing else, then two `security definer` functions
20. `migrations/0012_booking_arrival_and_payment.sql` → four new columns, five statuses, and
    four functions with `prosecdef = true`
21. **Enable `pg_cron` first** (Dashboard → Database → Extensions), then
    `migrations/0013_booking_lifecycle_cron.sql` → one scheduled job, and a first run
    reporting the seeded `checked_in` rows it closed

> ⚠️ **Step 19 fails if the existing rows overlap.** That is the point — block K asserts the
> seed is overlap-free, so a failure means real data needs looking at, not that the
> constraint needs relaxing.

> ⚠️ **Once step 19 has run, seed 0005 (step 18) is destructive.** It deletes every booking
> that is not `checked_out`, and a real reservation made through the app is `confirmed`,
> `checked_in` or `no_show`. Re-run it only on a database with no real bookings in it.

> **Step 21 is optional and reversible.** Skip it and everything still works — `status`
> simply stops advancing, exactly as it did before the job existed. `select
> cron.unschedule('advance-booking-lifecycle');` puts it back that way.

---

## Verification

### A. Row counts

```sql
select
    (select count(*) from stays)                     as stays,       -- 4
    (select count(*) from stay_images)               as images,      -- 21
    (select count(*) from amenities)                 as amenities,   -- 17
    (select count(*) from amenities where is_shared) as shared,      -- 6
    (select count(*) from stay_amenities)            as links;       -- 35
```

### B. Reconstruct one full villa

```sql
select
    s.slug, s.name, s.location, s.price_per_night,
    s.capacity, s.beds, s.area, s.is_new,
    s.bed_type_label, s.bed_type_note, s.capacity_label,
    s.lat, s.lng, s.airport_code, s.airport_city,
    (select count(*) from stay_images i where i.stay_id = s.id) as image_count,
    (select array_agg(a.slug order by sa.sort_order)
       from stay_amenities sa
       join amenities a on a.id = sa.amenity_id
      where sa.stay_id = s.id) as amenities
from stays s
where s.slug = 'tuscan-twilight-villa';
```

Should match what the site renders: `3500000`, `6`, `3`, `220`, `true`, `Superking`,
`Crib on request`, `4 adults and 2 children`, `-8.506900`, `115.262500`, `DPS`,
`Denpasar`, `image_count = 5`, and amenities in this order:
`{infinity-pool, yoga-deck, housekeeping, wifi, kitchen, air-conditioning, safe, airport-transfer}`
— villa-specific amenities first, then the shared block. Exactly what's
rendered today.

### C. Every villa has a cover photo, and no blur data is missing

```sql
-- Both queries should return 0 rows.
select slug from stays s
 where not exists (select 1 from stay_images i
                    where i.stay_id = s.id and i.sort_order = 0);

select storage_path from stay_images where blur_data_url is null;
```

### D. Images are actually public

```bash
curl -s -o /dev/null -D - \
  "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/public/stays/tuscan-twilight-villa/0-exterior.webp"
```

Should return `HTTP/2 200`, `content-type: image/webp`, and
`cache-control: public, max-age=31536000`.

> Use GET (`-o /dev/null -D -`), **not** `curl -I`. Supabase Storage serves
> HEAD requests through a different path that always replies with
> `cache-control: no-cache` — making a perfectly healthy object look broken.

### E. RLS actually locks things down

Use the **anon key**, not the service role. Reads should work, writes should
be rejected:

```bash
node --env-file=.env.local --input-type=module -e '
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const read = await db.from("stays").select("slug");
console.log("read :", read.error?.message ?? `${read.data.length} rows`);

const write = await db.from("stays").insert({
  slug: "rls-probe", name: "probe", location: "probe", price_per_night: 1,
  capacity: 1, beds: 1, area: 1, description: "probe",
  bed_type_label: "probe", capacity_label: "probe",
  lat: 0, lng: 0, airport_code: "XXX", airport_city: "probe",
});
console.log("write:", write.error ? "blocked OK — " + write.error.message
                                  : "SUCCEEDED — RLS is NOT protecting this table");
'
```

Expected: `read : 4 rows` and `write: blocked OK`. If `write` succeeds, the
policy is wrong — delete the row (`delete from stays where slug = 'rls-probe';`)
and re-run `0001_stays_schema.sql`.

The bucket also needs to be tested separately. Use **valid WebP data**, not
random bytes: the bucket has `allowed_mime_types`, so a garbage file gets
rejected by the MIME filter before RLS is even tested — making it look safe
when it hasn't actually been proven.

```bash
node --env-file=.env.local --input-type=module -e '
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const webp = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#000" } }).webp().toBuffer();

for (const [label, run] of [
  ["insert   ", () => db.storage.from("stays").upload("rls-probe.webp", webp, { contentType: "image/webp" })],
  ["overwrite", () => db.storage.from("stays").upload("tuscan-twilight-villa/0-exterior.webp", webp, { contentType: "image/webp", upsert: true })],
  ["delete   ", () => db.storage.from("stays").remove(["tuscan-twilight-villa/0-exterior.webp"])],
]) {
  const { data, error } = await run();
  const removedSomething = Array.isArray(data) && data.length > 0;
  console.log(label, error || !removedSomething && label.startsWith("delete") ? "blocked OK" : "SUCCEEDED — bucket is anon-writable");
}
'
```

All three should say `blocked OK`. `list` and read access are **meant** to be
open — that's the deliberate `select` policy.

### F. Advisor is clean

Dashboard → **Advisors → Security** → no "RLS disabled in public" findings.

### G. The application hasn't changed at all

This is the main guardrail for this phase.

```bash
pnpm tsc --noEmit     # still 11 errors, ALL of them in _legacy/ — any increase means something leaked
pnpm dev              # /stays and /stays/[stayId] look identical, still backed by dummy data
git status            # zero changes under features/ app/ ui/ lib/ next.config.ts
```

Expect **zero** errors. There used to be a red baseline of nine, all inside the
quarantined `_legacy/` folder, which failed `next build` after it had already
compiled cleanly. That folder has since been deleted, so the check is now
absolute rather than differential.

### H. Reviews land correctly and aggregate to the numbers on the page

```sql
-- 100 | 62 | 4.66  — must match the stats row rendered on /
select count(*), count(distinct guest_ref), round(avg(rating), 2) from reviews;

-- 25 per villa, 0 orphans
select s.slug, count(r.id) from stays s
  left join reviews r on r.stay_id = s.id group by s.slug order by s.slug;
select count(*) as orphans from reviews where stay_id is null;   -- 0

-- 32: 26 guests with two reviews, 6 with three. Proves one guest can review
-- more than once, across different villas.
select count(*) from (
  select guest_ref from reviews group by guest_ref having count(*) > 1
) t;

-- 94 — the "Recommend" figure in the stats row.
select round(100.0 * count(*) filter (where rating >= 4) / count(*)) from reviews;
```

The anon key must be able to read them (the section is hidden when the query
returns nothing, so a broken policy looks like "no reviews yet"):

```bash
node --env-file=.env.local --input-type=module -e '
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const read  = await db.from("reviews").select("id, stays ( slug )").limit(3);
console.log("read :", read.error?.message ?? `${read.data.length} rows, embed ok: ${"stays" in read.data[0]}`);
const write = await db.from("reviews").insert({
  author_display_name: "Probe", author_nationality: "Probe",
  rating: 5, quote: "This row should never be inserted by the anon key.",
});
console.log("write:", write.error ? "blocked OK — " + write.error.message
                                  : "SUCCEEDED — RLS is NOT protecting this table");
'
```

Expected: `read : 3 rows, embed ok: true` and `write: blocked OK`. The embed
check matters — `features/reviews/actions.ts` selects `stays ( slug )`, which
only resolves while the `reviews.stay_id → stays.id` foreign key exists.

### I. Guests exist, link to accounts, and leak nothing

Row counts and the review↔guest join (steps 6–8 of the execution order):

```sql
select count(*) from auth.users;                                   -- 62
select count(*) from public.guests;                                -- 62
select count(*) from public.reviews where guest_id is null;        --  0
select count(distinct guest_id) from public.reviews;               -- 62

-- Step 9 landed: every guest named, no phone invented.
select count(*) filter (where full_name is null) as unnamed,       --  0
       count(phone)                              as with_phone     --  0
  from public.guests;

-- The row that proves the names are data, not initcap() output.
select full_name from public.guests
 where display_name = 'Sean M.';                    -- Sean McAllister

-- The 6 guests who wrote three reviews each. Proves one account owns
-- several reviews across different villas.
select g.display_name, count(*)
  from public.guests g join public.reviews r on r.guest_id = g.id
 group by g.display_name having count(*) = 3;

-- guest_ref really is gone: 0 rows.
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'reviews'
   and column_name = 'guest_ref';
```

**The RLS probe — the one that actually matters.** `guests` holds phone numbers
and has *no* anon policy at all, unlike every other table here:

```bash
node --env-file=.env.local --input-type=module -e '
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const anon = await db.from("guests").select("id, phone");
console.log("anon  :", anon.error || anon.data.length === 0
  ? "blocked OK" : `LEAKED ${anon.data.length} rows`);

const s = await db.auth.signInWithPassword({
  email: "amara.lindqvist@example.com",
  password: process.env.SEED_ACCOUNT_PASSWORD,
});
console.log("signin:", s.error?.message ?? "ok");

const mine = await db.from("guests").select("id, display_name");
console.log("as me :", mine.error?.message ?? `${mine.data.length} row(s) — must be exactly 1`);
'
```

Expected: `blocked OK`, `ok`, and **exactly 1 row**. One row proves
`auth.uid() = id` is really filtering; 62 rows means the policy is wrong and
every guest phone number is readable.

Finally, the end-to-end scenario — an account that already has review history:

```sql
select s.name, r.rating, left(r.quote, 40) || '…'
  from public.reviews r
  join public.stays s on s.id = r.stay_id
 where r.guest_id = (select id from auth.users
                      where email = 'amara.lindqvist@example.com');
```

Three rows, three different villas.

### J. Avatar seam exists and nobody can overwrite anybody

Columns and bucket:

```sql
select table_name, column_name from information_schema.columns
 where (table_name, column_name)
    in (('guests','avatar_path'), ('reviews','author_avatar_path'));   -- 2 rows

select id, public, file_size_limit from storage.buckets
 where id = 'guests';                                    -- guests | true | 524288
```

The strengthened constraint must bite — this has to be **rejected**:

```sql
begin;
update public.reviews
   set author_avatar_path = 'probe/x.webp'
 where id = (select id from public.reviews limit 1);
update public.reviews
   set guest_id = null, author_display_name = 'Former guest'
 where id = (select id from public.reviews limit 1);
-- expected: violates check constraint "reviews_orphan_is_anonymised"
rollback;
```

**The storage probe — the one that matters.** Use a real 1×1 WebP, not random bytes: the
bucket's MIME filter rejects garbage before RLS is ever reached, which makes a broken
policy look safe (same trap as block E).

```bash
node --env-file=.env.local --input-type=module -e '
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const webp = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#000" } }).webp().toBuffer();

const s = await db.auth.signInWithPassword({
  email: "amara.lindqvist@example.com", password: process.env.SEED_ACCOUNT_PASSWORD });
console.log("signin :", s.error?.message ?? "ok");
const me = s.data.user.id;

const mine = await db.storage.from("guests").upload(`${me}/probe.webp`, webp, { contentType: "image/webp", upsert: true });
console.log("own    :", mine.error ? "BLOCKED — policy too strict: " + mine.error.message : "uploaded OK");

const theirs = await db.storage.from("guests").upload(`00000000-0000-0000-0000-000000000000/probe.webp`, webp, { contentType: "image/webp" });
console.log("others :", theirs.error ? "blocked OK" : "SUCCEEDED — ANYONE CAN OVERWRITE ANYONE");

await db.auth.signOut();
const read = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/guests/${me}/probe.webp`);
console.log("anon   :", read.ok ? "readable OK" : `NOT readable (${read.status})`);

await db.auth.signInWithPassword({ email: "amara.lindqvist@example.com", password: process.env.SEED_ACCOUNT_PASSWORD });
await db.storage.from("guests").remove([`${me}/probe.webp`]);
'
```

Expected: `ok`, `uploaded OK`, `blocked OK`, `readable OK`. The third line is the whole point —
if it succeeds, any signed-in guest can replace any other guest's photo.

### K. Bookings are consistent, and invisible to strangers

Only applies after steps 15–16. Shape and spread:

```sql
-- 140 | 116 | 4 | 16 | 4 | 128
select count(*)                                       as bookings,
       count(*) filter (where status = 'checked_out') as checked_out,
       count(*) filter (where status = 'checked_in')  as checked_in,
       count(*) filter (where status = 'confirmed')   as confirmed,
       count(*) filter (where status = 'cancelled')   as cancelled,
       count(paid_at)                                 as paid
from public.bookings;
```

**The one that matters most.** No constraint prevents a double-booking — `0009` explains
why — so this query is the only thing that will catch one. Cancellations release their dates
and are excluded, exactly as a constraint's `WHERE` clause would have been. Must be **0 rows**:

```sql
select a.id as booking_a, b.id as booking_b, a.stay_id
from public.bookings a
join public.bookings b
  on  b.stay_id = a.stay_id and b.id > a.id
  and daterange(a.start_date, a.end_date, '[)') && daterange(b.start_date, b.end_date, '[)')
where a.status <> 'cancelled' and b.status <> 'cancelled';
```

Three more that CHECK constraints cannot express — all must be **0 rows**:

```sql
-- Party larger than the villa sleeps. Spans two tables, so it cannot be a CHECK.
select b.id, b.num_guests, s.capacity, s.slug
from public.bookings b join public.stays s on s.id = b.stay_id
where b.num_guests > s.capacity;

-- Status contradicting the calendar. CHECK constraints must be IMMUTABLE and
-- now() is not, so this can only ever be asserted here.
select id, status, start_date, end_date from public.bookings
where (status = 'checked_out' and end_date   > current_date)
   or (status = 'confirmed'   and start_date < current_date)
   or (status = 'checked_in'  and (start_date > current_date or end_date < current_date));

-- Paid or stayed before the booking was even made.
select id from public.bookings
where created_at::date > start_date or paid_at::date > start_date;
```

> ⚠️ **The status query is exact only in the days right after seeding.** `status` is a stored
> value while `current_date` moves, so the four `checked_in` rows drift out of their window
> within about a week, and `confirmed` rows go stale as their dates arrive. That is not a bug in
> the data — it is what a status column means without a job to advance it. Re-seed on a clean
> table if you need the block to come back clean, and expect the same drift once real bookings
> exist and nothing moves them along.

Every review has a stay that could plausibly precede it — expect **100**:

```sql
select count(*) from public.reviews r
where exists (
    select 1 from public.bookings b
     where b.guest_id = r.guest_id and b.stay_id = r.stay_id
       and b.end_date <= r.created_at::date
);
```

**RLS.** Unlike `stays`, a stranger must read **nothing** here — and get an empty list rather
than an error, which is what a missing `anon` policy looks like from outside:

```bash
node --env-file=.env.local --input-type=module -e '
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const anon = await db.from("bookings").select("id, start_date, total_price");
console.log("anon  :", anon.error ? "error — " + anon.error.message
  : anon.data.length === 0 ? "0 rows — blocked OK"
  : `${anon.data.length} ROWS LEAKED — occupancy and prices are public`);

const s = await db.auth.signInWithPassword({
  email: "amara.lindqvist@example.com", password: process.env.SEED_ACCOUNT_PASSWORD });
const mine = await db.from("bookings").select("id, guest_id");
const foreign = mine.data?.filter((r) => r.guest_id !== s.data.user.id).length ?? 0;
console.log("guest :", mine.error ? "error — " + mine.error.message
  : `${mine.data.length} rows, ${foreign} belonging to someone else`);
await db.auth.signOut();
'
```

Expected: `anon  : 0 rows — blocked OK` and `guest : 4 rows, 0 belonging to someone else`
(Amara has three seeded reviews plus one upcoming stay). **Any non-zero on the second number
means one guest can read another's reservations.**

**`stay_id` restrict actually bites.** This must be **rejected**:

```sql
begin;
delete from public.stays where slug = 'riverside-stone-lodge';
-- expected: violates foreign key constraint "bookings_stay_id_fkey" on table "bookings"
rollback;
```

### L. Availability is public, and nothing else is

Run after step 17. This is the block that proves `0010` opened exactly one door and no more.

**The function returns something, and it agrees with the table.** Every villa should have
five forward ranges after step 18 — the cancelled booking is excluded, which is the point.

```sql
select s.slug, count(*) as forward_ranges
from public.stays s
cross join lateral public.get_stay_booked_ranges(s.slug) r
group by s.slug order by s.slug;
-- 4 rows, forward_ranges = 5 each
```

**No range it hands back overlaps another.** A picker asked to grey out the same day twice
means the seed has a real bug.

```sql
select s.slug, a.start_date, a.end_date, b.start_date, b.end_date
from public.stays s
cross join lateral public.get_stay_booked_ranges(s.slug) a
cross join lateral public.get_stay_booked_ranges(s.slug) b
where a.start_date < b.start_date
  and daterange(a.start_date, a.end_date, '[)')
   && daterange(b.start_date, b.end_date, '[)');
-- 0 rows
```

**Cancellations really are released.** The cancelled booking's dates must NOT come back:

```sql
select b.id, b.start_date, b.end_date
from public.bookings b
join public.stays s on s.id = b.stay_id
where b.status = 'cancelled'
  and s.slug = 'tuscan-twilight-villa'
  and exists (
    select 1 from public.get_stay_booked_ranges('tuscan-twilight-villa') r
     where r.start_date = b.start_date
  );
-- 0 rows
```

**The table is still shut.** Same anon probe as block K, plus the function beside it:

```bash
node --env-file=.env.local -e '
const { createClient } = require("@supabase/supabase-js");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const rows = await db.from("bookings").select("id, total_price, guest_notes");
console.log("table :", rows.data?.length === 0 ? "0 rows — blocked OK" : "LEAKED");

const rpc = await db.rpc("get_stay_booked_ranges", { p_slug: "coastal-arch-retreat" });
console.log("rpc   :", rpc.error ? "error — " + rpc.error.message : `${rpc.data.length} ranges`);
console.log("keys  :", Object.keys(rpc.data?.[0] ?? {}).join(", "));
'
```

Expected: `table : 0 rows — blocked OK`, `rpc : 5 ranges`, and
`keys : start_date, end_date`. **Any other key means the function's return type was widened
and something private is now public.**

### M. The write path is closed, and the door only opens a door

Run after steps 19–21. Everything here is about what is *not* possible.

**The table has exactly one policy, and it is a SELECT.** An INSERT or UPDATE policy
appearing in this list means someone reintroduced the hole `0011` §1 explains — RLS
authorises rows, not values, so a policy here would let a guest write their own price.

```sql
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'bookings';
-- 1 row: "guests read their own bookings" | SELECT | {authenticated}
```

**Every booking function is a definer with an empty search_path**, and each has exactly one
signature. Two signatures for one name means an old overload survived a migration and
PostgREST is now choosing between them at random.

```sql
select proname, prosecdef, proconfig, count(*) over (partition by proname) as signatures
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('create_booking', 'settle_booking_payment', 'get_check_in_invite',
                  'check_in_booking', 'advance_booking_lifecycle', 'get_stay_booked_ranges')
order by proname;
-- 6 rows, all prosecdef = t, all proconfig = {search_path=}, all signatures = 1
```

**Overlap is impossible, not merely unlikely.** Run this twice as a signed-in guest; the
second must fail with `23P01`.

```sql
select public.create_booking('coastal-arch-retreat',
    current_date + 400, current_date + 402, 2::smallint, null, 'gopay', 'smart-lock');
-- clean up afterwards with the service role:
-- delete from public.bookings where start_date > current_date + 300;
```

**What a door code reaches.** The two check-in functions are granted to `anon` on purpose
(see `features/booking/README.md` §8), so what they return is the whole security boundary:

```bash
node --env-file=.env.local -e '
const { createClient } = require("@supabase/supabase-js");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const code = process.argv[1];   // an access_code from a real booking
const invite = await db.rpc("get_check_in_invite", { p_code: code });
console.log("keys  :", Object.keys(invite.data?.[0] ?? {}).join(", "));

const rows = await db.from("bookings").select("access_code, total_price");
console.log("table :", rows.data?.length === 0 ? "0 rows — blocked OK" : "LEAKED");
' A3F72C9B
```

Expected: `keys : stay_name, stay_location, start_date, end_date, already_checked_in`, and
`table : 0 rows — blocked OK`. **Any additional key — a price, a guest id, a booking id —
means the allow-list was widened and an anonymous scanner now sees more than a door needs
to.**

**The lifecycle job is honest.** ⚠️ The second query must always return 0 rows: a
`checked_in` booking whose departure day has passed means the job is not running.

```sql
select * from public.advance_booking_lifecycle();

select id, start_date, end_date, status
from public.bookings
where status = 'checked_in'
  and end_date <= (now() at time zone 'Asia/Makassar')::date;
-- 0 rows
```

**Nothing but a guest can write `checked_in`.** This is the invariant that keeps `status`
a record rather than a derivation — the job in `0013` is forbidden from inferring an
arrival from the calendar. Confirm by reading its source; if `advance_booking_lifecycle`
ever contains the string `'checked_in'` on the *right* of a `set`, that rule has been
broken:

```sql
select prosrc ~ 'set status = ''checked_in''' as job_fakes_arrivals
from pg_proc
where proname = 'advance_booking_lifecycle';
-- job_fakes_arrivals = f
```

---

## Notes

### One villa photo has to stay in the repo

`public/villas/villa4/minimalist-coastal-interior-with-arched-window-built-seating.jpg`
is used in **two** places:

1. The `coastal-arch-retreat` gallery (Tier 3 → moving to Supabase), and
2. [`features/spa/components/spa-relaxation-section.tsx`](../features/spa/components/spa-relaxation-section.tsx) (Tier 2 → stays in the repo).

The script uploads it for the gallery's sake, but when `public/villas/` gets
cleaned up later, **this file must be moved** to `public/marketing/spa/`
first, not deleted along with the rest.

### Why `width` / `height` are stored in the DB

A static import gives Next dimensions + a blurDataURL for free at build time.
A remote URL gives it nothing. Without those two columns, `<Image>` loses its
layout-space reservation and CLS comes back — the same reason `blur_data_url`
has to be generated at upload time, not at render time.

### Why `storage_path`, not a full URL

The public URL is assembled from `NEXT_PUBLIC_SUPABASE_URL` at read time.
Changing project or region then becomes an env-var change, not a data migration.

### Why the bucket is public

Villa photos are meant to be seen by anyone. A signed URL would kill CDN
caching, since the URL changes on every request.

---

## What's next

Everything that was listed here as "next" is **done**: the `AppImage` seam, the
`types.ts` / `api.ts` split, the Supabase queries, `images.remotePatterns`, the
"by boat" card removal, and deleting `public/villas/`.

> The blow-by-blow of that migration lives in `DATA-LAYER.md`, which is a local
> working document and deliberately gitignored — so it is not in a fresh clone.
> **`ADMIN-PANEL-CONTEXT.md` is no longer in this repo either.** It was written
> for the admin panel's codebase, whose readers are explicitly assumed to have no
> access to this one, so keeping a copy here worked against its own purpose — it
> was untracked and now lives in that repository. The references that remain —
> here, in `GUEST_PLANNING_TABLE.md`, in `0009_bookings.sql` and in
> `stay-card.tsx` — name it as the source of a decision, not as a link you can
> open from a fresh clone.
> Its last version here is recoverable with
> `git show <the untracking commit>~1:ADMIN-PANEL-CONTEXT.md`.

What genuinely remains:

1. **On-demand revalidation.** The catalogue is cached with a 1-hour floor and
   tagged `stays`, but nothing invalidates that tag yet — so an edit takes up to
   an hour to reach visitors. Closing that gap means a Route Handler calling
   `revalidateTag("stays", "max")`, triggered by a Supabase Database Webhook.
   Rationale and the security contract are in
   [`../ADMIN-PANEL-CONTEXT.md`](../ADMIN-PANEL-CONTEXT.md).
2. **`_legacy/` still breaks `next build`.** Nine TypeScript errors there fail
   the build after it compiles cleanly, which means the app cannot deploy as-is.
   Nothing imports `_legacy/` any more, so deleting it turns the build green.
3. **`reviews.booking_id`, and only then "verified".** Nothing links a review to the stay
   behind it, so there is still no way to tell a review by someone who actually stayed from
   one that was simply typed. The migration is small — one nullable column plus the composite
   foreign key in `GUEST_PLANNING_TABLE.md` §3, whose target (`bookings_id_guest_stay_key`)
   `0009` already created. As of step 21 a `checked_out` booking is a fact somebody's arrival
   produced rather than a value nothing maintains, so "did this person actually stay" finally
   has an answer worth joining to.
4. **Cancelling a booking.** The refund policy is written down
   (`features/booking/README.md` §11) and the `cancelled` status has existed since `0009`,
   but a guest cannot trigger it. It is its own phase: a refund rule is a decision, not a
   button.

> **Steps 15–21 closed the two items that used to sit here.** Bookings are read and written
> by the application now — see `features/booking/README.md` for the whole path. One rule from
> that era still holds and is easy to break by accident: a query for somebody's own bookings
> **must not** go through `lib/supabase.ts`. That client is for the public catalogue; a
> per-guest query cached under a shared tag is one visitor's reservations served to the next.
> `features/booking/actions.ts` uses the session-bound client with no `use cache` for exactly
> that reason.
