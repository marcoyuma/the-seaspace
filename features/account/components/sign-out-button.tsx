import { signOut } from "@/features/auth/server-actions";

/**
 * Sign out, as a form rather than an onClick handler.
 *
 * No `"use client"` and no JavaScript required: a plain form posting to a Server Action
 * works even before hydration, which matters for the one control that has to keep working
 * when something else on the page has broken.
 */
export default function SignOutButton() {
    return (
        <form action={signOut}>
            <button
                type="submit"
                className="rounded-[40px] border border-black px-6 py-3 text-[16px] font-medium text-black transition-colors duration-300 ease-out motion-reduce:transition-none hover:border-transparent hover:bg-black hover:text-white focus-visible:border-transparent focus-visible:bg-black focus-visible:text-white"
            >
                Sign out
            </button>
        </form>
    );
}
