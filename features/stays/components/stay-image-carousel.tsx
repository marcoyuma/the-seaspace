"use client";
// Client Component in full: every frame position comes from pointer gestures and
// imperative GSAP transforms, so there is no static part worth rendering on the server.

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import Image from "next/image";
// Type-only: GSAP's module body reads `Date.now()` when it is evaluated (its ticker
// IIFE), which `cacheComponents` counts as IO and reports as a prerender error on this
// route. `import type` is erased, so the library itself is pulled in from an effect below.
import type { gsap } from "gsap";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

import type { StayImage } from "@/features/stays/types";
import Skeleton from "@/ui/skeleton";

// FRAME_WIDTH and GAP mirror the `lg:` step of FRAME_HEIGHT_CLASSES / FRAME_WIDTH_CLASSES
// below (the frame is smaller at narrower breakpoints — see those constants). They only
// seed the copy count — the wrap maths measures the real geometry off the DOM, and an
// over-estimate here just means a few unused spare copies, never too few.
/** Rail height at the `lg` breakpoint, in px. Basis of IMAGE_PAINT_WIDTH — kept as the
 * largest step so the `sizes` attribute never under-fetches at a smaller breakpoint. */
const RAIL_HEIGHT = 600;
const FRAME_WIDTH = 526;
const GAP = 24;

/** Viewport/frame height per breakpoint. No inline style anymore — media queries need
 * real classes. Steps down from RAIL_HEIGHT at `lg` so a 600px-tall rail does not eat
 * most of a phone's viewport. */
const FRAME_HEIGHT_CLASSES = "h-70 sm:h-85 md:h-105 lg:h-150";
/** Frame width per breakpoint, aspect-matched to FRAME_HEIGHT_CLASSES (~0.88, the same
 * ratio as the original fixed 526×600). The peek (PEEK_RATIO) scales with this
 * automatically since it is derived from the measured frame width, not a fixed px. */
const FRAME_WIDTH_CLASSES = "w-61.5 sm:w-74.5 md:w-92 lg:w-131.5";

/** `object-cover` paints `RAIL_HEIGHT × aspect` wide, not FRAME_WIDTH, so `sizes` must
 * describe that or the browser under-fetches. 1.5 is the widest villa aspect. */
const IMAGE_PAINT_WIDTH = Math.round(RAIL_HEIGHT * 1.5);

/** JPEG 80 is visually indistinguishable from 100 on photos, at a fraction of the bytes. */
const IMAGE_QUALITY = 80;

/** Seconds for an arrow-driven step. */
const STEP_DURATION = 0.6;

/** Sliver of the previous frame kept visible, as a fraction of one frame's width rather
 * than a fixed px — the frame itself is now responsive (FRAME_CLASSES below), and a flat
 * px peek would eat an ever-larger share of a narrower mobile frame. ~0.25 matches the
 * original 130px sliver at the desktop frame width (526px). Baked into every resting
 * position, so the reference composition survives and consecutive stops stay one frame
 * apart at any breakpoint. */
const PEEK_RATIO = 0.25;

/** Pointer travel before a press becomes a drag. Below it the gesture stays a click,
 * which is what keeps the arrows operable — see handlePointerDown. */
const DRAG_THRESHOLD = 4;

/** Weight of each new velocity sample. Low enough to ride out jittery pointers. */
const VELOCITY_SMOOTHING = 0.3;

/** Fraction of a frame a slow drag must cover before it advances one. */
const COMMIT_DISTANCE_RATIO = 0.25;

/** px·s⁻¹ above which a flick advances a frame however far it actually travelled. */
const COMMIT_VELOCITY = 500;

/** Copy count derives from this rather than a measurement, so the markup matches on
 * server and client and the measuring effect can never feed its own dependencies. */
const MAX_SUPPORTED_VIEWPORT = 3840;

// Matches the SSR-safe pattern in app/ui/gallery.tsx — useLayoutEffect warns on the
// server, so fall back to useEffect where `window` is absent.
const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Full-bleed, infinitely looping image rail for the stay detail page.
 *
 * Frames are repeated across several copies and the scroll position is wrapped into
 * `[0, setWidth)`, so neither dragging nor stepping ever reaches an edge.
 *
 * @param images - Ordered frames; every one renders at the same width.
 */
export default function StayImageCarousel({ images }: { images: StayImage[] }) {
    /* Position model — everything below is arithmetic on top of this.
     *
     * `posRef.value` is a virtual scroll offset in px; raising it moves the rail
     * LEFT, bringing later frames in. Frame N rests at `N * stepWidth() -
     * INITIAL_PEEK`, so frame 0 rests at `-INITIAL_PEEK` — the peek is baked into
     * every stop, not applied once at the start. `frameIndexAt` inverts that.
     *
     * Index space is unbounded in both directions: targetIndexRef just keeps
     * counting, and only paint() folds it back onto real pixels. paint() is also
     * the sole writer to the DOM — everything else sets posRef and calls it. */

    /** Clipping window, gesture surface, and the element ResizeObserver watches. */
    const viewportRef = useRef<HTMLDivElement>(null);
    /** The flex row paint() translates. */
    const trackRef = useRef<HTMLDivElement>(null);
    /** Per-frame nodes, read only by measure() to derive the set width. */
    const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

    // An object rather than a number ref because gsap.to needs a mutable target, and
    // never state because pointer moves must paint without a render per frame. The peek
    // is now a ratio of the measured frame width, so there is nothing meaningful to seed
    // this with before the first measure() — it gets snapped to the real rest position
    // there instead, before anything paints.
    const posRef = useRef({ value: 0 });
    /** Measured px width of one full set (`count` frames plus gaps). Zero until the
     * first measure lands — that is what every `<= 0` guard in this file tests. */
    const setWidthRef = useRef(0);
    /** The single in-flight glide, killed before any new one so a drag and an arrow
     * can never animate the rail at the same time. */
    const tweenRef = useRef<gsap.core.Tween | null>(null);
    /** GSAP itself, once the deferred import below has landed. `null` on the server and
     * for the first few frames in the browser — glideTo() snaps in the meantime. */
    const gsapRef = useRef<typeof import("gsap").default | null>(null);

    /** Destination frame, tracked apart from the live position so rapid arrow clicks
     * queue instead of each restarting from wherever the tween had reached. */
    const targetIndexRef = useRef(0);

    const pointerRef = useRef({
        active: false,
        /** Whether DRAG_THRESHOLD has been crossed; until then the gesture is a click. */
        dragging: false,
        startX: 0,
        /** posRef value at press — the anchor every drag delta is applied to. */
        startValue: 0,
        // Previous move sample, differenced to estimate velocity.
        lastX: 0,
        lastTime: 0,
        velocity: 0,
    });

    /** The only React state here; it exists purely to drive the dot row. */
    const [activeIndex, setActiveIndex] = useState(0);
    /**
     * Whether the first frame has painted. The page itself is prerendered, so there is no data
     * to wait for here — the only gap is the photo bytes, and an empty rail with arrows and a
     * dot row floating over nothing is what that gap looks like without this.
     */
    const [railReady, setRailReady] = useState(false);

    const count = images.length;

    // One copy to sit on, one of slack each side, plus whatever the widest screen
    // spans — so the viewport can never see past the spare sets.
    const nominalSetWidth = count * (FRAME_WIDTH + GAP);
    const copies = Math.ceil(MAX_SUPPORTED_VIEWPORT / nominalSetWidth) + 2;

    // Frames are uniform, so every landing point is exact arithmetic — no offset
    // table and no nearest-neighbour search.
    /** Distance from one frame's rest position to the next, gap included. */
    const stepWidth = useCallback(() => setWidthRef.current / count, [count]);
    /** Where frame `index` comes to rest. */
    const restPosition = useCallback(
        (index: number) => index * stepWidth() - stepWidth() * PEEK_RATIO,
        [stepWidth],
    );
    /** Inverse of restPosition, rounded to whichever frame `value` is nearest. */
    const frameIndexAt = useCallback(
        (value: number) =>
            Math.round((value + stepWidth() * PEEK_RATIO) / stepWidth()),
        [stepWidth],
    );

    const paint = useCallback(() => {
        const track = trackRef.current;
        const setWidth = setWidthRef.current;
        if (!track || setWidth <= 0) return;

        // Fold the unbounded position onto [0, setWidth) — every set is identical,
        // so any two positions one set apart are visually the same rail.
        //
        // Hand-rolled rather than `gsap.utils.wrap`: this runs on the very first paint,
        // before the deferred GSAP import can have landed. JS `%` keeps the sign, hence
        // the `+ setWidth` correction — the same shape as the dot maths below.
        const value = posRef.current.value;
        const wrapped = ((value % setWidth) + setWidth) % setWidth;
        // The extra setWidth parks the window on the SECOND copy, leaving a whole
        // set of slack to the left so negative positions (the peek, a backwards
        // step) still render frames rather than empty track.
        track.style.transform = `translate3d(${-(setWidth + wrapped)}px, 0, 0)`;

        const index = frameIndexAt(posRef.current.value);
        // JS `%` keeps the sign, so negative indices need the `+ count` correction.
        const dot = ((index % count) + count) % count;
        // Only touch state when the dot actually moves — paint() runs every frame.
        setActiveIndex((current) => (current === dot ? current : dot));
    }, [count, frameIndexAt]);

    /** Measures the set width off the DOM and re-measures whenever the viewport
     * resizes, since the frames' own widths are Tailwind-driven. */
    useIsomorphicLayoutEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const measure = () => {
            const slides = slideRefs.current;
            const first = slides[0];
            const firstOfNextSet = slides[count];
            // Refs are still null on the very first pass; the observer re-runs us.
            if (!first || !firstOfNextSet) return;

            // A frame and its clone one set later differ by exactly the set width,
            // gaps included — so no spacing value is duplicated in JS.
            const firstMeasure = setWidthRef.current <= 0;
            setWidthRef.current = firstOfNextSet.offsetLeft - first.offsetLeft;
            // Nothing has painted yet, so snap straight to the target frame's real
            // rest position instead of unwinding from the placeholder `0` posRef
            // started at.
            if (firstMeasure) {
                posRef.current.value = restPosition(targetIndexRef.current);
            }
            paint();
        };

        measure();

        // Deliberately does NOT depend on `copies`: that value is derived, not
        // measured, so this effect never feeds back into its own dependencies.
        const observer = new ResizeObserver(measure);
        observer.observe(viewport);
        return () => observer.disconnect();
    }, [count, paint, restPosition]);

    // Pulls GSAP in after mount rather than at module scope. Its ticker reads
    // `Date.now()` as the module evaluates, and with `cacheComponents` on that counts as
    // reading the clock during the client prerender — which would cost this route its
    // static shell (see the `import type` note at the top). The rail's markup and images
    // carry no GSAP, so deferring it keeps the hero server-rendered.
    useEffect(() => {
        let cancelled = false;
        import("gsap").then((module) => {
            if (!cancelled) gsapRef.current = module.default;
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Kill any in-flight glide on unmount so GSAP never paints into a detached node.
    useEffect(() => () => void tweenRef.current?.kill(), []);

    /** The only way the rail moves on its own — shared by the arrows and drag release
     * so letting go of a swipe feels exactly like clicking ‹ / ›. */
    const glideTo = useCallback(
        (index: number) => {
            tweenRef.current?.kill();
            targetIndexRef.current = index;
            const target = restPosition(index);

            // The same snap serves two cases: motion is unwanted, or GSAP has not
            // finished loading yet (a click within the first frames after hydration).
            // Landing on the right frame instantly beats dropping the interaction.
            const gsapInstance = gsapRef.current;
            if (prefersReducedMotion() || !gsapInstance) {
                posRef.current.value = target;
                paint();
                return;
            }

            tweenRef.current = gsapInstance.to(posRef.current, {
                value: target,
                duration: STEP_DURATION,
                ease: "power3.out",
                onUpdate: paint,
            });
        },
        [paint, restPosition],
    );

    const step = useCallback(
        (direction: 1 | -1) => {
            // Geometry not measured yet — drop the click rather than divide by zero.
            if (setWidthRef.current <= 0) return;
            // Counting from the target, not the live position, is what makes rapid
            // clicks queue up instead of collapsing into one frame of travel.
            glideTo(targetIndexRef.current + direction);
        },
        [glideTo],
    );

    /** Where a released drag rests. Deliberately not a physics throw: an inertia landing
     * scales with velocity and is unbounded, so a hard flick coasted across many frames.
     * Settling on a frame instead caps post-release travel at one. */
    const settleRail = useCallback(
        (velocity: number, startValue: number) => {
            const width = stepWidth();
            if (width <= 0) return;

            // Frame the gesture began on, and how many frames it travelled from
            // there — fractional, so 0.4 means "not quite one frame across".
            const startIndex = Math.round(
                (startValue + width * PEEK_RATIO) / width,
            );
            const offsetFrames =
                (posRef.current.value - restPosition(startIndex)) / width;

            // Where the drag itself left the rail.
            let index = startIndex + Math.round(offsetFrames);

            // A flick, or a drag past the commit distance, must not be swallowed by
            // that rounding back onto the frame it started from.
            const committed =
                Math.abs(velocity) > COMMIT_VELOCITY ||
                Math.abs(offsetFrames) > COMMIT_DISTANCE_RATIO;
            if (committed && index === startIndex) {
                index =
                    startIndex +
                    // Velocity decays to ~0 when the pointer pauses before release,
                    // so fall back to the direction the drag actually went.
                    (Math.sign(velocity) || Math.sign(offsetFrames));
            }

            glideTo(index);
        },
        [glideTo, restPosition, stepWidth],
    );

    /** Swaps the viewport cursor for the duration of a drag. Split out because both
     * ends of the gesture need it and neither owns the element. */
    const setGrabbing = (dragging: boolean) => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        // Inline style, not a class: React owns `className` here and would clobber an
        // imperative class on the next render, which the dots trigger mid-gesture.
        viewport.style.cursor = dragging ? "grabbing" : "grab";
    };

    /** Stage 1 of the gesture: arm a *possible* drag. Freezes the rail and records the
     * anchor, but commits to nothing — this may still resolve as a click on an arrow.
     * handlePointerMove decides which it was. */
    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;

        // Pointer capture retargets the following pointerup to the viewport, so `click`
        // resolves there and a button's onClick never fires. Never drag from a button.
        if ((event.target as HTMLElement).closest("button")) return;

        tweenRef.current?.kill();
        // Killing a glide mid-flight leaves targetIndexRef pointing at a frame the
        // rail never reached. Rebase it onto what is actually on screen, so the next
        // arrow click steps from there rather than resuming the abandoned journey.
        if (setWidthRef.current > 0) {
            targetIndexRef.current = frameIndexAt(posRef.current.value);
        }

        const pointer = pointerRef.current;
        pointer.active = true;
        pointer.dragging = false;
        pointer.startX = event.clientX;
        pointer.startValue = posRef.current.value;
        pointer.lastX = event.clientX;
        pointer.lastTime = event.timeStamp;
        pointer.velocity = 0;
    };

    /** Stage 2: promote the press to a drag once it clears DRAG_THRESHOLD, then pin the
     * rail to the pointer and keep a smoothed velocity estimate for the release. */
    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const pointer = pointerRef.current;
        if (!pointer.active) return;

        const dx = event.clientX - pointer.startX;

        if (!pointer.dragging) {
            if (Math.abs(dx) <= DRAG_THRESHOLD) return;
            // Only now is this unambiguously a drag, so only now take the pointer —
            // capturing any earlier would break the arrow clicks.
            pointer.dragging = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            setGrabbing(true);
        }

        // The rail travels opposite the pointer, so negate to get its px/s velocity.
        const elapsed = event.timeStamp - pointer.lastTime;
        if (elapsed > 0) {
            const instant = ((pointer.lastX - event.clientX) / elapsed) * 1000;
            pointer.velocity =
                pointer.velocity * (1 - VELOCITY_SMOOTHING) +
                instant * VELOCITY_SMOOTHING;
        }
        pointer.lastX = event.clientX;
        pointer.lastTime = event.timeStamp;

        // Subtract, don't add: dragging right (dx > 0) should carry the rail right,
        // which in this coordinate system means a smaller position.
        posRef.current.value = pointer.startValue - dx;
        paint();
    };

    /** Stage 3: release. Bound to both pointerup and pointercancel, so a gesture the OS
     * steals still unwinds. Hands the rail to settleRail — unless the press never became
     * a drag, in which case it bows out and lets the click land. */
    const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        const pointer = pointerRef.current;
        if (!pointer.active) return;
        pointer.active = false;

        // Never moved far enough to become a drag — leave it as a click.
        if (!pointer.dragging) return;
        pointer.dragging = false;
        setGrabbing(false);

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        settleRail(pointer.velocity, pointer.startValue);
    };

    // Memoised so the activeIndex change behind the dots does not re-reconcile
    // every <Image> subtree mid-gesture.
    const frames = useMemo(
        () =>
            Array.from({ length: copies * count }, (_, i) => (
                <div
                    key={i}
                    ref={(el) => {
                        slideRefs.current[i] = el;
                    }}
                    className={`relative h-full ${FRAME_WIDTH_CLASSES} shrink-0 overflow-hidden rounded-xl`}
                >
                    <Image
                        className="pointer-events-none object-cover"
                        src={images[i % count].src}
                        alt={images[i % count].alt}
                        // Supabase-hosted frames carry their blur from the database;
                        // without it `placeholder="blur"` below throws at runtime.
                        blurDataURL={images[i % count].blurDataURL}
                        fill
                        // The `100vw` token is load-bearing: it makes Next prune the
                        // srcset to deviceSizes, dropping candidates this box never uses.
                        sizes={`(max-width: 767px) 100vw, ${IMAGE_PAINT_WIDTH}px`}
                        quality={IMAGE_QUALITY}
                        placeholder="blur"
                        // `preload` replaces the deprecated `priority` prop in Next 16;
                        // roughly three frames are on screen at first paint.
                        preload={i < 3}
                        // Only the first frame reports in — the rail is legible as soon as
                        // it has one photo, and waiting on all of them would leave the
                        // skeleton up long after there is anything to hide.
                        onLoad={i === 0 ? () => setRailReady(true) : undefined}
                        onError={i === 0 ? () => setRailReady(true) : undefined}
                    />
                </div>
            )),
        [images, copies, count],
    );

    return (
        <div className="pt-3">
            <div
                ref={viewportRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                // `touch-pan-y` keeps vertical page scrolling native on touch while
                // reserving horizontal gestures for the rail.
                className={`relative w-full cursor-grab touch-pan-y overflow-hidden select-none ${FRAME_HEIGHT_CLASSES}`}
            >
                {/* Absolute on purpose: in flow, the track's multi-thousand-px intrinsic
                    width propagates to <main> — a grid item, so `min-width: auto` stops
                    it shrinking — and stretches every section below off-screen. */}
                {/* `will-change-transform` keeps the track on its own layer — paint()
                    rewrites its transform on every pointer move. */}
                <div
                    ref={trackRef}
                    className="absolute inset-y-0 left-0 flex h-full w-max gap-6 will-change-transform"
                >
                    {frames}
                </div>

                <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Previous image"
                    className="absolute top-1/2 left-[10%] z-10 -translate-y-1/2 cursor-pointer text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-opacity duration-200 ease-out hover:opacity-70 motion-reduce:transition-none"
                >
                    <CaretLeftIcon size={40} weight="light" />
                </button>

                <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Next image"
                    className="absolute top-1/2 right-[10%] z-10 -translate-y-1/2 cursor-pointer text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-opacity duration-200 ease-out hover:opacity-70 motion-reduce:transition-none"
                >
                    <CaretRightIcon size={40} weight="light" />
                </button>

                {/* `pointer-events-none` so a drag starting over the dots still reaches
                    the viewport. `left-[47%]` positions the row's left edge, not its
                    centre — hand-tuned for the current dot count rather than derived. */}
                <div className="pointer-events-none absolute bottom-6.5 left-[47%] z-10 flex items-center gap-2 rounded-full bg-black/25 px-3.5 py-2 backdrop-blur-sm">
                    {images.map((image, i) => (
                        <span
                            key={image.alt}
                            className={`h-2 w-2 rounded-full transition-colors duration-200 ease-out motion-reduce:transition-none ${
                                i === activeIndex ? "bg-white" : "bg-white/40"
                            }`}
                        />
                    ))}
                </div>

                {/* Layered OVER the rail rather than replacing it: GSAP measures the real
                    frames on mount, and swapping the markup out from under it would leave the
                    rail sized against a placeholder. `z-20` clears the arrows and the dot row,
                    which have nothing to point at yet. */}
                <div
                    className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-500 ease-out motion-reduce:transition-none ${
                        railReady ? "opacity-0" : "opacity-100"
                    }`}
                >
                    <div className="flex h-full w-max gap-6">
                        {/* Three is what the widest breakpoint shows at once — enough to read
                            as a rail, not so many that the placeholder outruns the viewport. */}
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton
                                key={i}
                                className={`h-full ${FRAME_WIDTH_CLASSES} shrink-0 rounded-xl`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
