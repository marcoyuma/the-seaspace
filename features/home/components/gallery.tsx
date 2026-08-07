"use client";

import Heading from "@/ui/heading";
import OverlineText from "@/ui/overline-text";
import Image, { type StaticImageData } from "next/image";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import Text from "@/ui/text";
import gsap from "gsap";
import gallery1 from "@/public/gallery/g1.jpg";
import gallery2 from "@/public/gallery/g2.jpg";
import gallery3 from "@/public/gallery/g3.jpg";
import gallery4 from "@/public/gallery/g4.jpg";
import gallery5 from "@/public/gallery/g5.jpg";
import gallery6 from "@/public/gallery/g6.jpg";
import gallery7 from "@/public/gallery/g7.png";
import gallery8 from "@/public/gallery/g8.jpg";

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDownIcon } from "@phosphor-icons/react/dist/ssr";

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
 * Seconds for the time-based caption wipe-in that plays the instant the pin
 * engages (and plays in reverse when the user scrolls back up past the pin
 * start). Intentionally NOT scrubbed: the caption must be fully on screen
 * immediately, regardless of how slowly the user keeps scrolling.
 */
const CAPTION_INTRO_DURATION = 0.5;

/**
 * Main-timeline progress (0–1) at which the scrubbed caption wipe-out
 * begins. Paired with `CAPTION_HIDE_END` to define the fade-out window.
 */
const CAPTION_HIDE_START = 0.6;

/**
 * Main-timeline progress (0–1) at which the caption is fully gone — 80%,
 * well before the images finish scrolling and the pin releases, so nothing
 * lingers once the gallery hands control back to the page.
 */
const CAPTION_HIDE_END = 0.8;

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
    { src: gallery1, alt: "Stays preview", variant: "wide" },
    { src: gallery2, alt: "Stays preview", variant: "slim" },
    { src: gallery3, alt: "Stays preview", variant: "wide" },
    { src: gallery4, alt: "Stays preview", variant: "slim" },
    { src: gallery5, alt: "Stays preview", variant: "wide" },
    { src: gallery6, alt: "Stays preview", variant: "slim" },
    { src: gallery7, alt: "Stays preview", variant: "wide" },
    { src: gallery8, alt: "Stays preview", variant: "slim" },
];

/**
 * Register the ScrollTrigger plugin once at module scope.
 * GSAP guards against duplicate registration internally, so calling this in a
 * module that may be re-evaluated (e.g. HMR) is safe. Registration must happen
 * before any `scrollTrigger` config is passed to a tween.
 */
gsap.registerPlugin(ScrollTrigger);

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

    useIsomorphicLayoutEffect(() => {
        const section = sectionRef.current;
        const track = trackRef.current;
        const caption = captionRef.current;
        console.log(section);
        console.log(track);
        console.log(caption);

        if (!section || !track || !caption) return;

        /**
         * GSAP lifecycle — `gsap.context()`:
         *
         * Every animation and ScrollTrigger created inside this callback is
         * recorded against the context. On unmount, `ctx.revert()` kills the
         * tween AND its ScrollTrigger, removes the pin-spacer element that
         * ScrollTrigger injects into the DOM, and restores all inline styles.
         *
         * This is critical under React 18/19 Strict Mode, where effects run
         * mount → cleanup → mount in development: without a full revert, the
         * second mount would measure a DOM already wrapped in a pin-spacer
         * and create a duplicate ScrollTrigger (double-initialization bug).
         */
        const ctx = gsap.context(() => {
            /**
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
                    trigger: track,
                    /**
                     * Pinning mechanism:
                     *
                     * The trigger is the image track, so `start: "center
                     * center"` engages the pin the moment the IMAGES' own
                     * vertical center aligns with the viewport center — the
                     * headings above and caption below simply come along for
                     * the ride around that anchor.
                     *
                     * `pin: section` — the element frozen in place is still
                     * the whole section (headings + track + caption); GSAP
                     * allows the pinned element to differ from the trigger
                     * used for position math.
                     *
                     * `end` extends the pin by the horizontal distance times
                     * `SCROLL_RESISTANCE`: the user must scroll 1.8px
                     * vertically to move the track 1px horizontally, which is
                     * what produces the heavy, deliberate feel on entry.
                     *
                     * The pin wraps the section in a pin-spacer that
                     * preserves document flow while the section is fixed.
                     * `anticipatePin: 1` pre-applies the pin ~1 frame early to
                     * avoid a visible jump on fast scrolling.
                     */
                    start: "center center",
                    end: () => `+=${getScrollDistance() * SCROLL_RESISTANCE}`,
                    pin: section,
                    anticipatePin: 1,
                    /**
                     * `scrub: true` binds timeline progress directly to the
                     * scrollbar position — the track and caption respond
                     * instantly to scroll input and stop the moment the user
                     * stops, with no smoothing lag and no drift.
                     */
                    scrub: true,
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
                },
            });

            // Horizontal travel occupies the full timeline (progress 0 → 1).
            // Linear easing is mandatory for scrubbed animations: any curve
            // would break the direct mapping between scroll and motion.
            timeline.to(track, {
                x: () => -getScrollDistance(),
                ease: "none",
                duration: 1,
            });

            /**
             * Per-image parallax — an inner slide layered on the same scrub.
             *
             * Each <img> is scaled up (per-variant scale constants) so it
             * overflows its `overflow-hidden` frame on both sides; the tween
             * then slides it from −shift to +shift across the full pin —
             * COUNTER to the frames' leftward travel. Moving the photo
             * against its frame makes it appear to hold its ground while
             * the window sweeps across it, which reads as the image being
             * progressively revealed (mirrored on scroll-up), perfectly in
             * sync with the scrub (no delay, no drift).
             *
             * The slide targets the images while the track tween above owns
             * the frames' container, so the two transforms never conflict.
             * GSAP applies translate before scale in its transform string,
             * so the visual offset equals `xPercent` of the unscaled frame
             * width and stays inside the (scale − 1) / 2 slack per side.
             *
             * Wide and slim frames are tuned separately: `xPercent` is
             * relative to each frame's own width, so the narrow slim frames
             * need a deeper zoom and a larger shift to travel a comparable
             * number of absolute pixels (see the paired constants above).
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
             */
            timeline.fromTo(
                caption,
                { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" },
                {
                    opacity: 0,
                    clipPath: "inset(0% 0% 0% 100%)",
                    ease: "none",
                    duration: CAPTION_HIDE_END - CAPTION_HIDE_START,
                    immediateRender: false,
                },
                CAPTION_HIDE_START,
            );
        }, section);

        // Full teardown: kills the ScrollTrigger, removes the pin-spacer, and
        // reverts inline styles — prevents memory leaks and Strict Mode
        // double-initialization artifacts.
        return () => ctx.revert();
    }, []);

    return (
        // `overflow-hidden` clips the translated track so the horizontal
        // motion never produces a page-level horizontal scrollbar.
        <div
            ref={sectionRef}
            id="gallery"
            className="flex flex-col gap-6.5 max-w-dvw mb-27.5 overflow-hidden scroll-mt-14"
        >
            <div className="flex flex-col gap-6.5 justify-center items-center">
                <OverlineText>Gallery</OverlineText>
                <Heading classname="text-center">
                    Sanctuary of Stolen Moment
                </Heading>
                <Text classname="text-center">
                    Happy guests is what we seek the most. The outcome for
                    happiness is nothing but leisure
                </Text>
            </div>
            {/* Track + caption are grouped in one block so the caption's
                13px top margin is measured from the track itself, not
                affected by the section's own column gap. */}
            <div>
                {/* The horizontal track: translated on the X axis by GSAP. */}
                <div ref={trackRef} className="flex gap-3.5">
                    {GALLERY_ITEMS.map((item, index) => (
                        <ImageShaper key={index} variant={item.variant}>
                            <Image
                                className="h-full w-full object-cover"
                                src={item.src}
                                placeholder="blur"
                                quality={100}
                                priority
                                fill
                                alt={item.alt}
                            />
                        </ImageShaper>
                    ))}
                </div>
                {/* Caption sits in normal layout flow, 13px (mt-3.25) below
                    the track, with the text and arrow icon aligned on one
                    horizontal row. Shown and hidden by the scrubbed
                    clip-path wipes. */}
                <div
                    ref={captionRef}
                    className="mt-6.5 flex items-center justify-center gap-2 text-[16px] font-bold text-black"
                >
                    <p>Keep scrolling to continue the journey</p>
                    <span className="rounded-full border border-dotted border-black p-1">
                        <ArrowDownIcon size={16} color="#000000" />
                    </span>
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
    const tempVariant =
        variant === "wide" ? "w-[1000px] h-[609px]" : "w-[315px] h-[609px]";
    return (
        // `data-variant` lets the parallax tweens target wide and slim
        // frames separately with variant-specific depth settings.
        <div
            data-variant={variant}
            className={`relative overflow-hidden cursor-grab shrink-0 ${tempVariant}`}
        >
            {children}
        </div>
    );
}
