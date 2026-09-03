"use client";

import { useActionState, useState } from "react";

import { cancelBooking } from "@/features/booking/server-actions";
import { ERROR } from "@/features/auth/components/form-primitives";
import Modal from "@/ui/modal";
import { PILL_SIZE } from "@/ui/pill-styles";

/**
 * The "Cancel reservation" flow: a trigger button and the dialog it opens.
 *
 * @param bookingId Which reservation to cancel. Re-checked by `cancel_booking()` in 0019.
 * @param consequence The refund sentence, formatted on the server so no money or date
 *   formatter ships to the browser.
 * @param deadlineNote The free-cancellation deadline as prose, or `null` once it has passed.
 */
export default function CancelBookingDialog({
    bookingId,
    consequence,
    deadlineNote,
}: {
    bookingId: number;
    consequence: string;
    deadlineNote: string | null;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [state, action, pending] = useActionState(cancelBooking, undefined);

    // Derived rather than closed in an effect: on success the page behind re-renders as
    // "Reservation cancelled", and a permanent record beats a message inside a dialog.
    const showDialog = isOpen && !state?.ok;

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={`rounded-full ${PILL_SIZE.md} border border-black/20 font-medium text-black transition-colors duration-300 ease-out motion-reduce:transition-none hover:border-transparent hover:bg-black hover:text-white focus-visible:border-transparent focus-visible:bg-black focus-visible:text-white`}
            >
                Cancel reservation
            </button>

            <Modal
                isOpen={showDialog}
                onClose={() => !pending && setIsOpen(false)}
                label="Cancel your reservation"
            >
                <h2 className="text-[24px] font-semibold text-black">
                    Cancel this reservation?
                </h2>
                <p className="mt-3 text-[16px] font-medium text-black/60">
                    {consequence}
                </p>
                {deadlineNote && (
                    <p className="mt-3 text-[16px] font-medium text-black/60">
                        {deadlineNote}
                    </p>
                )}
                <p className="mt-3 text-[16px] font-medium text-black/60">
                    This was a simulated payment, so no real money moved — and
                    none comes back.
                </p>

                <form action={action} className="mt-8 flex flex-col gap-6">
                    <input type="hidden" name="bookingId" value={bookingId} />

                    {state?.ok === false && (
                        <p role="alert" className={ERROR}>
                            {state.message}
                        </p>
                    )}

                    <div className="flex items-center gap-4">
                        {/* Neither label is the bare word "Cancel": next to a cancellation
                            it would mean both things at once. */}
                        <button
                            type="submit"
                            disabled={pending}
                            className={`rounded-full ${PILL_SIZE.md} bg-black font-medium text-white transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                            {pending ? "Cancelling…" : "Cancel reservation"}
                        </button>
                        <button
                            type="button"
                            disabled={pending}
                            onClick={() => setIsOpen(false)}
                            className="text-[16px] font-medium text-black/60 transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Keep it
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
