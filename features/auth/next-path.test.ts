import { describe, expect, it } from "vitest";

import {
    OAUTH_NEXT_COOKIE,
    OAUTH_NEXT_MAX_AGE,
    safeNextPath,
} from "@/features/auth/next-path";

/**
 * The open-redirect guard. A `next` value arrives from a query string, a form field or a
 * cookie and is handed straight to `redirect()`, so anything that escapes same-origin here
 * is a phishing hop with the site's own domain in front of it.
 *
 * ⚠️ proxy.ts keeps a deliberate second copy of this rule (it can be deployed separately to
 * a CDN). If the rule below ever changes, that copy has to change with it.
 */

describe("safeNextPath", () => {
    it("passes a same-origin path through untouched", () => {
        expect(safeNextPath("/account/trips")).toBe("/account/trips");
    });

    it("keeps the query string", () => {
        // proxy.ts sends the checkout URL through here and the selection lives in the query,
        // so dropping it would land the guest on an empty checkout page.
        expect(
            safeNextPath("/stays/villa/book?checkIn=2026-09-16&adults=2"),
        ).toBe("/stays/villa/book?checkIn=2026-09-16&adults=2");
    });

    it("rejects a protocol-relative URL", () => {
        // `//evil.example` starts with a slash but is not a path — this is the case that
        // makes "starts with exactly one slash" the rule rather than "starts with a slash".
        expect(safeNextPath("//evil.example")).toBe("/");
        expect(safeNextPath("//evil.example/account")).toBe("/");
    });

    it("rejects an absolute URL", () => {
        expect(safeNextPath("https://evil.example")).toBe("/");
        expect(safeNextPath("http://evil.example/account")).toBe("/");
    });

    it("rejects a scheme that is not http", () => {
        expect(safeNextPath("javascript:alert(1)")).toBe("/");
        expect(safeNextPath("data:text/html,<script>")).toBe("/");
    });

    it("rejects a bare host with no leading slash", () => {
        expect(safeNextPath("evil.example")).toBe("/");
        expect(safeNextPath("account/trips")).toBe("/");
    });

    it("rejects a missing value", () => {
        expect(safeNextPath("")).toBe("/");
        expect(safeNextPath(null)).toBe("/");
        expect(safeNextPath(undefined)).toBe("/");
    });

    it("rejects a non-string FormDataEntryValue", () => {
        // `formData.get()` returns a File when the field was a file input, and a hand-rolled
        // POST can make any field one.
        const file = new File(["x"], "next.txt");
        expect(safeNextPath(file)).toBe("/");
    });

    it("honours a custom fallback", () => {
        expect(safeNextPath(null, "/account")).toBe("/account");
        expect(safeNextPath("//evil.example", "/account")).toBe("/account");
        expect(safeNextPath("https://evil.example", "/account")).toBe("/account");
    });

    it("does not apply the fallback to a value it accepted", () => {
        expect(safeNextPath("/account/trips", "/account")).toBe("/account/trips");
    });
});

describe("OAuth handover constants", () => {
    it("expires the next cookie after ten minutes", () => {
        // Long enough to finish a consent screen, short enough to be forgettable.
        expect(OAUTH_NEXT_MAX_AGE).toBe(600);
    });

    it("names the cookie", () => {
        expect(OAUTH_NEXT_COOKIE).toBe("seaspace-oauth-next");
    });
});
