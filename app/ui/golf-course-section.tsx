import Image from "next/image";

import { playfair } from "@/app/_styles/fonts";
import puttingGreenImg from "@/public/leisure/golf-course/golf-course2.jpg";

/**
 * Wide image band followed by a two-column heading/paragraph split.
 *
 * Carries `id="the-course"` — the target of `GolfHero`'s secondary CTA.
 */
export default function GolfCourseSection() {
    return (
        <section id="the-course" className="scroll-mt-14 pt-6">
            <div className="relative h-155 w-full overflow-hidden rounded-[20px]">
                <Image
                    src={puttingGreenImg}
                    alt="A putter lined up behind a ball on a close-mown green"
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
                    The Round
                </h2>

                <p className="text-[18px] leading-relaxed font-medium text-black/50">
                    The layout follows the cliff edge from the first tee to the
                    last green, and prevailing breezes mean no two rounds play
                    alike. Clubs, carts and caddies are arranged at the pro
                    shop.
                </p>
            </div>
        </section>
    );
}
