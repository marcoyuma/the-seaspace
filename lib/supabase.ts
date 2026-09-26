import { createClient } from "@supabase/supabase-js";

/**
 * Read-only Supabase client for the public site. Domain-free: it knows how to reach Supabase and
 * how long to cache, not stays — feature queries live in their feature (features/stays/actions.ts).
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

// A pasted REST URL (…/rest/v1/) makes supabase-js throw PGRST125, and silently breaks storage
// image URLs. Normalising to the origin once closes both.
const SUPABASE_ORIGIN = new URL(SUPABASE_URL).origin;

/**
 * Cache tag for the stays catalogue (rows, photos, amenities). Invalidation reaches only the NEXT
 * request; open tabs stay stale by design (2026-08-16) — create_booking() re-checks price and
 * capacity at payment, so don't add polling, refresh-on-focus or Realtime without revisiting that.
 */
export const STAYS_CACHE_TAG = "stays";

/**
 * Catalogue cache life: `hours` in prod, where the stays webhook (api/revalidate/stays) clears the
 * tag and the interval backs up fire-and-forget pg_net; `seconds` in dev, which pg_net can't reach.
 * Only cached readers use it (getStay, getStays, review aggregates); /stays uses uncached `*Fresh`.
 */
export const STAYS_CACHE_PROFILE =
    process.env.NODE_ENV === "development" ? "seconds" : "hours";

/**
 * Cache tag for reviews and their aggregates. Readers tag BOTH this and STAYS_CACHE_TAG, so the
 * catalogue webhook still clears them while a posted review invalidates only this. No profile of
 * its own: reviews ride STAYS_CACHE_PROFILE, and `updateTag` makes a new one appear instantly.
 */
export const REVIEWS_CACHE_TAG = "reviews";

/** Cache tag for availability. Callers add a per-slug tag alongside it. */
export const BOOKINGS_CACHE_TAG = "bookings";

/**
 * Availability cache life: minutes, as a stale calendar offers dates already taken. Only booked
 * date ranges pass through it (get_stay_booked_ranges, migration 0010) — never per-guest rows.
 */
export const BOOKINGS_CACHE_PROFILE = "minutes";

/**
 * Anonymous, session-free client for the public catalogue. Caching is deliberately per function
 * (`use cache` in each feature's actions.ts), never on this client, so an authenticated query
 * borrowing it can't be cached for the next visitor. Auth has its own clients.
 */
export const supabase = createClient(SUPABASE_ORIGIN, SUPABASE_ANON_KEY, {
    // Server-side only; there is no browser session to persist and no user to refresh.
    auth: { persistSession: false },
});

/**
 * Public-bucket object URL. Rows store bucket-relative paths, so moving project or region is an
 * env change, not a data migration.
 */
export function publicStorageUrl(bucket: string, path: string): string {
    return `${SUPABASE_ORIGIN}/storage/v1/object/public/${bucket}/${path}`;
}
