import type { Review } from "@/features/reviews/types";
import RatingStars from "@/features/reviews/components/rating-stars";
import ReviewContent from "@/features/reviews/components/review-content";

/**
 * One review in a static list — the stay detail page's grid, and the "show all" modal.
 *
 * Composes the same three pieces `ReviewCard` does, but without its `phase` prop or its
 * `animate-review-enter` / `animate-review-exit` classes. Those exist because the carousel
 * mounts one card at a time and slides it in; a grid renders every card at once, so
 * inheriting that machinery would mean carrying animation state nothing drives.
 *
 * `ReviewContent` and `RatingStars` are reused as they are — the author block and the stars
 * must look identical whether a review appears in the carousel or in this list.
 *
 * No `"use client"`: no state, no handlers.
 *
 * @param className - Layout only (the caller's own padding/dividers). Appended after the
 *   base classes; that only works while it stays layout-only, since concatenation cannot
 *   resolve a clash with a base utility (see `ui/pill-styles.tsx`).
 */
export default function StayReviewItem({
    review,
    className = "",
}: {
    review: Review;
    className?: string;
}) {
    return (
        <li className={`flex flex-col gap-2.5 ${className}`}>
            <ReviewContent
                displayName={review.displayName}
                nationality={review.nationality}
            />

            <RatingStars rating={review.rating} />

            {/* `w-full`, matching ReviewCard: a fixed width here would overflow the narrower
                of the two grid columns on tablet. */}
            <p className="w-full text-[16px] font-medium text-black/60">
                “{review.quote}”
            </p>
        </li>
    );
}
