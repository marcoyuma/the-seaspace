import Image from "next/image";

import ExperienceRequestCta from "@/features/experience-requests/components/experience-request-cta";
import aerialGreenImg from "@/public/leisure/golf-course/golf-course.jpg";
import clifftopBunkersImg from "@/public/leisure/golf-course/golf-course3.jpg";
import OverlineText from "@/ui/overline-text";

/**
 * Opening section of `/golf-course`: headline, subcopy and the CTA stacked
 * above a single hero image. One column below `lg` — the supporting
 * clifftop shot sits under the copy again, but only from `lg` up
 * (`hidden lg:block`); it stays out of the mobile/tablet flow instead of
 * the full removal `RESPONSIVE-AUDIT.md` Bagian C called for, since a
 * `hidden` breakpoint was all that section actually needed. Mirrors
 * `SpaHero` class for class so the two leisure pages read as one template.
 *
 * Still a Server Component. The only interactive thing here is
 * `ExperienceRequestCta`, which draws its own `"use client"` boundary around the
 * button alone — the headline and the preloaded LCP image below keep
 * prerendering.
 */
export default function GolfHero() {
    // `gap-6` matches every other image grid in the project (stays preview,
    // services row, stays index). Both tracks are `1fr`, so narrowing the gap
    // widens the images rather than insetting them — the columns still reach
    // the Container's edges.
    return (
        <section className="grid grid-cols-1 gap-6 pt-16 lg:grid-cols-2">
            {/* `lg:h-190` matches the tall image opposite it, so the
                supporting shot below has a real amount of leftover height to
                fill via `flex-1` instead of collapsing to its content size. */}
            <div className="flex flex-col gap-6 lg:h-190">
                {/* `gap-3` (12px) between overline/heading/text(+CTA) matches the
                    intro-cluster convention used on `/` — see
                    RESPONSIVE-AUDIT.md Bagian F. */}
                <div className="flex flex-col gap-3">
                    <OverlineText>Try a swing now</OverlineText>
                    <h1 className="font-semibold text-[32px] leading-tight sm:text-[40px] lg:text-[48px] lg:leading-none text-black">
                        A Round Between the Cliffs and the Sea
                    </h1>

                    <p className="max-w-140 text-[16px] leading-relaxed font-medium text-black/60">
                        Eighteen holes that trace the coastline hole for hole, where
                        the sea breeze decides how the round plays.
                    </p>

                    {/* One CTA here, two on the spa hero. The `#the-course` anchor
                        link was dropped: the section it pointed at is the very next
                        thing on the page, so it scrolled past nothing. The `id`
                        stays in `GolfCourseSection` for anyone linking in. */}
                    <div className="flex gap-4">
                        <ExperienceRequestCta experience="golf-course" />
                    </div>
                </div>

                {/* Hidden below `lg`: on a narrow column this would squeeze
                    the copy above it instead of adding a second vista, so it
                    only appears once there is a whole second column to
                    balance against. */}
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

            {/* The hero's main image — visible at every breakpoint, unlike
                the clifftop shot beside it. Sized to match
                `GolfCourseSection`'s band below on mobile/tablet (both
                `h-70`/`sm:h-96`), then grows into the original tall desktop
                treatment at `lg`, where it's also the LCP element. */}
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
