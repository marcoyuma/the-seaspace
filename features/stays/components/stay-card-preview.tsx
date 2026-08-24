import Image from "next/image";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import type { AppImage } from "@/features/stays/types";

interface StayCardPreviewProps {
    imageSrc: AppImage;
    villaNameText: string;
    locationText: string;
}

/**
 * Preview card for a single stay/villa, used in `StaysPreviewSection`.
 * Displays a full-bleed image with a floating info pill (name + location)
 * anchored to the bottom, and a subtle zoom-on-hover effect to signal
 * interactivity before navigation/booking flow is wired up.
 */
export default function StayCardPreview({
    imageSrc,
    villaNameText,
    locationText,
}: StayCardPreviewProps) {
    return (
        <div
            // Was a fixed 600x570 inline style — the root cause of the
            // "hero image tidak tercrop" bug: two 600px cards need a
            // >=1200px container, so anything narrower (including this
            // grid's own `md:grid-cols-2` columns) got silently clipped.
            // `w-full` + `aspect-[600/570]` keeps the exact 600:570 photo
            // proportions from the original design while letting the grid
            // column (1 col mobile, 2 col md+) drive the actual width.
            className="relative w-full aspect-600/570 overflow-hidden cursor-pointer rounded-[20px] group"
        >
            <Image
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                src={imageSrc.src}
                placeholder="blur"
                // Remote sources have no auto-generated blur — it comes from the database.
                blurDataURL={imageSrc.blurDataURL}
                // Source is WebP q80; requesting more only inflates bytes. See stay-card.tsx.
                quality={80}
                // `priority` is deprecated as of Next 16; `preload` is the replacement.
                preload
                fill
                // `villaNameText` already conveys the subject visually adjacent
                // to this image; alt text is kept descriptive for screen readers
                // independent of the rendered overlay text.
                alt={`${villaNameText} in ${locationText}`}
            />

            {/* Floating info pill anchored to the bottom edge of the card.
                Positioned with explicit offsets (not inset-0) so the height
                stays driven by `min-h-12` rather than being stretched to
                fill the parent. */}
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-x-3 bg-white min-h-12 rounded-[20px] pl-4 pr-2 py-1">
                {/* Rolling label, same trick as `RollingNavLink` in
                    menu-panel.tsx: the villa name and the location sit
                    stacked one line-height apart inside a clipped box, and
                    the whole stack shifts up on hover so the location
                    takes over the name's exact position and styling. */}
                <div className="grid h-5.75 overflow-hidden">
                    {/* Both lines share the same grid cell (`col-start-1
                        row-start-1`) so the container's width tracks
                        whichever text is longer — an `absolute` overlay
                        would size to the first line only and clip the
                        other.

                        Below `md` there's no hover to trigger the roll, so
                        the layout starts already in the "post-hover" state
                        (location showing, name rolled away) and only
                        reverts to name-first + becomes hover-driven at
                        `md` and up. */}
                    <p className="col-start-1 row-start-1 -translate-y-full text-black font-medium text-[18px] leading-5.75 tracking-normal transition-transform duration-300 ease-out md:translate-y-0 md:group-hover:-translate-y-full motion-reduce:transition-none">
                        {villaNameText}
                    </p>
                    <p
                        aria-hidden
                        className="col-start-1 row-start-1 translate-y-0 text-black font-medium text-[18px] leading-5.75 tracking-normal transition-transform duration-300 ease-out md:translate-y-full md:group-hover:translate-y-0 motion-reduce:transition-none"
                    >
                        {locationText}
                    </p>
                </div>

                {/* Right side rolls from the (now-relocated) location text
                    to an outlined arrow affordance on hover — same
                    translate-y roll as the label on the left, so both
                    sides read as one consistent motion instead of the
                    arrow just fading in. Grid-stacked so the slot's width
                    is driven by the wider of the two — the 32px circle
                    never clips the text. */}
                <div className="grid h-8 shrink-0 items-center justify-items-end overflow-hidden">
                    {/* Same mobile-first "already rolled" logic as the label:
                        the arrow sits in place below `md`, and only becomes
                        hover-driven (arrow rolls in, text rolls out) from
                        `md` up where hover actually exists. */}
                    <p className="col-start-1 row-start-1 -translate-y-full text-black/60 font-medium text-[16px] tracking-normal transition-transform duration-300 ease-out md:translate-y-0 md:group-hover:-translate-y-full motion-reduce:transition-none">
                        {locationText}
                    </p>
                    <span
                        aria-hidden
                        className="col-start-1 row-start-1 flex h-8 w-8 translate-y-0 items-center justify-center rounded-full border border-black text-black transition-transform duration-300 ease-out md:translate-y-full md:group-hover:translate-y-0 motion-reduce:transition-none"
                    >
                        <ArrowRightIcon size={16} weight="bold" />
                    </span>
                </div>
            </div>
        </div>
    );
}
