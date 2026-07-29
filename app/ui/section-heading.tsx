// Serif display face for section intros (matches the "guide you to your suite"
// reference). Declared once in app/_styles/fonts.ts so headings that aren't a
// centred SectionHeading — e.g. the stay detail page h1 — share the same load.
import { playfair } from "@/app/_styles/fonts";

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
            <h2
                className={`${playfair.className} text-[56px] leading-[1.1] text-black`}
            >
                {title}
            </h2>
            <p className="mt-6 text-[18px] leading-relaxed text-black/50 font-medium">
                {description}
            </p>
        </div>
    );
}
