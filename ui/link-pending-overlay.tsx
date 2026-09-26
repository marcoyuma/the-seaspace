"use client";

import { useLinkStatus } from "next/link";

/**
 * Pending hint for a card-sized `<Link>`; must sit INSIDE a `relative` link, since `useLinkStatus`
 * reads context. Usually invisible (the route is prerendered and prefetched) — it's the safety net
 * for slow connections. Always mounted, only opacity toggles, so a click never shifts the layout.
 *
 * @example <Link href={href} className="relative block"><StayCard {...stay} /><LinkPendingOverlay /></Link>
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
