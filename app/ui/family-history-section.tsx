"use client";

import React, { useRef, useLayoutEffect } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register the plugin once — GSAP core doesn't know how to read scroll
// position without this.
gsap.registerPlugin(ScrollTrigger);

const HEADING_TEXT =
    "Two family sanctuaries where beachfront paradise meets tropical highlands. welcoming guests since 1962.";

// Batch 1 (images 1 & 2, rendered on the sides).
const sideImages = [
    {
        src: "/family-section-images/familyS2.jpg",
        alt: "empty space photo 1",
        position: "left" as const,
        variant: "slim" as const,
    },
    {
        src: "/family-section-images/familyS1.jpg",
        alt: "empty space photo 2",
        position: "right" as const,
        variant: "wide" as const,
    },
];

// Batch 1's top/center image (image 3).
const topImage = {
    src: "/family-section-images/familyS5.jpg",
    alt: "empty space photo 3",
};

// Batch 2 (images 4 & 5). Reuses the same src as batch 1 (no new assets
// yet), but these are separate DOM elements/refs, so they animate
// independently from batch 1.
const sideImages2 = [
    {
        src: "/family-section-images/familyS4.jpg",
        alt: "empty space photo 1 (batch 2)",
        position: "left" as const,
        variant: "wide" as const,
    },
    {
        src: "/family-section-images/familyS3.jpg",
        alt: "empty space photo 2 (batch 2)",
        position: "right" as const,
        variant: "slim" as const,
    },
];
// Batch 2's top/center image (image 6).
const topImage2 = {
    src: "/family-section-images/familyS6.jpg",
    alt: "empty space photo 3 (batch 2)",
};

// Heading letters' pre-fade opacity. Shared by the initial paint state and
// the heading tween's `from` — must match or the fade jumps on frame 1.
const HEADING_DIM_OPACITY = 0.1;

// How far images travel off-screen (in viewport height units).
const TRAVEL = {
    hiddenBelow: "90vh", // starting position: below the viewport
    hiddenAbove: "-90vh", // ending position: above the viewport
};

// Scales sideDuration/topDuration AND the pin's scroll `end` together (see
// below), so images get more scroll-distance per pixel of travel (slower)
// without stealing scroll budget from other phases on the shared timeline.
// Scaling only duration would compress everything else; scaling only `end`
// would slow every phase uniformly. Position params like "<50%" stay correct
// since they're percentages of a tween's OWN duration, not absolute values.
const SLOWDOWN_FACTOR = 2.5;

const TIMING = {
    textStaggerEach: 0.015,
    // Absolute start time of the side images on the timeline. "0" = the very
    // beginning, so they move from the first frame of the pin.
    sideStart: "0",
    sideDuration: 3.0 * SLOWDOWN_FACTOR,
    // Feed "<X%" position params: "<" anchors to the previous tween's START,
    // "X%" is a percentage of that tween's OWN duration (not absolute) — so
    // these stay correct as SLOWDOWN_FACTOR scales durations.
    topOverlapPercent: 50, // side batch → that batch's top image (both batches)
    batch2OverlapPercent: 30, // batch 1's top image → side batch 2
    textVanishPercent: 42, // batch 2's top image → heading snaps out
    topDuration: 3.0 * SLOWDOWN_FACTOR,
};

// "none" = linear easing. Keeps movement speed proportional 1:1 to scroll
// speed at any point in the tween, so overlapping images don't feel like
// they have mismatched speed (which happens with GSAP's default ease,
// power1.out, since overlapping tweens would sit at different points on
// that ease curve at the same scroll position).
const TRAVEL_EASE = "none";

export default function FamilyHistorySection() {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLHeadingElement>(null);
    const sideImageRefs = useRef<Array<HTMLDivElement | null>>([]);
    const topImageRef = useRef<HTMLDivElement>(null);
    const sideImageRefs2 = useRef<Array<HTMLDivElement | null>>([]);
    const topImageRef2 = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        // gsap.context() scopes all animations/ScrollTriggers created inside
        // it to this component, so ctx.revert() below can clean everything
        // up automatically when the component unmounts (prevents leaks).
        const ctx = gsap.context(() => {
            const container = containerRef.current;
            const stage = stageRef.current;
            const text = textRef.current;
            // Filter out any refs that haven't attached yet (still null).
            const sideEls = sideImageRefs.current.filter(
                (el): el is HTMLDivElement => el !== null,
            );
            const topEl = topImageRef.current;
            const sideEls2 = sideImageRefs2.current.filter(
                (el): el is HTMLDivElement => el !== null,
            );
            const topEl2 = topImageRef2.current;

            // Bail out early if any required element isn't mounted yet, to
            // avoid animating undefined targets.
            if (!container || !stage || !text || !topEl || !topEl2) return;

            // Grab every individual letter span (see JSX below) so they can
            // be animated one by one.
            const charEls =
                text.querySelectorAll<HTMLSpanElement>("[data-char]");

            // Initial states run BEFORE any tween is created, so the first
            // painted frame is already correct (useLayoutEffect runs ahead of
            // paint). Order matters — see the immediateRender note below.

            // Letters start mostly transparent.
            gsap.set(charEls, { opacity: HEADING_DIM_OPACITY });

            // All six images: hidden below the viewport, visible/interactable
            // via autoAlpha, waiting to be animated upward by the timeline.
            gsap.set([...sideEls, topEl, ...sideEls2, topEl2], {
                autoAlpha: 1,
                y: TRAVEL.hiddenBelow,
            });

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
                    stagger: { each: TIMING.textStaggerEach, from: "start" },
                    scrollTrigger: {
                        trigger: container,
                        start: "top 70%",
                        end: "top top",
                        scrub: 1,
                    },
                },
            );

            // Main timeline: drives every image/text phase. Because they all
            // share this one timeline, changing any timing value here
            // (duration, position params) affects every phase's relative
            // timing, not just the one you edited.
            //
            // `paused: true` is REQUIRED here: a GSAP timeline auto-plays on
            // the global ticker the moment it's created. We don't want that —
            // this timeline's playhead is driven manually from scroll position
            // in the ScrollTrigger.onUpdate below, so it must start paused and
            // never advance on its own.
            const tl = gsap.timeline({ paused: true });

            // Heading opacity is deliberately NOT animated here — that's the
            // fromTo/ScrollTrigger above. Two scrubbed animations writing the
            // same property would race (last one to render wins, and it'd
            // sample its start value from whatever the first just wrote).

            // --- PHASE 1: side images (1 & 2) move from hiddenBelow to
            // hiddenAbove, from the first frame of the pin ---
            tl.to(
                sideEls,
                {
                    y: TRAVEL.hiddenAbove,
                    duration: TIMING.sideDuration,
                    ease: TRAVEL_EASE,
                },
                TIMING.sideStart,
            );

            // --- PHASE 2: top image (3) starts once Phase 1 has played
            // topOverlapPercent% of its own duration — i.e. overlapping
            // with Phase 1 instead of waiting for it to fully finish ---
            tl.to(
                topEl,
                {
                    y: TRAVEL.hiddenAbove,
                    duration: TIMING.topDuration,
                    ease: TRAVEL_EASE,
                },
                `<${TIMING.topOverlapPercent}%`,
            );

            // --- PHASE 3: side images batch 2 (4 & 5). Same style/duration/
            // ease as Phase 1 — only the target elements differ ---
            tl.to(
                sideEls2,
                {
                    y: TRAVEL.hiddenAbove,
                    duration: TIMING.sideDuration,
                    ease: TRAVEL_EASE,
                },
                `<${TIMING.batch2OverlapPercent}%`,
            );

            // --- PHASE 4: top image batch 2 (6). Same style/duration/ease
            // as Phase 2, overlapping with Phase 3 ---
            tl.to(
                topEl2,
                {
                    y: TRAVEL.hiddenAbove,
                    duration: TIMING.topDuration,
                    ease: TRAVEL_EASE,
                },
                `<${TIMING.topOverlapPercent}%`,
            );

            // Heading disappears INSTANTLY (not a fade) at the moment topEl2 is
            // centred over it. .set() rather than .to() because we want a hard
            // snap with no duration. Positioned relative to Phase 4's start, as
            // a percentage of topEl2's own travel — landing where it sits at its
            // resting position covering the h2.
            tl.set(text, { autoAlpha: 0 }, `<${TIMING.textVanishPercent}%`);

            // Marks the exact vanish instant: "<" anchors to the START of the
            // .set() just added (zero-duration, so its start IS that instant),
            // not the timeline's end. Read back below to decide pin release.
            tl.addLabel("textGone", "<");

            // Pin wiring: release the pin at the EXACT instant the heading
            // disappears, instead of holding through topEl2's remaining exit.
            //
            // Can't just shorten `end` on a normal `animation: tl` trigger —
            // a scrubbed ScrollTrigger always maps start→end onto the FULL
            // tl.duration(), so shrinking `end` only compresses the sequence
            // (topEl2 still fully exits, just faster), it never stops partway.
            //
            // Instead the playhead is driven manually and clamped to the
            // "textGone" moment: `self.progress` (0→1, scrub-smoothed) is
            // scaled to the [0, textGone] slice and written via tl.time().
            // Past `end`, the pin releases with topEl2 frozen mid-cover;
            // its unplayed tail never runs on-screen.
            //
            // `scrollPerTimeUnit` recovers the original pacing as a rate — the
            // prior design scrolled (150 * SLOWDOWN_FACTOR)% of viewport height
            // across the full tl.duration(). Applying that rate to just the
            // kept `textGone` slice gives the pin's scroll length at the same
            // image speed. Derived at runtime so it stays correct if
            // TIMING/SLOWDOWN_FACTOR change later.
            const textGoneTime = tl.labels.textGone;
            const scrollPerTimeUnit = (150 * SLOWDOWN_FACTOR) / tl.duration();
            const pinDistancePercent = scrollPerTimeUnit * textGoneTime;

            ScrollTrigger.create({
                trigger: container,
                start: "top top", // pin activates once container's top hits viewport top
                end: `+=${pinDistancePercent}%`, // scroll length of the [0, textGone] slice at original pacing
                scrub: 1, // smooth the scroll→progress mapping (1s catch-up)
                pin: stage, // the element that stays fixed on screen while pinned
                pinSpacing: true, // ScrollTrigger inserts a spacer exactly as tall as the pin duration, so no dead blank scroll trails the animation
                // Map smoothed scroll progress onto ONLY the first `textGone`
                // seconds of the timeline. This is what freezes topEl2 over the
                // heading at release instead of playing its exit.
                onUpdate: (self) => tl.time(self.progress * textGoneTime),
            });
        }, containerRef);

        // The measurements above ran before the Manrope webfont swapped in
        // and before images decoded — both reflow the page afterwards and
        // silently invalidate the pin/trigger measurements. Re-measure once
        // each has settled.
        let cancelled = false;
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

        return () => {
            cancelled = true;
            if (!alreadyLoaded) window.removeEventListener("load", refresh);
            ctx.revert();
        };
    }, []);

    return (
        <div ref={containerRef} className="relative mb-25">
            {/* This is the element that gets pinned — stays fixed on screen
                for the whole scroll range defined by tl's ScrollTrigger. */}
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
                    className="max-w-133 text-black font-display font-semibold text-[48px] text-center relative z-20"
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
                            {wi < arr.length - 1 && "\u00A0"}
                        </React.Fragment>
                    ))}
                </h2>

                {/* Batch 1 side images (1 & 2) */}
                {sideImages.map((image, index) => (
                    <div
                        key={image.src}
                        ref={(el) => {
                            sideImageRefs.current[index] = el;
                        }}
                        className={[
                            "absolute top-1/2 -translate-y-1/2 z-10 shrink-0",
                            image.variant === "wide"
                                ? "w-84 h-74"
                                : "w-64 h-94",
                            // Outer-edge inset matches Container's `mx-30`
                            // (120px) so these images line up vertically with
                            // StaysPreviewSection's content edges below. Kept as
                            // an `lg:` offset (mobile falls back to `left-8`)
                            // to avoid over-insetting on narrow viewports.
                            image.position === "left"
                                ? "left-8 lg:left-30"
                                : "right-8 lg:right-30",
                        ].join(" ")}
                    >
                        <Image
                            src={image.src}
                            alt={image.alt}
                            fill
                            className="object-cover rounded-2xl"
                        />
                    </div>
                ))}

                {/* Batch 1 top/center image (3) */}
                <div
                    ref={topImageRef}
                    className="absolute top-[12%] left-1/2 -translate-x-1/2 w-122 h-72 z-30"
                >
                    <Image
                        src={topImage.src}
                        alt={topImage.alt}
                        fill
                        className="object-cover rounded-2xl"
                    />
                </div>

                {/* Batch 2 side images (4 & 5) — same layout/size classes as
                    batch 1, only the ref array (sideImageRefs2) differs */}
                {sideImages2.map((image, index) => (
                    <div
                        key={`batch2-${image.src}-${index}`}
                        ref={(el) => {
                            sideImageRefs2.current[index] = el;
                        }}
                        className={[
                            "absolute top-1/2 -translate-y-1/2 z-10 shrink-0",
                            image.variant === "wide"
                                ? "w-84 h-74"
                                : "w-64 h-94",
                            // Outer-edge inset matches Container's `mx-30`
                            // (120px) so these images line up vertically with
                            // StaysPreviewSection's content edges below. Kept as
                            // an `lg:` offset (mobile falls back to `left-8`)
                            // to avoid over-insetting on narrow viewports.
                            image.position === "left"
                                ? "left-8 lg:left-30"
                                : "right-8 lg:right-30",
                        ].join(" ")}
                    >
                        <Image
                            src={image.src}
                            alt={image.alt}
                            fill
                            className="object-cover rounded-2xl"
                        />
                    </div>
                ))}

                {/* Batch 2 top/center image (6) — same position/z-index as
                    batch 1's top image, only the ref differs */}
                <div
                    ref={topImageRef2}
                    className="absolute top-[12%] left-1/2 -translate-x-1/2 w-140 h-103 z-30 shrink-0"
                >
                    <Image
                        src={topImage2.src}
                        alt={topImage2.alt}
                        fill
                        className="object-cover rounded-2xl"
                    />
                </div>
            </div>
        </div>
    );
}
