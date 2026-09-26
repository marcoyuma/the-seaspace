import type { PaymentMethodId } from "@/features/booking/lib/payment-methods";

/**
 * Simulated payment provider — **no money moves, no card is collected**; a real sandbox would add
 * redirects, webhooks and tunnels. Keeps a provider's shape (row before charge, failable call, opaque
 * ref, separate settle/refund), so Stripe only swaps `chargeDemoPayment()` + a webhook. ⚠️ Server-only.
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
 * @param amountIdr Whole rupiah, logged and echoed like a real charge — never what gets stored.
 * @param method Which of the demo methods the guest picked.
 * @param declineOnPurpose The checkout "simulate a declined payment" toggle, so failure is reachable.
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
