"use client";

import { useLinkStatus } from "next/link";

/**
 * Confirms a click on a card-sized `<Link>` while the navigation is still in flight.
 *
 * Must be a DESCENDANT of the `<Link>` it reports on — `useLinkStatus` reads the link's
 * pending state from context, so wrapping the link instead of sitting inside it returns
 * `{ pending: false }` forever. The link also needs a positioning context (`relative`).
 *
 * Expect it to stay invisible most of the time, by design: `/stays/[stayId]` is prerendered
 * and `<Link>` prefetches by default, so the pending phase is usually skipped entirely. This
 * is the safety net for a cold or slow connection, not decoration.
 *
 * Always rendered with only opacity toggling — an element that appears on click would shift
 * the card's layout at the worst possible moment.
 *
 * @example
 * <Link href={`/stays/${stay.id}`} className="relative block">
 *     <StayCard {...stay} />
 *     <LinkPendingOverlay />
 * </Link>
 */
export default function LinkPendingOverlay() {
    const { pending } = useLinkStatus();

    return (
        <span
            aria-hidden
            className={`pointer-events-none absolute inset-0 flex items-center justify-center rounded-[20px] bg-white/45 backdrop-blur-[1px] transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                // `delay-100` only on the way IN: a prefetched route resolves faster than
                // that, so the hint never flashes on a navigation that was already instant.
                pending ? "opacity-100 delay-100" : "opacity-0"
            }`}
        >
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-black/15 border-t-black/55 motion-reduce:animate-none" />
        </span>
    );
}
