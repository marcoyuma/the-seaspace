import { createClient } from "@supabase/supabase-js";

/**
 * Read-only Supabase client for the public site.
 *
 * Domain-free on purpose: this module knows how to reach Supabase and how long to cache,
 * nothing about stays. Feature-specific queries live in the feature that owns them
 * (see features/stays/api.ts).
 */

// Static property access, not process.env[name]. Next only inlines NEXT_PUBLIC_* when it
// can see the literal key at build time — a dynamic lookup would silently yield undefined
// if this module were ever pulled into a Client Component.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Fails at module load rather than as a confusing 500 later. generateStaticParams()
    // reaches this at BUILD time, so on Vercel these must be set in Project Settings —
    // .env.local alone is not enough.
    throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
            "Set both in .env.local for local dev and in the Vercel project settings for builds.",
    );
}

// The dashboard also hands out a REST endpoint URL (…/rest/v1/). supabase-js appends its
// own paths, so a pasted REST URL throws PGRST125 — loud and easy to catch. The same
// mistake in a storage URL fails *silently*, producing broken images with no error at all.
// Normalising once here closes both.
const SUPABASE_ORIGIN = new URL(SUPABASE_URL).origin;

/** Cache tag for everything in the stays catalogue: rows, photos, amenities. */
export const STAYS_CACHE_TAG = "stays";

/**
 * Cache profile for the catalogue. One hour in production, one second in development.
 *
 * In production the tag above is invalidated on demand by the Supabase Database Webhook
 * that POSTs to app/api/revalidate/stays/route.ts, and the hourly interval is the safety
 * net behind it: pg_net is fire-and-forget, so a webhook that never arrives would
 * otherwise leave the catalogue stale forever.
 *
 * Development gets `seconds` because that webhook cannot reach it. pg_net runs on
 * Supabase's own servers, which have no route to localhost — so with `hours` the only way
 * to see a row added from the admin panel was to restart `next dev`. The default
 * "use cache" handler is an in-memory LRU with no on-disk persistence, so killing the
 * process was the only thing that dropped the entry (see the handler's own `get`: an entry
 * survives until `timestamp + revalidate`, and nothing else evicts it).
 *
 * ⚠️ None of this reaches a page that is already open in someone's browser, and nothing is
 * planned that will. Invalidating the tag only guarantees the NEXT request renders fresh;
 * an open tab keeps what it has until the visitor reloads or navigates. That was decided
 * deliberately on 2026-08-16 — a villa catalogue changes a few times a week, and the
 * freshness that actually carries risk is enforced where it belongs instead: create_booking()
 * re-reads price, discount and capacity at payment time rather than trusting the page.
 * Do not add polling, refresh-on-focus or Realtime here without revisiting that decision.
 */
export const STAYS_CACHE_PROFILE =
    process.env.NODE_ENV === "development" ? "seconds" : "hours";

/**
 * Cache tag for reviews: the rows themselves and every aggregate over them.
 *
 * Separate from STAYS_CACHE_TAG because reviews now have a write path of their own
 * (features/reviews/server-actions.ts). Review readers tag BOTH, so the catalogue webhook
 * from 0017 keeps clearing them exactly as it did before, while a guest posting a review
 * can invalidate just this — rather than dropping the whole four-villa catalogue, which is
 * cached for an hour and did not change.
 *
 * No profile of its own: reviews are catalogue-shaped data, so they ride on
 * STAYS_CACHE_PROFILE. What makes a new review appear immediately is `updateTag`, not a
 * short interval.
 */
export const REVIEWS_CACHE_TAG = "reviews";

/** Cache tag for availability. Callers add a per-slug tag alongside it. */
export const BOOKINGS_CACHE_TAG = "bookings";

/**
 * Cache profile for availability: minutes, not hours.
 *
 * The catalogue can be an hour stale with no consequence — a villa's photos do not
 * change. Availability can: a stale calendar offers dates that were taken while the
 * page sat in the cache, and the guest finds out only at checkout. Minutes is the
 * shortest interval that still spares the database a query per render.
 *
 * This never caches anything guest-specific. Only booked date ranges pass through it,
 * via the get_stay_booked_ranges RPC (supabase/migrations/0010_stay_availability.sql) —
 * never the bookings rows themselves, which are per-guest and must not be shared.
 */
export const BOOKINGS_CACHE_PROFILE = "minutes";

/**
 * Anonymous, session-free client for the public catalogue.
 *
 * Caching is NOT attached here. It used to be, via a `global.fetch` override that forced
 * `next: { revalidate, tags }` onto every request — which meant any authenticated query
 * borrowing this client would have its response cached and served to the next visitor.
 * Under Cache Components the policy lives at the function level instead (`use cache` +
 * `cacheTag` + `cacheLife` in each feature's actions.ts), so that hazard is gone by
 * construction rather than by remembering to avoid it.
 *
 * Auth uses its own clients — see lib/supabase-server.ts and lib/supabase-browser.ts.
 */
export const supabase = createClient(SUPABASE_ORIGIN, SUPABASE_ANON_KEY, {
    // Server-side only; there is no browser session to persist and no user to refresh.
    auth: { persistSession: false },
});

/**
 * Builds the URL for an object in a public bucket.
 *
 * Rows store a bucket-relative path rather than a full URL, so moving projects or regions
 * is an env change instead of a data migration. Public buckets serve this path directly,
 * with no round-trip needed to mint it.
 */
export function publicStorageUrl(bucket: string, path: string): string {
    return `${SUPABASE_ORIGIN}/storage/v1/object/public/${bucket}/${path}`;
}
