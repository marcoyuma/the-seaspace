import Skeleton from "@/ui/skeleton";

/**
 * Placeholder for one <StayCard />, streamed in while the /stays grid loads.
 *
 * Every block mirrors its counterpart in stay-card.tsx — the same `aspect-[3/2]` cover, the
 * same `mt-*` rhythm, and bar heights that follow the card's own `text-[15px] sm:text-[16px]`
 * type ramp. That is the whole point: the fallback and the real card occupy the same height
 * at every breakpoint, so the grid does not jump when the data lands.
 *
 * Change this whenever stay-card.tsx's geometry changes.
 */
export default function StayCardSkeleton() {
    return (
        <div className="w-full">
            <Skeleton className="w-full aspect-[3/2] rounded-[20px]" />

            {/* Title, then price tight beneath it — `mt-4` / `mt-0.5` as in the real card. */}
            <Skeleton className="mt-4 h-[15px] w-3/4 rounded-md sm:h-4" />
            <Skeleton className="mt-1.5 h-[15px] w-2/5 rounded-md sm:h-4" />

            {/* Specs row: guests / beds / area. Same wrap and gaps as the card, so a narrow
                column breaks the three bars onto two lines exactly where the text does. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6.5">
                <Skeleton className="h-[14px] w-20 rounded-md sm:h-4 sm:w-24" />
                <Skeleton className="h-[14px] w-16 rounded-md sm:h-4 sm:w-20" />
                <Skeleton className="h-[14px] w-16 rounded-md sm:h-4 sm:w-20" />
            </div>
        </div>
    );
}
