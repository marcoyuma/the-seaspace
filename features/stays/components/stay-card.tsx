import Image from "next/image";
// SSR entry point — required in Server Components / any non-Context environment.
// Bare `Bed`/`Users` are deprecated by the package; use the `*Icon` exports.
// ArrowsOutSimple stands in for floor area — the four-corner "expand" glyph is
// the closest thing Phosphor has to the m² icon used on listing sites.
import {
    ArrowsOutSimpleIcon,
    BedIcon,
    UsersIcon,
} from "@phosphor-icons/react/ssr";

import type { AppImage } from "@/features/stays/types";
import { idr } from "@/lib/format";
import { CHIP_SIZE } from "@/ui/pill-styles";

interface StayCardProps {
    /** Cover image. `AppImage` rather than `StaticImageData` so the source can be a
     *  Supabase URL — see features/stays/types.ts. */
    imageSrc: AppImage;
    name: string;
    location: string;
    /** Nightly rate in IDR (integer rupiah), e.g. 2_500_000. */
    pricePerNight: number;
    /** Max guests the villa sleeps. */
    capacity: number;
    beds: number;
    /** Floor area in m². */
    area: number;
    /** Renders the "New" badge on the image when true. */
    isNew?: boolean;
}

/**
 * Real-estate–style listing card: a text block (title, specs, price) stacked
 * above a large rounded image. Data is currently passed in from a dummy array
 * on the stays page and will later come from Supabase — the prop shape is the
 * seam for that swap.
 */
export default function StayCard({
    imageSrc,
    name,
    location,
    pricePerNight,
    capacity,
    beds,
    area,
    isNew = false,
}: StayCardProps) {
    return (
        <div className="w-full cursor-pointer group">
            {/* Image wrapper is `relative` so <Image fill> can size to it. */}
            <div className="relative aspect-3/2 w-full overflow-hidden rounded-[20px]">
                <Image
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    src={imageSrc.src}
                    placeholder="blur"
                    // Remote images get no automatic blurDataURL — it is generated at
                    // upload time and stored alongside the row.
                    blurDataURL={imageSrc.blurDataURL}
                    // Matches the quality the source was encoded at (WebP q80 — see the
                    // upload contract in ADMIN-PANEL-CONTEXT.md). Asking for more re-encodes
                    // an already-lossy image at higher cost without recovering detail:
                    // measured 387 KB at q100 vs 138 KB at q80 for the same 1080px frame.
                    quality={80}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    alt={`${name} in ${location}`}
                />

                {isNew && (
                    // Radius and geometry match the chips on StayCardPreview so the two
                    // cards read as one language.
                    <div
                        className={`absolute bottom-4 left-4 flex items-center gap-2 rounded-[20px] bg-white font-semibold text-black ${CHIP_SIZE.sm}`}
                    >
                        New
                        <span className="h-2 w-2 rounded-full bg-[#2c8de2]" />
                    </div>
                )}
            </div>

            {/* Info block below the image (price → title → specs). Price and title
                sit tight together as one unit; the specs row is the separated tail. */}

            <h3 className="mt-4 text-black font-semibold text-[15px] sm:text-[16px] tracking-normal">
                {name}, {location}
            </h3>
            <p className="mt-0.5 text-[15px] sm:text-[16px] text-black/60 font-medium">
                {idr.format(pricePerNight)} / night
            </p>

            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6.5 text-[14px] sm:text-[16px] text-black/60 font-medium">
                <span className="flex items-center gap-1.5 sm:gap-2">
                    <UsersIcon
                        className="size-4 sm:size-[18px]"
                        weight="regular"
                        aria-hidden
                    />
                    {capacity} Guests
                </span>
                <span className="flex items-center gap-1.5 sm:gap-2">
                    <BedIcon
                        className="size-4 sm:size-[18px]"
                        weight="regular"
                        aria-hidden
                    />
                    {beds} Beds
                </span>
                <span className="flex items-center gap-1.5 sm:gap-2">
                    <ArrowsOutSimpleIcon
                        className="size-4 sm:size-[18px]"
                        weight="regular"
                        aria-hidden
                    />
                    {area} m²
                </span>
            </p>
        </div>
    );
}
