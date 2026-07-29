import Image from "next/image";
import Link from "next/link";

import { playfair } from "@/app/_styles/fonts";
import balconyImg from "@/public/scenery/balcony-with-view-santorini-greece.jpg";
import treatmentBedImg from "@/public/leisure/spa/bed-with-sea-view.jpg";

/** Where the primary CTA sends guests until a dedicated spa booking flow exists. */
const BOOKING_PATH = "/stays";

/** Anchor rendered by `SpaRelaxationSection`. */
const TREATMENTS_ANCHOR = "#treatments";

/**
 * Opening section of `/spa`: headline, subcopy and the two CTAs stacked in the
 * left column above a supporting image, with a full-height image on the right.
 * Server Component — nothing here is interactive beyond two links.
 */
export default function SpaHero() {
    return (
        <section className="grid grid-cols-2 gap-12 pt-16">
            <div className="flex flex-col">
                <h1
                    className={`${playfair.className} text-[54px] leading-[1.05] text-black`}
                >
                    Stillness Waits at the Seaspace Spa
                </h1>

                <p className="mt-6 max-w-140 text-[18px] leading-relaxed font-medium text-black/50">
                    Sink into the quiet of the coast, where the only thing
                    moving in a hurry is the tide.
                </p>

                <div className="mt-8 flex gap-4">
                    <Link
                        href={BOOKING_PATH}
                        className="rounded-[40px] bg-[#131A2B] px-4 py-3 text-[16px] font-medium text-white transition-opacity duration-200 ease-out hover:opacity-90 motion-reduce:transition-none"
                    >
                        Reserve a treatment
                    </Link>

                    <Link
                        href={TREATMENTS_ANCHOR}
                        className="rounded-[40px] border border-black px-4 py-3 text-[16px] font-medium text-black transition-colors hover:bg-black hover:text-white"
                    >
                        See the ritual menu
                    </Link>
                </div>

                {/* `flex-1` lets this image absorb whatever height the right
                    column sets, so both columns end flush regardless of how
                    many lines the headline wraps to. */}
                <div className="relative mt-12 min-h-80 flex-1 overflow-hidden rounded-[20px]">
                    <Image
                        src={balconyImg}
                        alt="Striped linen drying over a whitewashed balcony above the sea"
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
                    src={treatmentBedImg}
                    alt="A canopied treatment bed facing open water at sunrise"
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
