import Image from "next/image";

import weddingImg from "@/public/leisure/event-hall/javanese-wedding.png";

/**
 * Wide image band, same as `GolfCourseSection`/`SpaRelaxationSection`. `id="the-hall"` has no
 * internal link (the hero has no secondary CTA) — kept as a stable inbound target.
 */
export default function EventVenueSection() {
    return (
        <section id="the-hall" className="scroll-mt-14 pt-6">
            {/* Matches `EventVenueHero`'s image size below `lg` (`h-70`/`sm:h-96`), so both
                images read the same once the hero is one column; `h-155` at `lg`. */}
            <div className="relative h-70 w-full overflow-hidden rounded-[20px] sm:h-96 lg:h-155">
                <Image
                    src={weddingImg}
                    alt="Guests in traditional Javanese dress seated for a wedding reception in the hall"
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
