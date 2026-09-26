"use client";

import Heading from "@/ui/heading";
import OverlineText from "@/ui/overline-text";
import Image, { type StaticImageData } from "next/image";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import Text from "@/ui/text";
import gallery1 from "@/public/gallery/g1.jpg";
import gallery2 from "@/public/gallery/g2.jpg";
import gallery3 from "@/public/gallery/g3.jpg";
import gallery4 from "@/public/gallery/g4.jpg";
import gallery5 from "@/public/gallery/g5.jpg";
import gallery6 from "@/public/gallery/g6.jpg";
import gallery7 from "@/public/gallery/g7.png";
import gallery8 from "@/public/gallery/g8.jpg";

// GSAP is imported inside the effect below, not here: its ticker reads `Date.now()` as
// the module evaluates, and with `cacheComponents` on that counts as reading the clock
// during the client prerender, which costs the route its static shell.
import { ArrowDownIcon } from "@phosphor-icons/react/dist/ssr";

import {
    PRELOADER_GATE_ATTR,
    PRELOADER_WARM_ATTR,
} from "@/lib/preloader";

/**
 * Scroll px per 1px of horizontal slide (1 = 1:1). Higher reads as mass and holds attention on
 * the section longer.
 */
const SCROLL_RESISTANCE = 1.8;

/**
 * Wide-frame image zoom during the pin. The overflow — (scale − 1) / 2 of the frame per side
 * (1.3 → 15%) — is the slack budget the parallax slide may move within.
 */
const WIDE_PARALLAX_SCALE = 1.3;

/**
 * Slim-frame zoom, deliberately deeper: the slide is % of the frame's OWN width, so a 315px frame
 * needs more slack (1.5 → 25% per side) for visible motion.
 */
const SLIM_PARALLAX_SCALE = 1.5;

/**
 * How far (% of frame width) wide images slide, −shift → +shift, across the pin; must fit the
 * scale's slack or frame edges show. Runs COUNTER to the frames' travel, so each photo seems to
 * hold still as its window passes over it — the classic reveal parallax.
 */
const WIDE_PARALLAX_SHIFT_PERCENT = 14;

/**
 * Slim counterpart of `WIDE_PARALLAX_SHIFT_PERCENT`, within `SLIM_PARALLAX_SCALE`'s slack; higher
 * so the narrow frames sweep a comparable number of absolute pixels.
 */
const SLIM_PARALLAX_SHIFT_PERCENT = 24;

/**
 * Where a mobile frame waits (% of its own width): a centred 86dvw frame needs 108% to clear the
 * right edge; 115 absorbs sub-pixel rounding. Horizontal card stacking — frames slide in along X
 * and park centred on the previous one; the photo inside never drifts on its own.
 */
const MOBILE_STACK_OFFSCREEN_PERCENT = 115;

/**
 * How dark a card's overlay (see `ImageShaper`) goes once the next card covers it. Animated on the
 * incoming card's segment, so the shadow spreads as that card slides over.
 */
const MOBILE_COVER_OPACITY = 0.55;

/**
 * Mobile scrub catch-up (s). `scrub: true` maps 1:1 with no smoothing, inheriting every jitter of
 * momentum scrolling; a number interpolates, as GSAP advises with `snap`. Desktop keeps `true`.
 */
const MOBILE_SCRUB_SMOOTHING = 0.5;

/**
 * Scroll per card transition, × pinned stage height (pin = (items − 1) × this × height). Mobile's
 * `SCROLL_RESISTANCE`: with no track travel to multiply, the length comes from the card count.
 */
const MOBILE_STACK_SCROLL_PER_CARD = 0.7;

/**
 * Snap settle time (s). Must be slower than a phone's momentum decay, or the snap and the browser
 * fight over `scrollTop` and the settle stutters.
 */
const MOBILE_SNAP_DURATION = { min: 0.25, max: 0.5 };

/**
 * Quiet time before the snap starts; must outlast inertial scrolling, or the snap begins while
 * momentum still moves the page. GSAP's boolean-scrub default of 0.1 is too short for touch.
 */
const MOBILE_SNAP_DELAY = 0.15;

/**
 * Snap glide easing — the source of the "smooth and natural" feel. Deliberately NOT on the
 * per-card tweens, which stay linear so images track the finger 1:1 (see the `ease: "none"` note).
 */
const MOBILE_SNAP_EASE = "power2.inOut";

/**
 * Caption wipe-in time (s), played when the pin engages and reversed above its start. Not
 * scrubbed: the caption must be fully visible at once, however slowly the user scrolls.
 */
const CAPTION_INTRO_DURATION = 0.5;

/**
 * Timeline progress (0–1) where the scrubbed caption wipe-out starts. A FRACTION, not seconds:
 * timeline length differs per breakpoint, so it's scaled by `timeline.duration()` at the call site.
 */
const CAPTION_HIDE_START = 0.6;

/**
 * Progress where the caption is fully gone — well before the pin releases, so nothing lingers.
 * Scaled like `CAPTION_HIDE_START`.
 */
const CAPTION_HIDE_END = 0.8;

/**
 * `sizes` per variant — without it `fill` assumes 100vw for every frame. Desktop is frame width ×
 * parallax scale (1000×1.3 = 1300, 315×1.5 = 473), as photos paint larger than their frames.
 * Mobile has no parallax, so the photo is exactly the frame's 86dvw.
 */
const GALLERY_SIZES = {
    wide: "(min-width: 768px) 1300px, 86vw",
    slim: "(min-width: 768px) 473px, 86vw",
} as const;

/**
 * Frames that skip lazy loading: exactly one, because the curtain gates on it. Eager emits a
 * preload hint, and each extra one bids against the hero; the other seven are warmed once the
 * curtain lifts (ui/preloader.tsx).
 */
const EAGER_FRAME_COUNT = 1;

type GalleryItem = {
    src: StaticImageData;
    alt: string;
    variant: "wide" | "slim";
};

/**
 * Gallery content as data. Swap `src`/`alt` per item when real images are
 * ready — the scroll distance is measured from the rendered DOM, so any
 * number of items or mix of variants works without touching the animation.
 */
const GALLERY_ITEMS: GalleryItem[] = [
    {
        src: gallery1,
        alt: "Infinity pool inside a limestone sea cave, bougainvillea spilling over the opening",
        variant: "wide",
    },
    {
        src: gallery2,
        alt: "Narrow lap pool between whitewashed walls, an arch at its far end framing the sea",
        variant: "slim",
    },
    {
        src: gallery3,
        alt: "White timber lounge set on the sand under a string of lights, facing the bay",
        variant: "wide",
    },
    {
        src: gallery4,
        alt: "Weathered deck table and benches out over the water, a fishing boat passing beyond",
        variant: "slim",
    },
    {
        src: gallery5,
        alt: "Aerial view of a charter boat anchored in clear water, guests swimming alongside",
        variant: "wide",
    },
    {
        src: gallery6,
        alt: "Snorkeller gliding past a coral-covered rock wall in shallow, sunlit water",
        variant: "slim",
    },
    {
        src: gallery7,
        alt: "Dining room with blue-framed doors opening onto a terrace above the sea",
        variant: "wide",
    },
    {
        src: gallery8,
        alt: "Sun loungers and parasols along a palm-lined beach at the water's edge",
        variant: "slim",
    },
];

/**
 * SSR-safe layout effect: `useLayoutEffect` measures and pins before paint (no flash), but React
 * warns about it on the server, so the server falls back to `useEffect`.
 */
const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function Gallery() {
    /**
     * `sectionRef` is pinned on desktop; `trackRef` slides on X and anchors the position math, so
     * the pin engages when the IMAGES reach viewport centre; `captionRef` is the text + arrow.
     */
    const sectionRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const captionRef = useRef<HTMLDivElement>(null);
    /**
     * Track + indicator wrapper. On mobile it's a fixed `100svh` box and the pinned element, keeping
     * card and indicator within one screen (see its JSX comment).
     */
    const stageRef = useRef<HTMLDivElement>(null);
    // Mobile pagination dots, toggled imperatively from the scrub's `onUpdate` rather than React
    // state — GSAP owns the DOM here, and there's no re-render per scroll tick.
    const dotsRef = useRef<HTMLDivElement>(null);

    useIsomorphicLayoutEffect(() => {
        const section = sectionRef.current;
        const track = trackRef.current;
        const caption = captionRef.current;
        const stage = stageRef.current;

        if (!section || !track || !caption || !stage) return;

        let cancelled = false;
        /** Set once matchMedia is wired up; undefined if the chunk never landed. */
        let teardown: (() => void) | undefined;

        // Deferred for the reason given by the imports. The gallery sits below the
        // fold, so the extra round-trip lands long before it is scrolled into view.
        Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
            ([{ default: gsap }, { ScrollTrigger }]) => {
                // Unmounted while the chunk was in flight — nothing to attach to.
                if (cancelled) return;
                // Registration must happen before any `scrollTrigger` config is
                // passed to a tween. GSAP guards against duplicate registration
                // internally, so running this per mount is safe.
                gsap.registerPlugin(ScrollTrigger);


                /**
                 * `gsap.matchMedia()`: `gsap.context()`'s revert guarantees (tweens, pin-spacer,
                 * inline styles — vital under Strict Mode's double mount) plus a rebuild whenever
                 * 768px is crossed. Desktop and mobile need different tuning, so each is a branch.
                 */
                const mm = gsap.matchMedia();
                mm.add(
                    {
                        isDesktop: "(min-width: 768px)",
                        isMobile: "(max-width: 767px)",
                    },
                    (context) => {
                        const { isMobile } = context.conditions as {
                            isMobile: boolean;
                        };
                        /**
                         * DESKTOP ONLY (mobile's track never travels): how far the track slides so
                         * the last image reaches the edge. A function so ScrollTrigger re-reads it
                         * on every `refresh()` (resize, image load).
                         */
                        const getScrollDistance = () =>
                            track.scrollWidth - track.clientWidth;

                        /**
                         * Mobile hand-offs (8 cards → 7): also the mobile timeline's length in
                         * seconds and the snap increment's denominator. Desktop ignores it.
                         */
                        const steps = GALLERY_ITEMS.length - 1;

                        /**
                         * Caption intro: a paused, time-based tween so it appears IMMEDIATELY when
                         * the pin engages; `onToggle` plays/reverses it and the scrubbed hide owns
                         * the other end. `fromTo` renders `from` at creation, so no CSS pre-hide.
                         */
                        const captionIntro = gsap.fromTo(
                            caption,
                            { opacity: 0, clipPath: "inset(0% 100% 0% 0%)" },
                            {
                                opacity: 1,
                                clipPath: "inset(0% 0% 0% 0%)",
                                duration: CAPTION_INTRO_DURATION,
                                ease: "power2.out",
                                paused: true,
                            },
                        );

                        /**
                         * Main pinned timeline: travel and caption share one ScrollTrigger, so the
                         * caption can never fall out of sync with the images.
                         */
                        const timeline = gsap.timeline({
                            scrollTrigger: {
                                /**
                                 * Desktop pins `section` once the track's centre meets the
                                 * viewport's, for distance × SCROLL_RESISTANCE. Mobile pins the
                                 * 100svh `stage`; centring the taller section hid the indicator.
                                 */
                                trigger: isMobile ? stage : track,
                                start: isMobile ? "top top" : "center center",
                                end: () =>
                                    isMobile
                                        ? `+=${
                                              steps *
                                              stage.offsetHeight *
                                              MOBILE_STACK_SCROLL_PER_CARD
                                          }`
                                        : `+=${
                                              getScrollDistance() *
                                              SCROLL_RESISTANCE
                                          }`,
                                pin: isMobile ? stage : section,
                                /**
                                 * MUST stay explicit: ScrollTrigger disables pinSpacing when the
                                 * pinned element's parent is flex (mobile's `stage`), and without
                                 * the spacer the page scrolled straight past the frozen gallery.
                                 */
                                pinSpacing: true,
                                anticipatePin: 1,
                                /**
                                 * Mobile only: settle each release on a centred card (`i / steps`)
                                 * so hand-offs read as clicks. Desktop shows several frames at
                                 * once, so there's no single resting position to snap to.
                                 */
                                ...(isMobile
                                    ? {
                                          snap: {
                                              snapTo: 1 / steps,
                                              duration: MOBILE_SNAP_DURATION,
                                              ease: MOBILE_SNAP_EASE,
                                              delay: MOBILE_SNAP_DELAY,
                                          },
                                      }
                                    : {}),
                                /**
                                 * `true` binds progress to the scrollbar with no lag — right for a
                                 * wheel, but on touch it inherits momentum jitter and gives the
                                 * snap nothing to blend against, hence MOBILE_SCRUB_SMOOTHING.
                                 */
                                scrub: isMobile ? MOBILE_SCRUB_SMOOTHING : true,
                                // Recompute `x` and `end` (both function-based) whenever
                                // ScrollTrigger refreshes, e.g. after a resize.
                                invalidateOnRefresh: true,
                                /**
                                 * Plays the caption intro when the pin engages downward and
                                 * reverses it when it disengages upward; the pin-end cases
                                 * belong to the scrubbed hide.
                                 */
                                onToggle: (self) => {
                                    if (self.isActive && self.direction === 1) {
                                        captionIntro.play();
                                    } else if (!self.isActive && self.direction === -1) {
                                        captionIntro.reverse();
                                    }
                                },
                                /**
                                 * Mobile dots — the only "which of 8" cue, since each card fills
                                 * the screen. `round`, not `floor`: snap parks exactly on
                                 * `i / steps`, where flooring would flip the dot a fraction early.
                                 */
                                onUpdate: (self) => {
                                    if (!isMobile || !dotsRef.current) return;
                                    const activeIndex = Math.round(
                                        self.progress * steps,
                                    );
                                    Array.from(dotsRef.current.children).forEach(
                                        (dot, i) => {
                                            dot.classList.toggle(
                                                "w-6",
                                                i === activeIndex,
                                            );
                                            dot.classList.toggle(
                                                "bg-black/80",
                                                i === activeIndex,
                                            );
                                            dot.classList.toggle(
                                                "w-3",
                                                i !== activeIndex,
                                            );
                                            dot.classList.toggle(
                                                "bg-black/20",
                                                i !== activeIndex,
                                            );
                                        },
                                    );
                                },
                            },
                        });

                        /**
                         * MOBILE — horizontal card stacking: each frame waits off the right edge
                         * and slides to centre over the previous one (ascending zIndex, set via GSAP
                         * so `mm.revert()` strips it). Card `i` owns second `i − 1`: the snap grid.
                         */
                        if (isMobile) {
                            const cards = gsap.utils.toArray<HTMLElement>(
                                track.children,
                            );

                            // Waiting frames stay fully opaque, just clipped by the track's mobile
                            // `overflow-hidden`, so an entrance reads as a solid card sliding over.
                            gsap.set(cards, {
                                xPercent: MOBILE_STACK_OFFSCREEN_PERCENT,
                                autoAlpha: 1,
                                zIndex: (i: number) => i,
                            });
                            // The first frame is the one already on screen when the pin
                            // engages, so it never plays an entrance.
                            gsap.set(cards[0], { xPercent: 0 });

                            // `ease: "none"` is load-bearing: with a curve a frame finishes ~99% of
                            // its travel by 85% of its segment, so the snap moved the page with no
                            // matching motion. Smoothness comes from scrub smoothing and snap ease.
                            cards.forEach((card, i) => {
                                if (i === 0) return;
                                timeline.to(
                                    card,
                                    {
                                        xPercent: 0,
                                        ease: "none",
                                        duration: 1,
                                    },
                                    i - 1,
                                );
                                // The frame BENEATH darkens over the same second, so the shadow
                                // spreads exactly as the incoming frame covers it.
                                timeline.to(
                                    cards[i - 1].querySelector("[data-cover]"),
                                    {
                                        opacity: MOBILE_COVER_OPACITY,
                                        ease: "none",
                                        duration: 1,
                                    },
                                    i - 1,
                                );
                            });
                        } else {
                            // Travel spans the whole timeline; scrubbed tweens must be linear to
                            // keep scroll and motion mapped 1:1.
                            timeline.to(track, {
                                x: () => -getScrollDistance(),
                                ease: "none",
                                duration: 1,
                            });

                            /**
                             * Desktop parallax on the same scrub: each zoomed <img> slides −shift →
                             * +shift, COUNTER to the track, within its (scale − 1) / 2 slack. Images
                             * and track are separate targets, so their transforms never clash.
                             */
                            const wideImages = track.querySelectorAll(
                                '[data-variant="wide"] img',
                            );
                            const slimImages = track.querySelectorAll(
                                '[data-variant="slim"] img',
                            );
                            gsap.set(wideImages, { scale: WIDE_PARALLAX_SCALE });
                            gsap.set(slimImages, { scale: SLIM_PARALLAX_SCALE });
                            timeline.fromTo(
                                wideImages,
                                { xPercent: -WIDE_PARALLAX_SHIFT_PERCENT },
                                {
                                    xPercent: WIDE_PARALLAX_SHIFT_PERCENT,
                                    ease: "none",
                                    duration: 1,
                                },
                                0,
                            );
                            timeline.fromTo(
                                slimImages,
                                { xPercent: -SLIM_PARALLAX_SHIFT_PERCENT },
                                {
                                    xPercent: SLIM_PARALLAX_SHIFT_PERCENT,
                                    ease: "none",
                                    duration: 1,
                                },
                                0,
                            );
                        }

                        /**
                         * Caption hide: a scrubbed left→right wipe, mirrored on scroll-up.
                         * `immediateRender: false` keeps its `from` off the intro's hidden state;
                         * the fractions scale by the duration read BEFORE this tween is added.
                         */
                        const timelineDuration = timeline.duration();

                        timeline.fromTo(
                            caption,
                            { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" },
                            {
                                opacity: 0,
                                clipPath: "inset(0% 0% 0% 100%)",
                                ease: "none",
                                duration:
                                    (CAPTION_HIDE_END - CAPTION_HIDE_START) *
                                    timelineDuration,
                                immediateRender: false,
                            },
                            CAPTION_HIDE_START * timelineDuration,
                        );
                    },
                    section,
                );

                // Kills every tween/ScrollTrigger from both branches, removes the pin-spacer and
                // reverts inline styles — no leaks or Strict Mode double-init artifacts.
                teardown = () => mm.revert();
            },
        );

        return () => {
            cancelled = true;
            teardown?.();
        };
    }, []);

    return (
        // `overflow-hidden` clips the translated track so the horizontal
        // motion never produces a page-level horizontal scrollbar.
        <div
            ref={sectionRef}
            id="gallery"
            className="flex flex-col gap-5 max-w-dvw mb-12 md:mb-27.5 overflow-hidden scroll-mt-14"
        >
            {/* `gap-3` is the site-wide overline/heading/text spacing (RESPONSIVE-AUDIT.md
                Bagian F); the wrapper's larger `gap-5` spaces this block from the track. */}
            <div className="flex flex-col gap-3 justify-center items-center">
                <OverlineText>Gallery</OverlineText>
                <Heading className="text-center">
                    Sanctuary of Stolen Moment
                </Heading>
                <Text className="text-center">
                    Happy guests is what we seek the most. The outcome for
                    happiness is nothing but leisure
                </Text>
            </div>
            {/* Track + indicator, grouped so the indicator's margin counts from the track. On
                mobile it's the pinned stage: `svh` never resizes with the address bar, so the
                indicator stays above the fold. `pt-5` is a deliberate 14px downward nudge. */}
            <div
                ref={stageRef}
                className="h-[100svh] pt-5 flex flex-col items-center justify-center md:h-auto md:pt-0 md:block"
            >
                {/* Desktop: the GSAP-translated flex row. Mobile: a positioning context whose
                    `overflow-hidden` clips waiting frames — a pinned (fixed) stage escapes the
                    section's clip. Reset above `md`, where the row outgrows its container. */}
                <div
                    ref={trackRef}
                    className="relative w-full h-[80svh] overflow-hidden md:h-auto md:w-auto md:overflow-visible md:flex md:gap-3.5"
                >
                    {GALLERY_ITEMS.map((item, index) => (
                        <ImageShaper key={index} variant={item.variant}>
                            <Image
                                className="h-full w-full object-cover"
                                src={item.src}
                                placeholder="blur"
                                quality={90}
                                fill
                                sizes={GALLERY_SIZES[item.variant]}
                                // `priority` on all eight (deprecated in Next 16 anyway) put
                                // eight preload hints for below-the-fold photos in the head,
                                // competing with the hero for the connection.
                                loading={
                                    index < EAGER_FRAME_COUNT
                                        ? "eager"
                                        : undefined
                                }
                                alt={item.alt}
                                // The first frame is what the preloader curtain waits on;
                                // the lazy ones get warmed once it lifts so they do not pop
                                // in mid-pin. See ui/preloader.tsx.
                                {...(index === 0
                                    ? { [PRELOADER_GATE_ATTR]: "gallery" }
                                    : {})}
                                {...(index >= EAGER_FRAME_COUNT
                                    ? { [PRELOADER_WARM_ATTR]: "" }
                                    : {})}
                            />
                        </ImageShaper>
                    ))}
                </div>
                {/* Indicator; mobile adds dots, as each card fills the screen. A flow child, not
                    an overlay: the fixed-height stage already keeps it on screen without leaning
                    on the heights that caused the bug. */}
                <div className="mt-2 md:mt-6.5 flex flex-col items-center gap-3">
                    <div
                        ref={dotsRef}
                        className="flex md:hidden items-center gap-1.5"
                    >
                        {GALLERY_ITEMS.map((_, index) => (
                            <span
                                key={index}
                                className={`h-1 rounded-full transition-all ${
                                    index === 0
                                        ? "w-6 bg-black/80"
                                        : "w-3 bg-black/20"
                                }`}
                            />
                        ))}
                    </div>
                    {/* Shown and hidden by the scrubbed clip-path wipes. */}
                    <div
                        ref={captionRef}
                        className="flex items-center justify-center gap-2 text-[16px] font-bold text-black"
                    >
                        <p>Keep scrolling to continue the journey</p>
                        <span className="rounded-full border border-dotted border-black p-1">
                            <ArrowDownIcon size={16} color="#000000" />
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ImageShaper({
    children,
    variant,
}: {
    children: React.ReactNode;
    variant: "wide" | "slim";
}) {
    // Below `md`, frames share one near-full-screen size (`svh`, as in the stage) and stack on
    // each other. Centred with `inset-0 m-auto`, not `-translate-x-1/2`: GSAP writes `transform`
    // for `xPercent`, and a translate utility would fight it.
    const frameSize =
        variant === "wide"
            ? "w-[86dvw] h-[80svh] md:w-[1000px] md:h-[609px]"
            : "w-[86dvw] h-[80svh] md:w-[315px] md:h-[609px]";
    return (
        // `data-variant` lets the desktop parallax tweens target wide and slim
        // frames separately with variant-specific depth settings.
        <div
            data-variant={variant}
            className={`absolute inset-0 m-auto overflow-hidden cursor-grab shrink-0 md:relative md:inset-auto md:m-0 ${frameSize}`}
        >
            {children}
            {/* Mobile shadow, darkened once covered. `opacity-0` must be a class: GSAP loads
                lazily, and cards would flash black until then. Its inline opacity outranks this. */}
            <div
                data-cover
                className="absolute inset-0 bg-black opacity-0 pointer-events-none md:hidden"
            />
        </div>
    );
}
