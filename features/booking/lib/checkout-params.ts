import { fromISO, toISO } from "@/features/booking/lib/dates";
import type { GuestCounts } from "@/features/booking/types";

/**
 * The URL is the WHOLE picker → checkout handover (no store, cookie or draft): links survive reloads
 * and sharing, and all of it is untrusted — re-validated by `parseCheckoutParams()` and
 * `create_booking`. ⚠️ **Never a price in these params**; page and database re-read the catalogue.
 */

/** Where the `Reserve` button points. */
export function checkoutPath(slug: string): string {
    return `/stays/${slug}/book`;
}

/**
 * The checkout URL for one selection, e.g.
 * `/stays/coastal-arch-retreat/book?checkIn=2026-09-16&checkOut=2026-09-17&adults=2`.
 * Zero counts are omitted: shorter, and parsing treats a missing count as zero.
 */
export function buildCheckoutUrl(
    slug: string,
    checkIn: string,
    checkOut: string,
    guests: GuestCounts,
): string {
    const params = new URLSearchParams({ checkIn, checkOut });

    params.set("adults", String(guests.adults));
    if (guests.children > 0) params.set("children", String(guests.children));
    if (guests.infants > 0) params.set("infants", String(guests.infants));
    if (guests.pets > 0) params.set("pets", String(guests.pets));

    return `${checkoutPath(slug)}?${params}`;
}

/** What a Next.js page receives as `searchParams`, before anything has been checked. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface CheckoutSelection {
    /**
     * Both legs present — deliberately not `DateSelection`, whose nulls describe a range
     * still being picked. By the time a checkout URL exists, the picking is over.
     */
    selection: { checkIn: string; checkOut: string };
    guests: GuestCounts;
}

/** First value only. A repeated `?adults=2&adults=9` must not become an array. */
function one(value: string | string[] | undefined): string {
    return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/**
 * A `yyyy-mm-dd` string that is also a real calendar day, or `null`.
 *
 * The round trip is what rejects `2026-02-30`: `fromISO()` rolls it over to March 2nd,
 * whose formatted form no longer matches what arrived. Same technique as `parseUsDate()`.
 */
function readDay(value: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return toISO(fromISO(value)) === value ? value : null;
}

/** A small non-negative integer, or `null`. Capped so a silly URL cannot ask for 10⁹ cots. */
function readCount(value: string, max: number): number | null {
    if (value === "") return 0;
    if (!/^\d{1,2}$/.test(value)) return null;

    const count = Number(value);
    return count <= max ? count : null;
}

/**
 * Reads a selection back from the URL, or `null` if incoherent (truncated, edited, stale) — the page
 * then redirects to the villa. Availability and capacity need the database; the page checks them,
 * and `create_booking` again.
 *
 * @param searchParams The awaited `searchParams` of the checkout page.
 *
 * @example
 * const parsed = parseCheckoutParams(await searchParams);
 * if (!parsed) redirect(`/stays/${stayId}`);
 */
export function parseCheckoutParams(
    searchParams: RawSearchParams,
): CheckoutSelection | null {
    const checkIn = readDay(one(searchParams.checkIn));
    const checkOut = readDay(one(searchParams.checkOut));

    // Ordered, and at least one night apart — the same rule as the
    // `bookings_dates_ordered` constraint, so a URL that would be rejected by the
    // database is rejected before a form is ever drawn.
    if (!checkIn || !checkOut || checkOut <= checkIn) return null;

    const adults = readCount(one(searchParams.adults), 30);
    const children = readCount(one(searchParams.children), 30);
    const infants = readCount(one(searchParams.infants), 10);
    const pets = readCount(one(searchParams.pets), 10);

    if (adults === null || children === null || infants === null || pets === null) {
        return null;
    }

    // `bookings_guests_pos` requires at least one counted guest, and children cannot
    // check themselves in.
    if (adults < 1) return null;

    return {
        selection: { checkIn, checkOut },
        guests: { adults, children, infants, pets },
    };
}
