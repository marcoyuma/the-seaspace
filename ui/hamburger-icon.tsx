// Bars are right-flush and step down in width — the middle one is the target
// every bar converges on when the menu opens, so its 26px width drives the
// `scale-x` factors below (26/32 and 26/19).
const BAR_BASE =
    "absolute right-0 h-0.5 origin-right bg-black transition-transform duration-300 ease-in-out motion-reduce:transition-none";

/**
 * Menu trigger glyph. Closed it's a three-step staircase; open, the top and
 * bottom bars slide onto the middle one and scale to its width, so the three
 * overlap into a single line — no bar has to be hidden to sell the effect.
 *
 * Built from positioned spans rather than `<rect>`s because SVG geometry
 * attributes (`x`/`y`/`width`) aren't portably transitionable; transforms are,
 * and they stay on the GPU.
 *
 * @param isOpen - Whether the menu it controls is open; drives the merge.
 */
export default function HamburgerIcon({
    isOpen = false,
    className = "",
}: {
    isOpen?: boolean;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={`relative block h-5 w-8 cursor-pointer ${className}`}
        >
            <span
                className={`${BAR_BASE} top-0 w-8 ${
                    isOpen ? "translate-y-1.75 scale-x-[0.8125]" : ""
                }`}
            />
            <span className={`${BAR_BASE} top-1.75 w-6.5`} />
            <span
                className={`${BAR_BASE} top-3.5 w-4.75 ${
                    isOpen ? "-translate-y-1.75 scale-x-[1.368]" : ""
                }`}
            />
        </span>
    );
}
