// Interactive: the up/down arrows swap the visible review from local state. This is the
// client boundary of the reviews section — everything above it (section shell, heading,
// stats row) stays a Server Component and never ships as JS.
"use client";

import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";

import ReviewViewport, {
    type Direction,
} from "@/features/reviews/components/review-viewport";
import type { Review } from "@/features/reviews/types";

/**
 * An endless vertical carousel over the reviews it is given, one card at a time.
 *
 * Wraps in both directions, so the arrows never dead-end.
 */
export default function ReviewCarousel({ reviews }: { reviews: Review[] }) {
    /**
     * Index, previous index (the card animating out; `null` before the first step) and direction
     * change together, so one state object — separate states could tear and exit the wrong side.
     */
    const [carousel, setCarousel] = useState<{
        index: number;
        previousIndex: number | null;
        direction: Direction;
    }>({ index: 0, previousIndex: null, direction: 1 });
    const { index, previousIndex, direction } = carousel;

    function step(nextDirection: Direction) {
        setCarousel((state) => ({
            direction: nextDirection,
            previousIndex: state.index,
            // `+ reviews.length` before the modulo keeps the result positive
            // when stepping back from the first review — that wrap is what
            // makes the carousel endless in both directions.
            index:
                (state.index + nextDirection + reviews.length) % reviews.length,
        }));
    }

    return (
        // No fixed height: the box follows the active quote. `overflow-hidden` keeps a mid-slide
        // card inside the border while the height catches up, hidden by the 19px padding.
        <div className="flex flex-row justify-between border border-black/10 rounded-[20px] w-full max-w-161 px-6.5 py-4.75 overflow-hidden">
            <ReviewViewport
                reviews={reviews}
                index={index}
                previousIndex={previousIndex}
                direction={direction}
            />
            <div className="flex flex-col gap-2.25 justify-center">
                <NavButton label="Previous review" onClick={() => step(-1)}>
                    <ArrowUpIcon size={27} fill="black" />
                </NavButton>
                <NavButton label="Next review" onClick={() => step(1)}>
                    <ArrowDownIcon size={27} fill="black" />
                </NavButton>
            </div>
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
