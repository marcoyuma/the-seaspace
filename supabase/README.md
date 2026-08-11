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

All nine SQL files are **idempotent** — safe to re-run.

---

## Setup

1. Create a project at [supabase.com](https://supabase.com) (nearest region: Singapore).
2. Fill in `.env.local` at the repo root. Four variables; where to find each
   value is explained in that file's own comments. This file is gitignored —
   **never** commit it.
3. **Dashboard → Authentication → Providers → Email: switch "Confirm email"
   OFF.** Development-only. The signup trigger in `0006` keys on
   `email_confirmed_at`; with confirmation off Supabase stamps it immediately,
   so the seeded `@example.com` accounts link straight away without any real
   mailbox. Leave it on and step 7 below creates 62 accounts and **zero**
   `guests` rows.
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

### 6–8. Guest identity and accounts

**The script in the middle is not optional, and the order is not negotiable.**
`0007` backfills `reviews.guest_id` from accounts that only exist after step 7,
and it raises `Backfill incomplete` rather than half-migrating if you skip it.

6. `migrations/0006_guests.sql` → prints `0` (no accounts yet)
7. `node --env-file=.env.local scripts/create-seed-accounts.mjs`
   → `created: 62   skipped: 0   failed: 0`, then
   `public.guests now holds 62 rows`.
   Re-running prints `created: 0   skipped: 62`.
8. `migrations/0007_reviews_guest_id.sql` → prints `100 | 0 | 62`

> `public.guests` filling up during step 7 without the script ever writing to it
> **is** the proof that the trigger works — the script only touches
> `auth.admin`.

> Step 7 needs `SUPABASE_SERVICE_ROLE_KEY` and `SEED_ACCOUNT_PASSWORD` in
> `.env.local`. It reads the 62 authors out of `public.reviews` rather than from
> a retyped list, so it must run while `reviews.guest_ref` still exists — that
> is, before step 8, which drops it.

### 9–10. Photo upload — historical, already done

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

### 11. Verify

Run **every** block below. All of them must pass before step 12.

### 12. Drop the old table

Only after verification passes:

- `migrations/0003_drop_cabins.sql` — **export a CSV of `cabins` first**, there's no undo.

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
> `ADMIN-PANEL-CONTEXT.md`, next to this file's parent, **is** committed and
> carries everything an external consumer of this database needs.

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
