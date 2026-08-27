import Image from "next/image";

import jacuzziImg from "@/public/leisure/spa/jacuzzi.jpg";

/**
 * Wide image band followed by a two-column heading/paragraph split.
 *
 * Carries `id="treatments"`. Nothing links to it since `SpaHero` dropped its
 * secondary CTA; kept as a stable target for anyone linking in from outside.
 */
export default function SpaRelaxationSection() {
    return (
        <div id="treatments" className="scroll-mt-14 pt-6">
            {/* Matches `SpaHero`'s single remaining image size on
                mobile/tablet (`h-70`/`sm:h-96`) so the two images left on the
                page read as the same size once the hero drops to one column,
                then returns to its original `h-155` at `lg`. */}
            <div className="relative h-70 w-full overflow-hidden rounded-[20px] sm:h-96 lg:h-155">
                <Image
                    src={jacuzziImg}
                    alt="A whitewashed relaxation lounge with built-in seating beneath an semi indoor tropical vibes"
                    fill
                    placeholder="blur"
                    quality={90}
                    sizes="100vw"
                    className="object-cover"
                />
            </div>
        </div>
    );
}
