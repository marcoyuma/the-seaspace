import type { CheckInMethodId } from "@/features/booking/lib/check-in-methods";
import type { PaymentMethodId } from "@/features/booking/lib/payment-methods";

/**
 * A block of dates that is already taken.
 *
 * ⚠️ `end` is EXCLUSIVE, mirroring `bookings.end_date` — a range of
 * `{ start: "2026-08-10", end: "2026-08-13" }` occupies the nights of the 10th, 11th
 * and 12th, and the 13th is a valid check-in for the next guest. Everything that reads
 * this type must subtract a day; `expandBlockedDays()` in ./lib/dates.ts is the one
 * place that does, and nothing else should re-derive it.
 *
 * Both fields are `yyyy-mm-dd` strings, not `Date`. See ./lib/dates.ts for why.
 */
export interface BookedRange {
    start: string;
    end: string;
}

/**
 * The guest breakdown the picker collects.
 *
 * ⚠️ UI-only. `bookings` has a single `num_guests` column, so only `adults + children`
 * survives a save (see `guestsBooked()` below). Infants are excluded by the same rule
 * the copy states, and `pets` exists solely so the disabled row has something to bind
 * to — there is no column for it and none is planned.
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
 * The five values `bookings.status` may hold, mirroring `bookings_status_known`.
 *
 * 'confirmed' with `paidAt` still null is a real state, not a loose end: the row is
 * created before the payment is attempted so that it holds the dates while the provider
 * thinks. See supabase/migrations/0011_booking_writes.sql §5.
 *
 * 'no_show' arrived with 0012 — paid for, the stay has ended, and nobody ever checked in.
 * Without it the hourly job in 0013 would have to call that a completed stay.
 *
 * ⚠️ Only 'checked_in' has a human author (the guest, at the door). The other transitions
 * are made by `advance_booking_lifecycle()`, which is forbidden from writing that one:
 * whether anyone walked through the door is not something a calendar knows.
 */
export type BookingStatus =
    | "confirmed"
    | "checked_in"
    | "checked_out"
    | "cancelled"
    | "no_show";

/**
 * One of the signed-in guest's own reservations, as the trips pages want it.
 *
 * Prices are the row's own snapshot columns, never the catalogue's current numbers —
 * re-reading `stays.price_per_night` here would silently rewrite the price of every past
 * stay, which is the entire reason 0009 stores them.
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
     * The door credential, eight uppercase hex characters. `null` on seeded rows.
     *
     * ⚠️ Reaches the browser, and should: it is printed on the reservation and encoded
     * into the QR the guest scans. It is only ever selected through the "guests read
     * their own bookings" policy, so one guest can never see another's.
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
 * Everything a door is allowed to know about the booking behind a scanned code.
 *
 * Deliberately thin, and the thinness is the security model rather than a simplification:
 * `get_check_in_invite()` is callable by `anon`, so its return type is the allow-list.
 * Enough to say "you're arriving at Coastal Arch Retreat" and nothing more — no price, no
 * guest, no notes, not even the booking id.
 */
export interface CheckInInvite {
    stayName: string;
    stayLocation: string;
    checkIn: string;
    checkOut: string;
    alreadyCheckedIn: boolean;
}

/**
 * What the check-in button gets back.
 *
 * `bookingId` on success so a signed-in guest can be linked straight to their reservation.
 * It is returned only *after* a successful check-in, which is the one moment holding the
 * code has already proven itself.
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
