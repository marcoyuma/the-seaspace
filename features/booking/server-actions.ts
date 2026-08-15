"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";

import { createClient } from "@/lib/supabase-server";
import { supabase, BOOKINGS_CACHE_TAG } from "@/lib/supabase";
import { getAuthUser } from "@/features/auth/actions";
import { getStay } from "@/features/stays/actions";
import { buildCheckoutUrl } from "@/features/booking/lib/checkout-params";
import { chargeDemoPayment } from "@/features/booking/lib/payment-gateway";
import { isPaymentMethod } from "@/features/booking/lib/payment-methods";
import { isCheckInMethod } from "@/features/booking/lib/check-in-methods";
import { nightsBetween } from "@/features/booking/lib/dates";
import {
    guestsBooked,
    type CheckInFormState,
    type CheckoutFormState,
} from "@/features/booking/types";

/**
 * The one mutation in this feature: turning a selection into a paid reservation.
 *
 * Separate from actions.ts for the reason features/auth states — every export of a
 * `"use server"` file is a public HTTP endpoint, so reads have no business being one.
 * That also means this function must assume it was called directly, with any arguments
 * at all, by anyone: the form is a convenience, never the validation.
 *
 * Nothing here is the last line of defence. Identity, price, capacity, the calendar and
 * the past are all re-checked inside `create_booking`
 * (supabase/migrations/0011_booking_writes.sql), which is the only thing that can insert a
 * row. The checks in this file exist to produce sentences a guest can act on.
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
 * Books the villa and settles the (simulated) payment, then redirects to the reservation.
 *
 * The order is the part worth reading, and it is not the obvious one:
 *
 * 1. `create_booking` inserts the row **before** anything is charged. The row is what
 *    holds the dates — `bookings_no_overlap` is a database constraint, so from this
 *    moment nobody else can take those nights. Charging first would leave the dates open
 *    for the whole length of the provider round-trip.
 * 2. The payment runs.
 * 3. `settle_booking_payment` stamps `paid_at`, or cancels the booking so the dates go
 *    straight back on the market. A cancelled row is kept rather than deleted: it is a
 *    financial record, and 0009 spends a long comment on why those are not deleted.
 *
 * There is no transaction spanning 1–3, and there cannot be — step 2 leaves the database.
 * The failure mode is therefore a `confirmed` booking with `paid_at` null if the process
 * dies mid-flight, which is exactly the state a real provider's pending payments sit in
 * and what a webhook (or a sweeper) would later resolve.
 *
 * Shaped for `useActionState`: `(prevState, formData) => state`. Success never returns —
 * it redirects.
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

    // Note what is NOT sent: no price, no total, no guest id, and no access code. Price
    // comes from the catalogue inside the function, the guest id from the session's own
    // JWT, and the door code is minted there too — a credential generated by the caller is
    // a credential the caller chooses.
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

    // Only ever what the guest is told they are paying, and only from the catalogue read
    // above. The number the database stored is `total_price`, computed from its own
    // snapshot columns; these two agree because both read `stays` within the same second,
    // and the database's copy is the one that counts.
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

    // The calendar the guest just came from is cached for minutes, and it now offers
    // nights that are taken (or, on a decline, has just got them back). `updateTag` rather
    // than `revalidateTag`: this is read-your-own-writes, so the next render must wait for
    // fresh data instead of being served the stale calendar.
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
 * Opens the door: moves a booking from `confirmed` to `checked_in`.
 *
 * ⚠️ **Runs with the anonymous client, and requires no session.** Whoever is standing at
 * the door may be the partner who arrived on an earlier flight, or a guest whose session
 * expired somewhere over the Java Sea. A door code is a door code; demanding a login on a
 * doorstep at midnight is exactly the friction self check-in exists to remove.
 *
 * The blast radius is bounded by the database, not by this function:
 * `check_in_booking()` performs one transition on one row and returns an id. Holding a
 * stranger's code lets somebody mark that stay as begun — it does not let them read the
 * price, the notes, the guest, or anything else about it.
 *
 * Called from a button, never from a `GET`. `/checkin/{code}` renders a page; link
 * prefetchers, chat previews and antivirus scanners all follow links, and a URL that
 * checked guests in on sight would fire from a WhatsApp preview.
 *
 * Shaped for `useActionState`. Unlike `payAndBook()` it never redirects — the same
 * component is used by a signed-out scanner, who has nowhere to be sent.
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
