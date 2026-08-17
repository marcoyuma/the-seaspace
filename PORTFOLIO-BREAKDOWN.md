# The Seaspace — Portfolio Breakdown

This document is written for one reader: someone deciding whether to hire the person who
built this. It is not a README — it explains *why* the codebase looks the way it does, with
citations to the actual files, functions and comments that back each claim. Nothing here is
invented; where a claim can't be traced to a specific file or migration, it isn't made.

## 1. What this project is

The Seaspace is a fictional private-villa resort. The app is the guest-facing site: browse a
catalogue of villas, check live availability on a calendar, book a stay with a simulated
payment, receive a QR/door-code credential, and self check in — no front desk in the loop.
Guests also have accounts, leave reviews, and can request golf tee times, spa treatments, or
event-venue enquiries through a simulated request flow.

It's a solo learning project with no real client, built specifically to practice defending
architectural decisions rather than to hit a deadline — which is why the codebase carries an
unusual amount of "why", not just "what": migration files and feature READMEs record decisions
that were considered and rejected, not only the ones that were kept.

A companion admin panel (staff catalogue management, `public.staff` RLS access) exists as a
**separate repository** and is out of scope here; this repo only exposes the read/write
surface that repo is allowed to touch (see `supabase/migrations/0014_admin_staff_access.sql`,
`0015_staff_catalog_writes.sql`).

## 2. Tech stack, and why each piece is here

| Choice | Why (with evidence) |
|---|---|
| **Next.js 16.2.3**, App Router | `cacheComponents: true` in `next.config.ts` is used deliberately, not left at a default — the comment explains it lets `<Suspense>` become a real boundary around a session read in the header, without making the whole `/stays/[stayId]` route dynamic and killing `generateStaticParams()`. `proxy.ts` (Next 16's rename of `middleware.ts`) is used for the one thing only it can do: rotate a Supabase session cookie. |
| **React 19.2.4** | Ships with Next 16; `useSyncExternalStore` is used directly (not a library) in `features/booking/components/booking-panel.tsx`'s `useToday()` to solve a prerendering/hydration clock mismatch — see §6. |
| **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`), no ORM | Deliberately rejected an ORM. See §4. |
| **Tailwind v4** | Config lives in the CSS `@theme` block, not a JS config file — a v4-native choice reflected in `ARCHITECTURE.md`'s note about `_legacy/` components using undefined `primary-*`/`accent-*` tokens because they predate the v4 migration. |
| **Leaflet / react-leaflet**, CARTO tiles | `stay-map-canvas.tsx` picked CARTO over Google specifically because it needs no API key, account or billing — and `STAYS-INPUT-DECISIONS.md` reuses that exact reasoning to justify Nominatim over a paid geocoder for the admin panel's location picker, showing the constraint was applied consistently across two different decisions. |
| **`sharp`** | Not a default — added specifically for avatar re-encoding (see §5's EXIF discussion), justified in `features/account/README.md` as "the library Next itself recommends for self-hosted Image Optimization," a path the project already uses. |
| **`qrcode`** | Server-side only, rendered to inline SVG in `features/booking/lib/qr.ts` — no client-side encoder, no image request. Error correction is set to `M` instead of the default `L` because, per the code comment, the QR "gets scanned off a phone screen in a doorway at night, at an angle, with a fingerprint across it." |
| No test framework, no CI | Honest gap, not hidden. Verification is manual: SQL/curl probes documented in `supabase/README.md` (blocks A–M) and in each feature README's "Verification" section. Worth naming directly in an interview — see §7. |

## 3. Architecture & design patterns

**Feature-based structure**, not layer-based: `app/` is routing only, `features/*` each own
their components, actions and (where relevant) domain logic, `ui/` holds feature-agnostic
primitives, `lib/` holds domain-free helpers. `ARCHITECTURE.md` states the boundary rule
plainly — "a feature owns the components that render its domain objects, regardless of which
page displays them" — and backs it with a concrete example: `StaysPreviewSection` renders on
the landing page but lives in `features/stays/` because it renders `Stay` objects, not because
of where it's shown. The document also states, and a repo-wide grep can verify, that there are
currently **zero feature-to-feature imports** — composition happens one level up, in
`app/*/page.tsx`.

**`AppImage` as a seam between two image sources.** `features/stays/types.ts` defines:

```ts
export interface AppImage {
    src: string | StaticImageData;
    alt: string;
    blurDataURL?: string;
    width?: number;
    height?: number;
}
```

The doc comment explains the actual problem: a static `import img from "@/public/..."` becomes
a `StaticImageData` object at build time, but a Supabase Storage photo is only ever a URL
string — `StaticImageData` can't represent it. `AppImage` accepts both, so every render
component that takes an image prop is indifferent to whether the photo lives in `public/` or
in Supabase Storage. This is the concrete artifact of a staged migration (local catalogue →
Supabase-backed catalogue) that didn't require touching every component that renders a photo.

**Three Supabase clients, split by privilege and cache behavior**, not one client reused
everywhere:

| Client (`lib/*.ts`) | Session | Cached | Used for |
|---|---|---|---|
| `supabase.ts` → `supabase` | none | per-function `use cache` | Public catalogue reads (stays, reviews) |
| `supabase-server.ts` → `createClient()` | caller's cookies | never | Server Components, Server Actions, `proxy.ts` |
| `supabase-browser.ts` → `createClient()` | browser cookies | never | Client Components |
| `supabase-admin.ts` → `createAdminClient()` | service role | never | Server-only, bypasses RLS |

The server client is explicitly **not** a module singleton, because `cookies()` differs per
request — a shared instance would leak one visitor's session to the next. This is the kind of
mistake that's easy to make with Supabase in the App Router and easy to miss in review; making
it structurally impossible (a factory function, not a shared client) is the actual fix.

**Security lives in Postgres, not in application code.** RLS policies, `SECURITY DEFINER`
functions with `set search_path = ''`, and a GiST exclusion constraint do the enforcement —
detailed with citations in §4. This is also the reasoning behind rejecting an ORM (§4) and
behind the repo's one written rule about invented schema data: nothing is represented as a
boolean flag if it can instead be derived from a real relationship (e.g. review verification —
see §4's closing paragraph).

## 4. Best practices, with concrete evidence

**RLS proves *who*; a `SECURITY DEFINER` function's parameter list proves *what*.**
`supabase/migrations/0009_bookings.sql` states the rule explicitly: *"No `anon` policy exists,
and none may be added"* on `public.bookings`, because a `SELECT` policy would let the anon key
(shipped to every browser) read price, guest notes, and guest ids straight off the table —
PostgREST has no column allow-list to fall back on.

For writes, `0011_booking_writes.sql` documents rejecting the obvious-looking fix — an `INSERT`
policy with `with check (auth.uid() = guest_id)` — with a specific argument: *"RLS authorises
rows, not values. The policy proves who is booking. Nothing in it can check what they
wrote."* A guest holding a valid session could still `POST /rest/v1/bookings` with
`unit_price_per_night = 1`. So writes go through `create_booking()`, a `SECURITY DEFINER`
function whose **parameter list is the allow-list** — price and the door access code are never
parameters; both are computed inside the function, where the caller can't touch them.
`set search_path = ''` is called out in the same file as mandatory, not tidy: on a definer
function, an unqualified table name could otherwise resolve to a table the caller planted in
their own schema and execute with the function owner's privileges.

**A concurrency bug was found, documented, and fixed at the schema level — with the discarded
decision left in the code as a comment.** `0009_bookings.sql` §3 originally declined a
GiST exclusion constraint against overlapping bookings, reasoning that overlap was already
prevented "at the input path." `0011_booking_writes.sql` reverses that decision once writes
actually existed, in writing:

```sql
alter table public.bookings add constraint bookings_no_overlap
    exclude using gist (
        stay_id                                    with =,
        daterange(start_date, end_date, '[)')      with &&
    ) where (status <> 'cancelled');
```

This required `btree_gist` (GiST has no built-in equality operator class for a `bigint`). Two
guests submitting the same nights concurrently now produce one committed row and one Postgres
error code `23P01`, which `server-actions.ts` turns into a plain sentence. This is the single
strongest piece of evidence in the repo of a decision being revisited under new information
rather than defended for consistency's sake.

**Generated columns instead of computing derived values at multiple call sites.**
`bookings.num_nights` and `bookings.total_price` are `generated always as (...) stored`
columns. `total_price` re-derives the night count rather than referencing `num_nights` because,
per the migration's own comment, "Postgres forbids a generated column from reading another
generated column" — a real Postgres limitation worked around explicitly, not silently.

**EXIF/GPS stripping on avatar upload is mandatory and enforced server-side, with a specific
cited incident as the reasoning.** `features/account/README.md` cites a real 2012 case (John
McAfee located via EXIF GPS data in a published photo) to justify stripping metadata, and a
real CVE-class advisory (label-studio, GHSA-q68h-xwq5-mm7x) for why uploaded bytes can't be
trusted even as an image. `uploadAvatar` re-encodes every upload through `sharp`; a file
`sharp` can't decode is rejected outright — used as the actual MIME check instead of trusting a
`Content-Type` header — and the re-encoded WebP output carries no EXIF forward, because `sharp`
only copies metadata when `.withMetadata()` is explicitly called. The document is also precise
about the one exception: OAuth-copied avatars skip stripping, because those bytes were already
re-encoded by the provider's CDN and are already public at the provider's own URL — a
distinction the document takes care to argue rather than blur.

**No invented schema flags for derived concepts.** Review "verification" is not a boolean
column. It's defined structurally: a review counts as verified when `reviews.booking_id is not
null`, derived from a real foreign-key relationship rather than a hand-maintained flag that
could drift from reality. The composite unique key `bookings_id_guest_stay_key` was added
preemptively in `0009` specifically to be the future target of that foreign key.

## 5. Trade-offs and their consequences

**Payment is simulated — deliberately, and the reasoning is written down as a comparison
table**, not asserted. `features/booking/lib/payment-gateway.ts`'s top-of-file comment weighs
three real options against the chosen one:

| Option | Why not |
|---|---|
| Stripe Checkout (test mode) | Needs a webhook, a signing secret, and a tunnel for local dev — "a demo whose bookings silently stop completing whenever the webhook is not running is a worse portfolio piece than an honest simulation" |
| Midtrans Snap sandbox | Same operational weight as Stripe, fits the rupiah pricing, fiddlier sandbox |
| A card form accepting test numbers | "A demo site that asks for a card number will eventually be given a real one" |
| **A simulated provider with a real provider's shape** | Chosen |

The consequence that matters: what's kept is the *shape* a real provider imposes — the booking
is written before the charge (so the exclusion constraint holds the dates during the payment
round-trip), the call has an artificial delay and a genuine decline path, success returns an
opaque `DEMO-…` reference, and settlement is a separate step (`settle_booking_payment()`). The
file's own comment states the swap cost precisely: replacing `chargeDemoPayment()` with a real
`PaymentIntent` call and moving `settle_booking_payment()` into a webhook route — "nothing else
in the flow changes shape." The same pattern is reused verbatim in
`features/experience-requests/lib/email-gateway.ts`, whose comment explicitly cross-references
the payment gateway's reasoning — evidence this is a deliberate house pattern for faking an
external dependency honestly, not a one-off shortcut.

**Booking-before-payment ordering, and what it costs.** `payAndBook()` inserts the row first
(`status = 'confirmed'`, `paid_at` null), attempts the charge second, then settles or cancels.
The `features/booking/README.md` reasoning: "the row is the lock" — the exclusion constraint
only protects dates once the row exists, so charging first would leave the window open for the
entire provider round-trip. The explicit cost, stated rather than hidden: steps 1–3 aren't one
transaction and can't be, so a process dying mid-flight leaves a `confirmed` booking with
`paid_at` still null. That's rendered honestly as "Payment pending" on the trip page, and
resolved by the hourly `pg_cron` sweeper (`0013_booking_lifecycle_cron.sql`), which cancels
unpaid holds after 30 minutes and releases the dates.

**No ORM, and the reasoning is architectural rather than aesthetic.** Prisma (or any
connection-string ORM) was considered and rejected for this repo specifically because this
app's security model lives in Postgres: per-table RLS, `SECURITY DEFINER` functions, the
anti-overlap exclusion constraint. A connection-string ORM connects as a privileged user with
no JWT, so `auth.uid()` is null inside every query it runs — every RLS policy stops being a
guard, and enforcement would fall back into application code, which is exactly the downgrade
the RLS/RPC design in §4 was built to avoid. (The admin panel — a separate repository that
already uses the service role key and bypasses RLS by design — is a legitimate place for an
ORM; this repo isn't.)

**Two clocks, kept from drifting apart on purpose.** The stay detail page is statically
prerendered (`generateStaticParams()` runs at build time), so `new Date()` on the client would
freeze "today" at build time and disagree with the browser's actual clock. `useToday()` uses
`useSyncExternalStore` with a `null` server snapshot — the one hook allowed to differ between
server and client — to solve it invisibly (the modal starts closed, so `null` never renders).
On the server, three separate database functions (`create_booking`, `check_in_booking`,
`advance_booking_lifecycle`) all compare against `(now() at time zone 'Asia/Makassar')::date`
rather than Vercel's UTC clock, because a guest in Jakarta booking at 07:00 local time would
otherwise be told the day had already started.

## 6. Technical challenges solved

**Adopting Next.js 16's Cache Components mid-project**, specifically to keep a session-aware
header without making the whole app dynamic. `next.config.ts`'s comment and
`features/auth/README.md`'s "Rendering" section both explain the mechanism: without
`cacheComponents: true`, a single `cookies()` read anywhere in the tree makes the *entire
route* dynamic, at route granularity, not component granularity — which would have killed
static prerendering on `/stays/[stayId]`. The fix reshapes the component tree: `ui/profile-
icon.tsx` becomes an async Server Component wrapped in `<Suspense>` by `app/layout.tsx`; since
`ui/header.tsx` is a Client Component and can't import an async Server Component directly, the
profile icon is passed in as a `profileSlot` prop instead. A second, subtler consequence is
documented too: with a static shell flushed before the page finishes rendering, a `redirect()`
reached late in a page's render can't be a real HTTP redirect anymore — Next falls back to a
visible one-second `<meta refresh>` stall. That's why auth redirects live in `proxy.ts`
(optimistic, pre-filtering) *and* on the page (authoritative) rather than only on the page.

**Reconciling exclusive-end-date date-range semantics across a calendar UI, a database
constraint, and a plain-language "free cancellation" policy** without re-deriving the same
subtraction in three places. `bookings.end_date` is checkout day, not last night — a stay of
`[Aug 10, Aug 13)` occupies nights 10–12 only. The subtraction from an inclusive UI range to
this exclusive representation happens in exactly one function, `expandBlockedDays()` in
`features/booking/lib/dates.ts`, and every other consumer (the exclusion constraint's
`daterange(..., '[)')`, the calendar's `checkoutOnlyDay` handling of same-day turnover, the
door code's `today >= end_date` check) is built to agree with that single definition rather
than reimplementing it.

**Diagnosing a live SMTP failure with no working error surface**, documented in
`features/auth/README.md`'s "Email delivery: what was tried" section — three mail providers
(Supabase built-in, Brevo, Gmail SMTP) were configured and produced identical unhelpful
`unexpected_failure` errors, including a case where a direct SMTP probe against Gmail succeeded
(`235`, `250`) while Supabase still reported failure. The section documents the actual
diagnostic method (a raw `curl --url smtp://...` probe with `sed`-redacted credentials in the
transcript) and the conclusion: continuing to chase the gap stopped being worth the cost for a
portfolio project, so email confirmation was switched off rather than left half-broken, while
OAuth (GitHub/Google) remained the verified-email path since those providers verify addresses
themselves. This is a documented engineering decision to stop, not an unfinished feature
presented as done.

## 7. Talking points for an interview

- **"Walk me through a security decision you're proud of."** The RLS-vs-RPC split on
  `bookings` (§4) — explain *why* the RLS-only approach looked safe and wasn't (RLS authorizes
  rows, not values), and that the fix is enforced by the type system (a function's return type
  or parameter list), not by a policy someone could accidentally widen later.
- **"Tell me about a bug you found before it shipped."** The overlap-prevention reversal (§4)
  — a decision was made, then explicitly revisited once new information (concurrent writes)
  invalidated the original reasoning, and the reversal is documented in the migration itself
  rather than silently overwriting the old comment.
- **"How do you handle things you can't fully build?"** The simulated payment and email
  gateways (§5) — a considered, written trade-off (a comparison table, not a shrug), a design
  that preserves the real integration's *shape* so swapping providers later is a one-file
  change, and a decline path that's reachable on purpose so failure handling is actually
  exercised.
- **"What would you do differently with more time?"** Automated tests and CI (§2) — currently
  verification is manual (SQL/curl probes per feature), which is honest about the gap rather
  than silent about it, and a natural next investment once the feature set stabilizes.
- **"How do you keep a fast-moving schema honest?"** The no-invented-columns discipline (§4) —
  review verification as `booking_id is not null` instead of a boolean flag is a small example
  of a larger habit: derive from relationships that exist, and say plainly when a guarantee
  isn't enforceable yet instead of adding a flag that pretends it is.
