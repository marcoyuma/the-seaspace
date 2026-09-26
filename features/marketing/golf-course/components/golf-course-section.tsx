import Image from "next/image";

import puttingGreenImg from "@/public/leisure/golf-course/golf-course2.jpg";

/**
 * Wide image band. `id="the-course"` has no internal link since `GolfHero` dropped its secondary
 * CTA — kept as a stable inbound target.
 */
export default function GolfCourseSection() {
    return (
        <section id="the-course" className="scroll-mt-14 pt-6">
            {/* Matches `GolfHero`'s image size below `lg` (`h-70`/`sm:h-96`), so both images
                read the same once the hero is one column; `h-155` at `lg`. */}
            <div className="relative h-70 w-full overflow-hidden rounded-[20px] sm:h-96 lg:h-155">
                <Image
                    src={puttingGreenImg}
                    alt="A putter lined up behind a ball on a close-mown green"
                    fill
                    placeholder="blur"
                    quality={90}
                    sizes="100vw"
                    className="object-cover"
                />
            </div>
        </section>
    );
}
