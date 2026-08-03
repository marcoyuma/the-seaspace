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
        // Size/leading copy the serif section headings on /golf-course and
        // /stays/[stayId], and the weight is left at Playfair's regular 400.
        // `leading-none` is deliberately avoided — it clips serif descenders.
        // The colour is a full ternary, not `text-${...}`: Tailwind v4 scans
        // source text, so an interpolated class name is never emitted.
        <h2
            id={id}
            className={`font-display text-[56px] leading-[1.1] ${
                variant === "white" ? "text-white" : "text-black"
            } ${classname}`}
        >
            {children}
        </h2>
    );
}
