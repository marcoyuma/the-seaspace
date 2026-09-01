import { Suspense } from "react";
import {
    AirplaneTiltIcon,
    CarProfileIcon,
} from "@phosphor-icons/react/dist/ssr";

import type { Stay } from "@/features/stays/types";
import StayMap from "@/features/stays/components/stay-map";
import TravelOptionCard from "@/features/stays/components/travel-option-card";

/** Mirrors StayMap's own skeleton colour, so the swap never flashes or shifts. */
function MapFallback() {
    return <div className="h-full w-full bg-[#EEF1F3]" />;
}

/**
 * "How to get here": a pinned map of the stay plus ways to reach it.
 *
 * Nothing here needs an API key: the map is Leaflet over CARTO tiles, and the
 * drive link is a plain Google Maps URL. The "by air" card used to build a
 * Google Flights link from a per-stay nearest-airport code/city, but every
 * villa in the catalogue hardcoded the same 'DPS'/'Denpasar' pair with no
 * lookup table behind it — not meaningfully per-villa data — so that column
 * was dropped (0016_stays_drop_unvalidated_fields.sql) and this card is now
 * generic instead.
 */
export default function StayLocationSection({ stay }: { stay: Stay }) {
    const { lat, lng } = stay.coordinates;

    const driveUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const flightUrl = "https://www.google.com/travel/flights";

    return (
        <div className="rounded-[20px] bg-[#F7F8F9] p-3 mt-24">
            <div className="h-105 w-full overflow-hidden rounded-2xl">
                {/* The map is the only purely client-side part of this page, so
                    it is also the only place likely to touch a browser API. The
                    boundary keeps the rest of the route prerenderable if it
                    does — under `cacheComponents` an unguarded clock read in a
                    Client Component costs the whole page its static shell. */}
                <Suspense fallback={<MapFallback />}>
                    <StayMap
                        lat={lat}
                        lng={lng}
                        label={`${stay.name}, ${stay.location}`}
                        stayId={stay.id}
                    />
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
