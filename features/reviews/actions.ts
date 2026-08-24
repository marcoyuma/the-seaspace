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
 * Data access for this feature. Reads only — the write path is in server-actions.ts, kept
 * apart because a `"use server"` export is a public HTTP endpoint and these should not be.
 *
 * Two clients appear below, and the split is the security boundary — the same arrangement
 * features/booking/actions.ts documents:
 *
 * - **Public reviews** use the anonymous client and `use cache`. Nothing in them is
 *   guest-specific, so one visitor's response is safe to serve to the next.
 * - **A guest's own review** uses the session-bound server client and is **never cached**.
 *   It answers a question about one person's reservation.
 *
 * ⚠️ Every read here goes through an `.rpc()`, never `.from("reviews")`.
 * `0018_reviews_write_path.sql` revoked SELECT on the table from `anon` and
 * `authenticated`, because `booking_id` maps a reservation to the guest who made it and the
 * anon key ships to the browser. Each function's RETURN TYPE is the column allow-list —
 * the same doctrine 0010 uses for availability and 0014 states outright: RLS filters rows,
 * not columns, so a function is what restricts a column.
 *
 * A `.select()` added here later will not fail loudly — it will come back as a permission
 * error that looks like a broken query. There is no table read to fall back to.
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
 * Shape the review RPCs return. Written by hand rather than generated — the project has no
 * `supabase gen types` step.
 *
 * `get_latest_reviews` and `get_stay_reviews` return the same seven columns, so one
 * interface serves both.
 */
interface ReviewRow {
    id: number;
    author_display_name: string;
    author_nationality: string;
    // The avatar seam from 0008. Still unrendered: ReviewContent draws a Phosphor icon, and
    // no guest has uploaded one. Returned by the RPC because it belongs to the read
    // contract, and dropped in `toReview` below rather than being carried as a field
    // nothing reads.
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
 * Wraps a PostgrestError in a real Error.
 *
 * Thrown, not swallowed into an empty array: an empty result is a legitimate state here (it
 * hides the section), so returning one on failure would make a database outage look like a
 * property with no reviews yet.
 *
 * Twin of the helper in features/stays/actions.ts. Kept local because features in this repo
 * never share helpers; if a third reader appears, promote it to lib/supabase.ts.
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
 * Both cache tags, on every read here.
 *
 * `STAYS_CACHE_TAG` keeps the catalogue webhook from 0017 clearing these exactly as it did
 * before this feature existed; `REVIEWS_CACHE_TAG` is the narrow door the write path uses,
 * so posting one review does not drop the whole hour-cached catalogue.
 */
function tagReviewRead() {
    cacheTag(STAYS_CACHE_TAG, REVIEWS_CACHE_TAG);
    cacheLife(STAYS_CACHE_PROFILE);
}

/**
 * The newest reviews, most recent first — at most one per author — for the landing-page
 * carousel.
 *
 * Recency sets the priority (there is no curation column, so `created_at` decides who gets
 * in), but not the selection on its own: 100 seeded reviews come from 62 guests, and the
 * same name twice in a loop that holds eight cards reads as a bug.
 *
 * The dedupe used to be an overfetch plus a JS pass, with a note that PostgREST has no
 * `distinct on` and an `.rpc()` would be the fix. This is that rpc — the deduping is now
 * `distinct on` inside `get_latest_reviews`, keyed so that several deleted accounts do not
 * collapse into one row.
 *
 * `limit` is a ceiling, not a promise. ReviewsSection already handles a short result.
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
 * Aggregates over *every* review, not just the carousel slice — the stats row describes the
 * property, not what happens to be on screen.
 *
 * Aggregated in SQL now. It used to pull a hundred `smallint`s and reduce them in JS,
 * because PostgREST's own aggregates (`rating.avg()`) depend on a server flag that is not
 * guaranteed to be on. Inside a function there is no such flag, and the zero-row guard that
 * used to live here is a `coalesce` in `get_review_stats` instead.
 *
 * ⚠️ Postgres `numeric` arrives over PostgREST as a **string**, not a number. Coerced here;
 * without it `averageRating.toFixed(2)` throws at render.
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
 * Every villa's rating, keyed by slug.
 *
 * One call rather than one per villa: the whole catalogue is four rows, and both readers
 * (the detail page for one villa, the landing-page preview grid for two) then share a
 * single cache entry.
 *
 * ⚠️ A villa with no reviews is **absent from the map**, not present with zeros. Callers
 * must treat `undefined` as "render nothing" — a 0.00 average would read as a bad review
 * rather than as no reviews. Same stance as ReviewsSection returning `null` when the table
 * is empty.
 *
 * @example
 * const ratings = await getStayRatingSummaries();
 * const rating = ratings.get("coastal-arch-retreat"); // StayRatingSummary | undefined
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
 * The signed-in guest's review of one booking, or `null` if they have not written one.
 *
 * Goes through `get_booking_review`, which scopes itself by `auth.uid()` internally — so
 * somebody else's booking id returns nothing rather than erroring, indistinguishable from a
 * booking that does not exist. That is what stops this becoming a way to ask "has reservation
 * #57 been reviewed".
 *
 * ⚠️ No `use cache`, ever. This reads cookies, and a cache entry here would be one guest's
 * review handed to whoever asked next. Wrapped in React's `cache` instead, so the page and
 * the prompt component asking the same question during one render share one round trip —
 * the same distinction features/auth/actions.ts draws.
 *
 * Returns `null` rather than throwing on failure: for a signed-out visitor the RPC
 * legitimately returns nothing, and "you have no review" is the honest answer to "what is
 * *your* review" when there is no you.
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
