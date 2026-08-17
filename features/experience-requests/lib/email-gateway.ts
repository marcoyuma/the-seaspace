import type { ExperienceId } from "@/features/experience-requests/types";

/**
 * A simulated staff inbox — **no email is ever sent, and no address here is real.**
 *
 * ---------------------------------------------------------------------------
 * Why simulated, and why it is still shaped like a real send
 * ---------------------------------------------------------------------------
 * There is no Seaspace golf desk or spa desk to receive this, and a real vendor (Resend,
 * Postmark) would need a verified domain and an API key for a demo whose only audience is
 * a portfolio reviewer — who could not see the inbox it landed in anyway. Mirrors the
 * reasoning in `features/booking/lib/payment-gateway.ts` for the same trade-off on the
 * payment side.
 *
 * What is kept is the *shape* a real send imposes, because that is what the rest of the
 * flow has to be built around either way:
 *
 * | Real provider | Here |
 * |---|---|
 * | The call is a network round-trip and can fail | `SEND_DELAY_MS`, and a failure path |
 * | Success returns a message id | `DEMO-…` id |
 * | Delivery is per recipient (the golf desk, the spa desk) | `STAFF_INBOXES` below |
 *
 * Swapping this file for Resend is: replace `sendExperienceRequest()`'s body with an API
 * call, keep the same return shape. Nothing in `server-actions.ts` would need to change.
 *
 * ⚠️ Server-side only, same reason as the payment gateway: a Client Component must never
 * be able to reach a "message sent" function, even a fake one.
 */

/** Long enough that the pending state reads as real, short enough not to feel broken. */
const SEND_DELAY_MS = 900;

/** Where each experience's enquiries would land, if this sent anything. */
const STAFF_INBOXES: Record<ExperienceId, string> = {
    "golf-course": "golf@seaspace.example",
    spa: "spa@seaspace.example",
    "event-venue": "events@seaspace.example",
};

export interface ExperienceRequestEmail {
    experience: ExperienceId;
    name: string;
    email: string;
    phone: string | null;
    partySize: number;
    preferredDate: string | null;
    preference: string | null;
    message: string | null;
}

export type EmailOutcome =
    | { ok: true; messageId: string }
    | { ok: false; reason: string };

/**
 * "Sends" an enquiry to the relevant desk and returns a provider-shaped outcome.
 *
 * @example
 * const outcome = await sendExperienceRequest({ experience: "spa", name: "Amara", ... });
 * if (!outcome.ok) return { message: outcome.reason };
 */
export async function sendExperienceRequest(
    request: ExperienceRequestEmail,
): Promise<EmailOutcome> {
    await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));

    // Printed rather than actually delivered — this is the one place the "email" can be
    // inspected at all, since nothing here reaches a real inbox.
    console.log(
        `[experience-request] to=${STAFF_INBOXES[request.experience]} from="${request.name} <${request.email}>" party=${request.partySize} preferred=${request.preferredDate ?? "-"} preference="${request.preference ?? "-"}"`,
    );

    return { ok: true, messageId: demoMessageId(request.experience) };
}

/** An opaque-looking message id, e.g. `DEMO-SPA-3F7K2Q`. */
function demoMessageId(experience: ExperienceId): string {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `DEMO-${experience.toUpperCase().replace("-", "")}-${random}`;
}
