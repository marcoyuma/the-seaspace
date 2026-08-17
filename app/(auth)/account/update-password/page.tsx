import { redirect } from "next/navigation";

import { getAuthUser } from "@/features/auth/actions";
import UpdatePasswordForm from "@/features/auth/components/update-password-form";

export const metadata = { title: "Update password" };

/**
 * Chooses a new password.
 *
 * Two ways in, both legitimate: a recovery link, which app/auth/confirm/route.ts turns into
 * a session before redirecting here, or an already signed-in guest from /account.
 *
 * Under /account, so `PROTECTED_PREFIXES` in proxy.ts already bounces signed-out visitors
 * before anything renders. The check below is the authoritative one — Proxy also runs on
 * prefetches and must never be the only line of defence.
 */
export default async function UpdatePasswordPage() {
    const user = await getAuthUser();
    if (!user) redirect("/login?next=/account/update-password");

    return (
        <div className="mx-auto w-full max-w-7xl px-6 py-24">
            <h1 className="text-[48px] font-semibold leading-none text-black">
                Update password
            </h1>
            <p className="mt-6 max-w-128.25 text-[16px] font-medium text-black/60">
                Signed in as {user.email}
            </p>

            <div className="mt-16 border-t border-black/10 pt-12">
                <UpdatePasswordForm />
            </div>
        </div>
    );
}
