import { describe, expect, it } from "vitest";

import {
    checkInPath,
    checkInUrl,
    formatAccessCode,
    looksLikeAccessCode,
} from "@/features/booking/lib/access-code";

/**
 * ⚠️ These are presentation helpers only. The code itself is minted by `create_booking()`
 * and `get_check_in_invite()` is what decides whether it opens anything — `looksLikeAccessCode`
 * exists to save a round trip on `/checkin/hello`, not to authorise.
 */

describe("looksLikeAccessCode", () => {
    it("accepts eight uppercase hex characters", () => {
        expect(looksLikeAccessCode("A3F72C9B")).toBe(true);
        expect(looksLikeAccessCode("00000000")).toBe(true);
        expect(looksLikeAccessCode("FFFFFFFF")).toBe(true);
    });

    it("accepts lowercase — the value is uppercased first", () => {
        expect(looksLikeAccessCode("a3f72c9b")).toBe(true);
    });

    it("trims surrounding whitespace", () => {
        expect(looksLikeAccessCode("  A3F72C9B  ")).toBe(true);
    });

    it("rejects a non-hex letter", () => {
        expect(looksLikeAccessCode("G3F72C9B")).toBe(false);
        expect(looksLikeAccessCode("A3F72C9Z")).toBe(false);
    });

    it("rejects the wrong length", () => {
        expect(looksLikeAccessCode("A3F72C9")).toBe(false);
        expect(looksLikeAccessCode("A3F72C9BB")).toBe(false);
        expect(looksLikeAccessCode("")).toBe(false);
    });

    it("rejects the formatted form", () => {
        // The spaced version is for reading, not for typing back in.
        expect(looksLikeAccessCode("A3F7 2C9B")).toBe(false);
    });

    it("rejects obvious rubbish out of a URL", () => {
        expect(looksLikeAccessCode("hello")).toBe(false);
        expect(looksLikeAccessCode("../../etc")).toBe(false);
    });
});

describe("formatAccessCode", () => {
    it("splits into two groups of four", () => {
        // Eight unbroken characters is what people misread; four and four is the grouping a
        // keypad instruction or a bank card uses.
        expect(formatAccessCode("A3F72C9B")).toBe("A3F7 2C9B");
    });
});

describe("checkInPath / checkInUrl", () => {
    it("builds the relative path", () => {
        expect(checkInPath("A3F72C9B")).toBe("/checkin/A3F72C9B");
    });

    it("builds the absolute URL a camera app can follow", () => {
        expect(checkInUrl("https://seaspace.example", "A3F72C9B")).toBe(
            "https://seaspace.example/checkin/A3F72C9B",
        );
    });

    it("works for a local origin with a port", () => {
        expect(checkInUrl("http://localhost:3000", "A3F72C9B")).toBe(
            "http://localhost:3000/checkin/A3F72C9B",
        );
    });
});
