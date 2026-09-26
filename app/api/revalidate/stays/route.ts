import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

import { STAYS_CACHE_TAG } from "@/lib/supabase";

/**
 * On-demand catalogue revalidation, called by 0017's DB webhook (so SQL Editor fixes count too); keeps
 * the prerendered villa page from an hour of staleness. A Route Handler: the caller is external and
 * `updateTag` is Server-Action-only. ⚠️ STAYS_REVALIDATE_SECRET must equal Vault's, or it fails silently.
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

    // `{ expire: 0 }`, not "max": stale-while-revalidate would still show the old catalogue on the
    // first load after a save. Costs one blocking query (~113 ms). The tag also covers review reads.
    revalidateTag(STAYS_CACHE_TAG, { expire: 0 });

    // Echoed back so the outcome is visible from the database side, where pg_net records
    // every response in net._http_response.
    return Response.json({ revalidated: true, now: Date.now() });
}
