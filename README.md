# The Seaspace

A guest-facing booking site for a fictional private-villa resort — browse a catalogue,
check live availability, book a stay with a simulated checkout, and self check in with a
QR code or door code. Built as a solo learning project to practice defending real
architectural trade-offs (security-definer functions vs. RLS, database-level concurrency
constraints, honest simulation of external services) rather than to hit a deadline.

For the reasoning behind the decisions below — not just what was built, but why — see
[`PORTFOLIO-BREAKDOWN.md`](./PORTFOLIO-BREAKDOWN.md).

## Tech stack

- **Next.js 16** (App Router, `cacheComponents` enabled) + **React 19**
- **TypeScript**, strict mode
- **Tailwind CSS v4**
- **Supabase** — Postgres, Auth, Storage (no ORM — see [`PORTFOLIO-BREAKDOWN.md` §4](./PORTFOLIO-BREAKDOWN.md#4-best-practices-with-concrete-evidence))
- **GSAP** + **Motion** — scroll and interaction animation
- **Leaflet** / **react-leaflet** — the stay-location map (CARTO tiles, no API key)
- **`qrcode`** — server-rendered check-in QR codes
- **`sharp`** — avatar re-encoding (EXIF stripping)
- Package manager: **pnpm**

## Features

- **Villa catalogue** — browse and filter stays, served from Supabase (Postgres + Storage), cached and revalidated per-catalogue-tag
- **Availability calendar & booking** — a live per-villa calendar, checkout with guest counts and pricing, all guarded by a database-level anti-overlap constraint so two guests can never double-book the same nights
- **Simulated checkout** — a payment flow shaped like a real provider (delay, decline path, opaque reference, separate settlement step) with no real money movement, documented as a deliberate trade-off
- **Self check-in** — a QR code and an 8-character door code, either of which opens the villa; an hourly job closes finished stays, releases abandoned unpaid holds, and marks no-shows
- **Guest accounts** — email/password or GitHub/Google OAuth sign-in, profile editing, avatar upload
- **Reviews** — structurally tied to a real completed booking rather than a hand-set "verified" flag
- **Experience requests** — a simulated enquiry flow for golf tee times, spa treatments, and event-venue bookings (intentionally *not* a real reservation — see the feature's own README)

## Folder structure

```
app/            Routing only — route groups (auth), (experiences), (stay-list); pages compose features
features/       Product features, each owning its components, actions, and (where relevant) domain logic
  account/      Profile + avatar
  auth/         Sign-in, sessions, OAuth
  booking/      Availability, checkout, arrival, lifecycle
  experience-requests/  Tee-time / spa / event-venue enquiries
  home/         Landing page sections
  marketing/    Spa / golf-course / event-venue content
  reviews/      Review carousel and cards
  services/     Amenities & services catalogue
  stays/        Villa catalogue, detail page, map
ui/             Shared, domain-free UI primitives (header, footer, modal, buttons...)
lib/            Domain-free helpers — Supabase clients (split by privilege/cache behavior), formatting
supabase/       SQL migrations, seed data, and the setup/verification runbook
scripts/        One-off Node scripts (e.g. seeding demo accounts)
public/         Static brand and marketing imagery (villa photos live in Supabase Storage)
proxy.ts        Next 16's middleware equivalent — session cookie refresh + optimistic auth redirects
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full boundary rules this structure follows.

## Getting started

### Prerequisites

- Node.js and [pnpm](https://pnpm.io)
- A [Supabase](https://supabase.com) project (the nearest region used during development was Singapore)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create `.env.local` in the repo root:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SEED_ACCOUNT_PASSWORD=
STAYS_REVALIDATE_SECRET=
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` come from your Supabase
project's API settings and are required just to build the app (the public catalogue client
fails fast at module load if either is missing). `SUPABASE_SERVICE_ROLE_KEY` and
`SEED_ACCOUNT_PASSWORD` are only needed if you run the demo account seed script.
`STAYS_REVALIDATE_SECRET` is only needed if you wire up the catalogue-revalidation webhook.

### 3. Set up the database

The database is not managed through this repo's code — every migration is applied by hand
through the Supabase Dashboard's SQL Editor, in order. **Follow
[`supabase/README.md`](./supabase/README.md) — it's a full runbook**, including which
dashboard settings need to be toggled first (email confirmation must be switched off, since
this project has no working mail sender) and how to seed demo data and accounts.

### 4. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
pnpm build   # production build
pnpm start   # run the production build
pnpm lint    # eslint
```

## Testing

There is no automated test suite in this repo yet — that's a known, stated gap rather than
an oversight (see [`PORTFOLIO-BREAKDOWN.md` §2](./PORTFOLIO-BREAKDOWN.md#2-tech-stack-and-why-each-piece-is-here)).
Verification is currently manual: `supabase/README.md` has runnable SQL and `curl` probes
covering RLS policies, storage policies, the booking overlap constraint, and the
revalidation webhook, and each feature's own README (`features/auth/README.md`,
`features/booking/README.md`, `features/account/README.md`) has its own "Verification"
section with the exact steps to exercise that feature end to end.

## Screenshots

<!-- TODO: add screenshots of the landing page, the stays catalogue, the booking calendar, and checkout -->

## Deployment

Not yet deployed. The intended target is **Vercel** — deployment details (live URL,
environment configuration) will be added here once it's live.

## License

Solo portfolio project — no license file is included, and no contributions are being
accepted at this time.
