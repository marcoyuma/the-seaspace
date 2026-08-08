import Image from "next/image";

import jacuzziImg from "@/public/leisure/spa/jacuzzi.jpg";

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
                    src={jacuzziImg}
                    alt="A whitewashed relaxation lounge with built-in seating beneath an semi indoor tropical vibes"
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
