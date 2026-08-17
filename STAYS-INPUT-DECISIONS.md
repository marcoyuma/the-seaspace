# Stays catalogue input decisions

> Reference for **both** repos: this customer site and the admin panel. Written after a review
> of four `stays` fields that were filled by hand in the admin panel with no validation tying
> them to anything real. Decided and confirmed with the project owner on 2026-08-16.
>
> This file records *why* each decision was made. `ADMIN-PANEL-CONTEXT.md` (this repo, root,
> gitignored) carries the resulting schema contract and the step-by-step "how" for the admin
> panel — read that alongside this one, not instead of it.

## Why this exists

Four columns on `public.stays` were typed by hand in the admin panel, and each had a concrete
failure mode:

1. **`slug`** — a plain text input. Two villas with the same derived slug produced a generic
   Postgres unique-violation error with no specific message, and the insert was silently rolled
   back.
2. **`lat` / `lng`** — typed as raw numbers next to a `location` text field that already named
   the city/region, with nothing connecting the two. A typo in either produced a map pin in the
   wrong place — and the customer map renders at zoom 18 (street level), so a bad pin is
   immediately visible.
3. **`bed_type_label` / `bed_type_note` / `capacity_label`** — free text, never checked against
   the real `capacity` number. `capacity_label` could read "4 adults and 2 children" while
   `capacity = 2`; the booking guest-stepper would still cap at 2, so the detail page's own text
   contradicted the booking flow on the same page.
4. **`airport_code` / `airport_city`** — every villa in the catalogue hardcoded the same
   `'DPS'` / `'Denpasar'` pair. There was no lookup table, and no villa had ever used a
   different value — the columns carried no real per-villa information.

## Decisions

### 1. `slug` — auto-derive from `name`, suffix on conflict, lock after publish

**Decision:** the admin panel no longer exposes a free-text slug input. Slug is derived from
`name` (lowercased, spaces → `-`, anything outside `[a-z0-9-]` stripped — matching the DB's own
`stays_slug_format` check). Before insert, the admin panel checks whether that slug is already
taken; on conflict it appends a numeric suffix: `villa-sunset` → `villa-sunset-2` →
`villa-sunset-3`.

**Why a numeric suffix over the id-prefix approach originally proposed:** prefixing a unique id
in front (`<id>-villa-sunset`) does guarantee uniqueness, but it makes the URL less readable and
the id carries no information about which villa it is. A trailing counter is the pattern most
listing/CMS platforms already use, stays deterministic (re-derivable by re-running the same
check against the database, not random), and keeps the villa name as the readable head of the
URL.

**Why lock after publish:** `ADMIN-PANEL-CONTEXT.md` already warns that changing `slug` changes
a public, possibly search-indexed URL. Auto-generation removes the *typing* risk but not the
*renaming* risk, so the slug field becomes read-only in the edit form once a villa has been
published. Before publish (still in draft), changing `name` may re-run the derivation.

**Scope:** admin panel repo only (its create/edit form). No schema change — `stays_slug_format`
and the `unique` constraint on `stays.slug` (`0001_stays_schema.sql`) already enforce the shape;
this decision only changes how the admin panel avoids hitting them.

### 2. `lat` / `lng` — geocode from a place search, then hand-correct on a pin map

**Decision:** the admin panel adds a location search box backed by the **Nominatim
(OpenStreetMap) Search API** (`nominatim.openstreetmap.org/search`) — free, no API key or
billing account, sending a proper `User-Agent` header and respecting Nominatim's 1
request/second usage policy. Staff type a place, pick a suggested result, and `lat`/`lng`
pre-fill from it. Staff then **drag a pin on a small Leaflet map in the admin form** to correct
the position, because geocoding by place name only returns a city/district centroid — not the
villa's actual location — and the customer-facing map renders at zoom 18, where a
centroid-only pin would visibly miss.

**Why Nominatim over a paid geocoder (e.g. Mapbox):** the customer site's own map
(`stay-map-canvas.tsx`) already chose CARTO tiles over Google specifically because it "needs no
API key, account, or billing." Nominatim is the geocoding counterpart of that same tile stack
and keeps that principle intact for the admin panel too. Mapbox's geocoder is more accurate
out of the box, but the accuracy gap is exactly what the manual pin-drag step already closes —
so it isn't worth trading away the no-key/no-billing property for.

**Why a one-shot "geocode and done" button was rejected:** it would still leave a city-centroid
pin as the final answer, which is the same failure mode this decision exists to fix (typo-level
misses were already "small" wrong; centroid-level misses can be just as visibly wrong on a
street-level map).

**`location` (the text field) is unaffected** — it stays a separate, manually-confirmed field
and still needs the comma format `"{District}, Bali"` that `stay-location-section.tsx` depends
on for its "by car" copy. The place search may suggest a value for it, but the admin panel does
not derive `location` from the geocoding result automatically.

**Scope:** admin panel repo only (its create/edit form gains a search box + mini-map). No
schema change — `lat`/`lng` remain `numeric(9,6)` with the same `-90..90`/`-180..180` range
checks.

### 3. `bed_type_label` / `bed_type_note` / `capacity_label` — dropped, replaced by nothing

**Decision:** all three columns are dropped from `public.stays`
(`0016_stays_drop_unvalidated_fields.sql`, this repo). The stays detail page now renders
`capacity`, `beds`, and `area` directly — three `smallint` columns that already existed, are
already constrained `> 0` by `stays_capacity_pos`, and were already trusted elsewhere (the
listing-grid `StayCard` renders exactly these three numbers today). No new free-text field
replaces the removed ones.

**Why delete instead of validate:** the alternative considered was keeping `capacity_label` but
having the admin panel warn when it doesn't match `capacity`. That was rejected — a warning is
still bypassable, and the two numbers can drift again the moment someone edits one field and
forgets the other. Rendering the same trusted number in one place removes the possibility of
drift entirely, rather than just flagging it after the fact. `bed_type_label`/`bed_type_note`
had no numeric counterpart to fall back to, so they are simply removed rather than replaced —
"Superking" vs "King" wasn't information the booking flow used for anything.

**Code changed in this repo:**
- `supabase/migrations/0016_stays_drop_unvalidated_fields.sql` — drops the three columns (along
  with the two from decision 4).
- `features/stays/types.ts` — `Stay.bedType` and `Stay.capacityLabel` removed.
- `features/stays/actions.ts` — removed from `STAY_SELECT`, `StayRow`, and `toStay()`.
- `features/stays/components/stay-info-section.tsx` — the two-column `SpecField` row (Bed
  type / Capacity text) is now a three-column row: Capacity (`"N Guests"`), Beds, Area
  (`"N m²"`), reusing the existing `SpecField` component with `stay.capacity`/`beds`/`area`.

**Scope:** both repos. This repo's changes are listed above; the admin panel repo should drop
the corresponding form fields for `bed_type_label`, `bed_type_note`, and `capacity_label` — the
columns no longer exist, so any insert/update that still sends them will fail with `column
"bed_type_label" of relation "stays" does not exist`.

### 4. `airport_code` / `airport_city` — dropped, "by air" card becomes generic

**Decision:** both columns are dropped (same migration as decision 3). The "by air"
`TravelOptionCard` in `stay-location-section.tsx` stays on the page, but its copy no longer
names a specific airport or city, and its call-to-action points at a generic Google Flights
search instead of a link built from a per-villa code/city.

**Why keep the card at all, just generic:** the "how to get here" section is still useful with
two options (car, air) even without a personalized airport name — a guest flying in still
benefits from being told a flight option exists and a search link to start from. Removing the
card entirely was considered and rejected only because it throws away a real (if generic) piece
of the "how to get here" story for no benefit — the fix for "this data is fake" is making it
honestly generic, not removing the whole card. If a future villa is genuinely outside the
current island/airport, a real per-villa airport field can be reintroduced then, backed by an
actual lookup rather than a hardcoded pair.

**Code changed in this repo:**
- `supabase/migrations/0016_stays_drop_unvalidated_fields.sql` — drops both columns.
- `features/stays/types.ts` — `Stay.nearestAirport` removed.
- `features/stays/actions.ts` — removed from `STAY_SELECT`, `StayRow`, and `toStay()`.
- `features/stays/components/stay-location-section.tsx` — removed the `nearestAirport`
  destructure and the per-city `flightUrl`; the "by air" card's description and link are now
  static/generic.

**Scope:** both repos. The admin panel repo should drop the `airport_code`/`airport_city` form
fields — see the same column-removal note as decision 3.

## What did *not* change

- `location` (text) is untouched — still required, still needs the `"{District}, Bali"` comma
  format (`stay-location-section.tsx` splits on the comma for its "by car" sentence).
- `capacity`, `beds`, `area` (numbers) are untouched as columns — only *how they're surfaced* on
  the detail page changed (decision 3).
- No RLS policy changes were needed. `0015_staff_catalog_writes.sql`'s insert/update policies on
  `stays` cover whatever columns the table has; dropping columns doesn't require touching them.

## Follow-up work this session did *not* do

- The admin panel repo itself (slug auto-generation UI, Nominatim search box + pin map, dropped
  form fields) — that code lives in a separate repository this session has no access to. This
  document and the updated `ADMIN-PANEL-CONTEXT.md` are its brief.
- `0016_stays_drop_unvalidated_fields.sql` has been written but, like every other migration in
  this repo, is applied by hand via the Supabase SQL editor — it has not been run against the
  live database yet.
