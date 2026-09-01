export default function OverlineText({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div>
            <h3
                // Was 18px — larger than both `Text` (16px) and the label on every button,
                // which inverted the hierarchy it is supposed to sit above. Same ramp as
                // CHIP_SIZE so the site has one small-label scale.
                className="text-[14px] font-medium tracking-normal text-[#0F677D] sm:text-[16px]"
            >
                {children}
            </h3>
        </div>
    );
}
