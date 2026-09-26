import type { BookedRange } from "@/features/booking/types";

/**
 * Hand-rolled calendar arithmetic (no date dependency; `Intl` suffices). 1) A day is a `yyyy-mm-dd`
 * STRING — Postgres's format, sortable, a safe key. 2) Any `Date` is built at LOCAL NOON: ISO parsing
 * gives UTC midnight (the day before, west of Greenwich), and no DST shift crosses noon.
 */

/** `yyyy-mm-dd` for a local calendar day. */
export function toISO(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

/** Local noon on the given day. See rule 2 above. */
export function fromISO(iso: string): Date {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
}

export function addDays(iso: string, days: number): string {
    const date = fromISO(iso);
    date.setDate(date.getDate() + days);
    return toISO(date);
}

/**
 * Nights between two days — the same subtraction `bookings.num_nights` performs.
 * Aug 18 → Aug 20 is 2 nights, not 3, because check-out is exclusive.
 */
export function nightsBetween(checkIn: string, checkOut: string): number {
    return Math.round(
        (fromISO(checkOut).getTime() - fromISO(checkIn).getTime()) / 86_400_000,
    );
}

/**
 * Today in the viewer's timezone. ⚠️ Client only: the detail page is prerendered, so a build-time
 * value would freeze and mismatch hydration — BookingPanel resolves it in an effect.
 */
export function todayISO(): string {
    return toISO(new Date());
}

/**
 * Today at the villas — the SERVER's version (Vercel runs UTC). `Asia/Makassar` (WITA, UTC+8) must
 * match `create_booking` (0011); `en-CA` because its short date format is `yyyy-mm-dd`.
 */
export function propertyTodayISO(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Makassar",
    }).format(new Date());
}

/** First day of the month `offset` months from the given day. */
export function addMonths(iso: string, offset: number): string {
    const date = fromISO(iso);
    // Day 1 first: stepping the month from the 31st lands on the 1st of the month
    // *after* the one intended whenever the target is shorter.
    date.setDate(1);
    date.setMonth(date.getMonth() + offset);
    return toISO(date);
}

/** First day of the month containing `iso`. */
export function startOfMonth(iso: string): string {
    return `${iso.slice(0, 7)}-01`;
}

/**
 * One month as Sunday-first cells; `null` is a leading blank. Trailing blanks are trimmed, so August
 * renders six rows and September five, matching the design.
 *
 * @param monthStart - Any day in the month; the 1st is derived.
 * @returns Cells in reading order, length a multiple of 7.
 */
export function monthGrid(monthStart: string): (string | null)[] {
    const first = fromISO(startOfMonth(monthStart));
    const leading = first.getDay();
    const daysInMonth = new Date(
        first.getFullYear(),
        first.getMonth() + 1,
        0,
    ).getDate();

    const weeks = Math.ceil((leading + daysInMonth) / 7);
    const cells: (string | null)[] = [];

    for (let index = 0; index < weeks * 7; index++) {
        const dayOfMonth = index - leading + 1;
        cells.push(
            dayOfMonth >= 1 && dayOfMonth <= daysInMonth
                ? toISO(
                      new Date(first.getFullYear(), first.getMonth(), dayOfMonth, 12),
                  )
                : null,
        );
    }

    return cells;
}

/**
 * Every day a booking covers. ⚠️ The ONE place exclusive ends become occupied days, hence stopping
 * before `range.end`: [10th, 13th) blocks 10–12, and the 13th stays a valid check-in. Re-deriving
 * this elsewhere is how a picker starts losing a day per booking.
 */
export function expandBlockedDays(ranges: BookedRange[]): Set<string> {
    const blocked = new Set<string>();

    for (const range of ranges) {
        for (let day = range.start; day < range.end; day = addDays(day, 1)) {
            blocked.add(day);
        }
    }

    return blocked;
}

/**
 * Whether every night of `[checkIn, checkOut)` is free — stops before `checkOut`, since departure is
 * turnover, not a clash. A read-time answer, not a guarantee (`bookings_no_overlap` is); it just
 * says so before payment.
 */
export function rangeIsFree(
    checkIn: string,
    checkOut: string,
    blocked: Set<string>,
): boolean {
    for (let day = checkIn; day < checkOut; day = addDays(day, 1)) {
        if (blocked.has(day)) return false;
    }
    return true;
}

/**
 * First taken day strictly after `checkIn`, or `null` — later days become unselectable, so a range
 * can't straddle another stay. Bounded by `horizon`, or a villa with no future bookings never returns.
 */
export function firstBlockedAfter(
    checkIn: string,
    blocked: Set<string>,
    horizon: string,
): string | null {
    for (let day = addDays(checkIn, 1); day <= horizon; day = addDays(day, 1)) {
        if (blocked.has(day)) return day;
    }
    return null;
}

/**
 * How far ahead the "can't pass the next booking" scan needs to look: the day after the
 * last booked day, or a year out when nothing is booked at all.
 */
export function selectionHorizon(ranges: BookedRange[], today: string): string {
    const lastEnd = ranges.reduce((latest, range) => {
        return range.end > latest ? range.end : latest;
    }, today);

    return addDays(lastEnd, 1);
}

// en-US on purpose, matching the reference design ("Aug 18, 2026"). The rest of the site
// formats currency as id-ID via lib/format.ts; these are separate decisions, and the
// dates are the ones a booking confirmation would echo back in English.
const FULL_DATE = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
});

const DAY_MONTH = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
});

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
});

const WEEKDAY_DATE = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
});

/** "Aug 18, 2026" */
export const formatFullDate = (iso: string) => FULL_DATE.format(fromISO(iso));

/** "Aug 17" — the free-cancellation deadline reads better without the year. */
export const formatDayMonth = (iso: string) => DAY_MONTH.format(fromISO(iso));

/** "August 2026" — a calendar heading. */
export const formatMonthYear = (iso: string) => MONTH_YEAR.format(fromISO(iso));

/** "Tuesday, August 18, 2026" — the accessible name of a day button. */
export const formatWeekdayDate = (iso: string) => WEEKDAY_DATE.format(fromISO(iso));

/** "08/18/2026" — what the CHECK-IN / CHECKOUT text inputs show. */
export function formatUsDate(iso: string): string {
    const [year, month, day] = iso.split("-");
    return `${month}/${day}/${year}`;
}

/**
 * Parses the `MM/DD/YYYY` a guest typed. `null` for anything that is not a real
 * calendar day, which includes the overflow the `Date` constructor would otherwise
 * silently roll over ("02/30/2026" becoming March 2nd).
 */
export function parseUsDate(value: string): string | null {
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;

    const [, month, day, year] = match;
    const candidate = new Date(Number(year), Number(month) - 1, Number(day), 12);

    // Round-tripping catches the rollover: a parsed Feb 30th comes back as March 2nd,
    // whose month no longer matches what was typed.
    if (candidate.getMonth() !== Number(month) - 1) return null;
    if (candidate.getDate() !== Number(day)) return null;

    return toISO(candidate);
}

/**
 * Last day of the free-cancellation window (cancel BEFORE it; see `withinFreeCancellation()`).
 * Airbnb "Flexible" (24h before the 3 PM check-in), rounded to the whole day before arrival since we
 * store `date` — never promising a refund Airbnb would refuse.
 */
export function freeCancellationDeadline(checkIn: string): string {
    return addDays(checkIn, -1);
}

/**
 * Whether a cancellation made on `today` is still inside the free window. Strict `<`: the
 * deadline day is already outside it, and `cancel_booking()` in 0019 mirrors that exactly.
 */
export function withinFreeCancellation(checkIn: string, today: string): boolean {
    return today < freeCancellationDeadline(checkIn);
}
