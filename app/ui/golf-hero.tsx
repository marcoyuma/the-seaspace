import Image from "next/image";

import PillLink from "@/app/ui/pill-link";
import cliffFairwayImg from "@/public/leisure/golf-course/golf-course3.jpg";
import aerialGreenImg from "@/public/leisure/golf-course/golf-course.jpg";
import OverlineText from "@/app/ui/overline-text";

/** Where the primary CTA sends guests until a dedicated tee-time booking flow exists. */
const BOOKING_PATH = "/stays";

/** Anchor rendered by `GolfCourseSection`. */
const COURSE_ANCHOR = "#the-course";

/**
 * Opening section of `/golf-course`: headline, subcopy and the two CTAs stacked
 * in the left column above a supporting image, with a full-height image on the
 * right. Mirrors `SpaHero` class for class so the two leisure pages read as one
 * template. Server Component — nothing here is interactive beyond two links.
 */
export default function GolfHero() {
    // `gap-6` matches every other image grid in the project (stays preview,
    // services row, stays index). Both tracks are `1fr`, so narrowing the gap
    // widens the images rather than insetting them — the columns still reach
    // the Container's edges.
    return (
        <section className="grid grid-cols-2 gap-6 pt-16">
            <div className="flex flex-col gap-6">
                <OverlineText>Try a swing now</OverlineText>
                <h1 className="font-display text-[54px] leading-[1.05] text-black">
                    A Round Between the Cliffs and the Sea
                </h1>

                <p className="max-w-140 text-[18px] leading-relaxed font-medium text-black/50">
                    Eighteen holes that trace the coastline hole for hole, where
                    the sea breeze decides how the round plays.
                </p>

                <div className="flex gap-4">
                    <PillLink href={BOOKING_PATH} variant="gradient">
                        Book a tee time
                    </PillLink>

                    <PillLink href={COURSE_ANCHOR} variant="outline">
                        See the course
                    </PillLink>
                </div>

                {/* `flex-1` lets this image absorb whatever height the right
                    column sets, so both columns end flush regardless of how
                    many lines the headline wraps to. */}
                <div className="relative mt-12 min-h-80 flex-1 overflow-hidden rounded-[20px]">
                    <Image
                        src={cliffFairwayImg}
                        alt="A clifftop fairway with sculpted bunkers and wind-bent trees above open ocean"
                        fill
                        placeholder="blur"
                        quality={100}
                        sizes="50vw"
                        className="object-cover"
                    />
                </div>
            </div>

            {/* Tallest above-the-fold image, so almost certainly the LCP
                element — the only image on this page worth preloading. */}
            <div className="relative h-190 overflow-hidden rounded-[20px]">
                <Image
                    src={aerialGreenImg}
                    alt="Aerial view of a green ringed by bunkers on a spit of land reaching into the water"
                    fill
                    placeholder="blur"
                    quality={100}
                    preload
                    sizes="50vw"
                    className="object-cover"
                />
            </div>
        </section>
    );
}
