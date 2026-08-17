"use client";

import { useActionState } from "react";
import Link from "next/link";

import { requestPasswordReset } from "@/features/auth/server-actions";
import {
    Field,
    FormBanner,
    SUBMIT,
} from "@/features/auth/components/form-primitives";

/**
 * Asks for a password reset link.
 *
 * The reply is the same whether or not the address has an account — see
 * `requestPasswordReset`. That is why the form stays on screen and shows a neutral banner
 * instead of redirecting somewhere celebratory: there is nothing here that confirms the
 * address exists.
 */
export default function ForgotPasswordForm() {
    const [state, action, pending] = useActionState(
        requestPasswordReset,
        undefined,
    );

    return (
        <div className="mx-auto w-full max-w-112">
            <h1 className="text-[40px] font-semibold leading-none text-black">
                Reset your password
            </h1>
            <p className="mt-4 text-[16px] font-medium text-black/60">
                We&apos;ll email you a link that signs you in long enough to
                choose a new one.
            </p>

            {state?.message && (
                <div className="mt-8">
                    <FormBanner message={state.message} ok={state.ok} />
                </div>
            )}

            <form action={action} className="mt-10 flex flex-col gap-6">
                <Field
                    id="email"
                    label="Email"
                    type="email"
                    required
                    autoComplete="email"
                    error={state?.errors?.email}
                />

                <button type="submit" disabled={pending} className={SUBMIT}>
                    {pending ? "Sending…" : "Send reset link"}
                </button>
            </form>

            <p className="mt-8 text-center text-[16px] font-medium text-black/60">
                Remembered it?{" "}
                <Link
                    href="/login"
                    className="font-semibold text-black underline underline-offset-4 transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-60"
                >
                    Sign in
                </Link>
            </p>
        </div>
    );
}
