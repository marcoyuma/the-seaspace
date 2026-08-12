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
 * How many rows to pull per carousel slot before duplicate authors are dropped.
 *
 * The seed holds 100 reviews from 62 guests, so 4x (32 candidates) leaves far more headroom
 * than the duplicate rate needs. Still one small, hourly-cached GET.
 */
const CANDIDATE_FACTOR = 4;

/**
 * The villa slug is embedded rather than looked up separately — one round-trip, and it keeps
 * `Review` complete enough to reuse on a per-villa page later.
 *
 * `guest_id` is read only to tell authors apart; it is deliberately dropped in `toReview` so
 * the uuid never travels to the client component that renders the cards.
 */
const REVIEW_SELECT = `
    id, guest_id, author_display_name, author_nationality, rating, quote,
    stays ( slug )
`;

// Shape returned by PostgREST for the select above. Written by hand rather than generated:
// the project has no `supabase gen types` step.
interface ReviewRow {
    id: number;
    // Null when the account behind the review was deleted — see 0007_reviews_guest_id.sql.
    guest_id: string | null;
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
function queryFailed(
    what: string,
    error: { message: string; code?: string },
): Error {
    return new Error(`Failed to load ${what} from Supabase: ${error.message}`, {
        cause: error,
    });
}

/**
 * The newest reviews, most recent first — at most one per author — for the landing-page
 * carousel.
 *
 * Recency sets the *priority* (there is no curation column, so `created_at` decides who gets
 * in), but not the selection on its own: 100 seeded reviews come from 62 guests, and the same
 * name twice in a loop that holds eight cards reads as a bug. So the query overfetches and the
 * duplicates are dropped here.
 *
 * Deduping in JS rather than in the database for the same reason `getReviewStats` aggregates
 * here: PostgREST has no `distinct on`, and an `.rpc()` is a POST, which the caching policy in
 * lib/supabase.ts does not attach `next: { revalidate, tags }` to. A view would be the
 * database-side answer if this ever outgrows the overfetch.
 *
 * `limit` is a ceiling, not a promise — if the candidate pool runs dry the result is short, and
 * ReviewsSection already handles that.
 */
export async function getLatestReviews(
    limit = CAROUSEL_SIZE,
): Promise<Review[]> {
    const { data, error } = await supabase
        .from("reviews")
        .select(REVIEW_SELECT)
        .order("created_at", { ascending: false })
        .limit(limit * CANDIDATE_FACTOR);

    if (error) throw queryFailed("reviews", error);

    const seen = new Set<string>();
    const picked: ReviewRow[] = [];

    // Single forward pass over rows already sorted newest-first, so the one kept per author is
    // always their most recent review.
    for (const row of data as unknown as ReviewRow[]) {
        // An ownerless row is a deleted account ('Former guest'). Those are different people,
        // so they get a per-row key instead of collapsing into a single null.
        const key = row.guest_id ?? `anon:${row.id}`;
        if (seen.has(key)) continue;

        seen.add(key);
        picked.push(row);
        if (picked.length === limit) break;
    }

    return picked.map(toReview);
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
