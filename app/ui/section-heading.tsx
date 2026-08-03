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
            <h2 className="font-display text-[56px] leading-[1.1] text-black">
                {title}
            </h2>
            <p className="mt-6 text-[18px] leading-relaxed text-black/50 font-medium">
                {description}
            </p>
        </div>
    );
}
