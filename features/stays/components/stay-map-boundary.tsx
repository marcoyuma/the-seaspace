// Error boundaries run in the browser, so this module has to be a Client
// Component — `unstable_catchError` refuses to be called on the server.
"use client";

import { unstable_catchError } from "next/error";

/**
 * Map fallback when Leaflet throws: the same grey plate plus the directions link. No retry (the
 * page's reads succeeded, so re-fetching changes nothing) and no logging — Next already reports it.
 *
 * @param directionsUrl - Directions link from the calling section, so both agree on the destination.
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
 * Contains a Leaflet crash to the map. `unstable_catchError`, not a hand-rolled class: it lets
 * `notFound()`/`redirect()` through and resets on client navigation. Without it the throw replaced
 * the villa page with the catalogue's error.tsx (BUG-STAY-MAP-REMOUNT.md).
 */
export default unstable_catchError(StayMapFallback);
