export default function OverlineText({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div>
            <h3
                className={`text-[16px] font-medium tracking-[0.64%] text-[#0F677D]`}
            >
                {children}
            </h3>
        </div>
    );
}
