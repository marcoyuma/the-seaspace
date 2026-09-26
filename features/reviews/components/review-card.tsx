import { StarIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

import type { Review } from "@/features/reviews/types";
import RatingStars from "@/features/reviews/components/rating-stars";
import ReviewContent from "@/features/reviews/components/review-content";

/**
 * One carousel review card; no `"use client"`, it's client only via ReviewViewport. Only the visible
 * card is in flow, so the wrapper's height is its quote's — the animation target, and correct before
 * hydration — while `previous` is lifted out of flow to animate away.
 *
 * @param phase - `initial` = first paint, no animation; `current` slides in; `previous` slides out.
 * @param ref - Attached by ReviewViewport to the visible card only, to measure it.
 */
export default function ReviewCard({
    review,
    phase,
    ref,
}: {
    review: Review;
    phase: "initial" | "current" | "previous";
    ref?: React.Ref<HTMLDivElement>;
}) {
    const isLeaving = phase === "previous";

    // `opacity-0` is where the exit animation ends and what reduced motion falls back to —
    // without it both reviews would sit stacked on top of each other.
    const phaseClasses = {
        initial: "relative",
        current: "relative animate-review-enter",
        previous:
            "absolute inset-x-0 top-0 opacity-0 pointer-events-none animate-review-exit",
    }[phase];

    return (
        <div
            ref={ref}
            aria-hidden={isLeaving}
            className={`flex flex-col gap-2.5 motion-reduce:animate-none ${phaseClasses}`}
        >
            {/* review content */}
            <ReviewContent
                displayName={review.displayName}
                nationality={review.nationality}
            />

            {/* stars */}
            <RatingStars rating={review.rating} />

            {/* `w-full` follows `ReviewViewport`'s `flex-1`; a fixed width clipped the quote on mobile. */}
            <p className="text-[16px] text-black/60 font-medium w-full">
                “{review.quote}”
            </p>
        </div>
    );
}
