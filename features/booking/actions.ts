import { cacheLife, cacheTag } from "next/cache";

import {
    supabase,
    BOOKINGS_CACHE_TAG,
    BOOKINGS_CACHE_PROFILE,
} from "@/lib/supabase";
import type { BookedRange } from "@/features/booking/types";

/**
 * Data access for availability. Same convention as features/stays/actions.ts: read
 * helpers for Server Components, no `"use server"`. The write path (a real reservation)
 * does not exist yet and will live in server-actions.ts when it does.
 */

// Shape PostgREST returns for the RPC. Hand-written, like the stays row types — the
// project has no `supabase gen types` step. A Postgres `date` arrives as a plain
// `yyyy-mm-dd` string, which is exactly the format the picker works in, so there is
// nothing to parse here.
interface BookedRangeRow {
    start_date: string;
    end_date: string;
}

/**
 * The dates already taken at one villa, from today onward.
 *
 * Goes through the `get_stay_booked_ranges` RPC rather than selecting from `bookings`:
 * the table is closed to `anon` by design (supabase/migrations/0009_bookings.sql), and
 * the function's return type is the column allow-list. See 0010_stay_availability.sql.
 *
 * Cached for minutes, not the catalogue's hours — a stale calendar offers dates that are
 * gone. Tagged per slug as well as globally so a future revalidation can clear one villa.
 *
 * ⚠️ `end` is exclusive. See BookedRange.
 *
 * @param slug - The stay's `slug`, which is also `Stay.id` in features/stays/types.ts.
 *
 * @example
 * const ranges = await getStayBookedRanges("coastal-arch-retreat");
 * // [{ start: "2026-08-18", end: "2026-08-21" }, …]
 */
export async function getStayBookedRanges(slug: string): Promise<BookedRange[]> {
    "use cache";
    cacheTag(BOOKINGS_CACHE_TAG, `${BOOKINGS_CACHE_TAG}:${slug}`);
    cacheLife(BOOKINGS_CACHE_PROFILE);

    const { data, error } = await supabase.rpc("get_stay_booked_ranges", {
        p_slug: slug,
    });

    if (error) {
        // Thrown, not swallowed into an empty array, for the same reason
        // features/stays/actions.ts throws: an empty calendar renders as a legitimate
        // "everything is free" page, which here would take bookings for dates that are
        // already occupied. A visible error is the safer failure.
        throw new Error(
            `Failed to load availability for stay "${slug}" from Supabase: ${error.message}`,
            { cause: error },
        );
    }

    return (data as BookedRangeRow[]).map((row) => ({
        start: row.start_date,
        end: row.end_date,
    }));
}
