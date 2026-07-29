// Only the visibility gate needs the browser; the stay page around it stays a
// Server Component.
"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

/** Matches the colour the map fades in over, so nothing shifts on load. */
function MapSkeleton() {
    return <div className="h-full w-full bg-[#EEF1F3]" />;
}

// Leaflet is not SSR-safe, and `ssr: false` is only honoured inside a Client
// Component — hence this wrapper existing at all, and the map itself living in
// a separate module. The only next/dynamic in the repo.
const StayMapCanvas = dynamic(() => import("@/app/ui/stay-map-canvas"), {
    ssr: false,
    // Not redundant with the skeleton below: that one covers "not scrolled to
    // yet", this Suspense fallback covers the chunk download once it is. Same
    // component in both, so the box stays grey instead of flashing blank.
    loading: () => <MapSkeleton />,
});

/** Start fetching slightly before the map scrolls into view. */
const PRELOAD_MARGIN = "200px";

/**
 * Lazy wrapper around the Leaflet map on the stay detail page.
 *
 * next/dynamic alone still downloads the chunk on mount, so this also gates on
 * an IntersectionObserver: the section sits well below the fold, and visitors
 * who never scroll to it shouldn't pay ~50KB of Leaflet plus ~250KB of tiles.
 *
 * @param lat - Latitude of the stay.
 * @param lng - Longitude of the stay.
 * @param label - Human-readable "Name, Location" shown in the popup.
 * @param stayId - Forwarded to the map as a remount key.
 */
export default function StayMap({
    lat,
    lng,
    label,
    stayId,
}: {
    lat: number;
    lng: number;
    label: string;
    stayId: string;
}) {
    console.log(lat, lng, label, stayId);

    // Watches the skeleton, since the map it decides to load doesn't exist yet.
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    // The gate itself: flipping `isVisible` on first approach is what triggers
    // the dynamic import, so nothing Leaflet-related is fetched before then.
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        // Single-element observer, so the entry list only ever has one item;
        // `rootMargin` widens the root box to fire early rather than on contact.
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                // One-way switch — once loaded the map stays mounted, so stop
                // observing rather than tracking it back out of view.
                setIsVisible(true);
                observer.disconnect();
            },
            { rootMargin: PRELOAD_MARGIN },
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return (
        // Sized in both states so the observer has a box to measure and the
        // swap doesn't shift layout.
        <div ref={containerRef} className="h-full w-full">
            {isVisible ? (
                <StayMapCanvas
                    lat={lat}
                    lng={lng}
                    label={label}
                    stayId={stayId}
                />
            ) : (
                <MapSkeleton />
            )}
        </div>
    );
}
