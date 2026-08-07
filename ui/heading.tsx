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
            className={`font-semibold text-[48px] leading-none ${
                variant === "white" ? "text-white" : "text-black"
            } ${classname}`}
        >
            {children}
        </h2>
    );
}
