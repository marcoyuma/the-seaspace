import Heading from "@/app/ui/heading";
import ParallaxImageSection from "@/app/ui/parallax-image-section";
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
            <div className="px-16 pt-16 pb-20">
                {/* CSS Grid (not flex) so the tagline column gets a fixed
                    proportional share (2fr) while the three link/contact
                    columns split the remainder evenly — matches the
                    asymmetric ratio in the design rather than relying on
                    arbitrary fixed widths (`w-[420px]`) + `ml-auto`. */}
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-x-16">
                    {/* Left: Heading */}
                    <Heading>Unforgettable stays by the sea.</Heading>

                    {/* Sitemap */}
                    <nav aria-label="Sitemap" className="flex flex-col">
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

                    {/* Amenities */}
                    <nav aria-label="Amenities" className="flex flex-col">
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

            {/* Decorative watermark — "THE SEASPACE" bleeds past the
                visible footer edge, clipped by `overflow-hidden` on the
                parent <footer>.
                - `clamp()` scales the font-size with viewport width
                  (instead of a fixed 170px) so it stays proportional on
                  smaller screens without manual breakpoint overrides.
                - `-mb` is a negative margin proportional to font-size
                  (`em`-based, not px) to pull the glyph's bottom edge
                  past the clip boundary consistently at any size.
                - `aria-hidden` + `select-none` + `pointer-events-none`
                  mark this as purely visual: screen readers should skip
                  it (brand name is already conveyed elsewhere, e.g. logo),
                  and it shouldn't be selectable or intercept clicks. */}
            <p
                aria-hidden="true"
                className="select-none pointer-events-none text-black/10 font-bold whitespace-nowrap leading-none
                 text-[200px]
                 -mb-15 tracking-[0.5%]"
            >
                THE SEASPACE
            </p>
        </footer>
    );
}
