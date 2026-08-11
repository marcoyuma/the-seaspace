// Client because of `useState`/`useEffect` and a ResizeObserver. In practice this module is
// already in the client graph via ReviewCarousel, but a hooks module without the directive
// fails with a confusing error the day someone imports it from a Server Component — the
// directive is cheap and documents the boundary.
"use client";

import { useEffect, useRef, useState } from "react";

import ReviewCard from "@/features/reviews/components/review-card";
import type { Review } from "@/features/reviews/types";

/** 1 steps forward (down arrow), -1 steps back (up arrow). */
export type Direction = 1 | -1;

/** How far a card travels while fading, in px. Small on purpose: the fade
 *  carries the transition, the slide only gives it a direction. */
const SLIDE_DISTANCE = 12;

/**
 * The animated area of the carousel: the card currently on screen, plus the one leaving.
 *
 * Owns nothing about *which* review is shown — ReviewCarousel decides that. What lives here
 * is the measurement, because only this element knows how tall the visible card is.
 *
 * @param index - Index into `reviews` of the card to show.
 * @param previousIndex - The card animating out; `null` only before the first step.
 * @param direction - Which way the pair slides, set once here for both cards.
 */
export default function ReviewViewport({
    reviews,
    index,
    previousIndex,
    direction,
}: {
    reviews: Review[];
    index: number;
    previousIndex: number | null;
    direction: Direction;
}) {
    const currentCardRef = useRef<HTMLDivElement>(null);
    // `null` until measured: on the server and at first paint the current card
    // is in normal flow, so the box already sizes itself correctly without JS.
    // The measured value exists only to make the height *animatable*.
    const [cardHeight, setCardHeight] = useState<number | null>(null);

    // ResizeObserver rather than a one-shot read: the quote reflows once web
    // fonts land and whenever the viewport changes, and the box must follow.
    useEffect(() => {
        const card = currentCardRef.current;
        if (!card) return;

        const sync = () => setCardHeight(card.offsetHeight);
        sync();

        const observer = new ResizeObserver(sync);
        observer.observe(card);
        return () => observer.disconnect();
    }, [index]);

    return (
        <div
            aria-live="polite"
            className="relative flex-1 transition-[height] duration-300 ease-out motion-reduce:transition-none"
            style={
                {
                    // Both cards inherit the slide direction from here, so they
                    // can never disagree about it.
                    "--review-slide": `${direction * SLIDE_DISTANCE}px`,
                    ...(cardHeight !== null ? { height: cardHeight } : {}),
                } as React.CSSProperties
            }
        >
            {/* Keyed by index so every step remounts the card and replays the
                enter animation from its start. */}
            <ReviewCard
                key={`current-${index}`}
                ref={currentCardRef}
                review={reviews[index]}
                // Before the first step there is nothing to animate away from,
                // and the enter animation would only blank the review out on
                // every page load.
                phase={previousIndex === null ? "initial" : "current"}
            />
            {previousIndex !== null && (
                <ReviewCard
                    key={`previous-${previousIndex}`}
                    review={reviews[previousIndex]}
                    phase="previous"
                />
            )}
        </div>
    );
}
