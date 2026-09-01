"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Logo from "@/ui/logo";
import MenuPanel from "@/ui/menu-panel";

// Fed to the panel — homepage only: the last two are anchors into this
// page's sections, so only valid while the panel is rendered on '/'.
const NAV_LINKS = [
    { label: "Stays", href: "/stays" },
    { label: "Experiences", href: "/spa" },
    { label: "Amenities", href: "/#amenities" },
    { label: "Gallery", href: "/#gallery" },
];

// Interior pages hand navigation entirely to the panel, so these are the
// destinations themselves rather than homepage anchors.
const PANEL_NAV_LINKS = [
    { label: "Stays", href: "/stays" },
    { label: "Golf Course", href: "/golf-course" },
    { label: "Spa", href: "/spa" },
    { label: "Event Venue", href: "/event-venue" },
];

// Subscribe to the viewport signals that decide whether the fixed hero
// background has been fully swept away by the white content scrolling over it.
function subscribeToViewport(onChange: () => void) {
    window.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange);
    return () => {
        window.removeEventListener("scroll", onChange);
        window.removeEventListener("resize", onChange);
    };
}

// Mirrors Tailwind's `lg` (64rem). `window.innerWidth` and a CSS media query
// both measure the viewport including the scrollbar, so the two agree.
const HERO_SWEEP_MIN_WIDTH = 1024;

// The sweep only exists from `lg` up: features/home/components/hero.tsx puts
// the full-viewport fixed background behind `hidden lg:block` and stacks a
// photo band over a blue panel in normal flow below that. So under `lg` there
// is no background being covered, and the threshold below — calibrated
// against the desktop hero, and reading an `innerHeight` that itself shifts
// as the mobile URL bar collapses — just snapped the bar to full width at an
// arbitrary scroll position. Return `false` there and the bar stays a pill.
//
// Above `lg` the hero occupies exactly one viewport (`h-dvh`), so by the time
// we've scrolled ~that far the background image is 100% covered. The small
// offset makes the pill start widening right as the sweep finishes behind it.
function getHeroSweptSnapshot() {
    if (window.innerWidth < HERO_SWEEP_MIN_WIDTH) return false;
    return window.scrollY >= window.innerHeight - 100;
}

/**
 * @param profileSlot The account control, passed in rather than imported. `ProfileIcon` is
 * an async Server Component that reads the session, and this header is a Client Component —
 * so it can only receive that subtree as a prop from a server parent (app/layout.tsx).
 */
function Header({ profileSlot }: { profileSlot: ReactNode }) {
    const pathname = usePathname();
    const isHome = pathname === "/";

    // Feeds both the bar and the panel; off the homepage the `/#` anchors would
    // scroll nowhere, so interior routes swap in real destinations.
    const navLinks = isHome ? NAV_LINKS : PANEL_NAV_LINKS;

    // `useSyncExternalStore` subscribes to browser scroll/resize without the
    // setState-in-effect pattern and stays hydration-safe: the server and the
    // first client render both use the `false` snapshot, then reconcile.
    const heroSwept = useSyncExternalStore(
        subscribeToViewport,
        getHeroSweptSnapshot,
        () => false,
    );

    // Only the homepage has a hero to sweep past; every other route starts
    // (and stays) in the widened state.
    const expanded = !isHome || heroSwept;

    return (
        <header
            // Fixed & horizontally centered. Collapsed it's a compact floating
            // pill (rounded, with a top gap). Once the hero is swept the white
            // BACKGROUND stretches to the full viewport width and sits flush
            // against the top edge — only the inner content (below) stays inset
            // to line up with the stays/services sections.
            // `max-lg:shadow-*` on the collapsed branch: under `lg` the pill
            // never expands (see getHeroSweptSnapshot), so it now floats over
            // the white sections too — where a white pill with a transparent
            // border would otherwise have no visible edge at all. Desktop keeps
            // the flat pill it has always had.
            className={`${isHome ? "fixed" : "relative border-none"} left-1/2 z-20 -translate-x-1/2
                        h-14 bg-white text-black
                        border-b border-black/10
                        transition-[width,top,border-radius,border-color] duration-500 ease-in-out motion-reduce:transition-none
                        ${
                            !expanded
                                ? "top-10 w-190 max-w-[calc(100%-48px)] rounded-full border-transparent max-lg:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
                                : "h-20 top-0 w-screen rounded-none border-black/10"
                        }`}
        >
            <div
                // The bar above can go full-bleed, but the content stays capped:
                // expanded, the inset mirrors `Container`'s mx-* at every
                // breakpoint (48px mobile → 64px sm → 128px md → 240px lg,
                // i.e. double Container's per-side margin) so the
                // logo/nav/icons align with the section edges; collapsed it
                // simply fills the pill.
                // Side columns share equal `1fr` so the `auto` center column
                // (the nav) stays geometrically centered between logo and
                // account regardless of their differing widths.
                //     className={`mx-auto grid h-full grid-cols-[1fr_auto_1fr] items-center
                //                 transition-[width,padding] duration-500 ease-in-out motion-reduce:transition-none
                //                 ${expanded ? "w-[calc(100%-240px)] px-0" : "w-full px-4"}`}
                // >
                className={`mx-auto flex h-full justify-between items-center
                            transition-[width,padding] duration-500 ease-in-out motion-reduce:transition-none
                            ${
                                expanded
                                    ? "w-[calc(100%-48px)] px-0 sm:w-[calc(100%-64px)] md:w-[calc(100%-128px)] lg:w-[calc(100%-240px)]"
                                    : "w-full px-4"
                            }`}
            >
                {/* Left: brand */}
                <div className="min-w-0 justify-self-start">
                    <Logo />
                </div>

                {/* Every route hands navigation and the account control
                    entirely to the panel now — the bar itself stays down to
                    just brand + trigger, at every breakpoint. */}
                <div className="flex min-w-0 items-center justify-self-end gap-4">
                    <MenuPanel links={navLinks} profileSlot={profileSlot} />
                </div>
            </div>
        </header>
    );
}

export default Header;
