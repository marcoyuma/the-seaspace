import { getLatestReviews, getReviewStats } from "@/features/reviews/actions";
import Container from "@/ui/container";
import ReviewsHeader from "@/features/reviews/components/reviews-header";
import ReviewsPanel from "@/features/reviews/components/reviews-panel";
import Skeleton from "@/ui/skeleton";

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
 *
 * Still needs a <Suspense> boundary in app/page.tsx despite the caching below: `"use cache"`
 * lives on the two action functions, not on this component, so the prerenderer still treats
 * it as an ordinary async component awaiting a promise.
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
        // Was a bare `<section>` with no horizontal inset at all (unlike
        // every other section on this page) — its 48px heading had nothing
        // to wrap against and overflowed every viewport narrower than the
        // text's own unwrapped width. `Container` also owns the vertical
        // gap now (its responsive `mb-*`), replacing the section's own
        // fixed `mb-27.5`, matching the pattern used elsewhere on this page.
        <Container>
            <section aria-labelledby="reviews-heading">
                <ReviewsHeader />
                <ReviewsPanel reviews={reviews} stats={stats} />
            </section>
        </Container>
    );
}

/**
 * <Suspense> fallback for `ReviewsSection`, exported so app/page.tsx can use it without
 * duplicating the header. `ReviewsHeader` is static copy, not data, so it renders immediately
 * either way — only the carousel + stats row (`ReviewsPanel`) is skeletonized.
 */
export function ReviewsSectionFallback() {
    return (
        <Container>
            <section aria-labelledby="reviews-heading">
                <ReviewsHeader />
                {/* Roughly matches ReviewsPanel's real height (carousel + stats row) so
                    swapping in the real content doesn't shift the page underneath it. */}
                <Skeleton className="h-100 w-full max-w-161 mx-auto rounded-[20px]" />
            </section>
        </Container>
    );
}
