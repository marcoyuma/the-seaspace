import Image from "next/image";

import weddingImg from "@/public/leisure/event-hall/javanese-wedding.png";

/**
 * Wide image band, same treatment as `GolfCourseSection` and
 * `SpaRelaxationSection` — one full-width shot, no copy underneath.
 *
 * Carries `id="the-hall"`. Nothing links to it since `EventVenueHero` has no
 * secondary CTA, same reasoning as the other two leisure pages; kept as a
 * stable target for anyone linking in from outside.
 */
export default function EventVenueSection() {
    return (
        <section id="the-hall" className="scroll-mt-14 pt-6">
            {/* Matches `EventVenueHero`'s single image size on mobile/tablet
                (`h-70`/`sm:h-96`) so the two images left on the page read as
                the same size once the hero drops to one column, then returns
                to its original `h-155` at `lg`. */}
            <div className="relative h-70 w-full overflow-hidden rounded-[20px] sm:h-96 lg:h-155">
                <Image
                    src={weddingImg}
                    alt="Guests in traditional Javanese dress seated for a wedding reception in the hall"
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
