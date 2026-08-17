export default function Text({
    children,
    classname,
}: {
    children: React.ReactNode;
    classname?: string;
}) {
    return (
        <p
            className={`text-[16px] text-black/60 font-medium tracking-normal max-w-128.25 ${classname}`}
        >
            {children}
        </p>
    );
}
