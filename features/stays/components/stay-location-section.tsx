import {
    AirplaneTiltIcon,
    CarProfileIcon,
} from "@phosphor-icons/react/dist/ssr";

import type { Stay } from "@/features/stays/types";
import StayMap from "@/features/stays/components/stay-map";
import TravelOptionCard from "@/features/stays/components/travel-option-card";

/**
 * "How to get here": a pinned map of the stay plus three ways to reach it.
 *
 * Nothing here needs an API key: the map is Leaflet over CARTO tiles, and the
 * car/flight links are plain Google Maps URLs / Flights query strings. The
 * ferry link is per-stay data because operators differ island to island.
 */
export default function StayLocationSection({ stay }: { stay: Stay }) {
    const { lat, lng } = stay.coordinates;
    const { code, city } = stay.nearestAirport;

    const driveUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    const flightUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(
        `flights to ${city} ${code}`,
    )}`;

    return (
        <div className="rounded-[20px] bg-[#F7F8F9] p-3 mt-24">
            <div className="h-105 w-full overflow-hidden rounded-2xl">
                <StayMap
                    lat={lat}
                    lng={lng}
                    label={`${stay.name}, ${stay.location}`}
                    stayId={stay.id}
                />
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
                    description={`Fly into ${city} (${code}) and enjoy a comfortable transit through the heart of the island.`}
                    ctaLabel="Search flights"
                    href={flightUrl}
                />
            </div>
        </div>
    );
}
