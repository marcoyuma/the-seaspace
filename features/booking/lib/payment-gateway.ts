import type { PaymentMethodId } from "@/features/booking/lib/payment-methods";

/**
 * A simulated payment provider — **no money moves, and no card is ever collected.**
 *
 * ---------------------------------------------------------------------------
 * Why simulated, and why it is still shaped like a real one
 * ---------------------------------------------------------------------------
 * A real integration (Stripe Checkout in test mode, Midtrans Snap sandbox) would add a
 * redirect to a hosted page, a webhook endpoint, a signing secret and a tunnel for local
 * development — and a demo whose bookings silently stop completing whenever the webhook
 * is not running is a worse portfolio piece than an honest simulation. The interesting
 * decisions in this project are in the schema and the availability rules, not in who
 * charges the card.
 *
 * What is kept is the *shape* a provider imposes, because that is what the rest of the
 * system has to be built around either way:
 *
 * | Real provider | Here |
 * |---|---|
 * | Booking is created before the charge, holding the dates | same — see 0011's §5 |
 * | The call is slow and can fail | `SETTLEMENT_DELAY_MS`, and a decline path |
 * | Success returns an opaque reference | `DEMO-…` reference |
 * | Settlement is a second step | `settle_booking_payment()` |
 * | Refunding a settled charge is a separate call | `refundDemoPayment()` |
 *
 * So swapping this file for Stripe is: replace `chargeDemoPayment()` with a call that
 * creates a PaymentIntent, and move the `settle_booking_payment()` call into a webhook
 * route. Nothing else in the flow changes shape. That seam is the whole reason this is a
 * module and not four lines inside the Server Action.
 *
 * ⚠️ Server-side only. It is deliberately NOT in payment-methods.ts, which the checkout
 * form imports — a Client Component must never be able to reach a "payment succeeded"
 * function, even a fake one, because the shape it is standing in for cannot be trusted to
 * the browser.
 */

/**
 * Long enough that the pending state is visibly real, short enough not to feel broken.
 * A live provider round-trip is the same order of magnitude.
 */
const SETTLEMENT_DELAY_MS = 1400;

export type PaymentOutcome =
    | { ok: true; reference: string }
    | { ok: false; reason: string };

/**
 * "Charges" an amount and returns a provider-shaped outcome.
 *
 * @param amountIdr Whole rupiah. Passed only so the amount is logged and echoed like a
 *   real charge would be — it is never the source of what gets stored, which the database
 *   computes from its own snapshot columns.
 * @param method Which of the demo methods the guest picked.
 * @param declineOnPurpose Set by the checkout form's "simulate a declined payment" toggle.
 *   The failure path exists in the UI and in the database (a cancelled, unpaid booking),
 *   so there has to be a way to actually reach it — a demo that can only succeed never
 *   proves it handles failure.
 *
 * @example
 * const outcome = await chargeDemoPayment({ amountIdr: 475_000, method: "gopay" });
 * if (!outcome.ok) return { message: outcome.reason };
 */
export async function chargeDemoPayment({
    amountIdr,
    method,
    declineOnPurpose = false,
}: {
    amountIdr: number;
    method: PaymentMethodId;
    declineOnPurpose?: boolean;
}): Promise<PaymentOutcome> {
    await new Promise((resolve) => setTimeout(resolve, SETTLEMENT_DELAY_MS));

    if (declineOnPurpose) {
        return {
            ok: false,
            reason: "The payment was declined by the (simulated) provider. Nothing was charged, and the dates have been released.",
        };
    }

    // Amount and method are checked rather than ignored, so this fails the way a provider
    // would if the caller ever passed nonsense — a zero-rupiah charge is a bug upstream,
    // not a free stay.
    if (!Number.isInteger(amountIdr) || amountIdr <= 0) {
        return {
            ok: false,
            reason: "The amount to charge could not be determined. Nothing was charged.",
        };
    }

    return { ok: true, reference: demoReference(method) };
}

/**
 * "Refunds" a settled charge, returning the receipt — e.g. `DEMO-REFUND-GOPAY-3F7K2Q`.
 * A bare string, not a `PaymentOutcome`: a settled charge is not declined on the way back.
 *
 * @param method The method the original charge went through.
 *
 * @example
 * const reference = await refundDemoPayment({ method: "gopay" });
 */
export async function refundDemoPayment({
    method,
}: {
    method: PaymentMethodId;
}): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, SETTLEMENT_DELAY_MS));

    return demoReference(method, "REFUND");
}

/**
 * An opaque-looking receipt id, e.g. `DEMO-GOPAY-3F7K2Q` or `DEMO-REFUND-GOPAY-3F7K2Q`.
 *
 * `DEMO-` is not decoration: this string is the only thing a guest could ever mistake for
 * proof of payment, so it says what it is in the first five characters.
 */
function demoReference(method: PaymentMethodId, kind?: "REFUND"): string {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    const prefix = kind ? `DEMO-${kind}` : "DEMO";
    return `${prefix}-${method.toUpperCase().replace("-", "")}-${random}`;
}
