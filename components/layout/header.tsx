"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveLink } from "@/lib/nav";
import Logo from "@/components/layout/logo";
import ProfileIcon from "@/components/layout/profile-icon";
import MenuPanel from "@/components/layout/menu-panel";

// Centralized nav targets — one place to change routes if they move.
// Homepage only: the last two are anchors into this page's sections.
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

// The hero occupies exactly one viewport (`h-dvh`), so by the time we've
// scrolled ~that far the background image is 100% covered. The small offset
// makes the pill start widening right as the sweep finishes behind it.
function getHeroSweptSnapshot() {
    return window.scrollY >= window.innerHeight - 100;
}

function Header() {
    const pathname = usePathname();
    const isHome = pathname === "/";
    console.log(isHome);

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
            className={`${isHome ? "fixed" : "relative border-none"} left-1/2 z-20 -translate-x-1/2
                        h-14 bg-white text-black
                        border-b border-black/10
                        transition-[width,top,border-radius,border-color] duration-500 ease-in-out motion-reduce:transition-none
                        ${
                            expanded
                                ? "h-20 top-0 w-screen rounded-none border-black/10"
                                : "top-10 w-190 max-w-[calc(100%-48px)] rounded-full border-transparent"
                        }`}
        >
            <div
                // The bar above can go full-bleed, but the content stays capped:
                // expanded it's `100% - 240px` (a 120px inset per side, matching
                // `Container`'s `px-30`) so the logo/nav/icons align with the
                // section edges; collapsed it simply fills the pill.
                // Side columns share equal `1fr` so the `auto` center column
                // (the nav) stays geometrically centered between logo and
                // account regardless of their differing widths.
                //     className={`mx-auto grid h-full grid-cols-[1fr_auto_1fr] items-center
                //                 transition-[width,padding] duration-500 ease-in-out motion-reduce:transition-none
                //                 ${expanded ? "w-[calc(100%-240px)] px-0" : "w-full px-4"}`}
                // >
                className={`mx-auto flex h-full justify-between items-center
                            transition-[width,padding] duration-500 ease-in-out motion-reduce:transition-none
                            ${expanded ? "w-[calc(100%-240px)] px-0" : "w-full px-4"}`}
            >
                {/* Left: brand */}
                <div className="min-w-0 justify-self-start">
                    <Logo />
                </div>

                {/* Center: primary navigation. Homepage only — interior pages
                    hand navigation entirely to the panel, leaving the bar as
                    just brand + trigger. Not rendered at all off the homepage
                    so the links aren't duplicated into the DOM invisibly.
                    Below `lg` the panel takes over here too. */}
                {isHome && (
                    <nav className="hidden justify-self-center lg:block">
                        <ul className="flex items-center gap-6 text-[18px] font-medium">
                            {navLinks.map((link) => {
                                const isActive = isActiveLink(
                                    link.href,
                                    pathname,
                                );

                                return (
                                    <li key={link.href}>
                                        <Link
                                            href={link.href}
                                            // `aria-current` carries the active
                                            // state for screen readers; the
                                            // underline below is purely visual.
                                            aria-current={
                                                isActive ? "page" : undefined
                                            }
                                            // Simple hover affordance: a 2px underline
                                            // that wipes in from the left. `scale-x`
                                            // (not width) so it animates on the GPU.
                                            // The active route pins that same
                                            // underline open instead of adding a
                                            // second treatment.
                                            className={`relative text-[16px] tracking-wide font-semibold py-1 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:bg-black after:transition-transform after:duration-300 after:ease-out after:content-[''] hover:after:scale-x-100 ${
                                                isActive
                                                    ? "after:scale-x-100"
                                                    : "text-black/60 after:scale-x-0 hover:text-black"
                                            }`}
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                )}

                {/* Right: account + menu trigger. Off the homepage the account
                    icon lives inside the panel instead, so the bar stays down
                    to the logo and the hamburger. */}
                <div className="flex min-w-0 items-center justify-self-end gap-4">
                    {isHome && (
                        <div className="hidden lg:block">
                            <ProfileIcon />
                        </div>
                    )}
                    <MenuPanel links={navLinks} showOnDesktop={!isHome} />
                </div>
            </div>
        </header>
    );
}

export default Header;
