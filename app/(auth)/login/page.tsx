import { Suspense } from "react";

import AuthForm from "@/features/auth/components/auth-form";

export const metadata = { title: "Sign in" };

/**
 * Sign in and sign up, behind one toggle.
 *
 * Signed-in visitors never reach this page — proxy.ts redirects them away before it renders.
 *
 * `searchParams` is a request-time API, so the form sits inside <Suspense>: the heading and
 * layout ship in the static shell while only the `next` value streams in.
 */
export default function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string; error?: string }>;
}) {
    return (
        // `dvh` rather than `vh`: on mobile, `100vh` is the viewport *without* the browser's
        // retracting chrome, so the form would sit slightly below the fold on first paint.
        // Matches the hero's `h-dvh`. No header or footer here — see ui/chrome-gate.tsx.
        <div className="mx-auto flex min-h-dvh w-full max-w-7xl items-center justify-center px-6 py-24">
            <Suspense fallback={<AuthForm />}>
                <LoginForm searchParams={searchParams} />
            </Suspense>
        </div>
    );
}

async function LoginForm({
    searchParams,
}: {
    searchParams: Promise<{ next?: string; error?: string }>;
}) {
    const { next, error } = await searchParams;

    // Neither value is validated here. `next` is re-validated by the Server Action before it
    // redirects, which is the only place it is ever trusted; `error` is only ever looked up
    // in a fixed table of messages, so an unknown code shows nothing at all.
    return <AuthForm next={next} error={error} />;
}
