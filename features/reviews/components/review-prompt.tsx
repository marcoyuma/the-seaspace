"use client";

// Client-side for two things only: the dialog's open flag, and the delete action's pending
// state. The eligibility decision is made on the server — see the note on `ReviewPrompt`.
import { useActionState, useState } from "react";

import { removeStayReview } from "@/features/reviews/server-actions";
import type { OwnReview } from "@/features/reviews/actions";
import RatingStars from "@/features/reviews/components/rating-stars";
import ReviewForm from "@/features/reviews/components/review-form";
import { FormBanner } from "@/features/auth/components/form-primitives";
import Modal from "@/ui/modal";
import PillButton from "@/ui/pill-button";

/** Text-underline action, matching the "← All trips" link on the same page. */
const TEXT_ACTION =
    "text-[16px] font-medium text-black underline underline-offset-4 transition-opacity duration-300 ease-out hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";

/**
 * "How was your stay?" on a reservation page — the panel that opens the review form, or
 * shows the review already written.
 *
 * ⚠️ **This component assumes the stay is reviewable and does not check.** Whether a booking
 * qualifies is decided by the page that renders it: only `status === 'checked_out'` does,
 * and for anything else the page omits this section entirely rather than rendering a
 * disabled button. A dead control with no explanation is worse than no control — and the
 * page already carries a `BookingStatusBadge` that says what state the reservation is in.
 *
 * The database enforces the same rule regardless: `upsert_stay_review` raises SB017 for a
 * booking that is not checked out, so hiding the section is presentation, not security.
 *
 * @param existing - The guest's review of this booking, or `null` if they have not written
 *   one. Decides between the two states below.
 */
export default function ReviewPrompt({
    bookingId,
    stayName,
    dateRange,
    existing,
}: {
    bookingId: number;
    stayName: string;
    /** Pre-formatted by the page, so date formatting stays on the server. */
    dateRange: string;
    existing: OwnReview | null;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [deleteState, deleteAction, deletePending] = useActionState(
        removeStayReview,
        undefined,
    );

    return (
        <section
            aria-labelledby="review-heading"
            // Same panel treatment as the payment and arrival sections on this page.
            className="mt-8 rounded-3xl border border-black/10 p-8"
        >
            <h2
                id="review-heading"
                className="text-[20px] font-semibold text-black"
            >
                {existing ? "Your review" : "How was your stay?"}
            </h2>

            {/* A failed delete has nowhere else to surface: the dialog is closed and the
                button sits right here. */}
            {deleteState && !deleteState.ok && deleteState.message && (
                <div className="mt-4">
                    <FormBanner message={deleteState.message} />
                </div>
            )}

            {existing ? (
                <>
                    <div className="mt-4">
                        <RatingStars rating={existing.rating} />
                    </div>

                    <p className="mt-3 text-[16px] font-medium whitespace-pre-line text-black/60">
                        “{existing.quote}”
                    </p>

                    <div className="mt-6 flex items-center gap-6">
                        <button
                            type="button"
                            onClick={() => setIsOpen(true)}
                            className={TEXT_ACTION}
                        >
                            Edit
                        </button>

                        {/* Its own <form>, not a button inside the edit form: one form with
                            two destinations is how a stray Enter keypress ends up deleting
                            something. */}
                        <form action={deleteAction}>
                            <input
                                type="hidden"
                                name="bookingId"
                                value={bookingId}
                            />
                            <button
                                type="submit"
                                disabled={deletePending}
                                className={TEXT_ACTION}
                            >
                                {deletePending ? "Removing…" : "Delete"}
                            </button>
                        </form>
                    </div>
                </>
            ) : (
                <>
                    <p className="mt-4 max-w-128.25 text-[16px] font-medium text-black/60">
                        Your rating and a few words help the next guest choose.
                        You can edit or remove it at any time.
                    </p>

                    <PillButton
                        variant="outline"
                        onClick={() => setIsOpen(true)}
                        aria-expanded={isOpen}
                        className="mt-6"
                    >
                        Rate your stay
                    </PillButton>
                </>
            )}

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                label={
                    existing
                        ? `Edit your review of ${stayName}`
                        : `Review your stay at ${stayName}`
                }
            >
                {/* `key` remounts the form when the saved review changes, so the fields pick
                    up the new defaults instead of keeping the values from the last open. */}
                <ReviewForm
                    key={existing ? `${existing.rating}:${existing.quote}` : "new"}
                    bookingId={bookingId}
                    stayName={stayName}
                    dateRange={dateRange}
                    existing={existing}
                    onClose={() => setIsOpen(false)}
                />
            </Modal>
        </section>
    );
}
