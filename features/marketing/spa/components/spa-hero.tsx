import Image from "next/image";

import ExperienceRequestCta from "@/features/experience-requests/components/experience-request-cta";
import treatmentBedImg from "@/public/leisure/spa/bed-with-sea-view.jpg";
import spaToolsImg from "@/public/leisure/spa/spa-tools.jpg";
import OverlineText from "@/ui/overline-text";

/**
 * `/spa` opening: copy + CTA over one hero image, plus a supporting shot under the copy from `lg`
 * up; twin of `GolfHero`. No "ritual menu" CTA — none exists yet (experience-requests README §7).
 * Stays a Server Component: `ExperienceRequestCta` scopes `"use client"` to the button alone.
 */
export default function SpaHero() {
    // `gap-6` matches every other image grid; both tracks are `1fr`, so the gap widens the
    // images rather than insetting them from the Container's edges.
    return (
        <div className="grid grid-cols-1 gap-6 pt-16 lg:grid-cols-2">
            {/* `lg:h-190` matches the tall image opposite it, so the
                supporting shot below has a real amount of leftover height to
                fill via `flex-1` instead of collapsing to its content size. */}
            <div className="flex flex-col gap-6 lg:h-190">
                {/* `gap-3` is the intro-cluster convention from `/` (RESPONSIVE-AUDIT.md Bagian F). */}
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

                {/* Hidden below `lg`, where it would squeeze the copy instead of adding a second
                    vista; it needs a whole second column to balance against. */}
                <div className="relative hidden overflow-hidden rounded-[20px] lg:block lg:flex-1">
                    <Image
                        src={spaToolsImg}
                        alt="Massage stones, dropper bottles and rolled towels arranged beside lit candles"
                        fill
                        placeholder="blur"
                        quality={90}
                        sizes="50vw"
                        className="object-cover"
                    />
                </div>
            </div>

            {/* Main image at every breakpoint: matches `SpaRelaxationSection`'s band below `lg`
                (`h-70`/`sm:h-96`), then goes tall at `lg`, where it's the LCP element. */}
            <div className="relative h-70 overflow-hidden rounded-[20px] sm:h-96 lg:h-190">
                <Image
                    src={treatmentBedImg}
                    alt="A canopied treatment bed facing open water at sunrise"
                    fill
                    placeholder="blur"
                    quality={90}
                    preload
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover"
                />
            </div>
        </div>
    );
}
