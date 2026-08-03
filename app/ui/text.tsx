export default function Text({
    children,
    classname,
}: {
    children: React.ReactNode;
    classname?: string;
}) {
    return (
        <p
            className={`text-[18px] text-black/50 font-medium max-w-128.25 ${classname}`}
        >
            {children}
        </p>
    );
}
