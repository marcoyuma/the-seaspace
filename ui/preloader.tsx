"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
    PRELOADER_ACTIVE_ATTR,
    PRELOADER_GATE_ATTR,
    PRELOADER_GROUND,
    PRELOADER_MAX_WAIT_MS,
    PRELOADER_MIN_VISIBLE_MS,
    PRELOADER_ROOT_ATTR,
    PRELOADER_SESSION_KEY,
    PRELOADER_WARM_ATTR,
} from "@/lib/preloader";

/** How long the bar needs to travel the last stretch to 100% before the curtain lifts. */
const BAR_SETTLE_MS = 280;

/**
 * Milliseconds for the creep to cover its full share of the gap to the next gate. Slow on
 * purpose: the creep exists so the bar is never frozen on a slow connection, not to fake
 * progress the page has not actually made.
 */
const CREEP_FULL_MS = 9000;

/** Fraction of the remaining gap the creep is ever allowed to cover. */
const CREEP_CEILING = 0.85;

/** Hard cap while anything is still outstanding — the bar must never read "done" early. */
const PROGRESS_CEILING = 0.97;

/** Backstop in case `animationend` never fires (animations disabled at the OS level, etc.). */
const LIFT_FALLBACK_MS = 900;

/** `idle` = curtain up, `leaving` = lift animation running, `gone` = unmounted. */
type Phase = "idle" | "leaving" | "gone";

/** Latched once per document, not per mount — a soft nav back to `/` re-runs no guard script. */
let armedLatch: boolean | null = null;
const armedListeners = new Set<() => void>();

function subscribeToArmedFlag(onStoreChange: () => void) {
    armedListeners.add(onStoreChange);
    return () => {
        armedListeners.delete(onStoreChange);
    };
}

function getArmedSnapshot() {
    if (armedLatch === null) {
        armedLatch =
            document.documentElement.hasAttribute(PRELOADER_ACTIVE_ATTR) &&
            !hasSeenPreloader();
    }
    return armedLatch;
}

/**
 * The server always renders the curtain — it cannot know whether this visitor has seen it, and
 * CSS keeps it hidden when the flag is absent. Returning `true` here is what makes the
 * hydration render match that HTML before the real snapshot takes over.
 */
function getArmedServerSnapshot() {
    return true;
}

/** Reads throw in private modes; a throw here would arm the curtain instead of skipping it. */
function hasSeenPreloader() {
    try {
        return sessionStorage.getItem(PRELOADER_SESSION_KEY) !== null;
    } catch {
        return false;
    }
}

/** Drops the flag so CSS hides the overlay, then notifies — safe now that the store subscribes. */
function disarmPreloader() {
    armedLatch = false;
    document.documentElement.removeAttribute(PRELOADER_ACTIVE_ATTR);
    for (const listener of armedListeners) listener();
}

/**
 * Intro curtain for `/`: an OVERLAY on the fully server-rendered page, never a render gate, so
 * crawlers get complete HTML. Armed by `preloader-flash-guard.tsx`. Progress is measured: it counts
 * the `<img data-gate>` already requested (no double download), plus fonts as one unit.
 *
 * @example <Preloader /> // app/page.tsx, first child above <Hero />
 */
export default function Preloader() {
    // The server snapshot keeps hydration matching the markup, then the client snapshot decides:
    // no setState in an effect, no flash (CSS hides it either way). Same pattern as ui/header.tsx.
    const armed = useSyncExternalStore(
        subscribeToArmedFlag,
        getArmedSnapshot,
        getArmedServerSnapshot,
    );

    const [phase, setPhase] = useState<Phase>("idle");

    const barRef = useRef<HTMLDivElement>(null);
    const previousOverflowRef = useRef("");

    useEffect(() => {
        // The hydration commit still carries the server snapshot (`true`), so this effect fires
        // once on EVERY load. Re-read the real value, or a reload scrolls the page to the top.
        if (!armed || !getArmedSnapshot()) return;

        // A reload can restore a mid-page scroll position, and a curtain lifting halfway down
        // the page reads as a bug. Reset before anything is visible.
        window.scrollTo(0, 0);
        previousOverflowRef.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        // Both hero variants are in the DOM; the CSS-hidden one is never fetched, so it would
        // never settle. `getClientRects()` works under `position: fixed`, unlike `offsetParent`.
        const gates = Array.from(
            document.querySelectorAll<HTMLImageElement>(
                `img[${PRELOADER_GATE_ATTR}]`,
            ),
        ).filter((el) => el.getClientRects().length > 0);

        const total = gates.length + 1; // + fonts
        let settled = 0;
        let finished = false;
        let rafId = 0;
        let liftTimer = 0;
        const cleanups: Array<() => void> = [];

        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;

        const startedAt = performance.now();

        function beginLift() {
            if (finished) return;
            finished = true;
            window.clearTimeout(maxWaitTimer);
            const elapsed = performance.now() - startedAt;
            const hold = Math.max(0, PRELOADER_MIN_VISIBLE_MS - elapsed);
            // `+ BAR_SETTLE_MS` so the bar is visibly at 100% before the curtain moves;
            // lifting while it still reads 80% looks like the page gave up waiting.
            liftTimer = window.setTimeout(
                () => setPhase("leaving"),
                hold + BAR_SETTLE_MS,
            );
        }

        function markSettled() {
            settled += 1;
            if (settled >= total) beginLift();
        }

        for (const img of gates) {
            // Already in the HTTP cache: `complete` is true before we can attach a listener,
            // and no `load` event is coming.
            if (img.complete && img.naturalWidth > 0) {
                markSettled();
                continue;
            }
            let done = false;
            const onSettle = () => {
                if (done) return;
                done = true;
                markSettled();
            };
            img.addEventListener("load", onSettle);
            // A broken image must not hold the curtain — it is never going to load.
            img.addEventListener("error", onSettle);
            cleanups.push(() => {
                img.removeEventListener("load", onSettle);
                img.removeEventListener("error", onSettle);
            });
        }

        let fontsSettled = false;
        const settleFonts = () => {
            if (fontsSettled) return;
            fontsSettled = true;
            markSettled();
        };
        document.fonts.ready.then(settleFonts).catch(settleFonts);

        // One stalled request must not trap the user behind the curtain. Whatever has not
        // arrived by now fades in later behind its own blur placeholder.
        const maxWaitTimer = window.setTimeout(beginLift, PRELOADER_MAX_WAIT_MS);

        // Driven on the animation frame rather than through state so the bar never triggers a
        // React render while the browser is busy decoding the very images it reports on.
        let shown = 0;
        let creep = 0;
        let lastFrame = performance.now();

        function frame(now: number) {
            const dt = Math.min(now - lastFrame, 100);
            lastFrame = now;

            const base = settled / total;
            let goal: number;
            if (finished) {
                goal = 1;
            } else {
                // The creep only eats into the gap BETWEEN real gates, so the bar keeps moving
                // on a slow connection without ever claiming a gate that has not landed.
                creep = Math.min(creep + dt / CREEP_FULL_MS, CREEP_CEILING);
                goal = Math.min(base + (1 - base) * creep, PROGRESS_CEILING);
            }

            shown = prefersReducedMotion
                ? goal
                : shown + (goal - shown) * Math.min(1, dt / 220);

            if (barRef.current) {
                barRef.current.style.transform = `scaleX(${shown})`;
            }
            rafId = window.requestAnimationFrame(frame);
        }
        rafId = window.requestAnimationFrame(frame);

        return () => {
            window.cancelAnimationFrame(rafId);
            window.clearTimeout(maxWaitTimer);
            window.clearTimeout(liftTimer);
            for (const off of cleanups) off();
        };
    }, [armed]);

    // The lift animation should end this, but a browser with animations switched off fires no
    // `animationend` at all — hence the timer.
    useEffect(() => {
        if (phase !== "leaving") return;
        const timer = window.setTimeout(() => setPhase("gone"), LIFT_FALLBACK_MS);
        return () => window.clearTimeout(timer);
    }, [phase]);

    useEffect(() => {
        if (phase !== "gone" || !armed) return;
        document.body.style.overflow = previousOverflowRef.current;
        try {
            sessionStorage.setItem(PRELOADER_SESSION_KEY, "1");
        } catch {
            // Private modes throw on write. Worst case the curtain shows again on the next
            // load — annoying, not broken.
        }
        disarmPreloader();
        warmDeferredImages();
    }, [phase, armed]);

    if (!armed || phase === "gone") return null;

    return (
        <div
            {...{ [PRELOADER_ROOT_ATTR]: "" }}
            role="status"
            aria-label="Loading"
            // Inline, not utilities: the element has to cover the viewport before the stylesheet
            // is live, or it paints as a plain block with the rest of the screen left white.
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 100,
                backgroundColor: PRELOADER_GROUND,
            }}
            className={`flex-col items-center justify-center gap-6 bg-blue-gradient ${
                phase === "leaving" ? "animate-preloader-lift" : ""
            }`}
            // Only this element's own lift counts — not anything animating inside it.
            onAnimationEnd={(event) => {
                if (event.target === event.currentTarget) setPhase("gone");
            }}
        >
            {/* Same wordmark as ui/logo.tsx, minus the <Link>: there is nowhere to navigate
                to from behind the curtain. */}
            <span className="font-logo text-[28px] font-semibold tracking-tighter text-white sm:text-[32px] md:text-[40px]">
                seaspace
            </span>

            <div
                aria-hidden
                className="h-px w-40 overflow-hidden rounded-full bg-white/25 sm:w-56"
            >
                {/* `scaleX` on a full-width bar rather than an animated `width`: it stays on
                    the compositor, so the bar keeps moving while the main thread decodes the
                    very photos it is reporting on. */}
                <div
                    ref={barRef}
                    className="h-full w-full origin-left scale-x-0 bg-white"
                />
            </div>
        </div>
    );
}

/**
 * Warms the lazy gallery frames the curtain skipped, so they don't pop in mid-GSAP scroll. Copies
 * `srcset`/`sizes` so the browser picks the same URL and the later fetch is a cache hit.
 */
function warmDeferredImages() {
    const connection = (
        navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (connection?.saveData) return;

    const run = () => {
        const deferred = document.querySelectorAll<HTMLImageElement>(
            `img[${PRELOADER_WARM_ATTR}]`,
        );
        for (const el of deferred) {
            if (el.complete && el.naturalWidth > 0) continue;
            const warm = new Image();
            // Order matters: the browser picks a candidate the moment `srcset` is assigned, so
            // `sizes` has to already be in place or it picks against the wrong width.
            warm.sizes = el.sizes;
            if (el.srcset) warm.srcset = el.srcset;
            else warm.src = el.src;
        }
    };

    if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(run, { timeout: 3000 });
    } else {
        window.setTimeout(run, 1200);
    }
}
