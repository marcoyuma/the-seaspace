import Image from "next/image";

import loungeImg from "@/public/villas/villa4/minimalist-coastal-interior-with-arched-window-built-seating.jpg";

/**
 * Wide image band followed by a two-column heading/paragraph split.
 *
 * Carries `id="treatments"` — the target of `SpaHero`'s secondary CTA.
 */
export default function SpaRelaxationSection() {
    return (
        <section id="treatments" className="scroll-mt-14 pt-6">
            <div className="relative h-155 w-full overflow-hidden rounded-[20px]">
                <Image
                    src={loungeImg}
                    alt="A whitewashed relaxation lounge with built-in seating beneath an arched sea-facing window"
                    fill
                    placeholder="blur"
                    quality={100}
                    sizes="100vw"
                    className="object-cover"
                />
            </div>
        </section>
    );
}
