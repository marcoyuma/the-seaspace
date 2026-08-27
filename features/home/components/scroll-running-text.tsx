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
            // Size ladder is the one already used for the same "one element,
            // must shrink on mobile" job in family-history-section.tsx and
            // ui/footer.tsx's heading (28/34/40/48) — desktop keeps its 48px,
            // and mobile drops under the 36px landing-section headings instead
            // of towering over them.
            //
            // `font-bold` stays: at `black/10` the weight is what makes the
            // glyphs read as texture at all, and it matches the only other
            // decorative black/10 display text in the repo (the "THE SEASPACE"
            // watermark in ui/footer.tsx). Everything that is real copy here
            // is `font-semibold`.
            //
            // Leading is a ratio, not `leading-14`: that was a fixed 56px tuned
            // for 48px text, so at 28px it would have left a ~2x line box. 1.15
            // reproduces the 48px rhythm and keeps the descenders in "explore"
            // clear of the next line, which sits only `gap-px` away (same
            // reasoning as the `leading-[1.05]` note in hero.tsx).
            //
            // max-w-dvw to prevent the width takes more than screen wide
            className="text-black/10 font-bold text-[28px] sm:text-[34px] md:text-[40px] lg:text-[48px] leading-[1.15] whitespace-nowrap max-w-dvw will-change-transform"
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
