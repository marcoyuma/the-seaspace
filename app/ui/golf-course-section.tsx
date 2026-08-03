import Image from "next/image";

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
        </section>
    );
}
