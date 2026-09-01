/**
 * The type scale for section headings.
 *
 * Font size and leading live here rather than in the base class list because
 * `className` is concatenated, not merged: a size passed by a caller would sit at
 * the same specificity as a baked-in one, and the winner would be decided by
 * Tailwind's generation order rather than by the caller. Keeping the scale in one
 * map means no caller ever has to fight the base — and nothing needs `!`.
 *
 * `footer` is the only heading that scales per breakpoint; every other section on
 * the site is pinned to a flat 36px (see RESPONSIVE-AUDIT.md Bagian F).
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
            // `w-full`: several callers render this inside a `flex-col
            // items-center` wrapper, relying on the h2's box shrinking to
            // fit its own content to look centered. As a non-stretched flex
            // item (column cross-axis), that shrink-to-fit sizing ignores
            // the flex container's actual available width and renders at
            // the text's full unwrapped max-content size instead of
            // wrapping — the root cause of several homepage sections
            // overflowing on mobile. `w-full` forces the box to the
            // container's real width so text wraps normally again. It does
            // NOT default to `text-center`: some callers (StaysPreviewSection,
            // Footer) are intentionally left-aligned; callers that relied on
            // the old shrink-wrap-to-center trick pass `className="text-center"`
            // explicitly instead.
            className={`w-full font-semibold ${SIZE[size]} ${
                variant === "white" ? "text-white" : "text-black"
            } ${className}`}
        >
            {children}
        </h2>
    );
}
