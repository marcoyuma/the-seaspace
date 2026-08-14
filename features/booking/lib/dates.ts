import type { BookedRange } from "@/features/booking/types";

/**
 * Calendar arithmetic for the date picker.
 *
 * Hand-rolled rather than pulling in date-fns: the project has no date dependency, the
 * picker needs about eight operations, and `Intl` already ships in every runtime.
 *
 * ---------------------------------------------------------------------------
 * Two rules that everything here depends on
 * ---------------------------------------------------------------------------
 * 1. A calendar day is a `yyyy-mm-dd` STRING, never a `Date`. It is the format Postgres
 *    hands back for a `date` column, it compares correctly with `<` and `>` because ISO
 *    dates sort lexicographically, and it is safe as a Set key and a React key. `Date`
 *    is only ever a local intermediate.
 * 2. Where a `Date` is unavoidable it is built at LOCAL NOON. `new Date("2026-08-18")`
 *    parses as UTC midnight, which is the previous day in every timezone west of
 *    Greenwich — so the picker would render Bali's dates one day off for a visitor in
 *    New York. Noon is far enough from both midnights that no DST shift can cross a day
 *    boundary either.
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
 * Today, in the viewer's timezone.
 *
 * ⚠️ Must only be called on the client. The detail page is prerendered, so a value
 * captured during the build would be frozen at build time and would also disagree with
 * whatever the browser computes at hydration. BookingPanel resolves it in an effect for
 * exactly that reason.
 */
export function todayISO(): string {
    return toISO(new Date());
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
 * One month laid out as calendar cells, Sunday-first.
 *
 * `null` is a leading blank before the 1st. Trailing blanks are trimmed — the grid is
 * only as tall as the month needs, which is why August renders six rows and September
 * five, matching the reference design.
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
 * Every individual day covered by a booking.
 *
 * ⚠️ This is the ONE place the exclusive end date is turned into occupied days, and it
 * is why the loop stops before `range.end`. A booking of [10th, 13th) blocks the 10th,
 * 11th and 12th; the 13th is free from 11:00 AM for the next guest, so it stays
 * selectable as a check-in. Re-deriving this anywhere else is how a picker starts
 * losing one day per booking.
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
 * The first taken day strictly after `checkIn`, or `null` if the rest of the window is
 * free.
 *
 * This is what stops a selection straddling somebody else's stay: once an arrival is
 * chosen, every day from here onward is unselectable, so a range can only ever be
 * carved out of one contiguous free block.
 *
 * Bounded by `horizon` rather than scanning forever — there is nothing beyond the last
 * booked day to find, and an unbounded loop on a villa with no future bookings would
 * never return.
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
 * The last day a guest can cancel and still be refunded in full.
 *
 * Airbnb's "Flexible" policy: a full refund if the guest cancels at least 24 hours
 * before check-in. Airbnb measures that against the 3:00 PM local check-in time; this
 * site stores `date`, not `timestamptz`, so the deadline is rounded to the whole day
 * before arrival — which is the same answer for every hour a guest would actually
 * cancel at, and never promises a refund Airbnb's rule would refuse.
 */
export function freeCancellationDeadline(checkIn: string): string {
    return addDays(checkIn, -1);
}
