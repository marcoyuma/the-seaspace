import Heading from "@/ui/heading";
import ParallaxImageSection from "@/ui/parallax-image-section";
import Link from "next/link";

// Sitemap navigation — paths derived from label via `.toLowerCase()`,
// so "Home" stays the only entry that maps to "/" rather than "/home".
const SITEMAP_LINKS = ["Home", "About", "Stays", "Contact"];

// Amenities currently point to "#" as their destination pages don't exist
// yet (no dedicated dining/spa/event-venue routes). Replace with real
// hrefs once those pages are built.
const AMENITIES_LINKS = ["Relax & Spa", "Golf Course", "Event Venue"];

const CONTACT_INFO = [
    { label: "Email", value: "contact@seaspace.com" },
    { label: "Telp", value: "+62-81283625321" },
];

export default function Footer() {
    return (
        <footer className="relative w-full overflow-hidden bg-white">
            <ParallaxImageSection />

            {/* Main Footer Content */}
            <div className="px-6 sm:px-10 md:px-16 pt-10 sm:pt-16 pb-10 sm:pb-20">
                {/* Grid, not flex: the tagline gets a 2fr share and the other three columns
                    split the rest, matching the design's asymmetric ratio. Mobile is one
                    column — Sitemap/Amenities hide below `sm`, leaving Heading + Contact. */}
                <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr] gap-x-16 gap-y-8 sm:gap-y-0">
                    {/* Left: Heading — the one heading on the site that scales
                        per breakpoint rather than sitting at a flat 36px, so it
                        can fill this column without wrapping awkwardly. */}
                    <Heading size="footer">
                        Unforgettable stays by the sea.
                    </Heading>

                    {/* Sitemap — hidden on mobile per design, kept from sm up */}
                    <nav aria-label="Sitemap" className="hidden sm:flex flex-col">
                        <span className="text-[16px] font-medium text-black/60">
                            / Sitemap
                        </span>
                        <div className="flex flex-col mt-7.5 gap-2.5">
                            {SITEMAP_LINKS.map((item) => (
                                <Link
                                    key={item}
                                    href={
                                        item === "Home"
                                            ? "/"
                                            : `/${item.toLowerCase()}`
                                    }
                                    className="text-[16px] font-medium text-black/60 hover:text-black transition-colors"
                                >
                                    {item}
                                </Link>
                            ))}
                        </div>
                    </nav>

                    {/* Amenities — hidden on mobile per design, kept from sm up */}
                    <nav aria-label="Amenities" className="hidden sm:flex flex-col">
                        <span className="text-[16px] font-medium text-black/60">
                            / Amenities
                        </span>
                        <div className="flex flex-col mt-7.5 gap-2.5">
                            {AMENITIES_LINKS.map((item) => (
                                <Link
                                    key={item}
                                    href="#"
                                    className="text-[16px] font-medium text-black/60 hover:text-black transition-colors"
                                >
                                    {item}
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

            {/* Decorative watermark: `-mb` pushes the glyph past the footer's `overflow-hidden`
                edge, and the aria/select/pointer utilities keep it purely visual. Hidden below
                `sm`, where 200px text overwhelms the viewport instead of reading as texture. */}
            <p
                aria-hidden="true"
                className="hidden sm:block select-none pointer-events-none text-black/10 font-bold whitespace-nowrap leading-none
                 text-[200px]
                 -mb-15 tracking-normal"
            >
                THE SEASPACE
            </p>
        </footer>
    );
}
