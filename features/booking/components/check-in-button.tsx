"use client";

// Client-side only for the submit lifecycle: the pending flag while the door is asked to
// open, and the refusal afterwards. The transition itself is a Server Action.
import { useActionState } from "react";
import Link from "next/link";

import { checkIn } from "@/features/booking/server-actions";
import { FormBanner } from "@/features/auth/components/form-primitives";
import { PILL_SIZE } from "@/ui/pill-styles";

/**
 * Turns a code into a check-in, on the reservation page and at `/checkin/{code}` (possibly signed
 * out), so it never redirects — success is stated in place. ⚠️ The code is a hidden POST field, never
 * a GET link: previews and scanners follow links and would check guests in.
 *
 * @param code The booking's access code, already known to open something.
 * @param label "I've arrived" on the reservation page, instead of the doorway's "Open the door".
 */
export default function CheckInButton({
    code,
    label = "Open the door",
}: {
    code: string;
    label?: string;
}) {
    const [state, action, pending] = useActionState(checkIn, undefined);

    if (state?.ok) {
        return (
            <div className="flex flex-col gap-4">
                <p
                    role="status"
                    className="rounded-2xl border border-black/10 bg-black/3 px-5 py-4 text-[16px] font-medium text-black"
                >
                    You&apos;re checked in. The door is open — welcome.
                </p>
                <Link
                    href={`/account/trips/${state.bookingId}`}
                    className="text-[16px] font-medium text-black underline underline-offset-4"
                >
                    See your reservation
                </Link>
            </div>
        );
    }

    return (
        <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="code" value={code} />

            {state && !state.ok && <FormBanner message={state.message} />}

            <button
                type="submit"
                disabled={pending}
                className={`rounded-full ${PILL_SIZE.md} bg-[#131A2B] font-medium text-white transition-opacity duration-300 ease-out hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none`}
            >
                {pending ? "Opening…" : label}
            </button>
        </form>
    );
}
