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
 * A date range mid-selection, so either leg may be missing.
 *
 * A complete range is `checkIn && checkOut`; a half-open one means the guest has picked
 * an arrival and the calendar is waiting for a departure.
 */
export interface DateSelection {
    checkIn: string | null;
    checkOut: string | null;
}
