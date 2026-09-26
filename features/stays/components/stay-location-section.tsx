import { Suspense } from "react";
import {
    AirplaneTiltIcon,
    CarProfileIcon,
} from "@phosphor-icons/react/dist/ssr";

import type { Stay } from "@/features/stays/types";
import StayMap from "@/features/stays/components/stay-map";
import StayMapBoundary from "@/features/stays/components/stay-map-boundary";
import TravelOptionCard from "@/features/stays/components/travel-option-card";

/** Mirrors StayMap's own skeleton colour, so the swap never flashes or shifts. */
function MapFallback() {
    return <div className="h-full w-full bg-[#EEF1F3]" />;
}

/**
 * "How to get here": a pinned map plus ways to reach the stay, with no billing account (Leaflet
 * over CARTO's free keyed tiles, plain Google URLs). The "by air" card is generic — the per-villa
 * airport column was the same everywhere and was dropped in 0016.
 */
export default function StayLocationSection({ stay }: { stay: Stay }) {
    const { lat, lng } = stay.coordinates;

    const driveUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const flightUrl = "https://www.google.com/travel/flights";

    return (
        <div className="rounded-[20px] bg-[#F7F8F9] p-3 mt-24">
            <div className="h-105 w-full overflow-hidden rounded-2xl">
                {/* The map is the page's only client-only part, so it's where a browser API gets
                    touched; under `cacheComponents` an unguarded clock read costs the static shell. */}
                <Suspense fallback={<MapFallback />}>
                    {/* And for the same reason it gets its own error boundary:
                        a Leaflet crash should cost the map, not the villa page.
                        Without it, the throw reached the catalogue's error.tsx. */}
                    <StayMapBoundary directionsUrl={driveUrl}>
                        <StayMap
                            lat={lat}
                            lng={lng}
                            label={`${stay.name}, ${stay.location}`}
                        />
                    </StayMapBoundary>
                </Suspense>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <TravelOptionCard
                    icon={
                        <CarProfileIcon size={26} weight="light" aria-hidden />
                    }
                    title="by car"
                    description={`Follow the coastal road toward ${stay.location.split(",")[0]}, then take the private lane that leads directly to the villa gate.`}
                    ctaLabel="Navigate"
                    href={driveUrl}
                />

                <TravelOptionCard
                    icon={
                        <AirplaneTiltIcon
                            size={26}
                            weight="light"
                            aria-hidden
                        />
                    }
                    title="by air"
                    description="Fly into the nearest airport and arrange a comfortable transit through the heart of the island."
                    ctaLabel="Search flights"
                    href={flightUrl}
                />
            </div>
        </div>
    );
}
