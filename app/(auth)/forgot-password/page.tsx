import ForgotPasswordForm from "@/features/auth/components/forgot-password-form";

export const metadata = { title: "Reset password" };

/**
 * Requests a password reset link.
 *
 * No <Suspense> and no request-time reads: unlike /login this page takes no `next`, so it
 * prerenders whole. The form below is a Client Component that ships with the static shell.
 *
 * Rendered without the site chrome, like /login — see ui/chrome-gate.tsx.
 */
export default function ForgotPasswordPage() {
    return (
        <div className="mx-auto flex min-h-dvh w-full max-w-7xl items-center justify-center px-6 py-24">
            <ForgotPasswordForm />
        </div>
    );
}
