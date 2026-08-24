import { describe, expect, it } from "vitest";

import { guestsBooked } from "@/features/booking/types";
import {
    EXPERIENCE_REQUESTS,
    isExperienceId,
} from "@/features/experience-requests/lib/experiences";
import { idr } from "@/lib/format";
import { isActiveLink } from "@/lib/nav";
import { publicStorageUrl } from "@/lib/supabase";

/**
 * The remaining pure functions, each too small for a file of its own.
 */

describe("guestsBooked", () => {
    it("counts adults and children only", () => {
        // The rule the copy states and the number that reaches `bookings.num_guests`.
        // Infants are excluded, and `pets` has no column at all.
        expect(
            guestsBooked({ adults: 2, children: 1, infants: 3, pets: 2 }),
        ).toBe(3);
    });

    it("ignores infants entirely", () => {
        expect(guestsBooked({ adults: 1, children: 0, infants: 5, pets: 0 })).toBe(
            1,
        );
    });

    it("is what `bookings_guests_pos` is compared against", () => {
        expect(guestsBooked({ adults: 1, children: 0, infants: 0, pets: 0 })).toBe(
            1,
        );
    });
});

describe("isActiveLink", () => {
    it("marks the exact route active", () => {
        expect(isActiveLink("/stays", "/stays")).toBe(true);
    });

    it("stays active deeper in the section", () => {
        expect(isActiveLink("/stays", "/stays/tuscan-twilight-villa")).toBe(true);
    });

    it("does not match a sibling route with the same prefix", () => {
        // The `${href}/` is what stops `/stays` lighting up on `/stays-other`.
        expect(isActiveLink("/stays", "/stays-other")).toBe(false);
    });

    it("treats home as an exact match only", () => {
        expect(isActiveLink("/", "/")).toBe(true);
        expect(isActiveLink("/", "/stays")).toBe(false);
    });

    it("never marks a hash target active", () => {
        // `usePathname` drops the fragment, so there is nothing to match on.
        expect(isActiveLink("/#gallery", "/")).toBe(false);
        expect(isActiveLink("/#gallery", "/#gallery")).toBe(false);
    });
});

describe("isExperienceId", () => {
    it("accepts every configured experience", () => {
        for (const id of Object.keys(EXPERIENCE_REQUESTS)) {
            expect(isExperienceId(id)).toBe(true);
        }
    });

    it("rejects an unknown id", () => {
        expect(isExperienceId("")).toBe(false);
        expect(isExperienceId("helipad")).toBe(false);
    });

    it("rejects a prototype property name", () => {
        // This is the whole reason the implementation uses `Object.hasOwn` and not `in`:
        // `in` walks the prototype chain, so `"toString"` would pass and then index to a
        // function on a `"use server"` endpoint.
        expect(isExperienceId("toString")).toBe(false);
        expect(isExperienceId("constructor")).toBe(false);
        expect(isExperienceId("__proto__")).toBe(false);
    });
});

describe("idr", () => {
    it("formats rupiah without decimals", () => {
        // Intl inserts a non-breaking space between the symbol and the digits in some ICU
        // versions, so the separator is normalised before comparing.
        const formatted = idr.format(2_500_000).replace(/ /g, " ");
        expect(formatted).toMatch(/^Rp ?2\.500\.000$/);
    });

    it("rounds away the fraction", () => {
        expect(idr.format(2_500_000.6)).not.toContain(",");
    });

    it("formats zero", () => {
        expect(idr.format(0)).toMatch(/0$/);
    });
});

describe("publicStorageUrl", () => {
    // Env is stubbed in vitest.config.mts — lib/supabase.ts throws at module load without it.
    it("builds a public object URL", () => {
        expect(publicStorageUrl("stays", "villa/cover.jpg")).toBe(
            "https://test-project.supabase.co/storage/v1/object/public/stays/villa/cover.jpg",
        );
    });

    it("uses the origin, so a pasted REST URL cannot break images silently", () => {
        expect(publicStorageUrl("guests", "avatar.png")).not.toContain("/rest/v1");
    });
});
