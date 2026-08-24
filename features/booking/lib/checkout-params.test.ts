import { describe, expect, it } from "vitest";

import {
    buildCheckoutUrl,
    checkoutPath,
    parseCheckoutParams,
    type RawSearchParams,
} from "@/features/booking/lib/checkout-params";
import type { GuestCounts } from "@/features/booking/types";

/**
 * The checkout URL is the entire handover between the picker and the checkout page, which
 * makes every value in it untrusted input — the same as a hand-typed URL. These tests are
 * written as a rejection matrix for that reason.
 */

const guests = (partial: Partial<GuestCounts> = {}): GuestCounts => ({
    adults: 2,
    children: 0,
    infants: 0,
    pets: 0,
    ...partial,
});

/** Turns a built URL back into the `searchParams` shape a page receives. */
function searchParamsOf(url: string): RawSearchParams {
    const query = new URL(url, "https://seaspace.example").searchParams;
    return Object.fromEntries(query.entries());
}

describe("checkoutPath", () => {
    it("points at the villa's book route", () => {
        expect(checkoutPath("coastal-arch-retreat")).toBe(
            "/stays/coastal-arch-retreat/book",
        );
    });
});

describe("buildCheckoutUrl", () => {
    it("always writes adults", () => {
        const url = buildCheckoutUrl("villa", "2026-09-16", "2026-09-17", guests());
        expect(url).toBe(
            "/stays/villa/book?checkIn=2026-09-16&checkOut=2026-09-17&adults=2",
        );
    });

    it("omits zero counts rather than writing children=0", () => {
        const url = buildCheckoutUrl(
            "villa",
            "2026-09-16",
            "2026-09-17",
            guests({ children: 1, infants: 0, pets: 0 }),
        );
        expect(url).toContain("children=1");
        expect(url).not.toContain("infants=");
        expect(url).not.toContain("pets=");
    });

    it("never puts a price in the URL", () => {
        // A price in the URL is a price the visitor can edit. The checkout page re-reads the
        // catalogue and `create_booking` re-reads it again.
        const url = buildCheckoutUrl("villa", "2026-09-16", "2026-09-17", guests());
        expect(url).not.toMatch(/price|total|amount|discount/i);
    });

    it("round-trips through parseCheckoutParams", () => {
        const selection = guests({ children: 1, infants: 2, pets: 1 });
        const url = buildCheckoutUrl("villa", "2026-09-16", "2026-09-20", selection);
        expect(parseCheckoutParams(searchParamsOf(url))).toEqual({
            selection: { checkIn: "2026-09-16", checkOut: "2026-09-20" },
            guests: selection,
        });
    });
});

describe("parseCheckoutParams", () => {
    const valid: RawSearchParams = {
        checkIn: "2026-09-16",
        checkOut: "2026-09-20",
        adults: "2",
    };

    it("reads a coherent selection", () => {
        expect(parseCheckoutParams(valid)).toEqual({
            selection: { checkIn: "2026-09-16", checkOut: "2026-09-20" },
            guests: { adults: 2, children: 0, infants: 0, pets: 0 },
        });
    });

    it("treats a missing count as zero", () => {
        const parsed = parseCheckoutParams(valid);
        expect(parsed?.guests).toEqual({
            adults: 2,
            children: 0,
            infants: 0,
            pets: 0,
        });
    });

    it("takes the first value of a repeated param", () => {
        // `?adults=2&adults=9` must not become an array, and must not become 9.
        const parsed = parseCheckoutParams({ ...valid, adults: ["2", "9"] });
        expect(parsed?.guests.adults).toBe(2);
    });

    it("treats an empty array param as absent", () => {
        // `?children=` can arrive parsed as `[]` depending on the runtime; it must read as
        // zero rather than crashing on `value[0]`.
        const parsed = parseCheckoutParams({ ...valid, children: [] });
        expect(parsed?.guests.children).toBe(0);
    });

    describe("dates", () => {
        it("rejects a day the calendar does not have", () => {
            expect(
                parseCheckoutParams({ ...valid, checkIn: "2026-02-30" }),
            ).toBeNull();
        });

        it("rejects an unpadded date", () => {
            expect(parseCheckoutParams({ ...valid, checkIn: "2026-9-16" })).toBeNull();
        });

        it("rejects a missing leg", () => {
            expect(parseCheckoutParams({ checkIn: "2026-09-16" })).toBeNull();
            expect(parseCheckoutParams({ checkOut: "2026-09-20" })).toBeNull();
            expect(parseCheckoutParams({})).toBeNull();
        });

        it("rejects a zero-night stay", () => {
            // Mirrors the `bookings_dates_ordered` constraint, so a URL the database would
            // refuse is refused before a form is ever drawn.
            expect(
                parseCheckoutParams({ ...valid, checkOut: "2026-09-16" }),
            ).toBeNull();
        });

        it("rejects a reversed range", () => {
            expect(
                parseCheckoutParams({ ...valid, checkOut: "2026-09-15" }),
            ).toBeNull();
        });

        it("accepts a single night", () => {
            expect(
                parseCheckoutParams({ ...valid, checkOut: "2026-09-17" }),
            ).not.toBeNull();
        });

        it("does not check availability — that needs the database", () => {
            // A date years in the past parses fine here; the page and `create_booking`
            // are what reject it.
            expect(
                parseCheckoutParams({
                    checkIn: "2020-01-01",
                    checkOut: "2020-01-02",
                    adults: "1",
                }),
            ).not.toBeNull();
        });
    });

    describe("guest counts", () => {
        it("requires at least one adult", () => {
            // `bookings_guests_pos` needs a counted guest, and children cannot check
            // themselves in.
            expect(parseCheckoutParams({ ...valid, adults: "0" })).toBeNull();
            expect(parseCheckoutParams({ ...valid, adults: "" })).toBeNull();
        });

        it("rejects non-numeric input", () => {
            expect(parseCheckoutParams({ ...valid, adults: "abc" })).toBeNull();
            expect(parseCheckoutParams({ ...valid, children: "1.5" })).toBeNull();
        });

        it("rejects a negative count", () => {
            expect(parseCheckoutParams({ ...valid, children: "-1" })).toBeNull();
        });

        it("rejects a three-digit count outright", () => {
            expect(parseCheckoutParams({ ...valid, adults: "031" })).toBeNull();
            expect(parseCheckoutParams({ ...valid, children: "100" })).toBeNull();
        });

        it("rejects rather than clamps a count over the cap", () => {
            // Deliberate: a URL asking for 31 adults is a broken URL, not a request to be
            // quietly reinterpreted as 30.
            expect(parseCheckoutParams({ ...valid, adults: "31" })).toBeNull();
            expect(parseCheckoutParams({ ...valid, children: "31" })).toBeNull();
            expect(parseCheckoutParams({ ...valid, infants: "11" })).toBeNull();
            expect(parseCheckoutParams({ ...valid, pets: "11" })).toBeNull();
        });

        it("accepts the caps themselves", () => {
            const parsed = parseCheckoutParams({
                ...valid,
                adults: "30",
                children: "30",
                infants: "10",
                pets: "10",
            });
            expect(parsed?.guests).toEqual({
                adults: 30,
                children: 30,
                infants: 10,
                pets: 10,
            });
        });

        it("does not check capacity — that needs the stay", () => {
            // 30 adults parses; whether the villa sleeps them is checked by the page and
            // again by `create_booking` (SB001).
            expect(
                parseCheckoutParams({ ...valid, adults: "30" }),
            ).not.toBeNull();
        });
    });
});
