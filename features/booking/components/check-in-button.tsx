"use client";

// Client-side only for the submit lifecycle: the pending flag while the door is asked to
// open, and the refusal afterwards. The transition itself is a Server Action.
import { useActionState } from "react";
import Link from "next/link";

import { checkIn } from "@/features/booking/server-actions";
import { FormBanner } from "@/features/auth/components/form-primitives";

/**
 * The button that turns a code into a check-in.
 *
 * Used from two places with the same behaviour: the reservation page, where the guest is
 * signed in, and `/checkin/{code}`, where whoever scanned the QR may be nobody the site
 * has ever seen. That is why it never redirects — a signed-out scanner has nowhere to be
 * sent, so success is stated in place and offers a link the signed-in case can follow.
 *
 * ⚠️ The code travels as a hidden field on a POST. It must never sit on a link that a
 * `GET` could act on: prefetchers, chat previews and antivirus scanners all follow links,
 * and a guest would be checked in by a WhatsApp preview of their own booking.
 *
 * @param code The booking's access code, already known to open something.
 * @param label Overridden on the reservation page, where "I've arrived" reads better than
 *   the doorway's "Open the door".
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
                className="rounded-[40px] bg-[#131A2B] px-4 py-3.5 text-[16px] font-medium text-white transition-opacity duration-300 ease-out hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
                {pending ? "Opening…" : label}
            </button>
        </form>
    );
}
