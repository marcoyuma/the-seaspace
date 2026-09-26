import { signOut } from "@/features/auth/server-actions";
import { PILL_SIZE } from "@/ui/pill-styles";

/**
 * Sign out as a form posting to a Server Action — no JS needed, so it works before hydration and
 * keeps working when something else on the page has broken.
 */
export default function SignOutButton() {
    return (
        <form action={signOut}>
            <button
                type="submit"
                className={`rounded-full ${PILL_SIZE.md} border border-black font-medium text-black transition-colors duration-300 ease-out motion-reduce:transition-none hover:border-transparent hover:bg-black hover:text-white focus-visible:border-transparent focus-visible:bg-black focus-visible:text-white`}
            >
                Sign out
            </button>
        </form>
    );
}
