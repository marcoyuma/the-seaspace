import Image from "next/image";

import puttingGreenImg from "@/public/leisure/golf-course/golf-course2.jpg";

/**
 * Wide image band followed by a two-column heading/paragraph split.
 *
 * Carries `id="the-course"`. Nothing links to it since `GolfHero` dropped its
 * secondary CTA; kept as a stable target for anyone linking in from outside.
 */
export default function GolfCourseSection() {
    return (
        <section id="the-course" className="scroll-mt-14 pt-6">
            {/* Matches `GolfHero`'s single remaining image size on
                mobile/tablet (`h-70`/`sm:h-96`) so the two images left on the
                page read as the same size once the hero drops to one column,
                then returns to its original `h-155` at `lg`. */}
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
