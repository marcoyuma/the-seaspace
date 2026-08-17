import Image from "next/image";

import ExperienceRequestCta from "@/features/experience-requests/components/experience-request-cta";
import conferenceHallImg from "@/public/leisure/event-hall/conference-hall.png";
import pavilionImg from "@/public/leisure/event-hall/event-venue.jpg";
import OverlineText from "@/ui/overline-text";

/**
 * Opening section of `/event-venue`: headline, subcopy and the CTA stacked above a single
 * hero image, with a second supporting shot under the copy from `lg` up (`hidden lg:block`
 * — out of the mobile/tablet flow, not removed outright). Same structure as `GolfHero` and
 * `SpaHero` — all three leisure heroes share this class-for-class so the pages read as one
 * template.
 *
 * Still a Server Component. `ExperienceRequestCta` draws its own `"use client"` boundary
 * around the request button alone, so the headline and the preloaded LCP image below keep
 * prerendering.
 */
export default function EventVenueHero() {
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
                    RESPONSIVE-AUDIT.md Bagian F. */}
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

                {/* Hidden below `lg`: on a narrow column this would squeeze
                    the copy above it instead of adding a second vista, so it
                    only appears once there is a whole second column to
                    balance against. Doubles as proof of the "hundred-seat
                    conference" line above — the same hall, set up the other
                    way. */}
                <div className="relative hidden overflow-hidden rounded-[20px] lg:block lg:flex-1">
                    <Image
                        src={conferenceHallImg}
                        alt="Rows of conference attendees facing a lit stage inside the same wood-panelled hall"
                        fill
                        placeholder="blur"
                        quality={100}
                        sizes="50vw"
                        className="object-cover"
                    />
                </div>
            </div>

            {/* The hero's main image — visible at every breakpoint, unlike
                the conference shot beside it. Sized to match
                `EventVenueSection`'s band below on mobile/tablet (both
                `h-70`/`sm:h-96`), then grows into the same tall desktop
                treatment as the other two leisure heroes at `lg`, where it's
                also the LCP element. */}
            <div className="relative h-70 overflow-hidden rounded-[20px] sm:h-96 lg:h-190">
                <Image
                    src={pavilionImg}
                    alt="A wood-panelled hall laid out for a formal dinner, ringed by pinecone-shaped pendant lights"
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
