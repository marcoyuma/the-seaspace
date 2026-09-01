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
 * Stretches the pinned scroll distance relative to the horizontal travel:
 * a value of 1 gives a 1:1 (1px scroll = 1px slide) mapping; higher values
 * make the user scroll further to move the gallery the same distance, which
 * reads as mass/heaviness and holds attention on the section longer.
 */
const SCROLL_RESISTANCE = 1.8;

/**
 * How much each wide-frame image is scaled up during the pin so it bleeds
 * past its clipping frame on both sides, creating hidden slack of
 * (scale − 1) / 2 of the frame width per side (1.3 → 15% each side). This
 * slack is the budget the parallax slide is allowed to move within.
 */
const WIDE_PARALLAX_SCALE = 1.3;

/**
 * Same role as `WIDE_PARALLAX_SCALE`, but for slim frames — and
 * deliberately deeper. The parallax slide is measured in % of the frame's
 * OWN width, so on a 315px slim frame the same percentage moves far fewer
 * absolute pixels than on a 1000px wide frame; a bigger zoom buys the
 * bigger slack budget (1.5 → 25% each side) that visible motion requires.
 */
const SLIM_PARALLAX_SCALE = 1.5;

/**
 * How far (in % of frame width) each wide-frame image slides inside its
 * frame across the full pin, from −shift to +shift. Must stay within
 * `WIDE_PARALLAX_SCALE`'s slack budget or the frame edges would show empty
 * background. The slide is scrubbed on the main timeline and runs COUNTER
 * to the frames' travel: as the frames sweep left, each photo drifts right
 * inside its window (mirrored on scroll-up), so the photo appears to hold
 * its ground while the frame passes over it — the classic reveal parallax
 * — with no delay or drift.
 */
const WIDE_PARALLAX_SHIFT_PERCENT = 14;

/**
 * Slim-frame counterpart of `WIDE_PARALLAX_SHIFT_PERCENT`, kept within
 * `SLIM_PARALLAX_SCALE`'s slack budget. Much higher than the wide shift so
 * the narrow frames sweep a comparable number of absolute pixels and their
 * motion reads just as clearly.
 */
const SLIM_PARALLAX_SHIFT_PERCENT = 24;

/**
 * Where a frame waits before its turn, as a % of its OWN width. On mobile each
 * frame is 86dvw and centred, so its left edge rests at 7dvw; clearing the
 * right viewport edge takes 93dvw of travel, which is 108% of the frame's
 * width. 115 buys margin for sub-pixel rounding so no sliver shows on entry.
 *
 * This is the "horizontal" in horizontal card stacking: a frame slides in
 * along the X axis and parks dead centre on top of the previous one. The photo
 * INSIDE the frame never moves independently — that second, layered sideways
 * drift was removed deliberately.
 */
const MOBILE_STACK_OFFSCREEN_PERCENT = 115;

/**
 * How dark a card goes once the next one has covered it. Applied to a black
 * overlay inside each frame (see `ImageShaper`), animated on the same segment
 * as the incoming card — so the shadow is still visible THROUGH the half-
 * transparent card above it, which is what sells "about to be covered".
 */
const MOBILE_COVER_OPACITY = 0.55;

/**
 * Catch-up time (seconds) for the mobile scrub. `scrub: true` binds progress
 * 1:1 to the scrollbar with NO smoothing, so on touch devices the animation
 * inherits every irregularity of a burst-y, momentum-driven scroll stream. A
 * numeric scrub interpolates towards the target instead, which is also what
 * GSAP recommends whenever `snap` is in play. Desktop keeps `true`: a mouse
 * wheel already delivers even deltas and there is no snap to cooperate with.
 */
const MOBILE_SCRUB_SMOOTHING = 0.5;

/**
 * Scroll length granted to each card transition, as a multiple of the pinned
 * stage's height — total pin = (items − 1) × this × stage height. Replaces
 * `SCROLL_RESISTANCE`'s role on mobile: there is no horizontal track travel
 * left to multiply, so the pin length is built from the card count instead.
 */
const MOBILE_STACK_SCROLL_PER_CARD = 0.7;

/**
 * Snap settle time, seconds. Was {0.15, 0.35}, which is faster than a phone's
 * own momentum scroll can decay — the snap and the browser ended up animating
 * `scrollTop` against each other, which is what made the settle stutter.
 */
const MOBILE_SNAP_DURATION = { min: 0.25, max: 0.5 };

/**
 * Quiet time after the last scroll event before the snap starts. Must outlast
 * the tail of the browser's inertial scrolling; at the previous 0.05 the snap
 * began while the finger's momentum was still moving the page. GSAP's own
 * default for a boolean scrub is 0.1, and touch needs more headroom than that.
 */
const MOBILE_SNAP_DELAY = 0.15;

/**
 * Easing for the snap glide itself. This is where the animation's "smooth and
 * natural" comes from — deliberately NOT from easing the per-card tweens,
 * which have to stay linear so the images track the finger 1:1. See the
 * `ease: "none"` note in the mobile branch.
 */
const MOBILE_SNAP_EASE = "power2.inOut";

/**
 * Seconds for the time-based caption wipe-in that plays the instant the pin
 * engages (and plays in reverse when the user scrolls back up past the pin
 * start). Intentionally NOT scrubbed: the caption must be fully on screen
 * immediately, regardless of how slowly the user keeps scrolling.
 */
const CAPTION_INTRO_DURATION = 0.5;

/**
 * Main-timeline progress (0–1) at which the scrubbed caption wipe-out
 * begins. Paired with `CAPTION_HIDE_END` to define the fade-out window.
 *
 * A FRACTION, not a number of seconds — the timeline's length differs per
 * breakpoint (1s on desktop, one second per card on mobile), so both of these
 * get multiplied by `timeline.duration()` at the call site.
 */
const CAPTION_HIDE_START = 0.6;

/**
 * Main-timeline progress (0–1) at which the caption is fully gone — 80%,
 * well before the images finish scrolling and the pin releases, so nothing
 * lingers once the gallery hands control back to the page. Scaled the same
 * way as `CAPTION_HIDE_START`.
 */
const CAPTION_HIDE_END = 0.8;

/**
 * `sizes` per frame variant. Load-bearing, not a nicety: with `fill` and no `sizes` the
 * browser assumes 100vw for EVERY frame, so a 315px slim frame was pulling the same
 * full-viewport file as the 1000px wide one.
 *
 * On DESKTOP the number is the frame width times its parallax scale — each photo is
 * deliberately painted larger than its frame so it has slack to slide inside it (see the
 * constants above): wide 1000px x 1.3 = 1300px, slim 315px x 1.5 = 473px.
 *
 * MOBILE has no parallax any more, so there is no slack to pay for: the frame slides in at
 * its natural size and the photo fills it exactly, so the painted width is simply the frame's
 * own 86dvw. This used to read 138vw, sized for a 1.6x zoom that no longer exists, which had
 * the browser fetching a file 60% wider than anything it could display.
 */
const GALLERY_SIZES = {
    wide: "(min-width: 768px) 1300px, 86vw",
    slim: "(min-width: 768px) 473px, 86vw",
} as const;

/**
 * Frames that skip lazy loading. Exactly one, and only because the preloader curtain gates on
 * it — `loading="eager"` makes Next emit a `<link rel=preload>`, and the hero the curtain is
 * really waiting for does not get one (it cannot; see hero.tsx). Every extra eager frame here
 * is another below-the-fold photo bidding against it.
 *
 * The other seven are warmed in the background the moment the curtain lifts, which is long
 * before anyone scrolls this far. See ui/preloader.tsx.
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
 * SSR-safe layout effect.
 *
 * `useLayoutEffect` fires synchronously after DOM mutations but BEFORE the
 * browser paints — the correct phase for measuring layout (scrollWidth /
 * clientWidth) and pinning elements without a visual flash. However, React
 * warns when `useLayoutEffect` runs during server rendering because there is
 * no DOM on the server. Falling back to `useEffect` on the server silences
 * the warning while preserving pre-paint measurement in the browser.
 */
const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function Gallery() {
    /**
     * `sectionRef` — the element ScrollTrigger pins to the viewport.
     * `trackRef`   — the horizontal flex row that gets translated on the X
     *                axis; also the trigger for all position math, so the
     *                pin engages when the IMAGES hit the viewport center.
     * `captionRef` — the text + arrow block revealed near the end of the pin.
     * Pinning the section (headings + track + caption) keeps the whole
     * gallery block frozen in place while only the track slides horizontally.
     */
    const sectionRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const captionRef = useRef<HTMLDivElement>(null);
    /**
     * `stageRef` — the track + indicator wrapper. On mobile this is a fixed
     * `100svh` box and it, not the whole section, is what gets pinned, so the
     * card and the indicator below it are always laid out inside one screen's
     * worth of space. See its class list in the JSX for why that is what stops
     * the indicator being pushed under the fold.
     */
    const stageRef = useRef<HTMLDivElement>(null);
    // Mobile-only pagination dots (one per GALLERY_ITEMS), driven imperatively
    // from the scrub's `onUpdate` below instead of React state, matching the
    // rest of this file's GSAP-owns-the-DOM approach and avoiding a re-render
    // on every scroll tick.
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
                 * GSAP lifecycle — `gsap.matchMedia()`:
                 *
                 * Same revert guarantees as `gsap.context()` (kills tweens/
                 * ScrollTriggers, removes the pin-spacer, restores inline styles on
                 * cleanup — critical for React Strict Mode's mount → cleanup →
                 * mount double-invoke), PLUS automatic re-run whenever the viewport
                 * crosses a registered breakpoint: crossing 768px reverts the old
                 * context and rebuilds the timeline with the other branch's tuning,
                 * so resizing across the breakpoint never leaves a stale pin/scale.
                 *
                 * Desktop and mobile need different scale/shift/resistance
                 * constants (see `MOBILE_*` above `ImageShaper` frames are a single
                 * uniform size on mobile instead of wide/slim), so each branch is
                 * its own `mm.add()` condition rather than one shared build.
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
                         * DESKTOP ONLY. Mobile's frames are absolutely positioned on top
                         * of one another and slide individually (see the `isMobile`
                         * branch below), so the track itself never travels and this
                         * measurement would read zero there.
                         *
                         * Horizontal distance formula:
                         *
                         *   distance = track.scrollWidth - track.clientWidth
                         *
                         * `scrollWidth` is the full content width of all children (wide +
                         * slim images + flex gaps), `clientWidth` is the visible portion.
                         * Their difference is exactly how far the track must translate
                         * left so the last image's right edge reaches the viewport edge —
                         * i.e. every image has fully scrolled through the view.
                         *
                         * Defined as a function (not a constant) so ScrollTrigger re-reads
                         * it on every `refresh()` (window resize, font/image load), keeping
                         * the animation distance in sync with the real layout.
                         */
                        const getScrollDistance = () =>
                            track.scrollWidth - track.clientWidth;

                        /**
                         * Card transitions on mobile: 8 cards means 7 hand-offs, which
                         * is also the mobile timeline's duration in seconds (one second
                         * per card, see below) and the denominator of the snap
                         * increment. Desktop ignores it.
                         */
                        const steps = GALLERY_ITEMS.length - 1;

                        /**
                         * Caption intro — time-based, fired by the pin, not the scrub.
                         *
                         * The caption must appear IMMEDIATELY when the pin engages, not
                         * progressively with scroll, so this wipe-in is a regular paused
                         * tween. The main ScrollTrigger's `onToggle` (below) plays it
                         * when the pin activates scrolling down and reverses it (wiping
                         * out right → left) when the user scrolls back up past the pin
                         * start. The end-of-pin side is owned by the scrubbed hide tween
                         * on the timeline instead, so the two never animate at once.
                         *
                         * `fromTo` renders its `from` state on creation, so the caption
                         * is hidden from first paint without needing a CSS pre-hide.
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
                         * Main pinned timeline.
                         *
                         * A timeline (rather than a lone tween) lets the horizontal
                         * travel and the caption reveal share one ScrollTrigger, so the
                         * caption's progress is derived from the same scroll position as
                         * the images — they can never fall out of sync.
                         */
                        const timeline = gsap.timeline({
                            scrollTrigger: {
                                /**
                                 * Pinning mechanism — the two branches pin DIFFERENT
                                 * elements, which is the whole fix for the vanishing
                                 * indicator.
                                 *
                                 * Desktop: trigger is the image track, so `start:
                                 * "center center"` engages the pin the moment the
                                 * IMAGES' own vertical center aligns with the viewport
                                 * center; `pin: section` freezes the whole section
                                 * (headings + track + caption) around that anchor. GSAP
                                 * allows the pinned element to differ from the trigger
                                 * used for position math. `end` extends the pin by the
                                 * horizontal distance times `SCROLL_RESISTANCE`: 1.8px
                                 * of scroll per 1px of slide, which is what produces the
                                 * heavy, deliberate feel on entry.
                                 *
                                 * Mobile: the section is TALLER than a phone viewport
                                 * (intro ~205px + card + indicator), so centring it on
                                 * the track left the indicator ~32px from the bottom
                                 * edge — and any `dvh` change from the browser address
                                 * bar sliding in pushed it under the fold for good,
                                 * since ScrollTrigger does not re-measure mid-scroll.
                                 * Pinning `stage` (a fixed `100svh` box holding only the
                                 * card and the indicator) from `top top` means the
                                 * indicator is laid out inside one screen's worth of
                                 * space that can never resize. The intro simply scrolls
                                 * past before the pin engages.
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
                                 * MUST stay explicit. ScrollTrigger turns
                                 * pinSpacing OFF by default whenever the pinned
                                 * element's parent computes to `display: flex`
                                 * — and `stage`'s parent, the section, is
                                 * exactly that. Leaving it undefined meant no
                                 * spacer was inserted, the document never grew
                                 * by the pin distance, and every section below
                                 * simply scrolled past the frozen gallery all
                                 * the way to the footer. Desktop pins the
                                 * section itself (parent is a plain block), so
                                 * there `true` only restates the default.
                                 */
                                pinSpacing: true,
                                anticipatePin: 1,
                                /**
                                 * Mobile only: land every release on a card sitting dead
                                 * centre. Snap points are the timeline progress values
                                 * where one card has fully settled — `i / steps` — which
                                 * is what makes the hand-off read as a click rather
                                 * than a drag. Desktop scrubs freely; several
                                 * frames share the viewport there, so there is no single
                                 * "correct" resting position to snap to.
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
                                 * `scrub: true` binds timeline progress directly to the
                                 * scrollbar position — the track and caption respond
                                 * instantly to scroll input and stop the moment the user
                                 * stops, with no smoothing lag and no drift. That is the
                                 * right trade for a mouse wheel, but on touch it hands
                                 * the animation every jitter of a momentum-driven scroll,
                                 * and it gives the snap nothing to blend against. Mobile
                                 * gets a catch-up interval instead — see
                                 * MOBILE_SCRUB_SMOOTHING.
                                 */
                                scrub: isMobile ? MOBILE_SCRUB_SMOOTHING : true,
                                // Recompute `x` and `end` (both function-based) whenever
                                // ScrollTrigger refreshes, e.g. after a resize.
                                invalidateOnRefresh: true,
                                /**
                                 * Drives the caption intro from the pin's state changes:
                                 * pin engages scrolling down → play the wipe-in
                                 * immediately; pin disengages scrolling back up → reverse
                                 * it. The other two toggle cases (leaving/re-entering at
                                 * the pin's end) are deliberately ignored — there the
                                 * caption is owned by the scrubbed hide tween below.
                                 */
                                onToggle: (self) => {
                                    if (self.isActive && self.direction === 1) {
                                        captionIntro.play();
                                    } else if (!self.isActive && self.direction === -1) {
                                        captionIntro.reverse();
                                    }
                                },
                                /**
                                 * Mobile pagination dots: each card fills nearly the
                                 * whole viewport (see `ImageShaper`), so the dot row is
                                 * the only cue for "which of the 8 images is this".
                                 * Desktop has no dot row (`dotsRef` is `md:hidden`), so
                                 * this is a no-op on that branch.
                                 *
                                 * `round`, not `floor`: snap parks progress exactly on
                                 * `i / steps`, so rounding hits the active card's index
                                 * dead on. Flooring `progress * length` instead only
                                 * happened to work because it over-counted by one item
                                 * — it would flip the dot a fraction early now that the
                                 * snap makes those boundaries exact.
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
                         * MOBILE — horizontal card stacking.
                         *
                         * Every frame is absolutely centred on top of the others (see
                         * `ImageShaper`), so nothing moves as a group the way the desktop
                         * track does. Instead each frame waits off the right edge and
                         * slides along X to dead centre, one at a time, parking ON TOP of
                         * the one before it while that one darkens underneath. `zIndex`
                         * ascends with the index, which is what makes the stack LIFO —
                         * the newest frame covers everything below it, and scrubbing back
                         * up peels that same frame off first.
                         *
                         * Card `i` occupies second `i - 1` of the timeline, so the
                         * timeline runs exactly `steps` seconds and every whole second is
                         * one card resting dead centre — the grid the snap above locks
                         * onto.
                         *
                         * `zIndex` is set through GSAP rather than a Tailwind class so
                         * `mm.revert()` strips it when the viewport crosses 768px;
                         * a class would leak into the desktop flex row.
                         */
                        if (isMobile) {
                            const cards = gsap.utils.toArray<HTMLElement>(
                                track.children,
                            );

                            // Waiting frames sit off the right edge rather than being
                            // hidden: the track is `overflow-hidden` on mobile, so they
                            // are already clipped and need no opacity of their own. That
                            // keeps every frame fully opaque, which is what makes the
                            // entrance read as a solid card sliding over the stack
                            // instead of materialising on top of it.
                            gsap.set(cards, {
                                xPercent: MOBILE_STACK_OFFSCREEN_PERCENT,
                                autoAlpha: 1,
                                zIndex: (i: number) => i,
                            });
                            // The first frame is the one already on screen when the pin
                            // engages, so it never plays an entrance.
                            gsap.set(cards[0], { xPercent: 0 });

                            // `ease: "none"` on both tweens below is load-bearing, not a
                            // default left in place. With a curve (this was power2.out) a
                            // frame covers ~99% of its travel by 85% of its segment, so
                            // when the snap pulled the remaining 15% of scroll — around
                            // 70px of page movement — the image barely shifted. The page
                            // lurched with no matching motion on screen, which is exactly
                            // what read as a broken, stuttering snap. Linear keeps scroll
                            // and image in step; the smoothness comes from
                            // MOBILE_SCRUB_SMOOTHING and MOBILE_SNAP_EASE instead.
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
                                // The frame BENEATH darkens across the same second, so
                                // the shadow spreads exactly as the incoming frame slides
                                // over it — that synchronisation is what reads as being
                                // covered by the object above rather than just dimming.
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
                            // Horizontal travel occupies the full timeline (progress
                            // 0 → 1). Linear easing is mandatory for scrubbed
                            // animations: any curve would break the direct mapping
                            // between scroll and motion.
                            timeline.to(track, {
                                x: () => -getScrollDistance(),
                                ease: "none",
                                duration: 1,
                            });

                            /**
                             * Per-image parallax — an inner slide layered on the same
                             * scrub.
                             *
                             * Each <img> is scaled up (per-variant scale constants) so
                             * it overflows its `overflow-hidden` frame on both sides;
                             * the tween then slides it from −shift to +shift across the
                             * full pin — COUNTER to the frames' leftward travel. Moving
                             * the photo against its frame makes it appear to hold its
                             * ground while the window sweeps across it, which reads as
                             * the image being progressively revealed (mirrored on
                             * scroll-up), perfectly in sync with the scrub.
                             *
                             * The slide targets the images while the track tween above
                             * owns the frames' container, so the two transforms never
                             * conflict. GSAP applies translate before scale in its
                             * transform string, so the visual offset equals `xPercent`
                             * of the unscaled frame width and stays inside the
                             * (scale − 1) / 2 slack per side.
                             *
                             * Wide and slim frames are tuned separately: `xPercent` is
                             * relative to each frame's own width, so the narrow slim
                             * frames need a deeper zoom and a larger shift to travel a
                             * comparable number of absolute pixels.
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
                         * Caption hide — a scrubbed directional wipe on the main
                         * timeline.
                         *
                         * The left inset grows 0% → 100%, covering the caption in the
                         * same left → right direction the images travel, so it is fully
                         * gone by `CAPTION_HIDE_END` (80%) — well before the images run
                         * out and the pin releases. Because it is scrubbed, scrolling
                         * back up replays it mirrored, re-revealing the caption
                         * right → left.
                         *
                         * `immediateRender: false` is essential on this `fromTo`:
                         * without it the visible `from` state would render on creation
                         * and override the intro tween's hidden initial state. The
                         * explicit `from` values (rather than a `.to()` capturing start
                         * values lazily) keep the wipe deterministic across
                         * `invalidateOnRefresh` cycles.
                         *
                         * CAPTION_HIDE_* are FRACTIONS of the timeline, but a position
                         * parameter is measured in seconds — so they have to be scaled
                         * by the timeline's length. That used to be a no-op because the
                         * desktop timeline is exactly 1s long; the mobile one runs
                         * `steps` (7) seconds, where an unscaled 0.6 would land at 8.6%
                         * progress and wipe the caption out almost immediately.
                         *
                         * `duration()` is read BEFORE this tween is added, and the tween
                         * ends at 0.8 × total, so it never extends the timeline it is
                         * measuring against.
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

                // Full teardown: kills every ScrollTrigger/tween created in either
                // matchMedia branch, removes the pin-spacer, and reverts inline
                // styles — prevents memory leaks and Strict Mode
                // double-initialization artifacts.
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
            {/* Intro block: `gap-3` (12px) is the site-wide spacing between
                overline/heading/text — see RESPONSIVE-AUDIT.md Bagian F.
                The outer wrapper's `gap-5` above governs the (slightly
                larger) gap from this block to the image track below. */}
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
            {/* Track + indicator are grouped in one block so the indicator's
                top margin is measured from the track itself, not affected by
                the section's own column gap.

                On mobile this block is also the PINNED stage: a fixed
                `100svh` box that centres the card and the indicator inside
                one screen's worth of space. `svh` (not `dvh`) is the point —
                it is the viewport height WITH the browser address bar
                showing, so it never changes when that bar slides in or out,
                which is what used to shove the indicator under the fold.
                Above `md` the utilities below reset it to a plain
                auto-height block and the desktop layout is untouched.

                `pt-5` is a deliberate 14px nudge downwards, not breathing
                room. Against `justify-center` a top padding only moves the
                centred group by HALF of itself (10px); the other 4px come
                from the indicator's own `mt-2`, trimmed from `mt-4` in the
                same pass so the group got shorter and re-centred lower. The
                shift is a constant 14px at any viewport height, and it costs
                6px of the clearance below the indicator — still ~27px on the
                narrowest phones. */}
            <div
                ref={stageRef}
                className="h-[100svh] pt-5 flex flex-col items-center justify-center md:h-auto md:pt-0 md:block"
            >
                {/* Desktop: the horizontal track, translated on the X axis by
                    GSAP. Mobile: a plain positioning context — the frames are
                    absolute inside it and slide in one at a time.

                    Mobile-only `overflow-hidden` clips the frames still
                    waiting off the right edge, which is also why they can stay
                    fully opaque while they wait. The section's own
                    `overflow-hidden` cannot be relied on here: once the stage
                    is pinned it is `position: fixed`, and a fixed element
                    escapes an ancestor's overflow clipping. Reset above `md`,
                    where the flex row is deliberately wider than its
                    container. */}
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
                {/* Indicator block. On mobile a pagination dot row is stacked
                    above the caption text — each card fills nearly the full
                    viewport (see `ImageShaper`), so the dots are the only cue
                    for progress through the 8 images; desktop shows several
                    frames at once so the dots would be redundant there.

                    It stays an ordinary flow child rather than an overlay:
                    the stage above has a fixed height and centres its
                    children, so "below the card" is already guaranteed to be
                    on screen. Absolute positioning would only reintroduce a
                    dependence on the very heights that caused the bug. */}
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
    // Below `md`, every frame is forced to the same near-full-viewport size
    // (86% width, 80% height — one image reads as one card, per the reference
    // design) and stacked on top of the others rather than laid out in a row;
    // the wide/slim distinction only kicks back in at desktop widths.
    //
    // `inset-0 m-auto` does the centring, deliberately NOT `-translate-x-1/2`:
    // GSAP slides each frame via `xPercent`, which it writes into the
    // `transform` property, and a Tailwind translate utility on the same
    // element would fight it. Margin-auto centring of an absolutely positioned
    // box with a definite size touches no transform at all.
    //
    // Height is `svh`, not `dvh` — see the stage wrapper in `Gallery` for why.
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
            {/* Mobile-only shadow, darkened by the timeline once the next card
                covers this one. `opacity-0` has to live in the class list: the
                GSAP chunk is loaded lazily, and without a painted starting
                value every card would flash solid black until it arrives. GSAP
                then writes opacity inline, which outranks this. */}
            <div
                data-cover
                className="absolute inset-0 bg-black opacity-0 pointer-events-none md:hidden"
            />
        </div>
    );
}
