export default function Heading({
    children,
    variant,
    classname,
    id,
}: {
    children: React.ReactNode;
    variant?: "white";
    classname?: string;
    /** Target for a section's `aria-labelledby`. */
    id?: string;
}) {
    return (
        <h2
            id={id}
            className={`font-semibold text-[48px] tracking-[-3%] leading-none text-${variant ? "white" : "black"} ${classname}`}
        >
            {children}
        </h2>
    );
}
