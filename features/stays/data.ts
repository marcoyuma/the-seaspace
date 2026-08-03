import { StaticImageData } from "next/image";

import villa1 from "@/public/villas/villa1/stay1.jpg";
import villa1Lr from "@/public/villas/villa1/stay1-lr.jpg";
import villa1Br from "@/public/villas/villa1/stay1-br.jpg";
import villa1Bat from "@/public/villas/villa1/stay1-bat.jpg";
import villa1Ext from "@/public/villas/villa1/stay1-e.jpg";

import villa2 from "@/public/villas/villa2/stay2.jpg";
import villa2Alt from "@/public/villas/villa2/stay2.2.jpg";
import villa2Lr from "@/public/villas/villa2/stay2-lr.jpg";
import villa2Br from "@/public/villas/villa2/stay2-br.jpg";
import villa2Bat from "@/public/villas/villa2/stay2-bat.jpg";

import villa3 from "@/public/villas/villa3/stay3.jpg";
import villa3Lr from "@/public/villas/villa3/stay3-lr.jpg";
import villa3Br from "@/public/villas/villa3/stay3-br.jpg";
import villa3Bat from "@/public/villas/villa3/stay3-bat.jpg";
import villa3Ext from "@/public/villas/villa3/stay3-e.jpg";

import villa4 from "@/public/villas/villa4/luxury-holiday-home-2.jpg";
import villa4Lr from "@/public/villas/villa4/contemporary-house-interior-design.jpg";
import villa4Br from "@/public/villas/villa4/minimalist-bedroom-with-blue-accents.jpg";
import villa4Bat from "@/public/villas/villa4/modern-minimalist-white-bathroom-design.jpg";
import villa4Seating from "@/public/villas/villa4/minimalist-coastal-interior-with-arched-window-built-seating.jpg";
import villa4Arch from "@/public/villas/villa4/minimalist-coastal-retreat-with-archway-ocean-view.jpg";

/** One expandable row in the AMENITIES panel on the detail page. */
export interface Amenity {
    id: string;
    label: string;
    detail: string;
}

/**
 * A frame in the detail-page image rail. Every frame renders at the same width
 * (see app/ui/stay-image-carousel.tsx), so order is the only thing that varies.
 */
export interface StayImage {
    src: StaticImageData;
    alt: string;
}

/**
 * Shape of a single stay. Kept decoupled from the eventual Supabase row so the
 * render layer stays stable when the dummy catalog below is replaced by a fetch.
 * The first block is what the /stays grid needs; the second is detail-page only.
 */
export interface Stay {
    id: string;
    imageSrc: StaticImageData;
    name: string;
    location: string;
    pricePerNight: number; // IDR
    capacity: number; // guests
    beds: number;
    area: number; // m²
    isNew: boolean;

    description: string;
    gallery: StayImage[];
    bedType: { label: string; note?: string };
    /** Free-text capacity phrasing, e.g. "4 adults and 2 children". */
    capacityLabel: string;
    amenities: Amenity[];
    coordinates: { lat: number; lng: number };
    nearestAirport: { code: string; city: string };
    /** Where the "by boat" CTA points. Per-stay because operators differ by island. */
    ferryUrl: string;
}

// Amenities every villa in the portfolio ships with. Spread into each stay so
// per-stay lists stay short and only carry what's actually different.
const SHARED_AMENITIES: Amenity[] = [
    {
        id: "housekeeping",
        label: "Daily housekeeping",
        detail: "Our team refreshes the villa every morning between 9am and 11am, and turns down the beds at dusk on request.",
    },
    {
        id: "wifi",
        label: "Fibre Wi-Fi throughout",
        detail: "Dedicated 300 Mbps fibre line with mesh access points in every room and on the terrace — fast enough for calls and streaming at the same time.",
    },
    {
        id: "kitchen",
        label: "Full kitchen & Nespresso bar",
        detail: "Induction hob, oven, dishwasher and a stocked Nespresso bar. A private chef can be arranged with 24 hours' notice.",
    },
    {
        id: "air-conditioning",
        label: "Climate control",
        detail: "Silent split-unit air conditioning in every bedroom, plus ceiling fans in the living areas for cooler evenings.",
    },
    {
        id: "safe",
        label: "In-room electronic safe",
        detail: "Laptop-sized safe in the primary bedroom wardrobe, with a personal code you set on arrival.",
    },
    {
        id: "airport-transfer",
        label: "Private airport transfer",
        detail: "Complimentary one-way transfer from Ngurah Rai International (DPS) in a private car. Return transfers are billed at cost.",
    },
];

// Dummy catalog — TODO: replace the array inside getStays()/getStay() with a
// Supabase query. Nothing outside this file needs to change when that happens.
const STAYS: Stay[] = [
    {
        id: "tuscan-twilight-villa",
        imageSrc: villa1,
        name: "Tuscan Twilight Villa",
        location: "Ubud, Bali",
        pricePerNight: 3_500_000,
        capacity: 6,
        beds: 3,
        area: 220,
        isNew: true,

        description:
            "Set into the terraced slope above the Petanu river, Tuscan Twilight Villa pairs warm limewashed walls with floor-to-ceiling glass that opens the whole living pavilion to the valley. Three bedrooms sit along a quiet garden corridor, each with its own outdoor shower. Mornings arrive with mist over the rice fields; evenings belong to the infinity pool and the long teak dining table under the pergola.",
        gallery: [
            { src: villa1, alt: "Villa exterior at dusk" },
            { src: villa1Br, alt: "Primary bedroom" },
            { src: villa1Bat, alt: "Ensuite bathroom" },
            { src: villa1Lr, alt: "Open living pavilion" },
            { src: villa1Ext, alt: "Garden and pool terrace" },
        ],
        bedType: { label: "Superking", note: "Crib on request" },
        capacityLabel: "4 adults and 2 children",
        amenities: [
            {
                id: "infinity-pool",
                label: "Private infinity pool",
                detail: "14-metre heated pool overlooking the valley, cleaned daily and lit from within after sunset.",
            },
            {
                id: "yoga-deck",
                label: "Riverside yoga deck",
                detail: "Covered teak deck above the river with mats and props provided. A resident instructor is available each morning at 7am.",
            },
            ...SHARED_AMENITIES,
        ],
        coordinates: { lat: -8.5069, lng: 115.2625 },
        nearestAirport: { code: "DPS", city: "Denpasar" },
        ferryUrl: "https://ferizy.com/",
    },
    {
        id: "coastal-arch-retreat",
        imageSrc: villa4,
        name: "Coastal Arch Retreat",
        location: "Uluwatu, Bali",
        pricePerNight: 5_200_000,
        capacity: 8,
        beds: 4,
        area: 340,
        isNew: true,

        description:
            "Coastal Arch Retreat sits on the limestone headland where the Indian Ocean swell breaks a hundred metres below. The architecture is deliberately spare — lime plaster, arched openings, built-in seating — so that nothing competes with the water. Four bedrooms open onto a shared courtyard, and the west-facing terrace is built around the sunset. This is the largest villa in our portfolio.",
        gallery: [
            { src: villa4, alt: "Clifftop exterior" },
            { src: villa4Br, alt: "Bedroom with blue accents" },
            { src: villa4Bat, alt: "Sculpted white bathroom" },
            { src: villa4Lr, alt: "Contemporary living room" },
            { src: villa4Arch, alt: "Archway to the ocean view" },
            { src: villa4Seating, alt: "Arched window with built-in seating" },
        ],
        bedType: { label: "Superking", note: "Two rooms convert to twins" },
        capacityLabel: "6 adults and 2 children",
        amenities: [
            {
                id: "clifftop-pool",
                label: "Clifftop horizon pool",
                detail: "20-metre saltwater pool cantilevered over the headland, with a submerged bench along the ocean edge.",
            },
            {
                id: "butler",
                label: "Dedicated villa host",
                detail: "A host is on site from 7am to 9pm to handle bookings, transport and anything the villa needs. Overnight contact is by phone.",
            },
            {
                id: "surf-storage",
                label: "Surf store & outdoor rinse",
                detail: "Locked board store beside the entry court, with a freshwater rinse station and wetsuit rail.",
            },
            ...SHARED_AMENITIES,
        ],
        coordinates: { lat: -8.8291, lng: 115.0849 },
        nearestAirport: { code: "DPS", city: "Denpasar" },
        ferryUrl: "https://ferizy.com/",
    },
    {
        id: "riverside-stone-lodge",
        imageSrc: villa2,
        name: "Riverside Stone Lodge",
        location: "Canggu, Bali",
        pricePerNight: 2_800_000,
        capacity: 4,
        beds: 2,
        area: 180,
        isNew: false,

        description:
            "A two-bedroom lodge built from local andesite stone, five minutes inland from Batu Bolong beach. The plan is compact and unfussy: a double-height living room, a covered kitchen that opens onto the plunge pool, and two bedrooms upstairs under an exposed timber roof. Quiet enough to work from, close enough to walk to the surf before breakfast.",
        gallery: [
            { src: villa2, alt: "Stone facade and entry" },
            { src: villa2Br, alt: "Upstairs bedroom" },
            { src: villa2Bat, alt: "Stone bathroom" },
            { src: villa2Lr, alt: "Double-height living room" },
            { src: villa2Alt, alt: "Plunge pool and deck" },
        ],
        bedType: { label: "King", note: "Second room has twin beds" },
        capacityLabel: "4 adults",
        amenities: [
            {
                id: "plunge-pool",
                label: "Plunge pool & sun deck",
                detail: "6-metre plunge pool shaded by frangipani, with four loungers and an outdoor shower.",
            },
            {
                id: "workspace",
                label: "Dedicated workspace",
                detail: "Desk, ergonomic chair and a second monitor in the mezzanine nook, on the same fibre line as the rest of the villa.",
            },
            {
                id: "bicycles",
                label: "Two bicycles included",
                detail: "Step-through bikes with locks and helmets, enough for the ten-minute ride to Batu Bolong.",
            },
            ...SHARED_AMENITIES,
        ],
        coordinates: { lat: -8.6478, lng: 115.1385 },
        nearestAirport: { code: "DPS", city: "Denpasar" },
        ferryUrl: "https://ferizy.com/",
    },
    {
        id: "cliffside-ocean-villa",
        imageSrc: villa3,
        name: "Cliffside Ocean Villa",
        location: "Nusa Penida, Bali",
        pricePerNight: 4_100_000,
        capacity: 6,
        beds: 3,
        area: 260,
        isNew: false,

        description:
            "The most remote stay we operate: a three-bedroom villa on the western cliffs of Nusa Penida, reached by fast boat from Sanur and then a twenty-minute drive. Every room faces the strait toward Bali, and on a clear evening you can watch the light go off Mount Agung from the pool. Bring what you need — the nearest shop is a village away, which is rather the point.",
        gallery: [
            { src: villa3, alt: "Villa above the western cliffs" },
            { src: villa3Br, alt: "Ocean-facing bedroom" },
            { src: villa3Bat, alt: "Open-air bathroom" },
            { src: villa3Lr, alt: "Living room facing the strait" },
            { src: villa3Ext, alt: "Pool terrace at golden hour" },
        ],
        bedType: { label: "Superking", note: "Crib on request" },
        capacityLabel: "4 adults and 2 children",
        amenities: [
            {
                id: "ocean-pool",
                label: "Cliff-edge pool",
                detail: "12-metre pool set flush with the cliff terrace, facing the strait and the Bali coastline.",
            },
            {
                id: "snorkel-kit",
                label: "Snorkelling kit & boat charter",
                detail: "Masks, fins and dry bags for six. Half-day charters to Crystal Bay and Manta Point can be booked through your host.",
            },
            {
                id: "generator",
                label: "Backup generator",
                detail: "Automatic changeover generator covers the whole villa — island outages never reach the guest areas.",
            },
            ...SHARED_AMENITIES,
        ],
        coordinates: { lat: -8.7278, lng: 115.5444 },
        nearestAirport: { code: "DPS", city: "Denpasar" },
        ferryUrl: "https://ferizy.com/",
    },
];

/**
 * Async today so the dummy array can be swapped for a Supabase query without
 * touching a single call site.
 */
export async function getStays(): Promise<Stay[]> {
    return STAYS;
}

export async function getStay(id: string): Promise<Stay | undefined> {
    return STAYS.find((stay) => stay.id === id);
}
