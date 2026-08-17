import Image from "next/image";

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
                stays driven by `h-12` rather than being stretched to fill
                the parent. */}
            <div className="absolute inset-x-3 bottom-3 flex flex-wrap justify-between items-center gap-x-3 bg-white min-h-12 rounded-[20px]">
                <p className="text-black font-medium text-[18px] tracking-normal mx-4">
                    {villaNameText}
                </p>
                <p className="text-black/60 font-medium text-[16px] tracking-normal mx-4">
                    {locationText}
                </p>
            </div>
        </div>
    );
}
