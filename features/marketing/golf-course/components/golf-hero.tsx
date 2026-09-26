import Image from "next/image";

import ExperienceRequestCta from "@/features/experience-requests/components/experience-request-cta";
import aerialGreenImg from "@/public/leisure/golf-course/golf-course.jpg";
import clifftopBunkersImg from "@/public/leisure/golf-course/golf-course3.jpg";
import OverlineText from "@/ui/overline-text";

/**
 * `/golf-course` opening: copy + CTA over one hero image, plus a supporting shot under the copy
 * from `lg` up; class-for-class twin of `SpaHero`/`EventVenueHero`. Stays a Server Component —
 * `ExperienceRequestCta` scopes `"use client"` to the button, so copy and LCP image prerender.
 */
export default function GolfHero() {
    // `gap-6` matches every other image grid; both tracks are `1fr`, so the gap widens the
    // images rather than insetting them from the Container's edges.
    return (
        <section className="grid grid-cols-1 gap-6 pt-16 lg:grid-cols-2">
            {/* `lg:h-190` matches the tall image opposite it, so the
                supporting shot below has a real amount of leftover height to
                fill via `flex-1` instead of collapsing to its content size. */}
            <div className="flex flex-col gap-6 lg:h-190">
                {/* `gap-3` is the intro-cluster convention from `/` (RESPONSIVE-AUDIT.md Bagian F). */}
                <div className="flex flex-col gap-3">
                    <OverlineText>Try a swing now</OverlineText>
                    <h1 className="font-semibold text-[32px] leading-tight sm:text-[40px] lg:text-[48px] lg:leading-none text-black">
                        A Round Between the Cliffs and the Sea
                    </h1>

                    <p className="max-w-140 text-[16px] leading-relaxed font-medium text-black/60">
                        Eighteen holes that trace the coastline hole for hole, where
                        the sea breeze decides how the round plays.
                    </p>

                    {/* One CTA only: a `#the-course` link would scroll past nothing, as that section
                        comes next. `GolfCourseSection` keeps the `id` for inbound links. */}
                    <div className="flex gap-4">
                        <ExperienceRequestCta experience="golf-course" />
                    </div>
                </div>

                {/* Hidden below `lg`, where it would squeeze the copy instead of adding a second
                    vista; it needs a whole second column to balance against. */}
                <div className="relative hidden overflow-hidden rounded-[20px] lg:block lg:flex-1">
                    <Image
                        src={clifftopBunkersImg}
                        alt="Bunkers cut into a grassy bluff overlooking the sea, framed by wind-bent trees"
                        fill
                        placeholder="blur"
                        quality={90}
                        sizes="50vw"
                        className="object-cover"
                    />
                </div>
            </div>

            {/* Main image at every breakpoint: matches `GolfCourseSection`'s band below `lg`
                (`h-70`/`sm:h-96`), then goes tall at `lg`, where it's the LCP element. */}
            <div className="relative h-70 overflow-hidden rounded-[20px] sm:h-96 lg:h-190">
                <Image
                    src={aerialGreenImg}
                    alt="Aerial view of a green ringed by bunkers on a spit of land reaching into the water"
                    fill
                    placeholder="blur"
                    quality={90}
                    preload
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover"
                />
            </div>
        </section>
    );
}
