"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";

import "leaflet/dist/leaflet.css";

/**
 * Needs NEXT_PUBLIC_CARTO_API_KEY. It is browser-visible by design (a free quota key, no billing).
 * CARTO watermarks keyless tiles since 2026-09-23 (docs.carto.com/faqs/carto-basemaps).
 */
const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY;

/**
 * CARTO Voyager tiles: OSMF's policy forbids production use of tile.openstreetmap.org, and Google
 * needs billing. Keyless still renders, just watermarked, so a missing key never breaks the page.
 * `light_all` swaps to greyscale Positron. Leaflet fills {r} with "@2x" under `detectRetina`.
 */
const TILE_URL = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${
    CARTO_API_KEY ? `?key=${encodeURIComponent(CARTO_API_KEY)}` : ""
}`;

if (!CARTO_API_KEY && process.env.NODE_ENV === "development") {
    console.warn(
        "NEXT_PUBLIC_CARTO_API_KEY is not set, so map tiles will carry CARTO's watermark. " +
            "Get a free key at https://carto.com/basemaps/apikey/",
    );
}

/** Required by both OSM and CARTO's licences — must stay visible on the map. */
const TILE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>';

const DEFAULT_ZOOM = 18;

/**
 * The Leaflet map — import only via stay-map.tsx's `ssr: false` dynamic import, as Leaflet touches
 * the DOM at module eval. Plain Leaflet, not react-leaflet@5, whose stale ref guard broke re-attach
 * cycles: the effect below creates and destroys in the SAME effect, so every teardown rebuilds.
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

    // Leaflet's default marker resolves icon URLs from the script path, which bundlers break (404s).
    // A divIcon avoids that and follows the site palette; `className: ""` drops Leaflet's white box.
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

    // Detached popup node, so its contents stay JSX (Tailwind classes, no escaping of the DB
    // `label`). Touching `document` in render is safe only because of the `ssr: false` gate.
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
