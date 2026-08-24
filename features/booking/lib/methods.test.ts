import { describe, expect, it } from "vitest";

import {
    CHECK_IN_METHODS,
    checkInMethod,
    DEFAULT_CHECK_IN_METHOD,
    isCheckInMethod,
} from "@/features/booking/lib/check-in-methods";
import {
    DEFAULT_PAYMENT_METHOD,
    isPaymentMethod,
    PAYMENT_METHODS,
    paymentMethodLabel,
} from "@/features/booking/lib/payment-methods";

/**
 * The two radio lists at checkout, and the narrowing guards `payAndBook` runs them through.
 *
 * `paymentMethodLabel` and `checkInMethod` both end in a non-null assertion, which is only
 * safe while every id in the list is findable and the guards are the sole way in — the
 * lookup and uniqueness tests below are what keep that true.
 */

describe("isPaymentMethod", () => {
    it("accepts every id in the list", () => {
        for (const method of PAYMENT_METHODS) {
            expect(isPaymentMethod(method.id)).toBe(true);
        }
    });

    it("accepts the three known ids", () => {
        expect(isPaymentMethod("gopay")).toBe(true);
        expect(isPaymentMethod("bank-transfer")).toBe(true);
        expect(isPaymentMethod("card")).toBe(true);
    });

    it("rejects rather than defaults an unknown value", () => {
        expect(isPaymentMethod("")).toBe(false);
        expect(isPaymentMethod("paypal")).toBe(false);
        expect(isPaymentMethod("GoPay")).toBe(false);
    });

    it("rejects a prototype property name", () => {
        // `"use server"` exports are public endpoints, so the form value is arbitrary input.
        expect(isPaymentMethod("toString")).toBe(false);
        expect(isPaymentMethod("constructor")).toBe(false);
    });
});

describe("isCheckInMethod", () => {
    it("accepts every id in the list", () => {
        for (const method of CHECK_IN_METHODS) {
            expect(isCheckInMethod(method.id)).toBe(true);
        }
    });

    it("rejects an unknown value", () => {
        expect(isCheckInMethod("")).toBe(false);
        expect(isCheckInMethod("concierge")).toBe(false);
        expect(isCheckInMethod("toString")).toBe(false);
    });
});

describe("lookups", () => {
    it("finds a label for every payment id", () => {
        for (const method of PAYMENT_METHODS) {
            expect(paymentMethodLabel(method.id)).toBe(method.label);
        }
    });

    it("finds a method for every check-in id", () => {
        for (const method of CHECK_IN_METHODS) {
            expect(checkInMethod(method.id)).toBe(method);
        }
    });

    it("returns copy the reservation page can show", () => {
        const method = checkInMethod("lock-box");
        expect(method.label).toBeTruthy();
        expect(method.instruction).toBeTruthy();
    });
});

describe("list integrity", () => {
    it("has unique payment ids", () => {
        // A duplicate id would make `find` silently return the first one, so the second
        // method would become unreachable without any error.
        const ids = PAYMENT_METHODS.map((method) => method.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("has unique check-in ids", () => {
        const ids = CHECK_IN_METHODS.map((method) => method.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("has defaults that are actually in their lists", () => {
        expect(isPaymentMethod(DEFAULT_PAYMENT_METHOD)).toBe(true);
        expect(isCheckInMethod(DEFAULT_CHECK_IN_METHOD)).toBe(true);
    });

    it("gives every entry the copy the radio list renders", () => {
        for (const method of PAYMENT_METHODS) {
            expect(method.label).toBeTruthy();
            expect(method.note).toBeTruthy();
        }
        for (const method of CHECK_IN_METHODS) {
            expect(method.label).toBeTruthy();
            expect(method.note).toBeTruthy();
            expect(method.instruction).toBeTruthy();
        }
    });
});
