"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActiveLink } from "@/lib/nav";
import HamburgerIcon from "@/ui/hamburger-icon";

type NavLink = { label: string; href: string };

// Resort coordinates for the "Get directions" row — same Google Maps
// directions URL shape used by the stay detail page (stay-location-section.tsx).
const RESORT_COORDINATES = { lat: -8.409518, lng: 115.188919 };
const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${RESORT_COORDINATES.lat},${RESORT_COORDINATES.lng}`;

// Pulled from the footer's CONTACT_INFO — there's no /contact route yet.
const CONTACT_EMAIL = "contact@seaspace.com";

// Marks the current route, and doubles as the colour that rolls up under every
// other link on hover — one constant so the two can't drift apart.
const ACTIVE_TINT = "text-black/70";

// `overflow-hidden` clips the roll, so the line box has to be tall enough to
// contain descenders ("y" in Stays) or they'd be shaved off at rest.
const NAV_LINK_BASE =
    "block text-[28px] font-medium leading-[1.35] tracking-tight";

/**
 * One of the large serif nav links.
 *
 * On hover the white label rolls up out of the clip while a tinted copy rises
 * into its place; leaving reverses it. Both halves are plain CSS transitions
 * rather than keyframes, so a cursor that leaves mid-roll reverses from wherever
 * the motion had got to instead of snapping.
 *
 * The current route doesn't roll — the effect reads as "somewhere you can go".
 */
function RollingNavLink({
    link,
    isActive,
    onNavigate,
}: {
    link: NavLink;
    isActive: boolean;
    onNavigate: () => void;
}) {
    if (isActive) {
        return (
            <Link
                href={link.href}
                onClick={onNavigate}
                aria-current="page"
                className={`${NAV_LINK_BASE} ${ACTIVE_TINT}`}
            >
                {link.label}
            </Link>
        );
    }

    return (
        <Link
            href={link.href}
            onClick={onNavigate}
            className={`${NAV_LINK_BASE} group relative overflow-hidden`}
        >
            <span className="block text-white transition-transform duration-300 ease-out group-hover:-translate-y-full group-focus-visible:-translate-y-full motion-reduce:transition-none">
                {link.label}
            </span>

            {/* The incoming copy. `inset-0` pins it to the link's own box, so
                `translate-y-full` parks it exactly one line below at any size.
                Hidden from screen readers — the label above already carries it. */}
            <span
                aria-hidden
                className={`absolute inset-0 block translate-y-full ${ACTIVE_TINT} transition-transform duration-300 ease-out group-hover:translate-y-0 group-focus-visible:translate-y-0 motion-reduce:transition-none`}
            >
                {link.label}
            </span>
        </Link>
    );
}

/** Hairline-separated secondary row at the bottom half of the panel. */
function PanelRow({
    href,
    external,
    icon,
    children,
    onNavigate,
}: {
    href: string;
    external?: boolean;
    icon?: React.ReactNode;
    children: React.ReactNode;
    onNavigate: () => void;
}) {
    const className =
        "flex items-center gap-3 border-b border-white/25 py-4 text-[18px] font-medium transition-opacity hover:opacity-80";

    // mailto:/https: targets bypass the router — Link would prefetch a route
    // that doesn't exist.
    if (external) {
        return (
            <a
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={
                    href.startsWith("http") ? "noopener noreferrer" : undefined
                }
                onClick={onNavigate}
                className={className}
            >
                {icon}
                {children}
            </a>
        );
    }

    return (
        <Link href={href} onClick={onNavigate} className={className}>
            {icon}
            {children}
        </Link>
    );
}

/**
 * The floating orange navigation panel and its trigger.
 *
 * Owns its own open/close state instead of `Header`: Header re-renders on every
 * scroll/resize tick (the pill-sweep `useSyncExternalStore`), so keeping menu
 * state here decouples the panel from that render churn and colocates the
 * trigger, panel, and effects in one place.
 *
 * Every route hands both navigation and the account control to this panel —
 * the header bar itself only ever shows brand + trigger.
 *
 * @param links - Primary nav targets, rendered as the large serif list.
 * @param profileSlot - The header's account control (sign-in link, or avatar/
 * account link once signed in), passed through from `Header` so the panel's
 * account row reflects the real session instead of a static placeholder.
 */
export default function MenuPanel({
    links,
    profileSlot,
}: {
    links: NavLink[];
    profileSlot: ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Close whenever the route changes — clicking a link navigates, and the
    // panel should retract as the new page comes in. Adjusted during render
    // (React's recommended pattern for state that depends on a prop change)
    // rather than in an effect, which would fire a second, cascading render.
    const [prevPathname, setPrevPathname] = useState(pathname);
    if (pathname !== prevPathname) {
        setPrevPathname(pathname);
        setIsOpen(false);
    }

    // Escape closes the panel while it's open.
    useEffect(() => {
        if (!isOpen) return;
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") setIsOpen(false);
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen]);

    const close = () => setIsOpen(false);

    return (
        // The panel is positioned against THIS box, whose top/right edges
        // coincide with the hamburger glyph's — that's what lets the panel's
        // dash land on the merged bars with one fixed pair of offsets.
        <div className="relative">
            {/* Trigger: the hamburger, which merges its bars into a single
                line while the panel is open. Toggles rather than only opening,
                so the button and the glyph can't disagree about the state. */}
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-label={isOpen ? "Close menu" : "Open menu"}
                aria-expanded={isOpen}
                aria-controls="menu-panel"
                className="flex cursor-pointer items-center"
            >
                <HamburgerIcon isOpen={isOpen} />
            </button>

            {/* Floating panel. Always mounted so the exit animation can play;
                visibility/pointer-events are toggled with the transition. */}
            <div
                id="menu-panel"
                role="dialog"
                aria-modal="false"
                aria-label="Site menu"
                // Offsets are negative because the panel hangs off the trigger:
                // -28px/-24px put its dash exactly on the merged hamburger line
                // (see the close button below), which holds in both the pill and
                // the expanded header without any per-breakpoint tuning. Only
                // 24px of the needed 32px is taken here — the last 8px is the
                // dash's own -mr-2 — so the panel never overruns the viewport
                // edge in the expanded header's narrowest inset.
                className={`absolute -right-6 -top-7 z-30 w-80 max-w-[calc(100vw-16px)] sm:w-96
                            origin-top-right rounded-3xl bg-linear-to-b from-[#2c8de2] via-[#267cc7] via-[#216cae] via-[#1c5c94] to-[#184d7c] px-8 py-6 text-white shadow-2xl
                            transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none
                            ${
                                isOpen
                                    ? "translate-y-0 scale-100 opacity-100"
                                    : "pointer-events-none invisible -translate-y-2 scale-95 opacity-0"
                            }`}
            >
                {/* Close affordance (dash): it sits directly on top of the
                    hamburger's merged line, so the line reads as staying put
                    while the panel grows behind it. `-mr-2` pulls it out of
                    `px-8`, `justify-end` makes its right edge the row's, and
                    `w-6.5` matches the middle bar's 26px exactly. The button
                    stays `w-8` so the hit area isn't as thin as the line. */}
                <div className="mb-8 -mr-2 flex justify-end">
                    <button
                        type="button"
                        onClick={close}
                        aria-label="Close menu"
                        className="flex h-6 w-8 cursor-pointer items-center justify-end"
                    >
                        <span className="h-0.5 w-6.5 rounded-full bg-white" />
                    </button>
                </div>

                {/* Primary navigation, set in the site's serif display face. */}
                <nav>
                    <ul className="flex flex-col gap-3">
                        {links.map((link) => (
                            <li key={link.href}>
                                <RollingNavLink
                                    link={link}
                                    isActive={isActiveLink(link.href, pathname)}
                                    onNavigate={close}
                                />
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Secondary rows: practical actions, separated by hairlines. */}
                <div className="mt-8 flex flex-col border-t border-white/25">
                    <PanelRow href={DIRECTIONS_URL} external onNavigate={close}>
                        Get directions
                    </PanelRow>

                    <PanelRow
                        href={`mailto:${CONTACT_EMAIL}`}
                        external
                        onNavigate={close}
                    >
                        Contact us
                    </PanelRow>

                    {/* Not a `PanelRow`: `profileSlot` is already a `Link`
                        (sign-in, or account/avatar once signed in), and
                        nesting an anchor inside `PanelRow`'s own anchor
                        would be invalid HTML. Its own icon carries
                        `currentColor`, so it inherits this row's white. */}
                    <div className="flex items-center gap-3 border-b border-white/25 py-4 text-[18px] font-medium text-white transition-opacity hover:opacity-80">
                        {profileSlot}
                    </div>
                </div>

                {/* Bottom strip: socials + copyright. */}
                <div className="mt-6 flex items-center gap-4">
                    <p className="text-[15px] text-white/90">
                        © 2026 The Seaspace.
                    </p>
                </div>
            </div>
        </div>
    );
}
