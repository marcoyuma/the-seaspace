/**
 * How a guest chooses to be let in, picked at checkout — before the booking is made,
 * because "how do I get in" is something you want to know before you pay.
 *
 * Twin of payment-methods.ts, and plain data for the same reason: a Client Component
 * renders these radios, and nothing here should drag server code into the browser bundle.
 *
 * ⚠️ **This is a preference, not an authorisation.** There is one `access_code` per
 * booking and it works at both doors — see supabase/migrations/0012 for why a second
 * credential would have been two things to keep in sync for no gain. A guest who chose the
 * lock box can still scan; one whose phone is flat can still type. That flexibility is the
 * entire reason the lock box exists.
 */

export type CheckInMethodId = "smart-lock" | "lock-box";

export interface CheckInMethod {
    id: CheckInMethodId;
    label: string;
    /** The sentence under the label at checkout. Says who this is for, not how it works. */
    note: string;
    /** Shown on the reservation afterwards, when the code is in front of the guest. */
    instruction: string;
}

export const CHECK_IN_METHODS: readonly CheckInMethod[] = [
    {
        id: "smart-lock",
        label: "Self check-in",
        note: "Scan your code at the door and let yourself in. No one to meet, no keys to collect, no arrival time to agree on.",
        instruction:
            "Hold this code up to the reader beside the door. It unlocks from your arrival day until the morning you leave.",
    },
    {
        id: "lock-box",
        label: "Lock box",
        note: "The same code, on a mechanical keypad by the door. Works with a flat phone, no signal and no power — which is why we offer it at all.",
        instruction:
            "Type these characters into the keypad on the lock box beside the door, then turn the handle. The key inside is yours for the stay.",
    },
];

export const DEFAULT_CHECK_IN_METHOD: CheckInMethodId = "smart-lock";

/** Narrows an untrusted form value. Anything unrecognised is rejected, not defaulted. */
export function isCheckInMethod(value: string): value is CheckInMethodId {
    return CHECK_IN_METHODS.some((method) => method.id === value);
}

/** The method belonging to an id that has already been validated. */
export function checkInMethod(id: CheckInMethodId): CheckInMethod {
    return CHECK_IN_METHODS.find((method) => method.id === id)!;
}
