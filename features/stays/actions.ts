import { cacheLife, cacheTag } from "next/cache";

import {
    supabase,
    publicStorageUrl,
    STAYS_CACHE_TAG,
    STAYS_CACHE_PROFILE,
} from "@/lib/supabase";
import type { Amenity, Stay, StayImage } from "@/features/stays/types";

const STAYS_BUCKET = "stays";

/**
 * One round-trip for a whole stay: PostgREST assembles the nested relations server-side,
 * so two child tables cost no extra queries. Kept as a single constant because every reader
 * needs the same shape — a stay missing its gallery is not a useful stay.
 */
const STAY_SELECT = `
    slug, name, location, price_per_night, discount, capacity, beds, area, is_new,
    description, lat, lng,
    stay_images ( storage_path, alt, blur_data_url, width, height, sort_order ),
    stay_amenities ( sort_order, amenities ( slug, label, detail ) )
`;

// Shapes returned by PostgREST for the select above. Written by hand rather than generated:
// the project has no `supabase gen types` step, and these are the only rows the app reads.
// Postgres `numeric` arrives as a JS number, not a string, so lat/lng need no parsing.
interface StayImageRow {
    storage_path: string;
    alt: string;
    blur_data_url: string | null;
    width: number;
    height: number;
    sort_order: number;
}

interface StayAmenityRow {
    sort_order: number;
    // Non-null: stay_amenities.amenity_id is NOT NULL with a real foreign key, so the
    // embedded resource always resolves.
    amenities: { slug: string; label: string; detail: string };
}

interface StayRow {
    slug: string;
    name: string;
    location: string;
    price_per_night: number;
    discount: number;
    capacity: number;
    beds: number;
    area: number;
    is_new: boolean;
    description: string;
    lat: number;
    lng: number;
    stay_images: StayImageRow[];
    stay_amenities: StayAmenityRow[];
}

function toGallery(rows: StayImageRow[]): StayImage[] {
    // Sorted here rather than relying on the query alone. PostgREST does honour .order() on
    // embedded resources, but leaning on that makes render order depend on a transport
    // detail; for a handful of rows the local sort is free insurance.
    return [...rows]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((image) => ({
            src: publicStorageUrl(STAYS_BUCKET, image.storage_path),
            alt: image.alt,
            blurDataURL: image.blur_data_url ?? undefined,
            width: image.width,
            height: image.height,
        }));
}

function toAmenities(rows: StayAmenityRow[]): Amenity[] {
    // sort_order encodes the original render order: 0-9 are villa-specific, 10+ are the
    // shared set that used to be spread in last.
    return [...rows]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(({ amenities }) => ({
            id: amenities.slug,
            label: amenities.label,
            detail: amenities.detail,
        }));
}

function toStay(row: StayRow): Stay {
    const gallery = toGallery(row.stay_images);

    return {
        id: row.slug,
        // sort_order 0 doubles as the cover, which is why the schema needs no separate
        // cover column. Guaranteed to exist by the `not exists` check in supabase/README.md.
        imageSrc: gallery[0],
        name: row.name,
        location: row.location,
        pricePerNight: row.price_per_night,
        discountPerNight: row.discount,
        capacity: row.capacity,
        beds: row.beds,
        area: row.area,
        isNew: row.is_new,
        description: row.description,
        gallery,
        amenities: toAmenities(row.stay_amenities),
        coordinates: { lat: row.lat, lng: row.lng },
    };
}

/**
 * Wraps a PostgrestError in a real Error. Thrown, not swallowed into `[]`: an empty catalogue would
 * render as a legitimate page and hide the outage. Caught by app/(stay-list)/stays/error.tsx.
 */
function queryFailed(what: string, error: { message: string; code?: string }): Error {
    return new Error(`Failed to load ${what} from Supabase: ${error.message}`, {
        cause: error,
    });
}

/**
 * Whole catalogue, in the order the /stays grid renders. No cache policy of its own —
 * the two exports below decide that, so the query itself lives in exactly one place.
 */
async function fetchStays(): Promise<Stay[]> {
    const { data, error } = await supabase
        .from("stays")
        .select(STAY_SELECT)
        .order("id");

    if (error) throw queryFailed("stays", error);
    return (data as unknown as StayRow[]).map(toStay);
}

/**
 * Cached catalogue. For readers that run away from a request and cannot stream a fallback:
 * generateStaticParams() on /stays/[stayId], which runs at build time. Kept on the shared
 * tag so the Supabase webhook still clears it — see app/api/revalidate/stays/route.ts.
 */
export async function getStays(): Promise<Stay[]> {
    "use cache";
    cacheTag(STAYS_CACHE_TAG);
    cacheLife(STAYS_CACHE_PROFILE);

    return fetchStays();
}

/**
 * Uncached catalogue for the /stays grid — where guests land right after an admin change, so
 * freshness beats a cache hit. The shell stays static; only the grid streams behind <Suspense>.
 */
export async function getStaysFresh(): Promise<Stay[]> {
    return fetchStays();
}

/** A single stay by slug. `undefined` means "no such stay" — the caller renders notFound(). */
export async function getStay(slug: string): Promise<Stay | undefined> {
    "use cache";
    cacheTag(STAYS_CACHE_TAG);
    cacheLife(STAYS_CACHE_PROFILE);

    const { data, error } = await supabase
        .from("stays")
        .select(STAY_SELECT)
        .eq("slug", slug)
        .maybeSingle();

    if (error) throw queryFailed(`stay "${slug}"`, error);
    return data ? toStay(data as unknown as StayRow) : undefined;
}

/**
 * Stays flagged for the landing preview. Reuses the full select (a leaner one isn't worth a second
 * mapper that could drift). No "first N" fallback — an empty `is_featured` set must look broken.
 */
async function fetchFeaturedStays(): Promise<Stay[]> {
    const { data, error } = await supabase
        .from("stays")
        .select(STAY_SELECT)
        .eq("is_featured", true)
        .order("id");

    if (error) throw queryFailed("featured stays", error);
    return (data as unknown as StayRow[]).map(toStay);
}

/** Cached featured set. No reader today; kept as the counterpart to getStays(). */
export async function getFeaturedStays(): Promise<Stay[]> {
    "use cache";
    cacheTag(STAYS_CACHE_TAG);
    cacheLife(STAYS_CACHE_PROFILE);

    return fetchFeaturedStays();
}

/**
 * Uncached featured set, read by the landing preview. Same reasoning as getStaysFresh():
 * the section already streams inside a <Suspense> boundary, so a live query buys freshness
 * without holding up the static shell around it.
 */
export async function getFeaturedStaysFresh(): Promise<Stay[]> {
    return fetchFeaturedStays();
}
