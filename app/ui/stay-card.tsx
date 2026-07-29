import Image, { StaticImageData } from "next/image";
// SSR entry point — required in Server Components / any non-Context environment.
// Bare `Bed` is deprecated by the package; use the `*Icon` export.
import { BedIcon } from "@phosphor-icons/react/ssr";

interface StayCardProps {
    imageSrc: StaticImageData;
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

// Indonesian rupiah, no decimals (e.g. "Rp2.500.000"). Built once at module
// scope so we don't allocate a formatter per render.
const idr = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
});

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
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[20px]">
                <Image
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    src={imageSrc}
                    placeholder="blur"
                    quality={100}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    alt={`${name} in ${location}`}
                />

                {isNew && (
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-[14px] bg-white px-4 py-2 text-[15px] font-medium text-black">
                        New
                        <span className="h-2 w-2 rounded-full bg-[#2c8de2]" />
                    </div>
                )}
            </div>

            {/* Info block below the image (title → specs → price). */}
            <h3 className="mt-4 text-black font-semibold text-[20px] tracking-[-1%]">
                {name}, {location}
            </h3>

            <p className="mt-1 flex items-center gap-1.5 text-[16px] text-black/50 font-medium">
                <span>{capacity} Guests</span>
                <span aria-hidden>·</span>
                <span className="flex items-center gap-1">
                    <BedIcon size={18} weight="regular" aria-hidden />
                    {beds} Beds
                </span>
                <span aria-hidden>·</span>
                <span>{area} m²</span>
            </p>

            <p className="mt-1 text-[16px] text-black/50 font-medium">
                {idr.format(pricePerNight)} / night
            </p>
        </div>
    );
}
