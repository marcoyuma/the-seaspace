import { getLatestReviews, getReviewStats } from "@/features/reviews/actions";
import ReviewsHeader from "@/features/reviews/components/reviews-header";
import ReviewsPanel from "@/features/reviews/components/reviews-panel";

/**
 * Guest reviews on the landing page: a vertical carousel of the newest reviews above a row
 * of aggregate figures.
 *
 * Async Server Component that fetches its own data, matching StaysPreviewSection — the page
 * composes sections without knowing what any of them needs. Both queries are cached and
 * revalidated by the shared policy in lib/supabase.ts, so this costs the landing page
 * nothing per request.
 *
 * The content used to be a hardcoded REVIEWS array with hand-typed stats ("200+", "5.00",
 * "100%") in features/home/components/reviews.tsx.
 */
export default async function ReviewsSection() {
    // Parallel, not sequential: neither query depends on the other, and awaiting them in
    // turn would add a needless round-trip to the page's render.
    const [reviews, stats] = await Promise.all([
        getLatestReviews(),
        getReviewStats(),
    ]);

    // Nothing to show and nothing to say about it: a marketing page is better off without
    // the section than with an empty box. Also guards the carousel, which indexes into the
    // array unconditionally.
    if (reviews.length === 0) return null;

    return (
        <section aria-labelledby="reviews-heading" className="mb-27.5">
            <ReviewsHeader />
            <ReviewsPanel reviews={reviews} stats={stats} />
        </section>
    );
}
