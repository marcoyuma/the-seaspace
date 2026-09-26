import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getAuthUser } from "@/features/auth/actions";
import UpdatePasswordForm from "@/features/auth/components/update-password-form";

export const metadata = { title: "Update password" };

/**
 * Chooses a new password — via a recovery link (app/auth/confirm makes it a session) or from
 * /account. The form is static; only the session read sits behind <Suspense> (no app/loading.tsx).
 */
export default function UpdatePasswordPage() {
    return (
        <div className="mx-auto w-full max-w-7xl px-6 py-24">
            <h1 className="text-[48px] font-semibold leading-none text-black">
                Update password
            </h1>

            <Suspense fallback={<SignedInAsFallback />}>
                <SignedInAs />
            </Suspense>

            <div className="mt-16 border-t border-black/10 pt-12">
                <UpdatePasswordForm />
            </div>
        </div>
    );
}

/**
 * Who the new password belongs to. proxy.ts bounces signed-out visitors first; this check is the
 * authoritative one, since Proxy also runs on prefetches.
 */
async function SignedInAs() {
    const user = await getAuthUser();
    if (!user) redirect("/login?next=/account/update-password");

    return (
        <p className="mt-6 max-w-128.25 text-[16px] font-medium text-black/60">
            Signed in as {user.email}
        </p>
    );
}

/** Reserves the line's height so the form below does not shift when the email arrives. */
function SignedInAsFallback() {
    return (
        <div
            aria-hidden
            className="mt-6 h-6 w-64 max-w-full rounded bg-black/5"
        />
    );
}
