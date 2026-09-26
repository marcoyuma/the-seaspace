import type { ExperienceId } from "@/features/experience-requests/types";

/**
 * Simulated staff inbox — **no email is sent; no address is real** (no real desks, and a vendor needs
 * a domain + key; cf. payment-gateway.ts). Keeps a real send's shape — latency, failure, message id,
 * per-desk inboxes — so Resend only replaces `sendExperienceRequest()`'s body. ⚠️ Server-only.
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
