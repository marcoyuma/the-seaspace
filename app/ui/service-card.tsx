import Image, { StaticImageData } from "next/image";

interface ServiceCardProps {
    imageSrc: StaticImageData;
    serviceName: string;
    bookButtonText: string;
    /**
     * Fill the grid cell (4:3) instead of the fixed 385x445 preview size.
     * Used by the 2-up service row on interior pages, where each card takes
     * half the container instead of a third.
     */
    fluid?: boolean;
    /** Only worth preloading when the card sits above the fold. */
    preload?: boolean;
}

/**
 * Preview card for a single bookable service/amenity, used in
 * `ServiceAndAmenitiesPreview`. At rest it's just the full-bleed image;
 * on hover (or keyboard focus) the image zooms slightly while a blurred
 * bottom scrim fades in and the service name + booking CTA slide up into
 * place.
 */
export default function ServiceCard({
    imageSrc,
    serviceName,
    bookButtonText,
    fluid = false,
    preload = true,
}: ServiceCardProps) {
    return (
        // `fluid` drops the inline size entirely rather than overriding it —
        // an inline `style` would win over any Tailwind width class.
        <div
            className={`relative overflow-hidden rounded-[20px] cursor-pointer group ${
                fluid ? "w-full aspect-4/3" : ""
            }`}
            style={fluid ? undefined : { width: 385, height: 445 }}
        >
            <Image
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                src={imageSrc}
                placeholder="blur"
                quality={100}
                // `priority` is deprecated as of Next 16 — `preload` is the
                // direct replacement with clearer intent. See
                // node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md
                preload={preload}
                fill
                // Without `sizes`, a `fill` image defaults to 100vw and the
                // browser downloads a far larger source than the card needs.
                sizes={fluid ? "50vw" : "385px"}
                alt={`${serviceName} service preview`}
            />

            {/* Bottom scrim: blurred + masked gradient so the white CTA pill
                and label stay legible regardless of the underlying image's
                brightness/contrast. Fades in with the label on hover — the
                unhovered card is the photo alone. Opacity is animated rather
                than `backdrop-filter` itself, which Safari doesn't interpolate.
                `pointer-events-none` keeps it from blocking clicks on the card
                beneath it. */}
            <div
                className="pointer-events-none absolute inset-0 opacity-0
                   transition-opacity duration-500 ease-out
                   group-hover:opacity-100 group-focus-within:opacity-100
                   [backdrop-filter:blur(7px)]
                   [-webkit-backdrop-filter:blur(7px)]
                   mask-[linear-gradient(to_top,black_0%,black_30%,transparent_50%)]"
            />

            {/* Label + CTA slide up from fully below the card's bottom edge.
                Anchored to `bottom-0` at its natural height (not `inset-0`) so
                `translate-y-full` resolves to exactly this block's own height —
                it starts completely out of frame and the card's `overflow-hidden`
                clips it. Transition names `translate`, not `transform`: Tailwind
                v4's translate utilities set the standalone `translate` property,
                so a `transform` transition would never fire and the block would
                snap into place. `group-focus-within` mirrors hover so the button
                stays reachable by keyboard; `motion-reduce` drops the travel and
                keeps only the fade. */}
            <div
                className="absolute inset-x-0 bottom-0 flex flex-col items-center px-2 py-2 gap-2
                   translate-y-full opacity-0 transition-[translate,opacity] duration-500 ease-out
                   group-hover:translate-y-0 group-hover:opacity-100
                   group-focus-within:translate-y-0 group-focus-within:opacity-100
                   motion-reduce:translate-y-0"
            >
                <span className="z-10 text-white text-[18px] font-semibold px-4 py-2">
                    {serviceName}
                </span>

                {/* Booking CTA — semantic <button>, not a styled <span>,
                    since this triggers an action (opening a booking flow),
                    not just static text. */}
                <button
                    type="button"
                    className="z-10 bg-white/95 text-black text-[16px] font-medium px-4 py-2 rounded-[20px] w-full transition-colors hover:bg-white"
                >
                    {bookButtonText}
                </button>
            </div>
        </div>
    );
}
