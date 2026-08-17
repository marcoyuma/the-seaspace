import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { STAYS_CACHE_TAG } from "@/lib/supabase";

/**
 * On-demand revalidation for the stays catalogue.
 *
 * Called by the Supabase Database Webhook installed in
 * supabase/migrations/0017_stays_revalidate_webhook.sql, which fires on every write to
 * `stays`, `stay_images`, `amenities` and `stay_amenities`.
 *
 * A Route Handler rather than a Server Action: the caller is another application over
 * plain HTTP, and `updateTag` — the read-your-own-writes counterpart — may only be called
 * from a Server Action in this same app.
 *
 * The trigger lives in the database rather than in the admin panel on purpose, so a row
 * corrected by hand in the SQL Editor invalidates the cache just as a save from the admin
 * panel does. A call made by the admin panel would only ever catch its own writes.
 *
 * Depends on STAYS_REVALIDATE_SECRET, which must hold the same value as the secret stored
 * in Supabase Vault. Rotating one without the other fails silently — the webhook stops
 * being accepted and the hourly `cacheLife` timer becomes the only refresh again.
 */

/** Header the webhook carries its shared secret in. Mirrored in the migration. */
const SECRET_HEADER = "x-revalidate-secret";

/**
 * Constant-time compare that tolerates a length mismatch.
 *
 * `timingSafeEqual` throws when the buffers differ in length, and letting that throw would
 * leak the secret's length through the difference between a 401 and a 500.
 */
function secretMatches(provided: string, expected: string): boolean {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
    const expected = process.env.STAYS_REVALIDATE_SECRET;

    // A missing secret is a misconfigured deployment, not an unauthorized caller. Failing
    // closed and loudly, because the alternative — treating "no secret" as "no check" —
    // would leave the endpoint open to anyone who found the path.
    if (!expected) {
        console.error(
            "STAYS_REVALIDATE_SECRET is not set; refusing to revalidate. " +
                "Set it in .env.local and in the Vercel project settings.",
        );
        return Response.json({ revalidated: false }, { status: 500 });
    }

    const provided = request.headers.get(SECRET_HEADER);

    if (!provided || !secretMatches(provided, expected)) {
        // No reason in the body: the caller is a machine that cannot act on one, and
        // distinguishing "missing" from "wrong" tells a prober which half to work on.
        return Response.json({ revalidated: false }, { status: 401 });
    }

    // `{ expire: 0 }` rather than the "max" profile: "max" is stale-while-revalidate, so
    // the first page load after an admin saves would still show the old catalogue and only
    // the second would be fresh — the exact confusion this endpoint exists to remove.
    // Expiring outright costs one blocking query (~113 ms) on the next visit instead.
    //
    // One tag covers the whole catalogue: rows, photos and amenities all carry it, and so
    // do the review queries in features/reviews/actions.ts.
    revalidateTag(STAYS_CACHE_TAG, { expire: 0 });

    // Echoed back so the outcome is visible from the database side, where pg_net records
    // every response in net._http_response.
    return Response.json({ revalidated: true, now: Date.now() });
}
