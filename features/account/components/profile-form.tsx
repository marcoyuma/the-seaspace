"use client";

// Client-side only for the submit lifecycle: `useActionState` supplies the pending flag and
// the saved/failed message. The write itself is a Server Action.
import { useActionState } from "react";

import { updateProfile } from "@/features/auth/server-actions";
import type { GuestProfile } from "@/features/auth/types";
import {
    FormBanner,
    INPUT,
    LABEL,
} from "@/features/auth/components/form-primitives";

/**
 * Edits the three `public.guests` columns a guest owns.
 *
 * Email is deliberately absent: it lives in `auth.users`, not `guests`, and changing it is
 * an auth flow with its own confirmation step rather than a profile field.
 *
 * @param profile Current values, read server-side and passed in so the inputs start filled.
 */
export default function ProfileForm({ profile }: { profile: GuestProfile }) {
    const [state, action, pending] = useActionState(updateProfile, undefined);

    return (
        <form action={action} className="flex max-w-112 flex-col gap-6">
            {state?.message && (
                <FormBanner message={state.message} ok={state.ok} />
            )}

            <div>
                <label htmlFor="displayName" className={LABEL}>
                    Display name
                </label>
                <input
                    id="displayName"
                    name="displayName"
                    defaultValue={profile.displayName}
                    aria-invalid={state?.errors?.displayName ? true : undefined}
                    aria-describedby={
                        state?.errors?.displayName
                            ? "displayName-error"
                            : undefined
                    }
                    className={INPUT}
                />
                {state?.errors?.displayName && (
                    <p
                        id="displayName-error"
                        className="mt-2 text-[14px] font-medium text-red-700"
                    >
                        {state.errors.displayName}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="fullName" className={LABEL}>
                    Full name
                    <span className="ml-2 font-medium text-black/40">
                        optional
                    </span>
                </label>
                <input
                    id="fullName"
                    name="fullName"
                    // `?? ""` rather than leaving it undefined: a controlled-looking input
                    // that starts as undefined logs a React warning when it later gets a value.
                    defaultValue={profile.fullName ?? ""}
                    className={INPUT}
                />
            </div>

            <div>
                <label htmlFor="nationality" className={LABEL}>
                    Nationality
                    <span className="ml-2 font-medium text-black/40">
                        optional
                    </span>
                </label>
                <input
                    id="nationality"
                    name="nationality"
                    defaultValue={profile.nationality ?? ""}
                    className={INPUT}
                />
            </div>

            <button
                type="submit"
                disabled={pending}
                className="mt-2 self-start rounded-[40px] bg-black px-6 py-3.5 text-[16px] font-medium text-white transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
                {pending ? "Saving…" : "Save changes"}
            </button>
        </form>
    );
}
