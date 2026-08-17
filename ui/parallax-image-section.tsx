"use client";

import Image from "next/image";
import { useRef } from "react";
import {
    motion,
    useScroll,
    useTransform,
    useReducedMotion,
} from "motion/react";
import kayakkingImg from "@/public/leisure/kayakking.jpg";

// Extra image height beyond the frame, in px. Split evenly above and below, so the
// image can travel ±PARALLAX_OVERFLOW / 2 without ever exposing a gap in the frame.
const PARALLAX_OVERFLOW = 220;

// Keeps the paddleboarders in frame across every crop the responsive `fill` produces.
const IMAGE_FOCAL_POINT = "50% 60%";

const HEADLINE_WORDS = ["Here", "unfold"];

const HEADLINE_CLASSNAME =
    "text-white font-semibold text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[96px] leading-none select-none";

export default function ParallaxImageSection() {
    const sectionRef = useRef<HTMLElement>(null);
    const prefersReducedMotion = useReducedMotion();

    // 0 when the section's top meets the viewport bottom (image starts entering),
    // 1 when the section's bottom meets the viewport top (image has fully passed).
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start end", "end start"],
    });

    // Mapped straight off scroll position with no spring, so the image stops the
    // instant scrolling stops instead of drifting to catch up.
    const shift = PARALLAX_OVERFLOW / 2;
    const y = useTransform(scrollYProgress, [0, 1], [-shift, shift]);

    return (
        <section
            ref={sectionRef}
            className="relative w-full h-140 sm:h-170 md:h-200 lg:h-240 overflow-hidden bg-white"
        >
            {/* Framed image container with top white bar */}
            <div className="absolute inset-x-0 bottom-0 top-6 sm:top-8 md:top-10 overflow-hidden shadow-2xl">
                {/* Background Image */}
                <motion.div
                    style={{
                        y: prefersReducedMotion ? 0 : y,
                        height: `calc(100% + ${PARALLAX_OVERFLOW}px)`,
                        top: -shift,
                    }}
                    className="absolute inset-x-0 will-change-transform"
                >
                    <Image
                        src={kayakkingImg}
                        alt="Aerial view of turquoise ocean with paddleboarders"
                        fill
                        className="object-cover"
                        style={{ objectPosition: IMAGE_FOCAL_POINT }}
                        sizes="100vw"
                        priority
                    />
                </motion.div>

                {/* Dark overlay for text readability */}
                <div className="absolute inset-0 bg-black/10" />

                {/* Content */}
                <div className="relative z-10 flex flex-col h-full px-4 sm:px-6 md:px-8 pb-8 sm:pb-12 md:pb-16 pt-6 md:pt-8">
                    {/* Headline — stacked on mobile, split apart from tablet up */}
                    <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-between flex-1 gap-2 sm:gap-0">
                        {HEADLINE_WORDS.map((word) => (
                            <h1 key={word} className={HEADLINE_CLASSNAME}>
                                {word}
                            </h1>
                        ))}
                    </div>

                    {/* Bottom paragraph */}
                    <p className="text-white/90 text-center text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl font-semibold max-w-72 sm:max-w-md md:max-w-2xl lg:max-w-198.75 mx-auto leading-relaxed">
                        in this sacred corner kissed by endless blue, we craft
                        moments that transcend ordinary stay. where the rhythm
                        of waves becomes the soundtrack to your spirit{"'"}s
                        gentle awakening.
                    </p>
                </div>
            </div>
        </section>
    );
}
