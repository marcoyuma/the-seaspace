"use server";

import { propertyTodayISO } from "@/features/booking/lib/dates";
import { sendExperienceRequest } from "@/features/experience-requests/lib/email-gateway";
import {
    EXPERIENCE_REQUESTS,
    isExperienceId,
} from "@/features/experience-requests/lib/experiences";
import type { RequestFormState } from "@/features/experience-requests/types";

/**
 * The one mutation in this feature — "mutation" loosely, since nothing here is written
 * anywhere. See `features/experience-requests/README.md` for why: there is no staff inbox
 * and no database table, only a simulated send that is honest about being one.
 *
 * Still its own file, matching every other feature here: every export of a `"use server"`
 * file is a public HTTP endpoint, so it must assume it was called directly, with any
 * arguments at all, and validate accordingly. There is no database to fall back on as a
 * second line of defence here — this file IS the validation.
 */

/** Long enough for a free-text note, short enough that this cannot be used as storage. */
const MAX_MESSAGE_LENGTH = 1000;

/** Long enough for any international number with spaces and a prefix. */
const MAX_PHONE_LENGTH = 40;

function readString(formData: FormData, key: string): string {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
}

/**
 * Deliberately loose. Nothing here delivers mail, so the only real test of an address is a
 * send this feature never attempts — a stricter pattern would just reject valid addresses
 * (apostrophes, plus tags, new TLDs) for no gain.
 */
function looksLikeEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Sends an enquiry from `/golf-course` or `/spa` to the relevant desk.
 *
 * Shaped for `useActionState`: `(prevState, formData) => state`. Success returns
 * `{ ok: true }` rather than redirecting — the guest is mid-page on a marketing route, and
 * sending them elsewhere to say "got it" would cost the page they were reading.
 *
 * @param formData `experience`, `name`, `email`, `phone`, `partySize`, `preferredDate`,
 *   `preference`, `message`.
 */
export async function submitExperienceRequest(
    _prevState: RequestFormState,
    formData: FormData,
): Promise<RequestFormState> {
    const experience = readString(formData, "experience");

    // Before anything else: without a known experience there is no vocabulary to validate
    // `preference` against, and no desk to address the message to.
    if (!isExperienceId(experience)) {
        return {
            message: "That request could not be matched to an experience. Reload the page.",
        };
    }

    const config = EXPERIENCE_REQUESTS[experience];

    const name = readString(formData, "name");
    const email = readString(formData, "email");
    const phone = readString(formData, "phone");
    const partySizeRaw = readString(formData, "partySize");
    const preferredDate = readString(formData, "preferredDate");
    const preference = readString(formData, "preference");
    const message = readString(formData, "message");

    // Echoed back on every rejection, so a single bad field does not empty the other five.
    const values = {
        name,
        email,
        phone,
        partySize: partySizeRaw,
        preferredDate,
        preference,
        message,
    };

    const errors: NonNullable<RequestFormState>["errors"] = {};

    if (!name) errors.name = "Tell us who to ask for.";

    if (!email) errors.email = "We reply by email, so we need an address.";
    else if (!looksLikeEmail(email))
        errors.email = "That does not look like an email address.";

    if (phone.length > MAX_PHONE_LENGTH)
        errors.phone = "That is longer than any phone number we can dial.";

    const partySize = Number(partySizeRaw);
    if (
        !Number.isInteger(partySize) ||
        partySize < 1 ||
        partySize > config.maxPartySize
    ) {
        errors.partySize = `Between 1 and ${config.maxPartySize}. For a larger group, say so in the message and we will arrange it.`;
    }

    if (preferredDate) {
        // `propertyTodayISO()`, not `new Date()`: Vercel's clock is UTC and the villas are
        // on WITA, so a guest in Bali asking for this afternoon would otherwise be told
        // their date had already passed. Same helper the booking flow compares against.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
            errors.preferredDate = "Pick a date from the calendar.";
        } else if (preferredDate < propertyTodayISO()) {
            errors.preferredDate = "That day has already passed. Pick a later one.";
        }
    }

    // Empty is fine — the field is optional. Anything else must be one of the options this
    // experience actually offered, or the message would claim a choice nobody was given.
    if (preference && !config.choice.options.includes(preference)) {
        errors.preference = "Choose one of the options listed.";
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
        errors.message = `Keep it under ${MAX_MESSAGE_LENGTH} characters — the rest we can cover by email.`;
    }

    if (Object.keys(errors).length > 0) return { errors, values };

    const outcome = await sendExperienceRequest({
        experience,
        name,
        email,
        phone: phone || null,
        partySize,
        preferredDate: preferredDate || null,
        preference: preference || null,
        message: message || null,
    });

    if (!outcome.ok) return { message: outcome.reason, values };

    return { ok: true };
}
