"use client";

import React, { useRef, useLayoutEffect } from "react";
import Image from "next/image";
// GSAP is imported inside the effect below, not here: its ticker reads `Date.now()` as
// the module evaluates, and with `cacheComponents` on that counts as reading the clock
// during the client prerender, which costs the route its static shell.
// registerPlugin() moved along with it — it is idempotent, so calling it per mount is fine.

const HEADING_TEXT =
    "Two family sanctuaries where beachfront paradise meets tropical highlands. welcoming guests since 1962.";

type SideImage = {
    src: string;
    alt: string;
    variant: "wide" | "slim";
};

// Array order IS the on-screen order inside the flex row (left → right). The
// old `position: "left" | "right"` field is gone along with the per-image
// `left-*`/`right-*` anchors it fed.
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
 * Where the reel parks before the pin engages, as a fraction of the stage's
 * height: 0.9 puts the first row's centre 90% of a viewport BELOW its resting
 * spot, i.e. just off the bottom edge. Carried over unchanged from the old
 * `TRAVEL.hiddenBelow` of 90vh so entry timing is untouched.
 */
const REEL_START_OFFSET = 0.9;

/**
 * Scroll distance granted per pixel the reel travels. Below 1 the images move
 * FASTER than the page scrolls, which is the pacing this section has always
 * had — the value is that pacing recovered from the constants it replaces:
 * the old pin ran (150 × 2.5) / 17.25 × 13.5 = 293.5% of viewport height while
 * the images covered 90vh + 234vh = 324% of it, and 293.5 / 324 = 0.906.
 */
const SCROLL_PER_TRAVEL = 0.906;

/**
 * Vertical gap below each reel row — the ONLY place the spacing between
 * batches is expressed now. It used to be split between GSAP timeline offsets
 * (`topOverlapPercent` and friends, in % of a tween's duration) and per-image
 * CSS anchors, two units that had to be reconciled by hand for every tweak.
 *
 * Below `lg` every gap is a flat 60px: the mobile frames are only 111–190px
 * tall, so the old viewport-derived spacing had rows overlapping each other
 * and the heading. The `lg` values reproduce the previous desktop composition
 * EXACTLY, at any window height — they are the old centre-to-centre distances
 * (52vh + 144px, 92vh − 144px, 90vh) minus half the height of each of the two
 * rows a gap sits between (side rows 376px, top image 288px, top image 2
 * 412px). The stray 144px is half of the top image's height, and comes from
 * `top-[12%]` having been the one anchor that was not centred.
 *
 * The last row needs no margin, hence three values for four rows.
 */
const ROW_SPACING = [
    "mb-15 lg:mb-[calc(52vh_-_188px)]",
    "mb-15 lg:mb-[calc(92vh_-_476px)]",
    "mb-15 lg:mb-[calc(90vh_-_394px)]",
] as const;

// Frame sizes and their matching `sizes` hints. Unchanged from before the
// reel refactor — only where they are mounted in the DOM moved.
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

// Batch 2's closing image stays deliberately larger than the heading's own box
// at every breakpoint: on `lg` the heading is snapped invisible the moment this
// image reaches its resting position, and that "cover" illusion only reads if
// the image is at least as big as the text it replaces. Below `lg` the heading
// is not hidden at all, so this same oversizing is what covers it, purely by
// stacking over it.
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
                 * `matchMedia` rather than a one-off `window.matchMedia` sample:
                 * crossing 1024px now reverts and rebuilds the whole setup, so the
                 * heading-vanish branch below follows a resize instead of needing a
                 * reload. It keeps every `gsap.context()` cleanup guarantee (kills
                 * tweens/ScrollTriggers, removes the pin-spacer, restores inline
                 * styles), which React Strict Mode's double mount depends on.
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

                        // Heading fade: its OWN ScrollTrigger, separate from the pin
                        // timeline below, so it starts as soon as barely visible
                        // ("top 70%") and finishes ("top top") right as the pin begins.
                        //
                        // fromTo + immediateRender:false is load-bearing: a plain .to()
                        // reads its start value off the DOM at init time, and a scrubbed
                        // tween's init moment isn't deterministic — reloading mid-scroll
                        // can fire `scroll` before DOMContentLoaded, initing the tween
                        // while letters are still at their SSR opacity of 1, recording
                        // 1 → 1 (heading never visibly fades). fromTo hardcodes both
                        // ends so the DOM is never sampled; immediateRender:false stops
                        // the `from` being slammed on at creation, which would otherwise
                        // fight the gsap.set above.
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
                         * Everything below is measured from the rendered reel, which is
                         * what makes the CSS gaps above the single source of truth for
                         * spacing: change a `mb-*` and the travel distance, the pin
                         * length and the resting positions all follow on the next
                         * refresh. No number is stated twice.
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

                        // The reel's own top edge sits at 50% of the stage (see its
                        // class list), so cancelling a row's centre offset parks THAT
                        // row dead centre. Start: first row one screen below that.
                        // End: last row on it, which is the moment it covers the
                        // heading and the pin lets go.
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

                        // Heading disappears INSTANTLY (not a fade) as the last image
                        // lands on it — desktop only, because only there is that image
                        // big enough to cover the heading's box. Below `lg` the heading
                        // wraps into more lines than the image can hide, so removing it
                        // would leave a bare gap; it stays visible and simply scrolls
                        // away once the pin releases.
                        if (isDesktop) {
                            timeline.set(text, { autoAlpha: 0 });
                        }
                    },
                    container,
                );

                // The measurements above ran before the Manrope webfont swapped in
                // and before images decoded — both reflow the page afterwards and
                // silently invalidate the pin/trigger measurements. Re-measure once
                // each has settled.
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
                    // `w-full`: as a flex item centered by its container
                    // (`justify-center items-center`), this h2 was shrinking
                    // to its own unwrapped content width instead of the
                    // container's available width, so it never wrapped and
                    // overflowed at mobile widths (same underlying flex
                    // quirk as `ui/heading.tsx`). `w-full` plus the
                    // per-breakpoint `max-w-*` keeps it wrapping sensibly at
                    // every viewport — mobile gets its OWN (smaller) cap
                    // instead of stretching to the full viewport width,
                    // which read as oversized/overflowing text edge-to-edge.
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
                            {/* A real space (not a non-breaking space) so
                                the browser has a soft-wrap point between
                                words -- with a non-breaking space the whole
                                sentence was one unbreakable run and never
                                wrapped, forcing a ~500px-wide heading that
                                overflowed every viewport narrower than
                                that. */}
                            {wi < arr.length - 1 && " "}
                        </React.Fragment>
                    ))}
                </h2>

                {/* The reel: every image in one column, translated as a single
                    element. It has to stay absolutely positioned — the images
                    must pass OVER the heading (`z-30` against the h2's `z-1`),
                    and normal flow cannot overlap. But the spacing INSIDE it is
                    ordinary flex layout, which is why `ROW_SPACING` is now the
                    only place vertical distance is expressed.

                    `top-1/2` (no vertical centring translate) puts the reel's
                    top edge on the stage's middle, so the GSAP math can park any
                    row dead centre just by cancelling that row's own centre
                    offset. A translate here would collide with the `y` GSAP
                    writes.

                    `invisible` is undone by `gsap.set(reel, {autoAlpha: 1})`
                    once the deferred GSAP chunk lands. Without it the reel
                    paints at rest — the first row sitting squarely on the
                    heading — for as long as that import takes. */}
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
 * One reel row holding the two edge images. `justify-between` plus the
 * horizontal padding reproduces the old `left-8`/`right-8` insets (`lg:px-30`
 * matches Container's `mx-30`, so these line up with the section below);
 * `items-center` keeps the two differently sized frames on one axis, as their
 * shared `top-1/2` anchor used to.
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
