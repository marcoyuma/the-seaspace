import { getLatestReviews, getReviewStats } from "@/features/reviews/actions";
import Container from "@/ui/container";
import ReviewsHeader from "@/features/reviews/components/reviews-header";
import ReviewsPanel from "@/features/reviews/components/reviews-panel";
import Skeleton from "@/ui/skeleton";

/**
 * Landing-page reviews: a carousel of the newest above aggregate figures. Fetches its own cached
 * data, like StaysPreviewSection. Still needs app/page.tsx's <Suspense>: `"use cache"` sits on the
 * actions, not here, so the prerenderer sees an ordinary async component.
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
        // `Container` supplies the inset the heading needs to wrap, and the vertical gap.
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
