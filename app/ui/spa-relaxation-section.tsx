import Image from "next/image";

import { playfair } from "@/app/_styles/fonts";
import loungeImg from "@/public/villas/villa4/minimalist-coastal-interior-with-arched-window-built-seating.jpg";

/**
 * Wide image band followed by a two-column heading/paragraph split.
 *
 * Carries `id="treatments"` — the target of `SpaHero`'s secondary CTA.
 */
export default function SpaRelaxationSection() {
    return (
        <section id="treatments" className="scroll-mt-14 pt-28">
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

            <div className="mt-16 grid grid-cols-2 gap-12">
                <h2
                    className={`${playfair.className} text-[56px] leading-[1.1] text-black`}
                >
                    Stillness
                </h2>

                <p className="text-[18px] leading-relaxed font-medium text-black/50">
                    Suites open onto the garden and the light comes off the
                    water all afternoon. Our therapists work with locally
                    pressed oils, and every ritual closes with tea on the
                    terrace.
                </p>
            </div>
        </section>
    );
}
