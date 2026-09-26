"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";

import { createClient } from "@/lib/supabase-server";
import { supabase, BOOKINGS_CACHE_TAG } from "@/lib/supabase";
import { getAuthUser } from "@/features/auth/actions";
import { getStay } from "@/features/stays/actions";
import { buildCheckoutUrl } from "@/features/booking/lib/checkout-params";
import {
    chargeDemoPayment,
    refundDemoPayment,
} from "@/features/booking/lib/payment-gateway";
import { isPaymentMethod } from "@/features/booking/lib/payment-methods";
import { isCheckInMethod } from "@/features/booking/lib/check-in-methods";
import {
    nightsBetween,
    propertyTodayISO,
    withinFreeCancellation,
} from "@/features/booking/lib/dates";
import { getGuestBooking } from "@/features/booking/actions";
import {
    guestsBooked,
    type CancelFormState,
    type CheckInFormState,
    type CheckoutFormState,
} from "@/features/booking/types";

/**
 * The feature's one mutation: selection → paid reservation. A `"use server"` export is a public
 * endpoint, so it assumes any arguments; `create_booking` (0011) re-checks identity, price, capacity,
 * calendar and dates — the checks here only produce sentences a guest can act on.
 */

/**
 * Custom SQLSTATEs raised by `create_booking`. Codes, not messages — declared as an
 * interface in 0011 §4 and extended by 0012 §3.
 */
const CREATE_BOOKING_ERRORS: Record<string, string> = {
    SB001: "That is more guests than this villa sleeps. Go back and lower the party size.",
    SB002: "Those dates have already started. Pick new ones.",
    SB003: "Your session expired while you were on this page. Sign in and try again.",
    SB004: "This villa is no longer listed.",
    SB005: "Your account has no guest profile yet, so a booking cannot be attached to it. Open your account page and reload.",
    SB008: "Choose how you would like to pay.",
    SB009: "Choose how you would like to get in.",
    // Postgres' own exclusion_violation, from the bookings_no_overlap constraint. The one
    // error here that is a genuine race rather than bad input: the calendar offered these
    // dates and somebody else finished paying for them first.
    "23P01":
        "Someone booked those exact nights while you were on this page. Go back and pick different dates.",
};

function readString(formData: FormData, key: string): string {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
}

function readCount(formData: FormData, key: string): number {
    const value = Number(readString(formData, key));
    return Number.isInteger(value) && value >= 0 ? value : 0;
}

/**
 * Books, pays (simulated) and redirects. Order matters: `create_booking` inserts FIRST, so
 * `bookings_no_overlap` holds the dates during payment; `settle_booking_payment` then stamps
 * `paid_at` or cancels (row kept). No transaction spans them: a crash leaves `confirmed` + null `paid_at`.
 */
export async function payAndBook(
    _prevState: CheckoutFormState,
    formData: FormData,
): Promise<CheckoutFormState> {
    const slug = readString(formData, "slug");
    const checkIn = readString(formData, "checkIn");
    const checkOut = readString(formData, "checkOut");
    const guests = {
        adults: readCount(formData, "adults"),
        children: readCount(formData, "children"),
        infants: readCount(formData, "infants"),
        pets: readCount(formData, "pets"),
    };
    const method = readString(formData, "method");
    const arrival = readString(formData, "checkInMethod");
    const guestNotes = readString(formData, "guestNotes");
    const declineOnPurpose = formData.get("declineOnPurpose") === "on";

    const user = await getAuthUser();
    if (!user) {
        // Not an error state: an expired session is a normal thing to walk into, and the
        // guest should land back on this exact checkout after signing in.
        redirect(
            `/login?next=${encodeURIComponent(buildCheckoutUrl(slug, checkIn, checkOut, guests))}`,
        );
    }

    if (!isPaymentMethod(method)) {
        return { message: "Choose how you would like to pay." };
    }

    if (!isCheckInMethod(arrival)) {
        return { message: "Choose how you would like to get in." };
    }

    const stay = await getStay(slug);
    if (!stay) {
        return { message: "This villa is no longer listed." };
    }

    // Guards the arithmetic below, not the booking — `bookings_dates_ordered` is what
    // actually enforces this. Without it a tampered form could ask for a negative total.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || checkOut <= checkIn) {
        return { message: "Those dates do not make sense. Pick them again." };
    }

    const numGuests = guestsBooked(guests);
    if (numGuests < 1) {
        return { message: "A booking needs at least one guest." };
    }

    const supabaseWithSession = await createClient();

    // Never sent: price, total, guest id or access code. The function reads price from the catalogue,
    // the guest from the JWT, and mints the door code — a caller-made credential is caller-chosen.
    const { data: bookingId, error: createError } = await supabaseWithSession.rpc(
        "create_booking",
        {
            p_slug: slug,
            p_start: checkIn,
            p_end: checkOut,
            p_num_guests: numGuests,
            p_guest_notes: guestNotes || null,
            p_payment_method: method,
            p_check_in_method: arrival,
        },
    );

    if (createError || typeof bookingId !== "number") {
        // Matched on `code`, never on message text — the messages are Postgres' and are
        // free to change, while the SQLSTATEs are declared in 0011 as an interface.
        const known = createError && CREATE_BOOKING_ERRORS[createError.code];
        if (!known) {
            console.error(
                `[booking:create] code=${createError?.code ?? "none"} ${createError?.message ?? "no booking id returned"}`,
            );
        }

        return {
            message:
                known ??
                "The reservation could not be created. Nothing was charged — try again.",
        };
    }

    // Only what the guest is told they pay; the DB's own `total_price` (from its snapshot columns)
    // is the one that counts. Both read `stays` within the same second, so they agree.
    const nights = nightsBetween(checkIn, checkOut);
    const amountIdr = (stay.pricePerNight - stay.discountPerNight) * nights;

    const outcome = await chargeDemoPayment({
        amountIdr,
        method,
        declineOnPurpose,
    });

    const { error: settleError } = await supabaseWithSession.rpc("settle_booking_payment", {
        p_booking_id: bookingId,
        p_paid: outcome.ok,
        // The receipt, kept only when there is one to keep. A declined attempt produced
        // nothing, and `bookings_reference_matches_payment` would reject a reference on an
        // unpaid row anyway.
        p_reference: outcome.ok ? outcome.reference : null,
    });

    if (settleError) {
        // The booking exists and is holding dates, but its payment state is now unknown to
        // us. Loud, because this is the one outcome nobody can resolve from the UI.
        console.error(
            `[booking:settle] booking=${bookingId} code=${settleError.code} ${settleError.message}`,
        );

        return {
            message:
                "Your reservation was created but we could not confirm the payment. Check your trips before trying again.",
        };
    }

    // The cached calendar now offers taken nights (or just got them back). `updateTag`, not
    // `revalidateTag`: read-your-own-writes, so the next render waits for fresh data.
    updateTag(`${BOOKINGS_CACHE_TAG}:${slug}`);

    if (!outcome.ok) {
        return { message: outcome.reason };
    }

    redirect(`/account/trips/${bookingId}`);
}

// ---------------------------------------------------------------------------
// The door
// ---------------------------------------------------------------------------

/** Custom SQLSTATEs raised by `check_in_booking`. See supabase/migrations/0012 §5. */
const CHECK_IN_ERRORS: Record<string, string> = {
    SB010: "That code does not open anything. Check it against your reservation, or ask whoever booked the villa to forward it.",
    SB011: "This reservation has not been paid for yet, so the door will not open. Open it in your trips to finish paying.",
    SB012: "This code works from your arrival day until the morning you leave — today is outside that. Check the dates on your reservation.",
};

/**
 * Opens the door (`confirmed` → `checked_in`). ⚠️ **Anonymous client, no session**: a door code is a
 * door code, and the DB bounds it to one transition. Called from a button, never a GET (link previews
 * would check guests in); never redirects, as a signed-out scanner has nowhere to be sent.
 */
export async function checkIn(
    _prevState: CheckInFormState,
    formData: FormData,
): Promise<CheckInFormState> {
    const code = readString(formData, "code");

    const { data: bookingId, error } = await supabase.rpc("check_in_booking", {
        p_code: code,
    });

    if (error || typeof bookingId !== "number") {
        const known = error && CHECK_IN_ERRORS[error.code];
        if (!known) {
            console.error(
                `[booking:checkIn] code=${error?.code ?? "none"} ${error?.message ?? "no booking id returned"}`,
            );
        }

        return {
            ok: false,
            message:
                known ??
                "The door could not be opened just now. Try again, and use the lock box if it keeps failing.",
        };
    }

    // The trips pages read per-request and are never cached, so this is only about the
    // client-side router cache: without it, navigating to the reservation after checking
    // in would show the status the guest saw a moment ago.
    revalidatePath("/account/trips");
    revalidatePath(`/account/trips/${bookingId}`);

    return { ok: true, bookingId };
}

// ---------------------------------------------------------------------------
// Changing your mind
// ---------------------------------------------------------------------------

/** Custom SQLSTATEs raised by `cancel_booking`. See supabase/migrations/0019 §2. */
const CANCEL_BOOKING_ERRORS: Record<string, string> = {
    SB006: "That reservation is not yours, or no longer exists.",
    SB019: "This reservation is not in a state that can be cancelled. Reload the page to see where it stands.",
    // Either direction of the refund mismatch, and neither is the guest's doing.
    SB020: "The refund for this reservation could not be worked out. Nothing was cancelled — reload and try again.",
    SB021: "Your arrival day has passed, so this reservation can no longer be cancelled.",
};

/**
 * Cancels a reservation, refunding it when the policy says so. README §11 has the rules.
 *
 * Shaped for `useActionState`. Never redirects — the guest stays on the reservation.
 */
export async function cancelBooking(
    _prevState: CancelFormState,
    formData: FormData,
): Promise<CancelFormState> {
    const bookingId = Number(readString(formData, "bookingId"));

    if (!Number.isInteger(bookingId) || bookingId < 1) {
        return { ok: false, message: "That reservation could not be found." };
    }

    const user = await getAuthUser();
    if (!user) {
        redirect(`/login?next=/account/trips/${bookingId}`);
    }

    // Ownership is the RLS policy behind this read, not a check written here.
    const booking = await getGuestBooking(bookingId);
    if (!booking) {
        return { ok: false, message: CANCEL_BOOKING_ERRORS.SB006 };
    }

    if (booking.status !== "confirmed") {
        return { ok: false, message: CANCEL_BOOKING_ERRORS.SB019 };
    }

    const today = propertyTodayISO();
    if (booking.checkIn < today) {
        return { ok: false, message: CANCEL_BOOKING_ERRORS.SB021 };
    }

    // Both halves of what `cancel_booking` calls `v_owed`: inside the free window, and
    // actually charged. An unpaid hold has nothing to give back whatever the calendar says.
    const owed =
        Boolean(booking.paidAt) &&
        withinFreeCancellation(booking.checkIn, today);

    const refundReference =
        owed && booking.paymentMethod
            ? await refundDemoPayment({ method: booking.paymentMethod })
            : null;

    const supabaseWithSession = await createClient();

    const { data: refunded, error } = await supabaseWithSession.rpc(
        "cancel_booking",
        { p_booking_id: bookingId, p_refund_reference: refundReference },
    );

    if (error || typeof refunded !== "boolean") {
        const known = error && CANCEL_BOOKING_ERRORS[error.code];
        if (!known) {
            console.error(
                `[booking:cancel] booking=${bookingId} code=${error?.code ?? "none"} ${error?.message ?? "no outcome returned"}`,
            );
        }

        return {
            ok: false,
            message:
                known ??
                "The reservation could not be cancelled just now. Reload the page and try again.",
        };
    }

    // The nights are back on the market and the guest may look straight at that calendar,
    // so `updateTag` rather than `revalidateTag` — same case as `payAndBook()` above.
    updateTag(`${BOOKINGS_CACHE_TAG}:${booking.staySlug}`);
    revalidatePath("/account/trips");
    revalidatePath(`/account/trips/${bookingId}`);

    return { ok: true, refunded };
}
