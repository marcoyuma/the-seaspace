"use client";

import React, { useRef, useLayoutEffect } from "react";
import Image from "next/image";
// GSAP is imported inside the effect, not here: its ticker reads `Date.now()` at module eval,
// which under `cacheComponents` costs the route its static shell. registerPlugin() moved with it.

const HEADING_TEXT =
    "Two family sanctuaries where beachfront paradise meets tropical highlands. welcoming guests since 1962.";

type SideImage = {
    src: string;
    alt: string;
    variant: "wide" | "slim";
};

// Array order IS the on-screen order inside the flex row (left → right).
const sideImages: SideImage[] = [
    {
        src: "/family-section-images/familyS2.jpg",
        alt: "empty space photo 1",
        variant: "slim",
    },
    {
        src: "/family-section-images/familyS1.jpg",
        alt: "empty space photo 2",
        variant: "wide",
    },
];

const topImage = {
    src: "/family-section-images/familyS5.jpg",
    alt: "empty space photo 3",
};

// Batch 2 reuses the same sources as batch 1 (no new assets yet) but is a
// separate row in the reel, so it passes the heading as its own beat.
const sideImages2: SideImage[] = [
    {
        src: "/family-section-images/familyS4.jpg",
        alt: "empty space photo 1 (batch 2)",
        variant: "wide",
    },
    {
        src: "/family-section-images/familyS3.jpg",
        alt: "empty space photo 2 (batch 2)",
        variant: "slim",
    },
];

const topImage2 = {
    src: "/family-section-images/familyS6.jpg",
    alt: "empty space photo 3 (batch 2)",
};

// Heading letters' pre-fade opacity. Shared by the initial paint state and
// the heading tween's `from` — must match or the fade jumps on frame 1.
const HEADING_DIM_OPACITY = 0.1;

// Per-letter delay of the heading fade-in.
const HEADING_STAGGER_EACH = 0.015;

/**
 * Where the reel parks before the pin, as a fraction of stage height: 0.9 puts the first row's
 * centre 90% of a viewport below its resting spot, just off the bottom edge.
 */
const REEL_START_OFFSET = 0.9;

/**
 * Scroll distance per pixel of reel travel. Below 1, images move FASTER than the page — the
 * section's original pacing (293.5% of viewport pinned for 324% of travel = 0.906).
 */
const SCROLL_PER_TRAVEL = 0.906;

/**
 * Gap below each reel row — the ONLY place batch spacing lives; the last row needs none. Below `lg`
 * a flat 60px (the 111–190px mobile frames overlapped otherwise). The `lg` values are the original
 * centre-to-centre distances minus half of each adjacent row's height.
 */
const ROW_SPACING = [
    "mb-15 lg:mb-[calc(52vh_-_188px)]",
    "mb-15 lg:mb-[calc(92vh_-_476px)]",
    "mb-15 lg:mb-[calc(90vh_-_394px)]",
] as const;

// Frame sizes and their matching `sizes` hints.
const SIDE_FRAME = {
    wide: "w-30 h-27.75 md:w-56 md:h-49 lg:w-84 lg:h-74",
    slim: "w-30 h-47.5 md:w-44 md:h-64 lg:w-64 lg:h-94",
} as const;

const SIDE_SIZES = {
    wide: "(min-width: 1024px) 336px, (min-width: 768px) 224px, 120px",
    slim: "(min-width: 1024px) 256px, (min-width: 768px) 176px, 120px",
} as const;

const TOP_FRAME = "w-37.5 h-33.25 md:w-84 md:h-49 lg:w-122 lg:h-72";
const TOP_SIZES = "(min-width: 1024px) 488px, (min-width: 768px) 336px, 150px";

// Batch 2's closing image stays larger than the heading at every breakpoint: on `lg` the heading
// vanishes as it lands (the "cover" needs it at least as big as the text); below `lg` the heading
// stays, and this oversizing covers it by stacking.
const TOP2_FRAME =
    "w-76 h-72 sm:w-116 sm:h-90 md:w-124 md:h-92 lg:w-140 lg:h-103";
const TOP2_SIZES =
    "(min-width: 1024px) 560px, (min-width: 768px) 496px, (min-width: 640px) 464px, 352px";

export default function FamilyHistorySection() {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLHeadingElement>(null);
    // One ref for the whole reel: every image moves at the same speed, so they
    // are one rigid body and GSAP only ever has to translate this element.
    const reelRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        let cancelled = false;
        /** Set once the animations are wired up; undefined if the chunk never landed. */
        let teardown: (() => void) | undefined;

        // Deferred for the reason given by the imports. The section sits below the
        // fold, so the extra round-trip lands long before it is scrolled into view.
        Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
            ([{ default: gsap }, { ScrollTrigger }]) => {
                // Unmounted while the chunk was in flight — nothing to attach to.
                if (cancelled) return;
                gsap.registerPlugin(ScrollTrigger);

                const container = containerRef.current;
                const stage = stageRef.current;
                const text = textRef.current;
                const reel = reelRef.current;

                if (!container || !stage || !text || !reel) return;

                /**
                 * `matchMedia`, not a one-off sample: crossing 1024px reverts and rebuilds, so the
                 * heading-vanish branch follows a resize. Keeps `gsap.context()`'s cleanup, which
                 * Strict Mode's double mount depends on.
                 */
                const mm = gsap.matchMedia();
                mm.add(
                    {
                        isDesktop: "(min-width: 1024px)",
                        isMobile: "(max-width: 1023px)",
                    },
                    (context) => {
                        const { isDesktop } = context.conditions as {
                            isDesktop: boolean;
                        };

                        // Grab every individual letter span (see JSX below) so they
                        // can be animated one by one.
                        const charEls =
                            text.querySelectorAll<HTMLSpanElement>(
                                "[data-char]",
                            );

                        // Initial states run BEFORE any tween is created, so the first
                        // painted frame is already correct (useLayoutEffect runs ahead
                        // of paint).
                        gsap.set(charEls, { opacity: HEADING_DIM_OPACITY });
                        // Reveals the reel, which the markup paints `invisible` — see
                        // the note on its class list for why.
                        gsap.set(reel, { autoAlpha: 1 });

                        // Heading fade on its OWN trigger, from barely visible ("top 70%") to the pin.
                        // `fromTo` hardcodes both ends (a mid-scroll reload could init `.to()` at the SSR
                        // opacity, 1 → 1); `immediateRender: false` stops it fighting the gsap.set above.
                        gsap.fromTo(
                            charEls,
                            { opacity: HEADING_DIM_OPACITY },
                            {
                                opacity: 1,
                                immediateRender: false,
                                stagger: {
                                    each: HEADING_STAGGER_EACH,
                                    from: "start",
                                },
                                scrollTrigger: {
                                    trigger: container,
                                    start: "top 70%",
                                    end: "top top",
                                    scrub: 1,
                                },
                            },
                        );

                        /**
                         * Everything below is measured from the rendered reel, so the CSS gaps are the
                         * single source of truth: change a `mb-*` and travel, pin length and resting
                         * positions follow on the next refresh.
                         */
                        const rows = gsap.utils.toArray<HTMLElement>(
                            reel.children,
                        );
                        const firstRow = rows[0];
                        const lastRow = rows[rows.length - 1];

                        // Distance from the reel's top edge to a row's middle. The reel
                        // is absolutely positioned, so it is the rows' offsetParent.
                        const centerOf = (row: HTMLElement) =>
                            row.offsetTop + row.offsetHeight / 2;

                        // The reel's top sits at 50% of the stage, so cancelling a row's centre offset
                        // parks it dead centre. Start: first row one screen below; end: last row
                        // centred, covering the heading as the pin lets go.
                        const startY = () =>
                            REEL_START_OFFSET * stage.offsetHeight -
                            centerOf(firstRow);
                        const endY = () => -centerOf(lastRow);

                        const timeline = gsap.timeline({
                            scrollTrigger: {
                                trigger: container,
                                start: "top top",
                                // Pin exactly as long as the reel needs to travel,
                                // scaled by the pacing constant. Function-based so a
                                // resize or a font/image reflow re-measures it.
                                end: () =>
                                    `+=${
                                        (startY() - endY()) * SCROLL_PER_TRAVEL
                                    }`,
                                scrub: 1,
                                pin: stage,
                                pinSpacing: true,
                                invalidateOnRefresh: true,
                            },
                        });

                        // The whole choreography: one linear translation of one
                        // element. `ease: "none"` keeps motion proportional to scroll
                        // speed at every point, which is what scrubbed animations need.
                        timeline.fromTo(
                            reel,
                            { y: () => startY() },
                            { y: () => endY(), ease: "none", duration: 1 },
                        );

                        // The heading vanishes INSTANTLY as the last image lands — desktop only, where
                        // that image covers its box. Below `lg` it wraps too tall to hide, so it stays
                        // and scrolls away after the pin.
                        if (isDesktop) {
                            timeline.set(text, { autoAlpha: 0 });
                        }
                    },
                    container,
                );

                // Measured before the webfont swap and image decode, which both reflow and
                // invalidate pin/trigger measurements — re-measure once each has settled.
                const refresh = () => {
                    if (!cancelled) ScrollTrigger.refresh();
                };

                document.fonts?.ready.then(refresh);

                // "load" has already fired if we mounted late (e.g. client-side nav),
                // and it never fires twice — so check readyState rather than waiting
                // for an event that will never arrive.
                const alreadyLoaded = document.readyState === "complete";
                if (alreadyLoaded) {
                    refresh();
                } else {
                    window.addEventListener("load", refresh);
                }

                teardown = () => {
                    if (!alreadyLoaded)
                        window.removeEventListener("load", refresh);
                    mm.revert();
                };
            },
        );

        return () => {
            cancelled = true;
            teardown?.();
        };
    }, []);

    return (
        <div ref={containerRef} className="relative mb-25">
            {/* This is the element that gets pinned — stays fixed on screen
                for the whole scroll range defined by the ScrollTrigger above. */}
            <div
                ref={stageRef}
                className="relative h-dvh w-full flex justify-center items-center overflow-hidden"
            >
                {/* Heading split word-by-word then letter-by-letter. Each
                    letter is its own span with data-char, which is what
                    both ScrollTriggers above select via querySelectorAll. */}
                <h2
                    aria-label={HEADING_TEXT}
                    ref={textRef}
                    // `w-full`: centred by flex, the h2 shrank to its unwrapped width and overflowed
                    // on mobile (same quirk as `ui/heading.tsx`). The per-breakpoint `max-w-*` gives
                    // mobile its own smaller cap instead of edge-to-edge text.
                    className="w-full max-w-70 sm:max-w-100 md:max-w-115 lg:max-w-133 text-black font-semibold text-[28px] sm:text-[34px] md:text-[40px] lg:text-[48px] leading-tight text-center relative z-1"
                >
                    {HEADING_TEXT.split(" ").map((word, wi, arr) => (
                        <React.Fragment key={wi}>
                            <span
                                aria-hidden="true"
                                className="inline-block whitespace-nowrap"
                            >
                                {word.split("").map((char, ci) => (
                                    <span
                                        key={ci}
                                        data-char
                                        className="inline-block"
                                    >
                                        {char}
                                    </span>
                                ))}
                            </span>
                            {/* A real space, not &nbsp;, so the browser can wrap between words —
                                otherwise the sentence is one unbreakable ~500px run. */}
                            {wi < arr.length - 1 && " "}
                        </React.Fragment>
                    ))}
                </h2>

                {/* The reel: every image in one absolute column (they must pass OVER the h2),
                    moved as one element; inner spacing is plain flex via `ROW_SPACING`. `top-1/2`,
                    not a translate (GSAP owns `y`); `invisible` until GSAP lands, or row 1 covers the heading. */}
                <div
                    ref={reelRef}
                    className="invisible absolute top-1/2 inset-x-0 z-30 flex flex-col"
                >
                    <SideRow images={sideImages} className={ROW_SPACING[0]} />
                    <CenterRow
                        image={topImage}
                        frame={TOP_FRAME}
                        sizes={TOP_SIZES}
                        className={ROW_SPACING[1]}
                    />
                    <SideRow images={sideImages2} className={ROW_SPACING[2]} />
                    <CenterRow
                        image={topImage2}
                        frame={TOP2_FRAME}
                        sizes={TOP2_SIZES}
                        className=""
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * Reel row with the two edge images. `lg:px-30` matches Container's `mx-30`, aligning with the
 * section below; `items-center` keeps the differently sized frames on one axis.
 */
function SideRow({
    images,
    className,
}: {
    images: SideImage[];
    className: string;
}) {
    return (
        <div
            className={`flex items-center justify-between px-8 md:px-16 lg:px-30 ${className}`}
        >
            {images.map((image) => (
                <div
                    key={image.src}
                    className={`relative shrink-0 ${SIDE_FRAME[image.variant]}`}
                >
                    <Image
                        src={image.src}
                        alt={image.alt}
                        fill
                        sizes={SIDE_SIZES[image.variant]}
                        className="object-cover rounded-2xl"
                    />
                </div>
            ))}
        </div>
    );
}

/** A reel row holding a single centred image. */
function CenterRow({
    image,
    frame,
    sizes,
    className,
}: {
    image: { src: string; alt: string };
    frame: string;
    sizes: string;
    className: string;
}) {
    return (
        <div className={`flex justify-center ${className}`}>
            <div className={`relative shrink-0 ${frame}`}>
                <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes={sizes}
                    className="object-cover rounded-2xl"
                />
            </div>
        </div>
    );
}
