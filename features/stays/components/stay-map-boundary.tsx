// Error boundaries run in the browser, so this module has to be a Client
// Component — `unstable_catchError` refuses to be called on the server.
"use client";

import { unstable_catchError } from "next/error";

/**
 * What the map box shows when Leaflet throws.
 *
 * Keeps the section useful rather than blank: the same grey plate the map fades
 * in over, plus the directions link the page would have offered anyway. No
 * retry button — the reads behind this page all succeeded, so re-fetching would
 * change nothing, and the map is a nicety the guest can route around.
 *
 * The error itself is deliberately not logged here: this function re-runs on
 * every render of the fallback, and Next already reports uncaught client errors
 * to the console in development and to the error digest in production.
 *
 * @param directionsUrl - Google Maps directions link for this stay, computed by
 * the calling section so the two can't disagree about the destination.
 */
function StayMapFallback({ directionsUrl }: { directionsUrl: string }) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#EEF1F3] px-6 text-center">
            <p className="text-[16px] font-medium text-black/60">
                The map couldn&apos;t be loaded
            </p>

            <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] font-medium text-black/60 underline transition-opacity hover:opacity-80"
            >
                Open in Google Maps
            </a>
        </div>
    );
}

/**
 * Wraps the Leaflet map so a client-side crash costs the map and nothing else.
 *
 * Built on `unstable_catchError` rather than a hand-rolled class boundary
 * because that one is framework-aware: `notFound()` and `redirect()` work by
 * throwing, and it knows not to swallow them, and it clears its own error state
 * on a client navigation. A plain React boundary does neither.
 *
 * Without this, a throw from the map reached app/(stay-list)/stays/error.tsx —
 * the catalogue's boundary — and replaced the whole villa page with copy about
 * a failed list query. See BUG-STAY-MAP-REMOUNT.md.
 */
export default unstable_catchError(StayMapFallback);
