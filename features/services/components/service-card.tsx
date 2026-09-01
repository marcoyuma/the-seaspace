import Image, { StaticImageData } from "next/image";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

interface ServiceCardProps {
    imageSrc: StaticImageData;
    serviceName: string;
    bookButtonText: string;
    /**
     * Fill the grid cell at a 4:3 ratio instead of the 385:445 preview
     * ratio. Used by the 2-up service row on interior pages, where each
     * card takes half the container instead of a third.
     */
    fluid?: boolean;
    /** Only worth preloading when the card sits above the fold. */
    preload?: boolean;
}

/**
 * Preview card for a single bookable service/amenity, used in
 * `ServiceAndAmenitiesPreview`. At rest the bottom pill shows only the
 * centred service name; on hover it rolls (translate-y, same mechanic as
 * `StayCardPreview`'s label) into a split layout — booking CTA text left,
 * arrow affordance right. Below `md` (no hover) it stays on the centred
 * rest state.
 */
export default function ServiceCard({
    imageSrc,
    serviceName,
    bookButtonText,
    fluid = false,
    preload = true,
}: ServiceCardProps) {
    return (
        // Was a fixed 385x445 inline style on the non-`fluid` path — same
        // "hero image tidak tercrop" root cause as stay-card-preview.tsx.
        // `aspect-385/445` keeps the original photo proportions while
        // `w-full` lets the grid column (1-up mobile, up to 3-up at md+ in
        // ServiceAndAmenitiesPreview) drive the actual rendered width.
        <div
            className={`relative w-full overflow-hidden rounded-[20px] cursor-pointer group ${
                fluid ? "aspect-4/3" : "aspect-385/445"
            }`}
        >
            <Image
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                src={imageSrc}
                placeholder="blur"
                quality={90}
                // `priority` is deprecated as of Next 16 — `preload` is the
                // direct replacement with clearer intent. See
                // node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md
                preload={preload}
                fill
                // Without `sizes`, a `fill` image defaults to 100vw and the
                // browser downloads a far larger source than the card needs.
                sizes={fluid ? "50vw" : "(min-width: 768px) 385px, 100vw"}
                alt={`${serviceName} service preview`}
            />

            {/* Floating info pill anchored to the bottom edge of the card.
                `h-12` (not `min-h-12`) is load-bearing: the two layouts
                inside are `absolute inset-0` and roll vertically, so the
                pill needs a fixed height for `translate-y-full` to resolve
                against and for `overflow-hidden` to actually clip the roll.
                40 → 48px is the same ramp as `CHIP_SIZE.md`, which this bar can't use
                directly: its children are `absolute`, so padding wouldn't set its height. */}
            <div className="absolute inset-x-3 bottom-3 h-10 overflow-hidden rounded-[20px] bg-white sm:h-12">
                {/* Rest state: just the service name, centred. This is
                    also the permanent state below `md`, where there's no
                    hover to trigger the roll — it simply never translates. */}
                <div className="absolute inset-0 flex items-center justify-center px-4 transition-transform duration-300 ease-out md:group-hover:-translate-y-full motion-reduce:transition-none">
                    <p className="text-black font-medium text-[14px] tracking-normal sm:text-[16px]">
                        {serviceName}
                    </p>
                </div>

                {/* Hover state: `StayCardPreview`-style split layout — CTA
                    text left, outlined arrow right. Starts parked one pill
                    -height below (`translate-y-full`) and rolls up into
                    view on hover, same as the rest state rolls out above
                    it. There's no separate CTA button anymore: the whole
                    card is the click target (booking flow not wired up
                    yet). */}
                <div
                    aria-hidden
                    className="absolute inset-0 flex translate-y-full items-center justify-between gap-x-3 py-1 pl-4 pr-2 transition-transform duration-300 ease-out md:group-hover:translate-y-0 motion-reduce:transition-none"
                >
                    <p className="text-black font-medium text-[14px] tracking-normal sm:text-[16px]">
                        {bookButtonText}
                    </p>
                    {/* 32px inside a 40px bar would overflow, but this layer only rolls in
                        from `md` up (see `md:group-hover` above), where the bar is 48px. */}
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-black text-black">
                        <ArrowRightIcon size={16} weight="bold" />
                    </span>
                </div>
            </div>
        </div>
    );
}
