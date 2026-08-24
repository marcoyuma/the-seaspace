import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

import {
    getAuthUser,
    getGuestProfile,
    hasPasswordIdentity,
} from "@/features/auth/actions";
import AvatarUpload from "@/features/account/components/avatar-upload";
import ProfileForm from "@/features/account/components/profile-form";
import SignOutButton from "@/features/account/components/sign-out-button";
import DeleteAccountDialog from "@/features/account/components/delete-account-dialog";

export const metadata = { title: "Account" };

/**
 * The guest's own profile.
 *
 * Only the heading is static, which is the point: with Cache Components every route needs
 * a shell that can be prerendered, and everything else here reads cookies. That read has
 * to sit inside <Suspense> — until aa44990 the app-wide app/loading.tsx was the boundary
 * that satisfied this, and it no longer exists.
 */
export default function AccountPage() {
    return (
        <div className="mx-auto w-full max-w-7xl px-6 py-24">
            <h1 className="text-[48px] font-semibold leading-none text-black">
                Account
            </h1>

            <Suspense fallback={<AccountSectionsFallback />}>
                <AccountSections />
            </Suspense>
        </div>
    );
}

/**
 * Everything on the page that depends on who is signed in.
 *
 * The `redirect()` below is the authoritative check, not the one users normally hit —
 * proxy.ts already bounces signed-out visitors, which is what makes that a real HTTP
 * redirect instead of a delayed meta refresh. This one still has to exist: Proxy runs on
 * prefetches and must never be the only line of defence.
 *
 * The check lives here rather than in a layout because layouts do not re-render on
 * client-side navigation — a check placed there would pass once and never run again.
 */
async function AccountSections() {
    const [user, profile, hasPassword] = await Promise.all([
        getAuthUser(),
        getGuestProfile(),
        hasPasswordIdentity(),
    ]);

    if (!user) redirect("/login?next=/account");

    return (
        <>
            <p className="mt-6 max-w-128.25 text-[16px] font-medium text-black/60">
                Signed in as {user.email}
            </p>

            {profile ? (
                <>
                    <section
                        aria-labelledby="profile-heading"
                        className="mt-16 border-t border-black/10 pt-12"
                    >
                        <h2
                            id="profile-heading"
                            className="text-[24px] font-semibold text-black"
                        >
                            Profile
                        </h2>
                        <p className="mt-3 max-w-128.25 text-[16px] font-medium text-black/60">
                            Your display name and nationality appear on the
                            reviews you write.
                        </p>

                        <div className="mt-8">
                            <AvatarUpload
                                key={user.id}
                                avatarPath={profile.avatarPath}
                            />
                        </div>

                        <div className="mt-10">
                            {/* Keyed by user id so switching accounts remounts the form.
                                Its inputs are uncontrolled, and React only writes
                                `defaultValue` into the DOM on mount — without a key that
                                changes, a reused <input> would keep the previous guest's
                                name. */}
                            <ProfileForm key={user.id} profile={profile} />
                        </div>
                    </section>

                    {/* The header links only to /account, so this is the one way into
                        the reservations list. */}
                    <section
                        aria-labelledby="trips-heading"
                        className="mt-16 border-t border-black/10 pt-12"
                    >
                        <h2
                            id="trips-heading"
                            className="text-[24px] font-semibold text-black"
                        >
                            Trips
                        </h2>
                        <p className="mt-3 max-w-128.25 text-[16px] font-medium text-black/60">
                            Every villa you have booked, past and upcoming.
                        </p>

                        <Link
                            href="/account/trips"
                            className="mt-8 inline-block text-[16px] font-medium text-black underline underline-offset-4 transition-opacity duration-300 ease-out hover:opacity-60 motion-reduce:transition-none"
                        >
                            View your trips
                        </Link>
                    </section>

                    <section
                        aria-labelledby="session-heading"
                        className="mt-16 border-t border-black/10 pt-12"
                    >
                        <h2
                            id="session-heading"
                            className="text-[24px] font-semibold text-black"
                        >
                            Session
                        </h2>
                        <div className="mt-8 flex items-center gap-8">
                            <SignOutButton />
                            <Link
                                href="/account/update-password"
                                className="text-[16px] font-medium text-black/60 underline underline-offset-4 transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-60"
                            >
                                Update password
                            </Link>
                        </div>
                    </section>
                </>
            ) : (
                // A signed-in user with no guest row means the 0006 trigger never fired —
                // almost always because "Confirm email" is ON in the dashboard while the
                // trigger waits for `email_confirmed_at`. Saying so beats an empty form.
                <div className="mt-16 border-t border-black/10 pt-12">
                    <p className="max-w-128.25 text-[16px] font-medium text-black/60">
                        Your account exists, but its guest profile has not been
                        created yet. This happens when email confirmation is
                        still pending — confirm your address and reload.
                    </p>
                    <div className="mt-10">
                        <SignOutButton />
                    </div>
                </div>
            )}

            {/* Outside the ternary above on purpose: deletion only needs the auth
                account, not a `guests` row, so it must still work for the pending-
                confirmation case in the `else` branch. */}
            <section
                aria-labelledby="danger-heading"
                className="mt-16 border-t border-black/10 pt-12"
            >
                <h2
                    id="danger-heading"
                    className="text-[24px] font-semibold text-black"
                >
                    Danger zone
                </h2>
                <p className="mt-3 max-w-128.25 text-[16px] font-medium text-black/60">
                    Permanently delete your account and everything tied to it.
                </p>
                <div className="mt-8">
                    <DeleteAccountDialog hasPassword={hasPassword} />
                </div>
            </section>
        </>
    );
}

/** Blocks standing in for the profile, trips, session and danger-zone sections. */
function AccountSectionsFallback() {
    return (
        <div aria-hidden>
            <div className="mt-6 h-6 w-64 max-w-full rounded bg-black/5" />
            {[0, 1, 2, 3].map((section) => (
                <div
                    key={section}
                    className="mt-16 h-40 border-t border-black/10 pt-12"
                >
                    <div className="h-full rounded-2xl bg-black/3" />
                </div>
            ))}
        </div>
    );
}
