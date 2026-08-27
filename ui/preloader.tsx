"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
    PRELOADER_ACTIVE_ATTR,
    PRELOADER_GATE_ATTR,
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

/**
 * The arming flag is written once by `ui/preloader-flash-guard.tsx` before hydration and never
 * changes afterwards, so there is genuinely nothing to subscribe to.
 */
function subscribeToArmedFlag() {
    return () => {};
}

function getArmedSnapshot() {
    return document.documentElement.hasAttribute(PRELOADER_ACTIVE_ATTR);
}

/**
 * The server always renders the curtain — it cannot know whether this visitor has seen it, and
 * CSS keeps it hidden when the flag is absent. Returning `true` here is what makes the
 * hydration render match that HTML before the real snapshot takes over.
 */
function getArmedServerSnapshot() {
    return true;
}

/**
 * Full-screen intro curtain for the landing page.
 *
 * It is an OVERLAY, never a gate on rendering: `app/page.tsx` still server-renders the whole
 * page underneath, so the HTML a crawler reads is complete and this component only stacks on
 * top of it. Swapping to `{loading ? <Preloader/> : <Page/>}` would ship an empty page to
 * search engines — avoiding that is the entire point of doing it this way.
 *
 * Whether it runs at all is decided before first paint by `ui/preloader-flash-guard.tsx`;
 * this component only reads the flag that guard leaves on <html>.
 *
 * Progress is measured, not animated: it counts the `<img data-gate>` elements the page has
 * ALREADY asked the browser for, so nothing is downloaded twice and the bar tracks real bytes.
 * Fonts count as one more unit so the copy underneath does not reflow the instant it lifts.
 *
 * @example
 * // app/page.tsx — first child, above <Hero />
 * <Preloader />
 */
export default function Preloader() {
    // `useSyncExternalStore` rather than reading the DOM in an effect: the server snapshot
    // keeps hydration matching the markup, then the client snapshot decides — no setState
    // during an effect body, and no flash, because CSS has the element hidden either way.
    // Same reconcile pattern as ui/header.tsx.
    const armed = useSyncExternalStore(
        subscribeToArmedFlag,
        getArmedSnapshot,
        getArmedServerSnapshot,
    );

    const [phase, setPhase] = useState<Phase>("idle");

    const barRef = useRef<HTMLDivElement>(null);
    const previousOverflowRef = useRef("");

    useEffect(() => {
        if (!armed) return;

        // A reload can restore a mid-page scroll position, and a curtain lifting halfway down
        // the page reads as a bug. Reset before anything is visible.
        window.scrollTo(0, 0);
        previousOverflowRef.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        // Both hero variants sit in the DOM at once (`hidden lg:block` / `lg:hidden`), and the
        // one CSS hides has no box — so the browser never fetches it and it would never
        // settle. `getClientRects()` is the check that survives `position: fixed`, where
        // `offsetParent` is null even when the element is perfectly visible.
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
        // The flag deliberately stays on <html>: `getArmedSnapshot` reads it every render, and
        // a value that changes without notifying the store is exactly the stale read
        // useSyncExternalStore warns about. With the overlay unmounted it matches nothing.
        try {
            sessionStorage.setItem(PRELOADER_SESSION_KEY, "1");
        } catch {
            // Private modes throw on write. Worst case the curtain shows again on the next
            // load — annoying, not broken.
        }
        warmDeferredImages();
    }, [phase, armed]);

    if (!armed || phase === "gone") return null;

    return (
        <div
            {...{ [PRELOADER_ROOT_ATTR]: "" }}
            role="status"
            aria-label="Loading"
            className={`fixed inset-0 z-100 flex-col items-center justify-center gap-6 bg-blue-gradient ${
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
 * Kicks off the gallery frames the curtain deliberately did not wait for.
 *
 * They are `loading="lazy"` and scroll in horizontally under GSAP, so without this they pop in
 * mid-animation. Copies `srcset`/`sizes` off the real element so the browser resolves the exact
 * same candidate URL and the later fetch is a cache hit — warming a different URL would just
 * double the bytes.
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
