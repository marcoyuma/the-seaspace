/**
 * How a guest chooses to be let in, picked before paying. Plain data like payment-methods.ts, for
 * the client radios. ⚠️ **A preference, not an authorisation**: one `access_code` works at both
 * doors (0012), so a lock-box guest can still scan and one with a flat phone can still type.
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
