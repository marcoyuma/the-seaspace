import type { Review } from "@/features/reviews/types";
import RatingStars from "@/features/reviews/components/rating-stars";
import ReviewContent from "@/features/reviews/components/review-content";

/**
 * One review in a static list (stay page grid, "show all" modal). Same pieces as `ReviewCard`,
 * minus its `phase` and animation classes — a grid renders every card at once, nothing slides.
 *
 * @param className - Layout only; concatenation can't resolve clashes (see `ui/pill-styles.tsx`).
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
