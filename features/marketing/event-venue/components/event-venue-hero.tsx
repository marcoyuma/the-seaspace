import Image from "next/image";

import ExperienceRequestCta from "@/features/experience-requests/components/experience-request-cta";
import conferenceHallImg from "@/public/leisure/event-hall/conference-hall.png";
import pavilionImg from "@/public/leisure/event-hall/event-venue.jpg";
import OverlineText from "@/ui/overline-text";

/**
 * `/event-venue` opening: copy + CTA over one hero image, plus a supporting shot under the copy
 * from `lg` up; class-for-class twin of `GolfHero`/`SpaHero`. Stays a Server Component —
 * `ExperienceRequestCta` scopes `"use client"` to the button, so copy and LCP image prerender.
 */
export default function EventVenueHero() {
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
                    <OverlineText>Event venue</OverlineText>
                    <h1 className="font-semibold text-[32px] leading-tight sm:text-[40px] lg:text-[48px] lg:leading-none text-black">
                        One Hall, Every Kind of Celebration
                    </h1>

                    <p className="max-w-140 text-[16px] leading-relaxed font-medium text-black/60">
                        From a Javanese wedding procession to a hundred-seat
                        conference, the pavilion resets around whatever the day
                        calls for.
                    </p>

                    <div className="flex gap-4">
                        <ExperienceRequestCta experience="event-venue" />
                    </div>
                </div>

                {/* Hidden below `lg`, where it would squeeze the copy instead of adding a vista.
                    Doubles as proof of the "hundred-seat conference" line: same hall, set up differently. */}
                <div className="relative hidden overflow-hidden rounded-[20px] lg:block lg:flex-1">
                    <Image
                        src={conferenceHallImg}
                        alt="Rows of conference attendees facing a lit stage inside the same wood-panelled hall"
                        fill
                        placeholder="blur"
                        quality={90}
                        sizes="50vw"
                        className="object-cover"
                    />
                </div>
            </div>

            {/* Main image at every breakpoint: matches `EventVenueSection`'s band below `lg`
                (`h-70`/`sm:h-96`), then goes tall at `lg`, where it's the LCP element. */}
            <div className="relative h-70 overflow-hidden rounded-[20px] sm:h-96 lg:h-190">
                <Image
                    src={pavilionImg}
                    alt="A wood-panelled hall laid out for a formal dinner, ringed by pinecone-shaped pendant lights"
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
