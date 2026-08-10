// Interactive: the up/down arrows swap the visible review from local state.
// Only this section needs client JS — the surrounding page stays a Server
// Component.
"use client";

import Heading from "@/ui/heading";
import OverlineText from "@/ui/overline-text";
import {
    ArrowDownIcon,
    ArrowUpIcon,
    StarIcon,
    UserCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";

type Review = {
    name: string;
    location: string;
    /** Whole stars to fill, 1–5. Drives how many `StarIcon`s are rendered. */
    rating: number;
    quote: string;
};

/** 1 steps forward (down arrow), -1 steps back (up arrow). */
type Direction = 1 | -1;

/** How far a card travels while fading, in px. Small on purpose: the fade
 *  carries the transition, the slide only gives it a direction. */
const SLIDE_DISTANCE = 12;

const REVIEWS: Review[] = [
    {
        name: "Genie Junior",
        location: "Dubai, UEA",
        rating: 5,
        quote: "It felt like a private retreat. Everything was effortless . from check-in to the little design details",
    },
    {
        name: "Amara Lindqvist",
        location: "Stockholm, Sweden",
        rating: 5,
        quote: "We woke up to the sound of the water every morning. The villa was spotless and the staff anticipated everything we needed",
    },
    {
        name: "Rafael Moreno",
        location: "Lisbon, Portugal",
        rating: 4,
        quote: "The sunset from the terrace alone was worth the trip. Quiet, unhurried, and beautifully put together",
    },
    {
        name: "Naomi Sato",
        location: "Kyoto, Japan",
        rating: 5,
        quote: "A rare place that looks exactly like its photos. We came for three nights and left already planning the next stay",
    },
];

/**
 * Guest reviews section: an endless vertical carousel of one review at a time,
 * stepped with the up/down arrows, above the aggregate stats row.
 */
export default function Reviews() {
    /**
     * The three values move together on every step, so they live in one state
     * object — separate `useState`s could tear (a render seeing the new index
     * with the old direction) and send a card out the wrong side.
     *
     * `previousIndex` is the card currently animating out; `null` only before
     * the first step.
     */
    const [carousel, setCarousel] = useState<{
        index: number;
        previousIndex: number | null;
        direction: Direction;
    }>({ index: 0, previousIndex: null, direction: 1 });
    const { index, previousIndex, direction } = carousel;

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

    function step(nextDirection: Direction) {
        setCarousel((state) => ({
            direction: nextDirection,
            previousIndex: state.index,
            // `+ REVIEWS.length` before the modulo keeps the result positive
            // when stepping back from the first review — that wrap is what
            // makes the carousel endless in both directions.
            index:
                (state.index + nextDirection + REVIEWS.length) % REVIEWS.length,
        }));
    }

    return (
        <section className="mb-27.5">
            <div className="flex flex-col justify-center items-center gap-6.5 mb-17.5">
                <OverlineText>Reviews</OverlineText>
                <Heading>Read our guests thought</Heading>
            </div>
            <div className="flex flex-col justify-center items-center gap-6.5">
                {/* No fixed height: the box follows the active quote.
                    `overflow-hidden` stops a mid-slide card from bleeding past
                    the border while the height catches up — the 19px of
                    vertical padding gives it room to do that unseen. */}
                <div className="flex flex-row justify-between border border-black/10 rounded-[20px] w-161 px-6.5 py-4.75 overflow-hidden">
                    <div
                        aria-live="polite"
                        className="relative flex-1 transition-[height] duration-300 ease-out motion-reduce:transition-none"
                        style={
                            {
                                // Both cards inherit the slide direction from
                                // here, so they can never disagree about it.
                                "--review-slide": `${
                                    direction * SLIDE_DISTANCE
                                }px`,
                                ...(cardHeight !== null
                                    ? { height: cardHeight }
                                    : {}),
                            } as React.CSSProperties
                        }
                    >
                        {/* Keyed by index so every step remounts the card and
                            replays the enter animation from its start. */}
                        <ReviewCard
                            key={`current-${index}`}
                            ref={currentCardRef}
                            review={REVIEWS[index]}
                            // Before the first step there is nothing to
                            // animate away from, and the enter animation would
                            // only blank the review out on every page load.
                            phase={
                                previousIndex === null ? "initial" : "current"
                            }
                        />
                        {previousIndex !== null && (
                            <ReviewCard
                                key={`previous-${previousIndex}`}
                                review={REVIEWS[previousIndex]}
                                phase="previous"
                            />
                        )}
                    </div>
                    <div className="flex flex-col gap-2.25 justify-center">
                        <NavButton
                            label="Previous review"
                            onClick={() => step(-1)}
                        >
                            <ArrowUpIcon size={27} fill="black" />
                        </NavButton>
                        <NavButton label="Next review" onClick={() => step(1)}>
                            <ArrowDownIcon size={27} fill="black" />
                        </NavButton>
                    </div>
                </div>
                <div className="flex flex-row justify-evenly items-center border rounded-[20px] border-black/10 w-161 px-6.5 py-4.75">
                    <StatItem value="200+" label="Reviews" />
                    <div className="w-px h-[51px] bg-black/10" />
                    <StatItem value="5.00" label="Ratings" />
                    <div className="w-px h-[51px] bg-black/10" />
                    <StatItem value="100%" label="Reply rate" />
                </div>
            </div>
        </section>
    );
}

/**
 * One review card.
 *
 * The visible card is the only one in normal flow, so the wrapper's natural
 * height always equals the visible quote's height — that is what the box
 * animates to, and what makes it render correctly before hydration. The
 * `previous` card is lifted out of flow to animate away over it.
 *
 * @param phase - `initial` is the first paint (visible, no animation),
 * `current` the card sliding in, `previous` the one sliding out.
 * @param ref - Attached by the parent to the visible card only, to measure it.
 */
function ReviewCard({
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
            <div className="flex gap-1">
                <UserCircleIcon size={54} color="black" weight="fill" />
                <div className="flex flex-col gap-0 inset-0 justify-center">
                    <h3 className="text-[16px] font-semibold text-black">
                        {review.name}
                    </h3>
                    <p className="text-[16px] font-semibold text-black/30">
                        {review.location}
                    </p>
                </div>
            </div>
            <div
                className="flex flex-row"
                aria-label={`${review.rating} out of 5 stars`}
            >
                {Array.from({ length: review.rating }, (_, star) => (
                    <StarIcon
                        key={star}
                        weight="fill"
                        fill="#FFC533"
                        size={24}
                    />
                ))}
            </div>

            <p className="text-[16px] text-black/50 font-medium w-97.5">
                “{review.quote}”
            </p>
        </div>
    );
}

function NavButton({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="flex justify-center items-center bg-[#D9D9D9]/30 rounded-[20px] w-14.25 h-14.25 cursor-pointer transition-colors duration-200 ease-out hover:bg-[#D9D9D9]/60 motion-reduce:transition-none"
        >
            {children}
        </button>
    );
}

function StatItem({ value, label }: { value: string; label: string }) {
    return (
        <div>
            <h3 className="font-semibold text-[24px] tracking-[0.5%]">
                {value}
            </h3>
            <span className="text-black/50">{label}</span>
        </div>
    );
}
