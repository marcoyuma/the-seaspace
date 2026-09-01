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
 * Preview card for a single stay/villa, used in `StaysPreviewSection`.
 * Displays a full-bleed image with floating info anchored to the bottom, and a
 * subtle zoom-on-hover effect to signal interactivity.
 *
 * The bottom overlay has two mutually exclusive forms: two separate chips below
 * `md`, one wide bar with hover-driven roll animations from `md` up. See the
 * comments on each block.
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

            {/* Rating chip, mirroring the label at the opposite corner.

                Deliberately NOT a third slot inside the bar below: that bar runs two
                separate roll animations (name→location on the left, location→arrow on the
                right), and both size themselves from a grid whose cell is shared by two
                stacked lines. Adding content there changes the widths those rolls are
                measured against.

                `top-3 left-3` rather than `inset-x-3`, so the chip is as wide as its own
                content instead of stretching across the card.

                No review count here: at this size the average alone is the useful half, and
                the label already owns the card's text budget. */}
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

            {/* Mobile overlay: two separate chips pushed to opposite edges.

                A 3/2 card is short — a single full-width white bar would eat roughly a
                third of it at phone widths. Splitting it lets the photo breathe. Only the
                location is printed: the villa name at this width forced a truncation that
                cut the name mid-word, and the name is already in the image's alt text and
                on the /stays card this links to. The roll animations are dropped rather
                than reimplemented — without hover there is nothing to trigger them.

                `hidden` (not opacity/visibility) is what keeps this from being announced
                twice — the `md` block below is display:none at these widths, so only one
                of the two is ever in the accessibility tree. */}
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

            {/* Desktop overlay (`md` and up): the original single floating bar.

                Not on CHIP_SIZE: its height comes from `min-h-12` and the 32px arrow it
                hosts, not from `2 × py + leading`, so the token's padding rule doesn't
                describe it. The asymmetric `pl-4 pr-2` is what keeps that arrow inset from
                the right edge by the same optical amount as the text on the left. */}
            <div className="absolute inset-x-3 bottom-3 hidden items-center justify-between gap-x-3 bg-white min-h-12 rounded-[20px] pl-4 pr-2 py-1 md:flex">
                {/* Rolling label, same trick as `RollingNavLink` in
                    menu-panel.tsx: the villa name and the location sit
                    stacked one line-height apart inside a clipped box, and
                    the whole stack shifts up on hover so the location
                    takes over the name's exact position and styling.

                    `h-6` must stay equal to `leading-6` below: a shorter clip shaves the
                    descender on "Twilight", a taller one lets the next line peek in. */}
                <div className="grid h-6 overflow-hidden">
                    {/* Both lines share the same grid cell (`col-start-1
                        row-start-1`) so the container's width tracks
                        whichever text is longer — an `absolute` overlay
                        would size to the first line only and clip the
                        other. */}
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

                {/* Right side rolls from the (now-relocated) location text
                    to an outlined arrow affordance on hover — same
                    translate-y roll as the label on the left, so both
                    sides read as one consistent motion instead of the
                    arrow just fading in. Grid-stacked so the slot's width
                    is driven by the wider of the two — the 32px circle
                    never clips the text. */}
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
