# Supabase — runbook

Database + storage for the **stays** feature. The schema here mirrors the
`Stay` / `StayImage` / `Amenity` types in [`features/stays/data.ts`](../features/stays/data.ts),
minus `ferryUrl` (dropped) and with nested objects flattened into columns.

> **Scope of this phase:** get the database ready and verified, **without**
> touching application code. Once every step below is green, the site still
> runs off the dummy array in `data.ts` — exactly as before. Swapping the data
> source is the next piece of work (see [What's next](#whats-next)).

## Contents

| File | Role |
|---|---|
| `migrations/0001_stays_schema.sql` | 4 tables, constraints, indexes, RLS |
| `migrations/0002_storage_bucket.sql` | `stays` bucket (public) + policy |
| `seed/0001_stays_seed.sql` | 4 villas, 17 amenities, 35 relation rows |
| `migrations/0003_drop_cabins.sql` | ⚠️ Destructive — run last |
| `../scripts/upload-stays-images.mts` | Compress → blur → upload → fill `stay_images` |

All four SQL files are **idempotent** — safe to re-run.

---

## Setup

1. Create a project at [supabase.com](https://supabase.com) (nearest region: Singapore).
2. Fill in `.env.local` at the repo root. Three variables; where to find each
   value is explained in that file's own comments. This file is gitignored —
   **never** commit it.
3. Make sure dependencies are installed: `pnpm install`.

---

## Execution order

### 1–3. SQL

Open **Dashboard → SQL Editor → New query**, paste the file's contents,
**Run**. One file per run, in order:

1. `migrations/0001_stays_schema.sql`
2. `migrations/0002_storage_bucket.sql`
3. `seed/0001_stays_seed.sql` → its last line should print `4 | 17 | 6 | 35`

> If step 2 fails with `must be owner of table objects`, just skip the policy
> block. A `public` bucket is already enough to read images; that policy only
> widens `list` access.

### 4. Compress photos (dry run)

```bash
pnpm stays:images -- --dry-run
```

Doesn't touch the network. Writes the WebP output to a temp directory and
prints a size comparison. Expected result:

```
21 images: 75286 KB → 6089 KB (92% smaller)
```

Open a few of the output files and check the quality still holds up. If it's
too soft, raise `WEBP_QUALITY` in the script.

### 5. Upload

```bash
pnpm stays:images
```

Uploads 21 images to the `stays` bucket and fills in `stay_images`, including
`width`, `height`, and `blur_data_url`.

### 6. Verify

Run **every** block below. All of them must pass before step 7.

### 7. Drop the old table

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

Should match `data.ts`: `3500000`, `6`, `3`, `220`, `true`, `Superking`,
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

The 11 errors in `_legacy/` are a pre-existing red baseline from before this
work — see `ARCHITECTURE.md`. Judge this differentially, not absolutely.

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

Not part of this phase. The sequence after this, just for context:

1. `lib/image.ts` seam — the `AppImage` type + `imageProps()` helper
2. Split `features/stays/data.ts` → `types.ts` / `data.ts` / `api.ts`
3. `api.ts` queries Supabase (no render component needs to change)
4. `images.remotePatterns` in `next.config.ts` — **not** a custom `loader`,
   which is global and would hijack `public/` assets that are still Tier 1 & 2
5. Remove the "by boat" card in `stay-location-section.tsx` (a consequence of dropping `ferryUrl`)
6. Remove `public/villas/` — except for the spa file above
