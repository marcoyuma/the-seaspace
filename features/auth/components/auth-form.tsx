"use client";

// Client-side because the form owns two pieces of interactive state that have no server
// equivalent: which mode is showing, and whether a submit is in flight. The mutations
// themselves stay on the server — this component only calls them.
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
// Package root, not /dist/ssr: these render inside a Client Component. Still the specifier
// `optimizePackageImports` in next.config.ts matches on.
import { GithubLogoIcon, GoogleLogoIcon } from "@phosphor-icons/react";

import {
    signIn,
    signInWithProvider,
    signUp,
} from "@/features/auth/server-actions";
import type { AuthMode } from "@/features/auth/types";
import {
    Field,
    FormBanner,
    SUBMIT,
} from "@/features/auth/components/form-primitives";
import { PILL_SIZE } from "@/ui/pill-styles";

/**
 * What a failed round trip through an auth route handler is shown as.
 *
 * The routes redirect here with a code rather than a sentence so the wording lives with the
 * rest of the form's copy, and so the URL carries nothing worth reading.
 */
const ERROR_MESSAGES: Record<string, string> = {
    link_invalid:
        "That link has expired or was already used. Request a new one below.",
    oauth_failed: "That sign-in did not complete. Try again.",
};

/**
 * Whether to offer password reset.
 *
 * `false` because resetting a password requires delivering an email, and this project has no
 * working mail sender — the form would answer with a reassuring "a link is on its way" while
 * nothing ever arrives. A link that quietly does nothing is worse than a feature that is not
 * advertised.
 *
 * `/forgot-password` and `/account/update-password` still exist and still work; they are just
 * not linked from here. Flip this to `true` the day email delivery works — that is the whole
 * restore.
 */
const PASSWORD_RESET_AVAILABLE = false;

// `gap-2` is the site's icon-to-label distance on a pill; the padding either side stays
// symmetric, since the logo carries no more optical weight than the word next to it.
const OAUTH_BUTTON = `flex w-full items-center justify-center gap-2 rounded-full ${PILL_SIZE.md} border border-black/15 font-medium text-black transition-colors duration-300 ease-out motion-reduce:transition-none hover:border-black disabled:cursor-not-allowed disabled:opacity-40`;

/**
 * Submit half of an OAuth button.
 *
 * Split out only because `useFormStatus` reports on the nearest ancestor <form>, so it has
 * to be read from a child of that form rather than from the component rendering it.
 */
function OAuthSubmit({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    const { pending } = useFormStatus();

    return (
        <button type="submit" disabled={pending} className={OAUTH_BUTTON}>
            {children}
            {pending ? "Redirecting…" : label}
        </button>
    );
}

/** One provider button. Its own <form> so each carries its own `provider` value. */
function OAuthButton({
    provider,
    label,
    next,
    children,
}: {
    provider: string;
    label: string;
    next: string;
    children: React.ReactNode;
}) {
    return (
        <form action={signInWithProvider}>
            <input type="hidden" name="provider" value={provider} />
            <input type="hidden" name="next" value={next} />
            <OAuthSubmit label={label}>{children}</OAuthSubmit>
        </form>
    );
}

/**
 * The /login form: sign in and sign up behind one toggle, plus GitHub and Google.
 *
 * @param next Where to land after success. Already validated server-side — passing it
 * through a hidden input is a convenience, not a trust boundary.
 * @param error Code from a failed auth route handler, e.g. `link_invalid`.
 *
 * @example
 * <AuthForm next="/stays" />
 */
export default function AuthForm({
    next = "/",
    error,
}: {
    next?: string;
    error?: string;
}) {
    const [mode, setMode] = useState<AuthMode>("sign-in");

    // Both hooks run on every render regardless of mode, so hook order never changes.
    // Keeping two actions rather than one that branches on a `mode` field means each
    // server action validates exactly the fields it needs.
    const [signInState, signInAction, signInPending] = useActionState(
        signIn,
        undefined,
    );
    const [signUpState, signUpAction, signUpPending] = useActionState(
        signUp,
        undefined,
    );

    const isSignUp = mode === "sign-up";
    const state = isSignUp ? signUpState : signInState;
    const pending = isSignUp ? signUpPending : signInPending;

    // The URL's error only applies until the guest submits something — after that, the
    // action's own reply is the current truth.
    const banner = state?.message
        ? { message: state.message, ok: state.ok }
        : error && ERROR_MESSAGES[error]
          ? { message: ERROR_MESSAGES[error], ok: false }
          : null;

    return (
        <div className="mx-auto w-full max-w-112">
            <h1 className="text-[40px] font-semibold leading-none text-black">
                {isSignUp ? "Create an account" : "Welcome back"}
            </h1>
            <p className="mt-4 text-[16px] font-medium text-black/60">
                {isSignUp
                    ? "An account is what lets you book a villa and leave a review."
                    : "Sign in to reach your bookings and reviews."}
            </p>

            {banner && (
                <div className="mt-8">
                    <FormBanner message={banner.message} ok={banner.ok} />
                </div>
            )}

            {/* Above the fields on purpose: for anyone who has a GitHub or Google account
                this is the shorter path, and it skips email confirmation entirely because
                the provider has already verified the address. */}
            <div className="mt-10 flex flex-col gap-3">
                <OAuthButton
                    provider="github"
                    label="Continue with GitHub"
                    next={next}
                >
                    <GithubLogoIcon size={20} weight="fill" />
                </OAuthButton>
                <OAuthButton
                    provider="google"
                    label="Continue with Google"
                    next={next}
                >
                    <GoogleLogoIcon size={20} weight="bold" />
                </OAuthButton>
            </div>

            <div className="my-8 flex items-center gap-4">
                <span className="h-px flex-1 bg-black/10" />
                <span className="text-[14px] font-medium text-black/40">
                    or
                </span>
                <span className="h-px flex-1 bg-black/10" />
            </div>

            {/* `key` remounts the form when the mode flips, so a rejected sign-in does not
                leave its error text sitting above the sign-up fields. */}
            <form
                key={mode}
                action={isSignUp ? signUpAction : signInAction}
                className="flex flex-col gap-6"
            >
                <input type="hidden" name="next" value={next} />

                <Field
                    id="email"
                    label="Email"
                    type="email"
                    required
                    autoComplete="email"
                    defaultValue={state?.values?.email}
                    error={state?.errors?.email}
                />

                <div>
                    <Field
                        id="password"
                        label="Password"
                        type="password"
                        required
                        autoComplete={
                            isSignUp ? "new-password" : "current-password"
                        }
                        error={state?.errors?.password}
                        hint={isSignUp ? "At least 6 characters." : undefined}
                    />

                    {!isSignUp && PASSWORD_RESET_AVAILABLE && (
                        <p className="mt-3 text-[16px]">
                            <Link
                                href="/forgot-password"
                                className="font-medium text-black/60 underline underline-offset-4 transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-60"
                            >
                                Forgot password?
                            </Link>
                        </p>
                    )}
                </div>

                {isSignUp && (
                    <>
                        <Field
                            id="displayName"
                            label="Display name"
                            required
                            autoComplete="nickname"
                            defaultValue={state?.values?.displayName}
                            error={state?.errors?.displayName}
                            hint="Shown on your reviews, e.g. 'Amara L.'"
                        />
                        <Field
                            id="fullName"
                            label="Full name"
                            autoComplete="name"
                            defaultValue={state?.values?.fullName}
                            hint="Only used for your reservations."
                        />
                        <Field
                            id="nationality"
                            label="Nationality"
                            autoComplete="country-name"
                            defaultValue={state?.values?.nationality}
                            hint="e.g. Swedish. Appears under your name on reviews."
                        />
                    </>
                )}

                <button type="submit" disabled={pending} className={SUBMIT}>
                    {pending
                        ? "Working…"
                        : isSignUp
                          ? "Create account"
                          : "Sign in"}
                </button>
            </form>

            <p className="mt-8 text-center text-[16px] font-medium text-black/60">
                {isSignUp ? "Already have an account?" : "New here?"}{" "}
                <button
                    type="button"
                    onClick={() => setMode(isSignUp ? "sign-in" : "sign-up")}
                    className="font-semibold text-black underline underline-offset-4 transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-60"
                >
                    {isSignUp ? "Sign in" : "Create an account"}
                </button>
            </p>
        </div>
    );
}
