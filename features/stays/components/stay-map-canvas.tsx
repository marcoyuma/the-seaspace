"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";

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
 * dynamic import in features/stays/components/stay-map.tsx. A static import
 * would break `pnpm build`, since generateStaticParams prerenders every stay
 * page.
 *
 * Driven against Leaflet's own API rather than react-leaflet. react-leaflet@5
 * creates the map in a ref callback but destroys it in an effect cleanup, and
 * never clears the ref guard that decides whether to create one — so a single
 * teardown/re-attach cycle on this subtree (StrictMode, or a <Suspense> above
 * hiding then revealing a tree that had already committed) left the children
 * calling addLayer() on a destroyed map. The rule that replaces it is the whole
 * point of the effect below: create and destroy in the SAME effect, so every
 * teardown is necessarily followed by a rebuild.
 *
 * @param lat - Latitude of the stay.
 * @param lng - Longitude of the stay.
 * @param label - Human-readable "Name, Location" shown in the popup.
 */
export default function StayMapCanvas({
    lat,
    lng,
    label,
}: {
    lat: number;
    lng: number;
    label: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);

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

    // Detached node the popup binds to, so its contents stay JSX: Tailwind
    // classes and rel="noopener noreferrer" survive, and `label` — which comes
    // from the database — needs no HTML escaping. Touching `document` during
    // render is safe here precisely because of the `ssr: false` gate above.
    const popupNode = useMemo(() => document.createElement("div"), []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const map = L.map(container, {
            // Both of these keep the map from hijacking page scroll: no
            // wheel-zoom on desktop, no one-finger pan on touch. Zoom buttons
            // and pinch-zoom still work.
            scrollWheelZoom: false,
            dragging: !L.Browser.mobile,
        }).setView([lat, lng], DEFAULT_ZOOM);

        L.tileLayer(TILE_URL, {
            attribution: TILE_ATTRIBUTION,
            subdomains: "abcd",
            maxZoom: 20,
            // Doubles tile weight on retina screens but keeps the map crisp,
            // which matters on a design this clean. Biggest lever to pull if
            // the ~250KB of tiles ever needs trimming.
            detectRetina: true,
        }).addTo(map);

        // Portal children commit before this effect runs, so `popupNode` is
        // already filled and Leaflet measures the popup at its real size.
        L.marker([lat, lng], { icon, title: label })
            .addTo(map)
            .bindPopup(popupNode, {
                // Stays open once the user pans or clicks elsewhere on the map;
                // only the × button closes it.
                autoClose: false,
                closeOnClick: false,
            })
            .openPopup();

        // The box is sized by CSS before the map mounts, but a lazily revealed
        // one can still measure 0 on the first frame. One re-read covers that.
        const frame = requestAnimationFrame(() => map.invalidateSize());

        return () => {
            cancelAnimationFrame(frame);
            map.remove();
        };
    }, [lat, lng, label, icon, popupNode]);

    // Leaflet owns everything inside this div — the portal deliberately renders
    // nothing here, so React never competes with it for the child list.
    return (
        <div ref={containerRef} className="h-full w-full">
            {createPortal(
                <>
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
                </>,
                popupNode,
            )}
        </div>
    );
}
