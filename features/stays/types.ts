import type { StaticImageData } from "next/image";

/**
 * One image, whatever its origin.
 *
 * A static `import img from "@/public/..."` is replaced at build time with an object
 * carrying `src`, dimensions and a generated `blurDataURL`. A Supabase image is only a URL
 * string, so `StaticImageData` cannot represent it. This type accepts both, which keeps the
 * render components stable no matter which tier an image comes from.
 */
export interface AppImage {
    src: string | StaticImageData;
    alt: string;
    /**
     * Required for remote URLs — Next generates one automatically only for static imports.
     * `placeholder="blur"` without it throws at runtime, which is why the value is stored
     * in the database at upload time rather than derived on render.
     */
    blurDataURL?: string;
    /**
     * Intrinsic size after compression. Every stays component currently renders with
     * `fill`, so these are not what reserves layout space (the wrapper's aspect ratio is) —
     * they are here for components that later drop `fill`, and to compute aspect ratios.
     */
    width?: number;
    height?: number;
}

/** One expandable row in the AMENITIES panel on the detail page. */
export interface Amenity {
    id: string;
    label: string;
    detail: string;
}

/**
 * A frame in the detail-page image rail. Every frame renders at the same width
 * (see features/stays/components/stay-image-carousel.tsx), so order is the only thing that
 * varies — it comes from `stay_images.sort_order`.
 */
export type StayImage = AppImage;

/**
 * Shape of a single stay, as the render layer wants it.
 *
 * Deliberately not a mirror of the database row: the DB uses snake_case, flattens the
 * nested objects into columns, and splits gallery and amenities into child tables.
 * features/stays/api.ts owns that translation, so changing the schema does not ripple into
 * components. The first block is what the /stays grid needs; the second is detail-page only.
 */
export interface Stay {
    /** The `slug` column — public identity and the /stays/[stayId] URL segment. */
    id: string;
    /** Cover image: `stay_images` row with `sort_order = 0`, same object as `gallery[0]`. */
    imageSrc: AppImage;
    name: string;
    location: string;
    pricePerNight: number; // IDR
    /**
     * Per-night reduction, in IDR. `0` for every villa today, which is why the price
     * lines still print `pricePerNight` directly — the booking summary is the only
     * reader that subtracts it. Kept because `stays.discount` is a real column and
     * `bookings.total_price` is defined in terms of it.
     */
    discountPerNight: number;
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
}
