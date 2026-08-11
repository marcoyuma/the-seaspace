import { supabase } from "@/lib/supabase";
import type { Review, ReviewStats } from "@/features/reviews/types";

/**
 * How many reviews the landing-page carousel holds.
 *
 * The arrows step one card at a time, so this is a UX ceiling rather than a payload one:
 * a hundred reviews would mean a hundred clicks to get back where you started.
 */
export const CAROUSEL_SIZE = 8;

/**
 * The villa slug is embedded rather than looked up separately — one round-trip, and it keeps
 * `Review` complete enough to reuse on a per-villa page later.
 */
const REVIEW_SELECT = `
    id, author_display_name, author_nationality, rating, quote,
    stays ( slug )
`;

// Shape returned by PostgREST for the select above. Written by hand rather than generated:
// the project has no `supabase gen types` step.
interface ReviewRow {
    id: number;
    author_display_name: string;
    author_nationality: string;
    rating: number;
    quote: string;
    // Null when `stay_id` is null — a testimonial that names no villa.
    stays: { slug: string } | null;
}

function toReview(row: ReviewRow): Review {
    return {
        id: row.id,
        displayName: row.author_display_name,
        nationality: row.author_nationality,
        rating: row.rating,
        quote: row.quote,
        stayId: row.stays?.slug,
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
 * never import each other; if a third reader appears, promote it to lib/supabase.ts.
 */
function queryFailed(what: string, error: { message: string; code?: string }): Error {
    return new Error(`Failed to load ${what} from Supabase: ${error.message}`, {
        cause: error,
    });
}

/**
 * The newest reviews, most recent first — what the landing-page carousel renders.
 *
 * Ordering is the whole selection strategy: there is no curation column, so `created_at`
 * decides what a visitor sees. The seed gives every row a distinct timestamp for exactly
 * this reason.
 */
export async function getLatestReviews(limit = CAROUSEL_SIZE): Promise<Review[]> {
    const { data, error } = await supabase
        .from("reviews")
        .select(REVIEW_SELECT)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw queryFailed("reviews", error);
    return (data as unknown as ReviewRow[]).map(toReview);
}

/**
 * Aggregates over *every* review, not just the carousel slice — the stats row describes the
 * property, not what happens to be on screen.
 *
 * Aggregated in JS on purpose. `.rpc()` is a POST, and the caching policy in lib/supabase.ts
 * only attaches `next: { revalidate, tags }` to fetches, so a stored function would silently
 * opt this query out of the hourly cache. PostgREST's own aggregates (`rating.avg()`) depend
 * on a server flag that is not guaranteed to be on. Pulling a hundred smallints through one
 * cached GET is far cheaper than losing the cache.
 *
 * If reviews ever reach thousands of rows, the replacement is a database *view* — still a
 * GET, still cached — not an RPC.
 */
export async function getReviewStats(): Promise<ReviewStats> {
    const { data, error } = await supabase.from("reviews").select("rating");

    if (error) throw queryFailed("review stats", error);

    const ratings = (data as unknown as { rating: number }[]).map(
        (row) => row.rating,
    );
    const total = ratings.length;

    // Guard the division: an empty table would otherwise produce NaN and render as "NaN".
    if (total === 0) return { total: 0, averageRating: 0, recommendRate: 0 };

    return {
        total,
        averageRating: ratings.reduce((sum, r) => sum + r, 0) / total,
        recommendRate: ratings.filter((r) => r >= 4).length / total,
    };
}
