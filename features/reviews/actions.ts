import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

import {
    supabase,
    REVIEWS_CACHE_TAG,
    STAYS_CACHE_TAG,
    STAYS_CACHE_PROFILE,
} from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";
import { getAuthUser } from "@/features/auth/actions";
import type {
    Review,
    ReviewStats,
    StayRatingSummary,
} from "@/features/reviews/types";

/**
 * Review reads (writes: server-actions.ts). Public reviews: anon client + `use cache`; a guest's own
 * review: session client, never cached. ⚠️ RPCs only — 0018 revoked table SELECT (booking_id exposes
 * guests), so return types are the column allow-list and a `.from("reviews")` is a permission error.
 */

/**
 * How many reviews the landing-page carousel holds.
 *
 * The arrows step one card at a time, so this is a UX ceiling rather than a payload one:
 * a hundred reviews would mean a hundred clicks to get back where you started.
 */
export const CAROUSEL_SIZE = 8;

/** How many reviews the stay detail page shows before the "show all" modal. */
export const STAY_REVIEWS_PREVIEW_SIZE = 6;

/**
 * Shape the review RPCs return (hand-written; no `supabase gen types`). `get_latest_reviews` and
 * `get_stay_reviews` return the same seven columns, so one interface serves both.
 */
interface ReviewRow {
    id: number;
    author_display_name: string;
    author_nationality: string;
    // Avatar seam from 0008, still unrendered (ReviewContent draws an icon). Part of the RPC's
    // read contract, but dropped in `toReview` rather than carried as an unread field.
    author_avatar_path: string | null;
    rating: number;
    quote: string;
    // Null when the review names no villa — `reviews.stay_id` is nullable. Only
    // `get_latest_reviews` can produce that; `get_stay_reviews` joins on the slug.
    stay_slug: string | null;
}

function toReview(row: ReviewRow): Review {
    return {
        id: row.id,
        displayName: row.author_display_name,
        nationality: row.author_nationality,
        rating: row.rating,
        quote: row.quote,
        stayId: row.stay_slug ?? undefined,
    };
}

/**
 * Wraps a PostgrestError in a real Error. Thrown, since an empty result hides the section and would
 * disguise an outage as "no reviews yet". Twin of the helper in features/stays/actions.ts — promote
 * it to lib/supabase.ts if a third reader appears.
 */
function queryFailed(
    what: string,
    error: { message: string; code?: string },
): Error {
    return new Error(`Failed to load ${what} from Supabase: ${error.message}`, {
        cause: error,
    });
}

/**
 * Tags every read with both: `STAYS_CACHE_TAG` so the catalogue webhook still clears it, and
 * `REVIEWS_CACHE_TAG` so posting a review doesn't drop the whole hour-cached catalogue.
 */
function tagReviewRead() {
    cacheTag(STAYS_CACHE_TAG, REVIEWS_CACHE_TAG);
    cacheLife(STAYS_CACHE_PROFILE);
}

/**
 * Newest reviews, at most one per author, for the landing carousel. Recency decides (no curation
 * column); `distinct on` inside `get_latest_reviews` stops 62 authors of 100 seeded reviews from
 * repeating. `limit` is a ceiling — ReviewsSection handles a short result.
 */
export async function getLatestReviews(
    limit = CAROUSEL_SIZE,
): Promise<Review[]> {
    "use cache";
    tagReviewRead();

    const { data, error } = await supabase.rpc("get_latest_reviews", {
        p_limit: limit,
    });

    if (error) throw queryFailed("reviews", error);

    return (data as ReviewRow[]).map(toReview);
}

/**
 * Aggregates over *every* review — the stats row describes the property, not the carousel slice;
 * computed in `get_review_stats`. ⚠️ `numeric` arrives as a **string**: coerced here, or
 * `averageRating.toFixed(2)` throws at render.
 */
export async function getReviewStats(): Promise<ReviewStats> {
    "use cache";
    tagReviewRead();

    const { data, error } = await supabase.rpc("get_review_stats");

    if (error) throw queryFailed("review stats", error);

    // `returns table` always yields an array, even for a single-row aggregate.
    const row = (
        data as { total: number; average_rating: string; recommend_rate: string }[]
    )[0];

    if (!row) return { total: 0, averageRating: 0, recommendRate: 0 };

    return {
        total: Number(row.total),
        averageRating: Number(row.average_rating),
        recommendRate: Number(row.recommend_rate),
    };
}

/**
 * One villa's reviews, newest first.
 *
 * The read 0005 created `reviews_stay_id_idx` for, describing it at the time as being "for
 * per-villa reads on the stay detail page, which do not exist yet".
 *
 * @param slug - The stay's `slug`, which is also `Stay.id` in features/stays/types.ts.
 * @param limit - Page size. The detail page shows `STAY_REVIEWS_PREVIEW_SIZE`; the
 *   "show all" modal asks for the villa's full count.
 *
 * @example
 * const reviews = await getStayReviews("coastal-arch-retreat", 6);
 */
export async function getStayReviews(
    slug: string,
    limit = STAY_REVIEWS_PREVIEW_SIZE,
    offset = 0,
): Promise<Review[]> {
    "use cache";
    tagReviewRead();

    const { data, error } = await supabase.rpc("get_stay_reviews", {
        p_slug: slug,
        p_limit: limit,
        p_offset: offset,
    });

    if (error) throw queryFailed(`reviews for stay "${slug}"`, error);

    return (data as ReviewRow[]).map(toReview);
}

/**
 * Every villa's rating keyed by slug — one call, so both readers share a cache entry. ⚠️ Unrated
 * villas are ABSENT, not zero: treat `undefined` as "render nothing" (0.00 reads as a bad review).
 *
 * @example const rating = (await getStayRatingSummaries()).get("coastal-arch-retreat");
 */
export async function getStayRatingSummaries(): Promise<
    Map<string, StayRatingSummary>
> {
    "use cache";
    tagReviewRead();

    const { data, error } = await supabase.rpc("get_stay_rating_summaries");

    if (error) throw queryFailed("stay ratings", error);

    const rows = data as {
        stay_slug: string;
        total: number;
        average_rating: string;
    }[];

    return new Map(
        rows.map((row) => [
            row.stay_slug,
            {
                staySlug: row.stay_slug,
                total: Number(row.total),
                // `numeric` over the wire is a string — see getReviewStats().
                averageRating: Number(row.average_rating),
            },
        ]),
    );
}

// ---------------------------------------------------------------------------
// The guest's own review
// ---------------------------------------------------------------------------

/** What the trip page needs to decide between "rate this stay" and "edit your review". */
export interface OwnReview {
    rating: number;
    quote: string;
}

/**
 * The signed-in guest's review of one booking, or `null`. The RPC scopes by `auth.uid()`, so another
 * guest's id looks nonexistent. ⚠️ Never `use cache` (reads cookies); React `cache` dedupes within a
 * render. Failures return `null` too — "you have no review" is honest when there is no you.
 *
 * @param bookingId From the URL, so it may be anything at all.
 */
export const getOwnBookingReview = cache(
    async (bookingId: number): Promise<OwnReview | null> => {
        const user = await getAuthUser();
        if (!user) return null;

        const supabaseWithSession = await createClient();
        const { data, error } = await supabaseWithSession.rpc(
            "get_booking_review",
            { p_booking_id: bookingId },
        );

        if (error) {
            console.error(`[reviews:own] code=${error.code} ${error.message}`);
            return null;
        }

        // `returns table` yields an array; no row means no review yet.
        const row = (data as OwnReview[] | null)?.[0];
        return row ?? null;
    },
);
