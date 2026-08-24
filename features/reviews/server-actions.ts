"use server";

import { revalidatePath, updateTag } from "next/cache";

import { createClient } from "@/lib/supabase-server";
import { REVIEWS_CACHE_TAG } from "@/lib/supabase";
import { getAuthUser } from "@/features/auth/actions";
import type { ReviewFormState } from "@/features/reviews/types";

/**
 * The two mutations in this feature: writing a review, and withdrawing it.
 *
 * Separate from actions.ts for the reason every other feature here states — each export of
 * a `"use server"` file is a public HTTP endpoint, so reads have no business being one.
 * That also means both functions below must assume they were called directly, with any
 * arguments at all, by anyone: the form is a convenience, never the validation.
 *
 * Nothing here is the last line of defence. Identity, ownership, whether the stay actually
 * happened, and the bounds on rating and length are all re-checked inside
 * `upsert_stay_review` (supabase/migrations/0018_reviews_write_path.sql), which is the only
 * thing that can write to `public.reviews`. The checks in this file exist to produce
 * sentences a guest can act on.
 */

/**
 * Custom SQLSTATEs raised by the review functions, declared as an interface in 0018 §6.
 * Matched on `code` and never on message text — PostgREST forwards the code verbatim, while
 * the messages are Postgres' own and free to change.
 */
const REVIEW_ERRORS: Record<string, string> = {
    SB015: "Your session expired while you were on this page. Sign in and try again.",
    SB016: "That reservation is not on your account, so there is nothing to review.",
    SB017: "This stay has not finished yet. You can review it once you have checked out.",
    SB018: "Your account has no guest profile yet, so a review cannot be attached to it. Open your account page and reload.",
    // Postgres' own check_violation, from reviews_rating_range or reviews_quote_len. Only
    // reachable when this file's own bounds have drifted from the table's, so the message
    // names both halves rather than guessing which one failed.
    "23514":
        "That rating or review does not fit what we can store: a rating of 1 to 5, and between 20 and 500 characters.",
};

/** Mirrors `reviews_quote_len` in 0005_reviews.sql. Keep the two in step. */
const QUOTE_MIN_LENGTH = 20;

/**
 * Mirrors `reviews_quote_len`. Not politeness: 0005 records that the carousel measures each
 * card with a ResizeObserver and animates the box to that height, so an unbounded quote
 * makes the landing-page section jump by hundreds of pixels between steps.
 */
const QUOTE_MAX_LENGTH = 500;

function readString(formData: FormData, key: string): string {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
}

/**
 * Turns a Postgrest failure into a sentence, logging the ones we did not anticipate.
 *
 * Same shape as `CREATE_BOOKING_ERRORS` handling in features/booking/server-actions.ts: an
 * unmapped code is a real bug, so it goes to the log with its code attached rather than
 * disappearing behind a generic message.
 */
function describeFailure(
    where: string,
    error: { code?: string; message: string } | null,
): string {
    const known = error && REVIEW_ERRORS[error.code ?? ""];

    if (!known) {
        console.error(
            `[reviews:${where}] code=${error?.code ?? "none"} ${error?.message ?? "no id returned"}`,
        );
    }

    return (
        known ??
        "Your review could not be saved just now. Try again in a moment."
    );
}

/**
 * Posts a review, or rewrites the guest's existing one for the same stay.
 *
 * One booking may carry one review (`reviews_booking_id_key`), so a second submission for
 * the same stay is an edit rather than a conflict — which is why there is no separate
 * "update" action. There is deliberately no review window, and that is precisely why
 * editing has to exist: a typo with no expiry would otherwise be permanent.
 *
 * Note what is NOT sent: no stay, no guest id, no author name, no timestamp. The villa and
 * the guest come from the booking row inside `upsert_stay_review`, and the displayed
 * identity is copied from `public.guests` there — so the denormalised author columns are a
 * real snapshot rather than three strings the browser supplied.
 *
 * Shaped for `useActionState`: `(prevState, formData) => state`. Returns `{ ok: true }`
 * rather than redirecting — the guest is on their own reservation page and the modal closes
 * over it, so sending them elsewhere to say "got it" would cost them the page they were on.
 *
 * @param formData `bookingId`, `rating`, `quote`.
 */
export async function saveStayReview(
    _prevState: ReviewFormState,
    formData: FormData,
): Promise<ReviewFormState> {
    const bookingIdRaw = readString(formData, "bookingId");
    const ratingRaw = readString(formData, "rating");
    const quote = readString(formData, "quote");

    // Echoed back on every rejection so a bad rating does not discard the words.
    const values = { rating: ratingRaw, quote };

    const user = await getAuthUser();
    if (!user) {
        // Not a redirect, unlike the checkout flow: this action runs from a modal on a page
        // the guest is already reading, and there is nothing to resume afterwards.
        return { message: REVIEW_ERRORS.SB015, values };
    }

    // `bookings.id` is a bigint identity column, so anything non-numeric cannot be a
    // booking. Rejected here rather than sent to PostgREST as a malformed argument.
    const bookingId = Number(bookingIdRaw);
    if (!Number.isInteger(bookingId) || bookingId < 1) {
        return {
            message: "That reservation could not be identified. Reload the page.",
            values,
        };
    }

    const errors: { rating?: string; quote?: string } = {};

    const rating = Number(ratingRaw);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        errors.rating = "Pick a rating from one to five stars.";
    }

    if (!quote) {
        errors.quote = "Tell other guests what the stay was like.";
    } else if (quote.length < QUOTE_MIN_LENGTH) {
        errors.quote = `A few more words — at least ${QUOTE_MIN_LENGTH} characters.`;
    } else if (quote.length > QUOTE_MAX_LENGTH) {
        errors.quote = `Keep it under ${QUOTE_MAX_LENGTH} characters.`;
    }

    if (Object.keys(errors).length > 0) return { errors, values };

    const supabaseWithSession = await createClient();
    const { error } = await supabaseWithSession.rpc("upsert_stay_review", {
        p_booking_id: bookingId,
        // `smallint` on the Postgres side; a plain number is what PostgREST wants.
        p_rating: rating,
        p_quote: quote,
    });

    if (error) {
        return { message: describeFailure("save", error), values };
    }

    // The landing-page carousel and the villa's own rating are cached for an hour, and both
    // are now wrong. `updateTag`, not `revalidateTag`: this is read-your-own-writes, so the
    // next render must wait for fresh data instead of being served the stale average.
    updateTag(REVIEWS_CACHE_TAG);

    // The trips pages read per-request and are never cached, so this is only about the
    // client-side router cache — without it the guest would navigate back to a page still
    // showing "How was your stay?".
    revalidatePath(`/account/trips/${bookingId}`);

    return { ok: true };
}

/**
 * Withdraws the guest's review of one booking.
 *
 * A real DELETE, and the contrast with `bookings` is deliberate: 0009 refuses to delete a
 * booking because it is a financial record with a retention obligation behind it. A review
 * is an opinion — nothing depends on it and no law requires keeping it.
 *
 * Removing it also frees the booking to be reviewed again, since `reviews_booking_id_key`
 * no longer holds it. That is intended: withdrawing a review should not lock somebody out
 * of writing a better one.
 */
export async function removeStayReview(
    _prevState: ReviewFormState,
    formData: FormData,
): Promise<ReviewFormState> {
    const bookingId = Number(readString(formData, "bookingId"));

    const user = await getAuthUser();
    if (!user) return { message: REVIEW_ERRORS.SB015 };

    if (!Number.isInteger(bookingId) || bookingId < 1) {
        return { message: "That reservation could not be identified. Reload the page." };
    }

    const supabaseWithSession = await createClient();
    const { error } = await supabaseWithSession.rpc("delete_stay_review", {
        p_booking_id: bookingId,
    });

    if (error) {
        return { message: describeFailure("remove", error) };
    }

    updateTag(REVIEWS_CACHE_TAG);
    revalidatePath(`/account/trips/${bookingId}`);

    return { ok: true };
}
