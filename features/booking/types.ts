import type { CheckInMethodId } from "@/features/booking/lib/check-in-methods";
import type { PaymentMethodId } from "@/features/booking/lib/payment-methods";

/**
 * A block of taken dates, as `yyyy-mm-dd` strings (see ./lib/dates.ts). ⚠️ `end` is EXCLUSIVE, like
 * `bookings.end_date`: [10th, 13th) occupies three nights and the 13th is a valid check-in.
 * `expandBlockedDays()` is the ONE place that subtracts the day — never re-derive it.
 */
export interface BookedRange {
    start: string;
    end: string;
}

/**
 * The picker's guest breakdown. ⚠️ UI-only: `bookings` has one `num_guests`, so only adults +
 * children survive a save (`guestsBooked()`); `pets` exists just for the disabled row — no column.
 */
export interface GuestCounts {
    adults: number;
    children: number;
    infants: number;
    pets: number;
}

/** What would land in `bookings.num_guests`. Infants and pets do not count. */
export function guestsBooked(guests: GuestCounts): number {
    return guests.adults + guests.children;
}

/**
 * `bookings.status` values. 'confirmed' with null `paidAt` is real: the row holds the dates during
 * payment (0011 §5). 'no_show' (0012) = paid, ended, never checked in. ⚠️ Only 'checked_in' is
 * human-made; `advance_booking_lifecycle()` makes the rest and may never write that one.
 */
export type BookingStatus =
    | "confirmed"
    | "checked_in"
    | "checked_out"
    | "cancelled"
    | "no_show";

/**
 * One of the guest's reservations. Prices are the row's snapshot columns, never the catalogue's —
 * re-reading `stays` would rewrite every past stay's price, which is why 0009 stores them.
 */
export interface GuestBooking {
    id: number;
    /** `stays.slug`, so a card can link back to the villa. */
    staySlug: string;
    stayName: string;
    stayLocation: string;
    /** The villa's cover photo, or `null` if its gallery is somehow empty. */
    image: { src: string; alt: string; blurDataURL?: string } | null;
    checkIn: string;
    /** ⚠️ Exclusive — the departure day, not the last night. */
    checkOut: string;
    nights: number;
    numGuests: number;
    pricePerNight: number;
    discountPerNight: number;
    totalPrice: number;
    status: BookingStatus;
    /** ISO timestamp, or `null` while unpaid. */
    paidAt: string | null;
    /**
     * How the guest chose to be let in, or `null` on the 140 seeded rows that predate
     * arrival methods entirely.
     */
    checkInMethod: CheckInMethodId | null;
    /**
     * Door credential, eight uppercase hex characters; `null` on seeded rows. ⚠️ Reaches the
     * browser on purpose (printed + QR), selected only via "guests read their own bookings".
     */
    accessCode: string | null;
    /** Which method was paid with. `null` on seeded rows, whose `paidAt` is fictional. */
    paymentMethod: PaymentMethodId | null;
    /** The provider's receipt id, e.g. `DEMO-GOPAY-3F7K2Q`. `null` until settled. */
    paymentReference: string | null;
    /** ISO timestamp of when the reservation was made, not of the stay itself. */
    createdAt: string;
    guestNotes: string | null;
    /**
     * When the guest cancelled. `null` on cancellations the system made for them — a
     * declined payment, the 0013 sweeper, or a seeded row.
     */
    cancelledAt: string | null;
    /** The refund receipt, e.g. `DEMO-REFUND-GOPAY-3F7K2Q`. `null` when nothing was owed. */
    refundReference: string | null;
}

/**
 * What the checkout form gets back from `payAndBook()`.
 *
 * There is no success shape: a completed booking redirects to its own page, so the only
 * states this can be in are "not submitted yet" and "something went wrong".
 */
export type CheckoutFormState = { message: string } | undefined;

/**
 * All a door may know about a scanned code's booking. The thinness IS the security model:
 * `get_check_in_invite()` is `anon`-callable — no price, guest, notes, or even the booking id.
 */
export interface CheckInInvite {
    stayName: string;
    stayLocation: string;
    checkIn: string;
    checkOut: string;
    alreadyCheckedIn: boolean;
}

/**
 * The check-in button's result. `bookingId` comes back only after a successful check-in (when the
 * code has proven itself), so a signed-in guest can jump to the reservation.
 */
export type CheckInFormState =
    | { ok: true; bookingId: number }
    | { ok: false; message: string }
    | undefined;

/**
 * What the cancellation dialog gets back. `refunded` is `cancel_booking()`'s own return
 * value rather than the action's arithmetic — the database owns the deadline rule.
 */
export type CancelFormState =
    | { ok: true; refunded: boolean }
    | { ok: false; message: string }
    | undefined;

/**
 * A date range mid-selection, so either leg may be missing.
 *
 * A complete range is `checkIn && checkOut`; a half-open one means the guest has picked
 * an arrival and the calendar is waiting for a departure.
 */
export interface DateSelection {
    checkIn: string | null;
    checkOut: string | null;
}
