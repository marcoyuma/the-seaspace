import Skeleton from "@/ui/skeleton";

/**
 * Placeholder for one <StayCard /> while /stays streams. Mirrors stay-card.tsx block for block
 * (aspect, `mt-*`, type ramp) so the grid doesn't jump when data lands — update it with that file.
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
