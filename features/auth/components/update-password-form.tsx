"use client";

import { useActionState } from "react";

import { updatePassword } from "@/features/auth/server-actions";
import {
    Field,
    FormBanner,
    SUBMIT,
} from "@/features/auth/components/form-primitives";

/**
 * Sets a new password for the current session.
 *
 * Nothing here checks how the session was obtained. A recovery link and a normal sign-in
 * produce the same thing, and Supabase scopes `updateUser` to the session's own user either
 * way — so the two cases need no separate handling.
 */
export default function UpdatePasswordForm() {
    const [state, action, pending] = useActionState(updatePassword, undefined);

    return (
        <form action={action} className="flex max-w-112 flex-col gap-6">
            {state?.message && (
                <FormBanner message={state.message} ok={state.ok} />
            )}

            <Field
                id="password"
                label="New password"
                type="password"
                required
                autoComplete="new-password"
                error={state?.errors?.password}
                hint="At least 6 characters."
            />

            <Field
                id="confirmPassword"
                label="Confirm new password"
                type="password"
                required
                autoComplete="new-password"
                error={state?.errors?.confirmPassword}
            />

            <button
                type="submit"
                disabled={pending}
                className={`${SUBMIT} self-start`}
            >
                {pending ? "Saving…" : "Update password"}
            </button>
        </form>
    );
}
