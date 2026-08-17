import { StarIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

import type { Review } from "@/features/reviews/types";
import RatingStars from "@/features/reviews/components/rating-stars";
import ReviewContent from "@/features/reviews/components/review-content";

/**
 * One review card.
 *
 * No `"use client"`: this renders no state and binds no handlers. It reaches the browser
 * bundle only because ReviewViewport imports it, which is the correct reason.
 *
 * The visible card is the only one in normal flow, so the wrapper's natural height always
 * equals the visible quote's height — that is what the box animates to, and what makes it
 * render correctly before hydration. The `previous` card is lifted out of flow to animate
 * away over it.
 *
 * @param phase - `initial` is the first paint (visible, no animation), `current` the card
 * sliding in, `previous` the one sliding out.
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

    // `opacity-0` on the outgoing card is the resting state the exit animation
    // ends on, and also what `motion-reduce` falls back to once the animation
    // is switched off — without it a reduced-motion user would see both
    // reviews stacked on top of each other.
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

            {/* Was a fixed `w-97.5` (390px) — wider than the carousel card's
                available space on mobile, so the quote's right edge got
                clipped by the carousel's `overflow-hidden`. `w-full` lets it
                match whatever width `ReviewViewport`'s `flex-1` gives it at
                any breakpoint. */}
            <p className="text-[16px] text-black/60 font-medium w-full">
                “{review.quote}”
            </p>
        </div>
    );
}
