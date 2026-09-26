import ForgotPasswordForm from "@/features/auth/components/forgot-password-form";

export const metadata = { title: "Reset password" };

/**
 * Requests a reset link. Unlike /login it takes no `next`, so it prerenders whole with no
 * <Suspense>. Chrome-free like /login (ui/chrome-gate.tsx).
 */
export default function ForgotPasswordPage() {
    return (
        <div className="mx-auto flex min-h-dvh w-full max-w-7xl items-center justify-center px-6 py-24">
            <ForgotPasswordForm />
        </div>
    );
}
