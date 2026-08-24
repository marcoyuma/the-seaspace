import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getAuthUser } from "@/features/auth/actions";
import UpdatePasswordForm from "@/features/auth/components/update-password-form";

export const metadata = { title: "Update password" };

/**
 * Chooses a new password.
 *
 * Two ways in, both legitimate: a recovery link, which app/auth/confirm/route.ts turns into
 * a session before redirecting here, or an already signed-in guest from /account.
 *
 * The form needs no server data, so it stays in the static shell. Only the session read is
 * behind <Suspense> — request-time data cannot sit outside a boundary under Cache
 * Components, and the app-wide app/loading.tsx that used to provide one is gone (aa44990).
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
 * Who the new password will belong to.
 *
 * Under /account, so `PROTECTED_PREFIXES` in proxy.ts already bounces signed-out visitors
 * before anything renders. The check below is the authoritative one — Proxy also runs on
 * prefetches and must never be the only line of defence.
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
