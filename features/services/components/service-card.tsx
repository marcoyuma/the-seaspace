import Image, { StaticImageData } from "next/image";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

interface ServiceCardProps {
    imageSrc: StaticImageData;
    serviceName: string;
    path: string;
    bookButtonText: string;
    /**
     * Fill the grid cell at a 4:3 ratio instead of the 385:445 preview
     * ratio. Used by the 2-up service row on interior pages, where each
     * card takes half the container instead of a third.
     */
    fluid?: boolean;
}

/**
 * Service card for `ServiceAndAmenitiesPreview`. At rest the bottom pill shows the centred name;
 * on hover it rolls (like `StayCardPreview`'s label) into CTA text + arrow. Below `md` (no hover)
 * it stays at rest.
 */
export default function ServiceCard({
    imageSrc,
    path,
    serviceName,
    bookButtonText,
    fluid = false,
}: ServiceCardProps) {
    return (
        // `aspect-*` + `w-full` keep the photo's proportions while the grid column drives width.
        <Link
            href={`/${path}`}
            className="block rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        >
            <div
                className={`relative w-full overflow-hidden rounded-[20px] group ${
                    fluid ? "aspect-4/3" : "aspect-385/445"
                }`}
            >
                <Image
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    src={imageSrc}
                    placeholder="blur"
                    quality={90}
                    // No `preload`: every call site sits below a full-viewport hero, and each hint
                    // lands in <head> ahead of the render-blocking stylesheet that gates first paint.
                    fill
                    // Without `sizes`, a `fill` image defaults to 100vw and the
                    // browser downloads a far larger source than the card needs.
                    sizes={fluid ? "50vw" : "(min-width: 768px) 385px, 100vw"}
                    alt={`${serviceName} service preview`}
                />

                {/* Fixed height, not `min-h`: the rolling layers are `absolute inset-0`, so the roll and
                clip need a definite height — padding can't set it, which is why this can't reuse
                `CHIP_SIZE.md` despite the same 40 → 48px ramp. */}
                <div className="absolute inset-x-3 bottom-3 h-10 overflow-hidden rounded-[20px] bg-white sm:h-12">
                    {/* Rest state: just the service name, centred. This is
                    also the permanent state below `md`, where there's no
                    hover to trigger the roll — it simply never translates. */}
                    <div className="absolute inset-0 flex items-center justify-center px-4 transition-transform duration-300 ease-out md:group-hover:-translate-y-full motion-reduce:transition-none">
                        <p className="text-black font-medium text-[14px] tracking-normal sm:text-[16px]">
                            {serviceName}
                        </p>
                    </div>

                    {/* Hover state: CTA text + outlined arrow, parked one pill-height below and rolled
                    up on hover. No separate button — the whole card links to the service's page. */}
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
        </Link>
    );
}
