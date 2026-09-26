/**
 * Section heading type scale, kept out of the base classes: `className` is concatenated, not
 * merged, so a caller's size would tie and lose to generation order — this map means no `!`.
 * Only `footer` scales per breakpoint; the rest are a flat 36px (RESPONSIVE-AUDIT.md Bagian F).
 */
const SIZE = {
    section: "text-[36px] leading-none",
    footer: "text-[28px] sm:text-[34px] md:text-[40px] lg:text-[48px] leading-tight sm:leading-none",
} as const;

/**
 * A section heading (`<h2>`).
 *
 * @param variant - `"white"` for headings on a dark surface. Defaults to black.
 * @param size - Type scale; see `SIZE`. Defaults to `"section"`.
 * @param className - Layout only (`text-center`, margins). Do not pass type-scale
 *   utilities here — add a `SIZE` entry instead, or they will clash with this one.
 * @param id - Target for a section's `aria-labelledby`.
 *
 * @example
 * <Heading className="text-center">Your Wonders</Heading>
 * <Heading size="footer">Unforgettable stays by the sea.</Heading>
 */
export default function Heading({
    children,
    variant,
    size = "section",
    className = "",
    id,
}: {
    children: React.ReactNode;
    variant?: "white";
    size?: keyof typeof SIZE;
    className?: string;
    id?: string;
}) {
    return (
        // No font class — headings inherit Manrope from <body>'s `font-sans`.
        // The colour is a full ternary, not `text-${...}`: Tailwind v4 scans
        // source text, so an interpolated class name is never emitted.
        <h2
            id={id}
            // `w-full`: inside a `flex-col items-center` parent the h2 shrank to its unwrapped
            // max-content and overflowed on mobile. No default `text-center` — StaysPreviewSection
            // and Footer are left-aligned; centred callers pass `className="text-center"`.
            className={`w-full font-semibold ${SIZE[size]} ${
                variant === "white" ? "text-white" : "text-black"
            } ${className}`}
        >
            {children}
        </h2>
    );
}
