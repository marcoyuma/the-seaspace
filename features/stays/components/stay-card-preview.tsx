import Image from "next/image";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import type { AppImage } from "@/features/stays/types";
import RatingSummary from "@/features/reviews/components/rating-summary";
import { CHIP_SIZE } from "@/ui/pill-styles";

interface StayCardPreviewProps {
    imageSrc: AppImage;
    villaNameText: string;
    locationText: string;
    /**
     * Mean rating for this villa, or omitted when nobody has rated it — in which case the
     * chip is absent rather than showing a zero. Optional so this card still renders
     * without any rating data at all.
     */
    ratingAverage?: number;
}

/**
 * Stay preview card for `StaysPreviewSection`: full-bleed image with zoom on hover, and a bottom
 * overlay that's two chips below `md` and one bar with hover rolls from `md` up.
 */
export default function StayCardPreview({
    imageSrc,
    villaNameText,
    locationText,
    ratingAverage,
}: StayCardPreviewProps) {
    return (
        <div
            // `aspect-3/2` is deliberately the same ratio as stay-card.tsx: the same villa
            // photo appears on the landing page and in /stays, and a different ratio meant
            // the two pages cropped it differently.
            className="relative w-full aspect-3/2 overflow-hidden cursor-pointer rounded-[20px] group"
        >
            <Image
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                src={imageSrc.src}
                placeholder="blur"
                // Remote sources have no auto-generated blur — it comes from the database.
                blurDataURL={imageSrc.blurDataURL}
                // Source is WebP q80; requesting more only inflates bytes. See stay-card.tsx.
                quality={80}
                // `priority` is deprecated as of Next 16; `preload` is the replacement.
                preload
                fill
                // Same grid breakpoint as stay-card.tsx — one column, then two from `md`.
                // Without this, `fill` defaults to 100vw and pulls a ~2x oversized file
                // once the grid is two columns wide.
                sizes="(max-width: 768px) 100vw, 50vw"
                // Carries the villa name at every breakpoint, including the mobile overlay
                // below where only the location is printed.
                alt={`${villaNameText} in ${locationText}`}
            />

            {/* Rating chip at the opposite corner — not a third slot in the bar below, whose rolls
                size from shared grid cells that extra content would change. `top-3 left-3` keeps it
                content-wide; no review count, as the label owns the card's text budget. */}
            {ratingAverage !== undefined && (
                <div
                    className={`absolute top-3 left-3 rounded-[20px] bg-white ${CHIP_SIZE.sm}`}
                >
                    <RatingSummary
                        average={ratingAverage}
                        size={16}
                        textScale="chip"
                    />
                </div>
            )}

            {/* Mobile overlay: split chips, since a full-width bar eats a third of a short 3/2 card.
                Location only (the name truncated mid-word; it's in the alt and on /stays); no rolls
                without hover. `hidden`, not opacity, keeps just one overlay in the a11y tree. */}
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-x-3 md:hidden">
                {/* Text size comes from CHIP_SIZE, not from the <p> — a `text-*` here would
                    collide with the token's at equal specificity. See AGENTS.md. */}
                <div
                    className={`flex min-w-0 items-center rounded-[20px] bg-white ${CHIP_SIZE.md}`}
                >
                    <p className="truncate text-black font-medium tracking-normal">
                        {locationText}
                    </p>
                </div>

                {/* Sized to match the chip beside it so the two sit on one line. Decorative
                    — the whole card is already wrapped in a <Link> by StaysPreviewSection,
                    so this must not read as a second target. */}
                <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-black sm:size-12"
                >
                    <ArrowRightIcon size={16} weight="bold" />
                </span>
            </div>

            {/* Desktop overlay (`md`+). Not CHIP_SIZE: its height comes from `min-h-12` and the 32px
                arrow, not `2 × py + leading`. Asymmetric `pl-4 pr-2` insets the arrow optically. */}
            <div className="absolute inset-x-3 bottom-3 hidden items-center justify-between gap-x-3 bg-white min-h-12 rounded-[20px] pl-4 pr-2 py-1 md:flex">
                {/* Rolling label (like `RollingNavLink`): name and location stacked in a clipped
                    box, shifting up on hover. `h-6` must equal `leading-6` — shorter shaves
                    "Twilight"'s descender, taller lets the next line peek in. */}
                <div className="grid h-6 overflow-hidden">
                    {/* Both lines share one grid cell, so the width tracks the longer text; an
                        `absolute` overlay would size to the first line and clip the other. */}
                    <p className="col-start-1 row-start-1 translate-y-0 text-black font-medium text-[16px] leading-6 tracking-normal transition-transform duration-300 ease-out group-hover:-translate-y-full motion-reduce:transition-none">
                        {villaNameText}
                    </p>
                    <p
                        aria-hidden
                        className="col-start-1 row-start-1 translate-y-full text-black font-medium text-[16px] leading-6 tracking-normal transition-transform duration-300 ease-out group-hover:translate-y-0 motion-reduce:transition-none"
                    >
                        {locationText}
                    </p>
                </div>

                {/* Right side rolls from location to an outlined arrow — the same motion as the
                    label, not a fade. Grid-stacked so the wider of the two sets the width. */}
                <div className="grid h-8 shrink-0 items-center justify-items-end overflow-hidden">
                    <p className="col-start-1 row-start-1 translate-y-0 text-black/60 font-medium text-[16px] tracking-normal transition-transform duration-300 ease-out group-hover:-translate-y-full motion-reduce:transition-none">
                        {locationText}
                    </p>
                    <span
                        aria-hidden
                        className="col-start-1 row-start-1 flex size-8 translate-y-full items-center justify-center rounded-full border border-black text-black transition-transform duration-300 ease-out group-hover:translate-y-0 motion-reduce:transition-none"
                    >
                        <ArrowRightIcon size={16} weight="bold" />
                    </span>
                </div>
            </div>
        </div>
    );
}
