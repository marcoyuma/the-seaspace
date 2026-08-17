export default function OverlineText({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div>
            <h3
                className={`text-[18px] font-medium tracking-normal text-[#0F677D]`}
            >
                {children}
            </h3>
        </div>
    );
}
