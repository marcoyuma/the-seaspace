import Image from "next/image";

import ExperienceRequestCta from "@/features/experience-requests/components/experience-request-cta";
import treatmentBedImg from "@/public/leisure/spa/bed-with-sea-view.jpg";
import spaToolsImg from "@/public/leisure/spa/spa-tools.jpg";
import OverlineText from "@/ui/overline-text";

/**
 * Opening section of `/spa`: headline, subcopy and the CTA stacked above a
 * single hero image. One column below `lg` — the supporting linen shot sits
 * under the copy again, but only from `lg` up (`hidden lg:block`); it stays
 * out of the mobile/tablet flow instead of the full removal
 * `RESPONSIVE-AUDIT.md` Bagian C called for, since a `hidden` breakpoint was
 * all that section actually needed. The "See the ritual menu" CTA that used
 * to sit beside it stays dropped — §7 of the experience-requests README
 * still calls that section a placeholder with no menu behind it yet.
 * Mirrors `GolfHero` class for class so the two leisure pages read as one
 * template.
 *
 * Still a Server Component. `ExperienceRequestCta` draws its own `"use client"`
 * boundary around the request button alone, so the headline and the preloaded
 * LCP image below keep prerendering.
 */
export default function SpaHero() {
    // `gap-6` matches every other image grid in the project (stays preview,
    // services row, stays index). Both tracks are `1fr`, so narrowing the gap
    // widens the images rather than insetting them — the columns still reach
    // the Container's edges.
    return (
        <div className="grid grid-cols-1 gap-6 pt-16 lg:grid-cols-2">
            {/* `lg:h-190` matches the tall image opposite it, so the
                supporting shot below has a real amount of leftover height to
                fill via `flex-1` instead of collapsing to its content size. */}
            <div className="flex flex-col gap-6 lg:h-190">
                {/* `gap-3` (12px) between overline/heading/text(+CTA) matches the
                    intro-cluster convention used on `/` — see
                    RESPONSIVE-AUDIT.md Bagian F. Replaces the old per-element
                    `mt-*` spacing so this is now driven by one gap instead of
                    three separately-tuned margins. */}
                <div className="flex flex-col gap-3">
                    <OverlineText>Spa & wellness</OverlineText>
                    <h1 className="font-semibold text-[32px] leading-tight sm:text-[40px] lg:text-[48px] lg:leading-none text-black">
                        Stillness Waits at the Seaspace Spa
                    </h1>

                    <p className="max-w-140 text-[16px] leading-relaxed font-medium text-black/60">
                        Sink into the quiet of the coast, where the only thing
                        moving in a hurry is the tide.
                    </p>

                    <div className="flex gap-4">
                        <ExperienceRequestCta experience="spa" />
                    </div>
                </div>

                {/* Hidden below `lg`: on a narrow column this would squeeze
                    the copy above it instead of adding a second vista, so it
                    only appears once there is a whole second column to
                    balance against. */}
                <div className="relative hidden overflow-hidden rounded-[20px] lg:block lg:flex-1">
                    <Image
                        src={spaToolsImg}
                        alt="Massage stones, dropper bottles and rolled towels arranged beside lit candles"
                        fill
                        placeholder="blur"
                        quality={100}
                        sizes="50vw"
                        className="object-cover"
                    />
                </div>
            </div>

            {/* The hero's main image — visible at every breakpoint, unlike
                the linen shot beside it. Sized to match
                `SpaRelaxationSection`'s band below on mobile/tablet (both
                `h-70`/`sm:h-96`), then grows into the original tall desktop
                treatment at `lg`, where it's also the LCP element. */}
            <div className="relative h-70 overflow-hidden rounded-[20px] sm:h-96 lg:h-190">
                <Image
                    src={treatmentBedImg}
                    alt="A canopied treatment bed facing open water at sunrise"
                    fill
                    placeholder="blur"
                    quality={100}
                    preload
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover"
                />
            </div>
        </div>
    );
}
