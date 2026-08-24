"use client";

// `useActionState` supplies the pending flag and the error/success state; the write itself
// is a Server Action. `useEffect` is only here to close the dialog once the write lands.
import { useActionState, useEffect } from "react";

import { saveStayReview } from "@/features/reviews/server-actions";
import type { OwnReview } from "@/features/reviews/actions";
import RatingInput from "@/features/reviews/components/rating-input";
import {
    ERROR,
    FormBanner,
    INPUT,
    LABEL,
    SUBMIT,
} from "@/features/auth/components/form-primitives";

/** Mirrors `reviews_quote_len` in 0005_reviews.sql, and the bounds in server-actions.ts. */
const QUOTE_MIN_LENGTH = 20;
const QUOTE_MAX_LENGTH = 500;

/**
 * The review form, as it appears inside the dialog on a reservation page.
 *
 * Serves both writing and editing — one booking may carry one review
 * (`reviews_booking_id_key`), so a second submission is an edit and `upsert_stay_review`
 * handles it as one. That is why there is no separate edit component.
 *
 * The form primitives come from `features/auth/components/form-primitives.tsx` rather than
 * being redefined here. Cross-feature, and that is already the established path:
 * `features/account/components/profile-form.tsx` imports the same three constants. `Field`
 * is deliberately not used — it renders an `<input>`, and this form needs a `<textarea>`
 * and a radio group.
 *
 * @param bookingId - Travels in a hidden input. Not trusted: `upsert_stay_review` re-checks
 *   that it belongs to the caller and that the stay is finished.
 * @param existing - The guest's current review when editing, so the fields start filled.
 * @param onClose - Called on cancel, and on a successful save.
 */
export default function ReviewForm({
    bookingId,
    stayName,
    dateRange,
    existing,
    onClose,
}: {
    bookingId: number;
    stayName: string;
    /** Pre-formatted, e.g. "12 – 15 August 2026". Formatting stays with the server page. */
    dateRange: string;
    existing?: OwnReview | null;
    onClose: () => void;
}) {
    const [state, action, pending] = useActionState(saveStayReview, undefined);

    const saved = state?.ok === true;

    // Closing on success is a side effect of state changing, not of the click — the action
    // may fail, and dismissing the dialog before knowing that would hide the error message
    // the guest needs to read.
    useEffect(() => {
        if (saved) onClose();
    }, [saved, onClose]);

    const errors = state && !state.ok ? state.errors : undefined;
    const values = state && !state.ok ? state.values : undefined;

    return (
        <form action={action} className="flex flex-col gap-6">
            <div>
                <h2 className="text-[24px] leading-tight font-semibold text-black">
                    {existing ? "Edit your review" : "How was your stay?"}
                </h2>
                <p className="mt-1 text-[16px] font-medium text-black/60">
                    {stayName} · {dateRange}
                </p>
            </div>

            {state && !state.ok && state.message && (
                <FormBanner message={state.message} />
            )}

            <input type="hidden" name="bookingId" value={bookingId} />

            <div>
                {/* Not a <label htmlFor>: the control is a group of five radios, so the
                    name belongs on the fieldset's own <legend> inside RatingInput. This is
                    the visible heading for it. */}
                <span className={LABEL}>Rating</span>

                <RatingInput
                    // A rejected submit re-renders this component, so the guest's choice has
                    // to come from the echoed value first and only fall back to what was
                    // already saved.
                    defaultValue={
                        values?.rating
                            ? Number(values.rating)
                            : existing?.rating
                    }
                    describedBy={errors?.rating ? "rating-error" : undefined}
                />

                {errors?.rating && (
                    <p id="rating-error" className={ERROR}>
                        {errors.rating}
                    </p>
                )}
            </div>

            <div>
                <label htmlFor="quote" className={LABEL}>
                    Your review
                </label>

                <textarea
                    id="quote"
                    name="quote"
                    rows={5}
                    // Browser-side limits only, and trivially bypassed — the action checks
                    // the same bounds, and `reviews_quote_len` checks them again.
                    minLength={QUOTE_MIN_LENGTH}
                    maxLength={QUOTE_MAX_LENGTH}
                    defaultValue={values?.quote ?? existing?.quote ?? ""}
                    aria-invalid={errors?.quote ? true : undefined}
                    aria-describedby={
                        errors?.quote ? "quote-error" : "quote-hint"
                    }
                    // Shares the auth forms' input styling so the border and focus ring
                    // match every other field on the site. `resize-y` because a textarea's
                    // default `both` lets it be dragged wider than the dialog.
                    className={`${INPUT} min-h-32 resize-y`}
                />

                {errors?.quote ? (
                    <p id="quote-error" className={ERROR}>
                        {errors.quote}
                    </p>
                ) : (
                    <p
                        id="quote-hint"
                        className="mt-2 text-[16px] font-medium text-black/60"
                    >
                        Between {QUOTE_MIN_LENGTH} and {QUOTE_MAX_LENGTH}{" "}
                        characters.
                    </p>
                )}
            </div>

            <div className="mt-2 flex items-center gap-6">
                <button type="submit" disabled={pending} className={SUBMIT}>
                    {pending
                        ? "Saving…"
                        : existing
                          ? "Save changes"
                          : "Post review"}
                </button>

                {/* A real <button type="button">, not a link: it dismisses a dialog rather
                    than navigating. Styled as text so it does not compete with the submit. */}
                <button
                    type="button"
                    onClick={onClose}
                    className="text-[16px] font-medium text-black/60 underline underline-offset-4 transition-opacity duration-300 ease-out hover:opacity-60 motion-reduce:transition-none"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
