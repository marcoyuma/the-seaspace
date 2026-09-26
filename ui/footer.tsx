import Heading from "@/ui/heading";
import ParallaxImageSection from "@/ui/parallax-image-section";
import Link from "next/link";

const SITEMAP_LINKS = [
    { label: "Home", path: "/" },
    { label: "Stays", path: "/stays" },
];

const AMENITIES_LINKS = [
    { label: "Relax & Spa", path: "/spa" },
    { label: "Golf Course", path: "/golf-course" },
    { label: "Event Venue", path: "/event-venue" },
];

const CONTACT_INFO = [
    { label: "Email", value: "contact@seaspace.com" },
    { label: "Telp", value: "+62-81283625321" },
];

// Manrope Bold metrics for "THE SEASPACE" at fontSize 100, measured with fontTools. inkLeft/Right
// trim the T/E side bearings so glyphs touch both edges; overshoot keeps "S" tops unclipped;
// `visible` is the cap height shown (~30px past half at 1440px). Re-measure if font/text change.
const WATERMARK = {
    advance: 731.6,
    inkLeft: 1,
    inkRight: 726.6,
    cap: 72,
    overshoot: 1.5,
    visible: 51,
} as const;

export default function Footer() {
    return (
        <footer className="relative w-full overflow-hidden bg-white">
            <ParallaxImageSection />

            {/* Main Footer Content */}
            <div className="px-6 sm:px-10 md:px-16 pt-10 sm:pt-16 pb-10 sm:pb-20">
                {/* CSS Grid (not flex) so the tagline column gets a fixed
                    proportional share (2fr) while the three link/contact
                    columns split the remainder evenly — matches the
                    asymmetric ratio in the design rather than relying on
                    arbitrary fixed widths (`w-[420px]`) + `ml-auto`.
                    Single column on mobile: Sitemap/Amenities are hidden
                    below `sm`, so only Heading + Contact remain, stacked. */}
                <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr] gap-x-16 gap-y-8 sm:gap-y-0">
                    {/* Left: Heading — the one heading on the site that scales
                        per breakpoint rather than sitting at a flat 36px, so it
                        can fill this column without wrapping awkwardly. */}
                    <Heading size="footer">
                        Unforgettable stays by the sea.
                    </Heading>

                    {/* Sitemap — hidden on mobile per design, kept from sm up */}
                    <nav
                        aria-label="Sitemap"
                        className="hidden sm:flex flex-col"
                    >
                        <span className="text-[16px] font-medium text-black/60">
                            / Sitemap
                        </span>
                        <div className="flex flex-col mt-7.5 gap-2.5">
                            {SITEMAP_LINKS.map((item) => (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className="text-[16px] font-medium text-black/60 hover:text-black transition-colors"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </nav>

                    {/* Amenities — hidden on mobile per design, kept from sm up */}
                    <nav
                        aria-label="Amenities"
                        className="hidden sm:flex flex-col"
                    >
                        <span className="text-[16px] font-medium text-black/60">
                            / Amenities
                        </span>
                        <div className="flex flex-col mt-7.5 gap-2.5">
                            {AMENITIES_LINKS.map((item) => (
                                <Link
                                    key={item.path}
                                    href={item.path}
                                    className="text-[16px] font-medium text-black/60 hover:text-black transition-colors"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                    </nav>

                    {/* Contact */}
                    <div className="flex flex-col gap-6">
                        {CONTACT_INFO.map(({ label, value }) => (
                            <div key={label}>
                                <p className="text-[16px] font-semibold text-black">
                                    {label}
                                </p>
                                <p className="text-[16px] font-medium text-black/60 mt-1">
                                    {value}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Decorative watermark as SVG: the viewBox scales type, width and crop with the footer,
                so it stays edge-to-edge and cut at the same point at any width. `textLength` pins
                the width even while a fallback font is showing during `display: swap`. */}
            <svg
                aria-hidden="true"
                viewBox={`${WATERMARK.inkLeft} ${-WATERMARK.overshoot} ${
                    WATERMARK.inkRight - WATERMARK.inkLeft
                } ${WATERMARK.visible + WATERMARK.overshoot}`}
                className="block w-full select-none pointer-events-none fill-black/10 font-bold"
            >
                <text
                    x="0"
                    y={WATERMARK.cap}
                    fontSize="100"
                    textLength={WATERMARK.advance}
                    lengthAdjust="spacingAndGlyphs"
                >
                    THE SEASPACE
                </text>
            </svg>
        </footer>
    );
}
