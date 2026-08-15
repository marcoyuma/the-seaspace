import { fromISO, toISO } from "@/features/booking/lib/dates";
import type { GuestCounts } from "@/features/booking/types";

/**
 * How a selection travels from the date picker to the checkout page.
 *
 * The picker is client state; the checkout page is a Server Component on another URL.
 * The URL is the handover, and it is deliberately the *whole* handover — there is no
 * store, no cookie and no draft row. Two things follow, and both are the point:
 *
 * 1. A checkout link can be bookmarked, shared or reloaded and still means the same
 *    thing. Nothing is lost by a refresh.
 * 2. Everything in it is untrusted input, exactly like a hand-typed URL, so the server
 *    re-validates all of it — see `parseCheckoutParams()` and, past that, the
 *    `create_booking` function in supabase/migrations/0011_booking_writes.sql.
 *
 * ⚠️ **No price ever appears in these parameters.** Not the nightly rate, not the total.
 * A price in the URL is a price the visitor can edit, and the checkout page would then be
 * quoting a number it was handed rather than one it looked up. The page re-reads the
 * catalogue; the database re-reads it again when the row is written.
 */

/** Where the `Reserve` button points. */
export function checkoutPath(slug: string): string {
    return `/stays/${slug}/book`;
}

/**
 * The checkout URL for one selection, e.g.
 * `/stays/coastal-arch-retreat/book?checkIn=2026-09-16&checkOut=2026-09-17&adults=2`.
 *
 * Zero counts are omitted rather than written out as `children=0`: the URL stays short and
 * readable, and `parseCheckoutParams()` treats a missing count as zero anyway.
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
 * Reads a selection back out of the URL, or `null` if it is not a coherent one.
 *
 * `null` covers a link that was truncated, hand-edited, or kept from a stay that has since
 * changed — the checkout page turns it into a redirect back to the villa rather than a
 * half-filled form. What it does **not** cover is whether the dates are still free or
 * within capacity: those need the database, and are checked by the page and again by
 * `create_booking`.
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
