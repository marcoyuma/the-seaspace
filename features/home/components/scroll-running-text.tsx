"use client";

import { useRef } from "react";
import {
    motion,
    useScroll,
    useTransform,
    useReducedMotion,
    type MotionValue,
} from "motion/react";
import HorizontalLine from "@/ui/horizontal-line";

// How far each line drifts (px) across the section's full pass through the
// viewport. Both lines travel this same distance, in opposite directions.
const DRIFT_DISTANCE = 300;

const LINES = [
    {
        text: "Sunsets to remember. Horizons to explore. Sunsets to remember. Horizons to explore. Sunsets to remember. Horizons to explore",
        direction: 1,
        // Starting x (px) at the moment the section enters the viewport.
        // Negative = already overflowing to the left, so the line never runs
        // out of characters on the side it drifts away from.
        initialOffset: -600,
    },
    {
        text: "Horizons to explore. Sunsets to remember. Horizons to explore. Sunsets to remember. Horizons to explore. Sunsets to remember",
        direction: -1,
        initialOffset: -100,
    },
] as const;

function MarqueeLine({
    text,
    direction, // 1 = drifts right as the section scrolls past, -1 = drifts left
    initialOffset,
    progress,
}: {
    text: string;
    direction: 1 | -1;
    initialOffset: number;
    progress: MotionValue<number>;
}) {
    const prefersReducedMotion = useReducedMotion();

    // Position is a pure function of the section's scroll progress: the same
    // scroll position always yields the same x. Deriving it from progress
    // rather than accumulating scroll velocity per frame is what makes this
    // survive a reload at any scroll position — there is no history to lose.
    const x = useTransform(
        progress,
        [0, 1],
        [initialOffset, initialOffset + direction * DRIFT_DISTANCE],
    );

    return (
        <motion.h2
            style={{ x: prefersReducedMotion ? initialOffset : x }}
            // max-w-dvw to prevent the width takes more than screen wide
            className="text-black/10 font-bold text-[48px] leading-14 whitespace-nowrap max-w-dvw will-change-transform"
        >
            {text}
        </motion.h2>
    );
}

export default function ScrollRunningText() {
    const sectionRef = useRef<HTMLDivElement>(null);

    // 0 when the section's top meets the viewport bottom (it starts entering),
    // 1 when its bottom meets the viewport top (it has fully passed).
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start end", "end start"],
    });

    return (
        <div ref={sectionRef} className="pt-22.25 pb-47.75 overflow-hidden">
            <HorizontalLine />
            <div className="py-5 flex flex-col gap-px">
                {LINES.map((line) => (
                    <MarqueeLine
                        key={line.text}
                        text={line.text}
                        direction={line.direction}
                        initialOffset={line.initialOffset}
                        progress={scrollYProgress}
                    />
                ))}
            </div>
            <HorizontalLine />
        </div>
    );
}
