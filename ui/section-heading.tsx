/**
 * Centered serif heading + supporting paragraph used to introduce a section.
 * Content-agnostic so it can front the stays grid today and other sections later.
 */
export default function SectionHeading({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="text-center max-w-2xl mx-auto py-24">
            <h2 className="font-semibold text-[48px] leading-none text-black">
                {title}
            </h2>
            <p className="mt-6 text-[16px] leading-relaxed text-black/60 font-medium tracking-normal">
                {description}
            </p>
        </div>
    );
}
