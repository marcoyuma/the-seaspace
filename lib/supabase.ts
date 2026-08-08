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
 * Time-based floor for catalogue freshness.
 *
 * The tag above is not invalidated by anything yet — on-demand revalidation from a Supabase
 * Database Webhook is a separate phase. Until then this interval is the only refresh
 * mechanism, and it stays as the safety net afterwards: pg_net is fire-and-forget, so a
 * webhook that never arrives would otherwise leave the catalogue stale forever.
 */
export const STAYS_REVALIDATE_SECONDS = 3600;

export const supabase = createClient(SUPABASE_ORIGIN, SUPABASE_ANON_KEY, {
    // Server-side only; there is no browser session to persist and no user to refresh.
    auth: { persistSession: false },
    global: {
        // supabase-js has no cache options of its own, so the caching policy is attached
        // here where every query passes through. Only GET requests are cached by Next —
        // PostgREST selects are GET, but an .rpc() call would be POST and opt out.
        fetch: (input, init) =>
            fetch(input, {
                ...init,
                next: {
                    revalidate: STAYS_REVALIDATE_SECONDS,
                    tags: [STAYS_CACHE_TAG],
                },
            }),
    },
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
