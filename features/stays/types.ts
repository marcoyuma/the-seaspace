import type { StaticImageData } from "next/image";

/**
 * One image, whatever its origin: a static import (object with `src`, size, `blurDataURL`) or a
 * Supabase URL string, which `StaticImageData` can't represent — so render components don't care.
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
 * A stay as the render layer wants it — deliberately not the DB row (snake_case, child tables);
 * features/stays/actions.ts owns that translation. First block: /stays grid; second: detail page.
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
     * Per-night reduction, in IDR. `0` today, so price lines print `pricePerNight` and only the
     * booking summary subtracts it; kept because `bookings.total_price` is defined in terms of it.
     */
    discountPerNight: number;
    capacity: number; // guests
    beds: number;
    area: number; // m²
    isNew: boolean;

    description: string;
    gallery: StayImage[];
    amenities: Amenity[];
    coordinates: { lat: number; lng: number };
}
