/**
 * The payment methods the checkout page offers.
 *
 * Split from payment-gateway.ts so the radio list can be imported by a Client Component
 * without dragging the gateway into the browser bundle. This file is plain data; that one
 * runs on the server only.
 *
 * ⚠️ **None of these is a real integration, and none of them collects an instrument.**
 * There is no card number field anywhere in this flow, on purpose: a demo site that asks
 * for a card number will eventually be given a real one. The choice made here is recorded
 * in the guest's mind only — `bookings` has no column for it, and adding one would imply a
 * payment record that does not exist.
 */

export type PaymentMethodId = "gopay" | "bank-transfer" | "card";

export interface PaymentMethod {
    id: PaymentMethodId;
    label: string;
    /** The line under the label. Says what would happen if this were live. */
    note: string;
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
    {
        id: "gopay",
        label: "GoPay",
        note: "You would be handed to the GoPay app to approve the amount.",
    },
    {
        id: "bank-transfer",
        label: "Bank transfer (VA)",
        note: "You would receive a virtual account number valid for 24 hours.",
    },
    {
        id: "card",
        label: "Credit or debit card",
        note: "You would be redirected to the provider's own hosted card form.",
    },
];

export const DEFAULT_PAYMENT_METHOD: PaymentMethodId = "gopay";

/** Narrows an untrusted form value. Anything unrecognised is rejected, not defaulted. */
export function isPaymentMethod(value: string): value is PaymentMethodId {
    return PAYMENT_METHODS.some((method) => method.id === value);
}

/** For error copy — the label belonging to an id that has already been validated. */
export function paymentMethodLabel(id: PaymentMethodId): string {
    return PAYMENT_METHODS.find((method) => method.id === id)!.label;
}
