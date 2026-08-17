export default function Heading({
    children,
    variant,
    classname = "",
    id,
}: {
    children: React.ReactNode;
    variant?: "white";
    classname?: string;
    /** Target for a section's `aria-labelledby`. */
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
            // the old shrink-wrap-to-center trick pass `classname="text-center"`
            // explicitly instead.
            className={`w-full font-semibold text-[48px] leading-none ${
                variant === "white" ? "text-white" : "text-black"
            } ${classname}`}
        >
            {children}
        </h2>
    );
}
