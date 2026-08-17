"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import "leaflet/dist/leaflet.css";

/**
 * CARTO Voyager — full-colour basemap (green parks, blue water, tinted roads)
 * in the spirit of the OSM standard style. Chosen over tile.openstreetmap.org
 * because the OSMF tile policy forbids production use, and over Google because
 * it needs no API key, account, or billing. Swap to `light_all` for the
 * greyscale Positron variant; that is this constant only, the attribution and
 * subdomains below are shared across all CARTO styles.
 *
 * {r} is filled with "@2x" by Leaflet when `detectRetina` is on.
 */
const TILE_URL =
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

/** Required by both OSM and CARTO's licences — must stay visible on the map. */
const TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>';

const DEFAULT_ZOOM = 18;

/**
 * The actual Leaflet map. Never import this directly — Leaflet touches the DOM
 * while the module is evaluated, so it must be reached through the `ssr: false`
 * dynamic import in app/ui/stay-map.tsx. A static import would break `pnpm
 * build`, since generateStaticParams prerenders every stay page.
 *
 * @param lat - Latitude of the stay.
 * @param lng - Longitude of the stay.
 * @param label - Human-readable "Name, Location" shown in the popup.
 * @param stayId - Used as the MapContainer key; see the comment on it below.
 */
export default function StayMapCanvas({
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
    // Leaflet's default marker resolves its icon URLs from the script location,
    // which bundlers break (404s). A divIcon sidesteps that entirely and lets
    // the pin follow the site's black/white palette. `className: ""` clears
    // Leaflet's own .leaflet-div-icon white box.
    const icon = useMemo(
        () =>
            L.divIcon({
                className: "",
                html: '<span class="block h-4 w-4 rounded-full border-[3px] border-white bg-black shadow-[0_2px_8px_rgba(0,0,0,0.35)]"></span>',
                iconSize: [16, 16],
                iconAnchor: [8, 8],
                popupAnchor: [0, -10],
            }),
        [],
    );

    // The popup is bound by the <Popup> child, which mounts *after* the marker
    // itself, so opening it needs the instance in state (a plain ref callback
    // would fire too early and find nothing bound).
    const [marker, setMarker] = useState<L.Marker | null>(null);

    useEffect(() => {
        marker?.openPopup();
    }, [marker]);

    return (
        <MapContainer
            // Remounts the map when navigating between stays, and neutralises
            // the double-mount that React StrictMode (on by default in the app
            // router) would otherwise turn into "Map container is already
            // initialized".
            key={stayId}
            center={[lat, lng]}
            zoom={DEFAULT_ZOOM}
            // MapContainer props are immutable after mount — changing `center`
            // later has no effect; that would need useMap() instead.
            scrollWheelZoom={false}
            // Both of these keep the map from hijacking page scroll: no
            // wheel-zoom on desktop, no one-finger pan on touch. Zoom buttons
            // and pinch-zoom still work.
            dragging={!L.Browser.mobile}
            className="h-full w-full"
        >
            <TileLayer
                url={TILE_URL}
                attribution={TILE_ATTRIBUTION}
                subdomains="abcd"
                maxZoom={20}
                // Doubles tile weight on retina screens but keeps the map crisp,
                // which matters on a design this clean. Biggest lever to pull if
                // the ~250KB of tiles ever needs trimming.
                detectRetina
            />

            <Marker
                ref={setMarker}
                position={[lat, lng]}
                icon={icon}
                title={label}
            >
                {/* Stays open once the user pans or clicks elsewhere on the map;
                    only the × button closes it. */}
                <Popup autoClose={false} closeOnClick={false}>
                    <span className="block text-[14px] font-medium text-black">
                        {label}
                    </span>
                    <a
                        href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-[13px] text-black/60 underline"
                    >
                        Open in Google Maps
                    </a>
                </Popup>
            </Marker>
        </MapContainer>
    );
}
