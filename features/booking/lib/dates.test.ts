import { afterEach, describe, expect, it, vi } from "vitest";

import {
    addDays,
    addMonths,
    expandBlockedDays,
    firstBlockedAfter,
    formatDayMonth,
    formatFullDate,
    formatMonthYear,
    formatUsDate,
    formatWeekdayDate,
    freeCancellationDeadline,
    fromISO,
    monthGrid,
    nightsBetween,
    parseUsDate,
    propertyTodayISO,
    rangeIsFree,
    selectionHorizon,
    startOfMonth,
    toISO,
    todayISO,
    withinFreeCancellation,
} from "@/features/booking/lib/dates";

/**
 * The calendar's arithmetic, which everything downstream of the date picker trusts.
 *
 * Two rules are load-bearing and are asserted repeatedly below rather than once:
 * check-out is EXCLUSIVE (a stay of [10th, 13th) occupies three nights, not four), and a
 * calendar day is a `yyyy-mm-dd` string compared lexicographically, never a `Date`.
 *
 * The suite runs with TZ pinned to Asia/Jakarta by vitest.config.ts — see the note there.
 */

describe("toISO / fromISO", () => {
    it("pads single-digit months and days", () => {
        expect(toISO(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
    });

    it("builds the day at local noon, not UTC midnight", () => {
        // The whole reason fromISO exists: `new Date("2026-08-18")` is UTC midnight, which
        // is Aug 17 anywhere west of Greenwich.
        const date = fromISO("2026-08-18");
        expect(date.getHours()).toBe(12);
        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth()).toBe(7);
        expect(date.getDate()).toBe(18);
    });

    it("round-trips", () => {
        for (const iso of ["2026-01-01", "2026-08-18", "2026-12-31", "2028-02-29"]) {
            expect(toISO(fromISO(iso))).toBe(iso);
        }
    });
});

describe("addDays", () => {
    it("rolls over a month boundary", () => {
        expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    });

    it("rolls over a year boundary", () => {
        expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    });

    it("walks backwards on a negative count", () => {
        expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    });

    it("knows about leap years", () => {
        expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
        expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    });

    it("returns the same day for zero", () => {
        expect(addDays("2026-08-18", 0)).toBe("2026-08-18");
    });
});

describe("nightsBetween", () => {
    it("counts nights, not days — check-out is exclusive", () => {
        // The number `bookings.num_nights` computes as `end_date - start_date`.
        expect(nightsBetween("2026-08-18", "2026-08-20")).toBe(2);
    });

    it("is 1 for a single night", () => {
        expect(nightsBetween("2026-08-18", "2026-08-19")).toBe(1);
    });

    it("is 0 for the same day", () => {
        expect(nightsBetween("2026-08-18", "2026-08-18")).toBe(0);
    });

    it("goes negative on reversed input — there is no guard here", () => {
        // Documented, not endorsed: ordering is enforced by parseCheckoutParams and by the
        // `bookings_dates_ordered` constraint, so this function never sees reversed input
        // in practice.
        expect(nightsBetween("2026-08-20", "2026-08-18")).toBe(-2);
    });

    it("survives a DST-style month with the noon trick", () => {
        expect(nightsBetween("2026-03-01", "2026-04-01")).toBe(31);
    });
});

describe("addMonths", () => {
    it("does not overflow a short month", () => {
        // Without the `setDate(1)` first, stepping the month from Jan 31 lands on Mar 3.
        expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    });

    it("steps backwards", () => {
        expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
    });

    it("normalises to the 1st even at offset 0", () => {
        expect(addMonths("2026-08-18", 0)).toBe("2026-08-01");
    });
});

describe("startOfMonth", () => {
    it("takes the 1st of the containing month", () => {
        expect(startOfMonth("2026-08-18")).toBe("2026-08-01");
        expect(startOfMonth("2026-08-01")).toBe("2026-08-01");
    });
});

describe("monthGrid", () => {
    it("always returns whole weeks", () => {
        for (const month of ["2026-01-01", "2026-02-01", "2026-08-01", "2028-02-01"]) {
            expect(monthGrid(month).length % 7).toBe(0);
        }
    });

    it("pads the front with one blank per weekday before the 1st", () => {
        // Aug 1 2026 is a Saturday, so six blanks precede it.
        const cells = monthGrid("2026-08-01");
        expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
        expect(cells[6]).toBe("2026-08-01");
    });

    it("renders August 2026 in six rows and February 2026 in four", () => {
        // The reference design depends on the grid being only as tall as the month needs.
        expect(monthGrid("2026-08-01")).toHaveLength(42);
        // Feb 1 2026 is a Sunday and February has 28 days — exactly four rows, no blanks.
        const february = monthGrid("2026-02-01");
        expect(february).toHaveLength(28);
        expect(february.includes(null)).toBe(false);
    });

    it("never ends with a fully blank week", () => {
        // "Trailing blanks are trimmed" means trimmed to the week boundary, not to the last
        // day: August 2026 ends on a Monday, so four blanks legitimately follow the 31st.
        // What must never happen is a whole empty row at the bottom.
        for (const month of ["2026-01-01", "2026-02-01", "2026-08-01", "2028-02-01"]) {
            const cells = monthGrid(month);
            const lastWeek = cells.slice(-7);
            expect(lastWeek.some((cell) => cell !== null)).toBe(true);
        }
    });

    it("lists every day of the month once, in order", () => {
        const days = monthGrid("2026-02-01").filter((cell) => cell !== null);
        expect(days).toHaveLength(28);
        expect(days[0]).toBe("2026-02-01");
        expect(days.at(-1)).toBe("2026-02-28");
        expect([...days].sort()).toEqual(days);
    });

    it("derives the month from any day in it", () => {
        expect(monthGrid("2026-08-18")).toEqual(monthGrid("2026-08-01"));
    });
});

describe("expandBlockedDays", () => {
    it("stops before the exclusive end date", () => {
        // A booking of [10th, 13th) occupies the 10th, 11th and 12th. The 13th is free from
        // 11:00 AM, so it stays selectable as somebody else's check-in.
        const blocked = expandBlockedDays([
            { start: "2026-08-10", end: "2026-08-13" },
        ]);
        expect([...blocked].sort()).toEqual([
            "2026-08-10",
            "2026-08-11",
            "2026-08-12",
        ]);
        expect(blocked.has("2026-08-13")).toBe(false);
    });

    it("returns an empty set for no bookings", () => {
        expect(expandBlockedDays([]).size).toBe(0);
    });

    it("merges back-to-back bookings without a gap", () => {
        const blocked = expandBlockedDays([
            { start: "2026-08-10", end: "2026-08-12" },
            { start: "2026-08-12", end: "2026-08-14" },
        ]);
        expect([...blocked].sort()).toEqual([
            "2026-08-10",
            "2026-08-11",
            "2026-08-12",
            "2026-08-13",
        ]);
    });

    it("expands a one-night booking to exactly one day", () => {
        const blocked = expandBlockedDays([
            { start: "2026-08-10", end: "2026-08-11" },
        ]);
        expect([...blocked]).toEqual(["2026-08-10"]);
    });
});

describe("rangeIsFree", () => {
    const blocked = expandBlockedDays([{ start: "2026-08-10", end: "2026-08-13" }]);

    it("allows same-day turnover — arriving the day another guest leaves", () => {
        expect(rangeIsFree("2026-08-13", "2026-08-15", blocked)).toBe(true);
    });

    it("allows departing on the day another booking begins", () => {
        expect(rangeIsFree("2026-08-08", "2026-08-10", blocked)).toBe(true);
    });

    it("rejects a range covering an occupied night", () => {
        expect(rangeIsFree("2026-08-09", "2026-08-11", blocked)).toBe(false);
        expect(rangeIsFree("2026-08-12", "2026-08-14", blocked)).toBe(false);
    });

    it("rejects a range that straddles the whole booking", () => {
        expect(rangeIsFree("2026-08-08", "2026-08-16", blocked)).toBe(false);
    });

    it("is true when nothing is booked", () => {
        expect(rangeIsFree("2026-08-01", "2026-09-01", new Set())).toBe(true);
    });
});

describe("firstBlockedAfter", () => {
    const blocked = expandBlockedDays([{ start: "2026-08-10", end: "2026-08-13" }]);

    it("finds the next taken day after the arrival", () => {
        expect(firstBlockedAfter("2026-08-05", blocked, "2026-08-20")).toBe(
            "2026-08-10",
        );
    });

    it("ignores the check-in day itself", () => {
        // The scan starts at checkIn + 1, so a check-in that is somehow itself blocked does
        // not report itself as the barrier.
        expect(firstBlockedAfter("2026-08-10", blocked, "2026-08-20")).toBe(
            "2026-08-11",
        );
    });

    it("returns null when the rest of the window is free", () => {
        expect(firstBlockedAfter("2026-08-13", blocked, "2026-08-20")).toBeNull();
    });

    it("does not look past the horizon", () => {
        expect(firstBlockedAfter("2026-08-05", blocked, "2026-08-09")).toBeNull();
    });

    it("includes the horizon day itself", () => {
        expect(firstBlockedAfter("2026-08-05", blocked, "2026-08-10")).toBe(
            "2026-08-10",
        );
    });
});

describe("selectionHorizon", () => {
    it("is the day after the last booked day", () => {
        expect(
            selectionHorizon(
                [
                    { start: "2026-08-10", end: "2026-08-13" },
                    { start: "2026-09-01", end: "2026-09-05" },
                ],
                "2026-08-01",
            ),
        ).toBe("2026-09-06");
    });

    it("ignores bookings that end before today", () => {
        expect(
            selectionHorizon(
                [{ start: "2026-07-01", end: "2026-07-05" }],
                "2026-08-01",
            ),
        ).toBe("2026-08-02");
    });

    it("is tomorrow when nothing is booked", () => {
        // ⚠️ The JSDoc on this function claims "a year out when nothing is booked". The code
        // does not do that, and this test pins what it actually does. The comment is what
        // looks wrong — firstBlockedAfter has nothing to find past the last booking — but
        // changing either is a separate decision.
        expect(selectionHorizon([], "2026-08-01")).toBe("2026-08-02");
    });
});

describe("parseUsDate", () => {
    it("parses what the text inputs show", () => {
        expect(parseUsDate("08/18/2026")).toBe("2026-08-18");
    });

    it("accepts unpadded month and day", () => {
        expect(parseUsDate("1/5/2026")).toBe("2026-01-05");
    });

    it("trims surrounding whitespace", () => {
        expect(parseUsDate("  08/18/2026  ")).toBe("2026-08-18");
    });

    it("rejects a day the calendar does not have", () => {
        // The round-trip check: Date would silently roll Feb 30 over to March 2.
        expect(parseUsDate("02/30/2026")).toBeNull();
        expect(parseUsDate("04/31/2026")).toBeNull();
    });

    it("accepts Feb 29 only in a leap year", () => {
        expect(parseUsDate("02/29/2028")).toBe("2028-02-29");
        expect(parseUsDate("02/29/2026")).toBeNull();
    });

    it("rejects an impossible month", () => {
        expect(parseUsDate("13/01/2026")).toBeNull();
        expect(parseUsDate("00/01/2026")).toBeNull();
    });

    it("rejects anything that is not MM/DD/YYYY", () => {
        for (const value of [
            "",
            "2026-08-18",
            "08-18-2026",
            "08/18/26",
            "8/18/20267",
            "aa/bb/cccc",
            "08/18",
        ]) {
            expect(parseUsDate(value)).toBeNull();
        }
    });
});

describe("formatUsDate", () => {
    it("reorders the parts without touching Date", () => {
        expect(formatUsDate("2026-08-18")).toBe("08/18/2026");
    });

    it("round-trips through parseUsDate", () => {
        for (const iso of ["2026-01-05", "2026-08-18", "2028-02-29"]) {
            expect(parseUsDate(formatUsDate(iso))).toBe(iso);
        }
    });
});

describe("freeCancellationDeadline", () => {
    it("is the day before check-in", () => {
        expect(freeCancellationDeadline("2026-08-18")).toBe("2026-08-17");
    });

    it("crosses a month boundary", () => {
        expect(freeCancellationDeadline("2026-08-01")).toBe("2026-07-31");
    });
});

describe("withinFreeCancellation", () => {
    const checkIn = "2026-08-18";

    it("is true up to the day before the deadline", () => {
        expect(withinFreeCancellation(checkIn, "2026-08-16")).toBe(true);
        expect(withinFreeCancellation(checkIn, "2026-07-01")).toBe(true);
    });

    it("is false on the deadline day itself", () => {
        // The load-bearing case. Strict `<`, so Aug 17 is already outside the window —
        // the rounding must never promise a refund Airbnb's 3:00 PM rule would refuse.
        expect(withinFreeCancellation(checkIn, "2026-08-17")).toBe(false);
    });

    it("is false on the check-in day, which is still cancellable", () => {
        // No refund, but cancelling is still allowed here — the two rules are separate.
        expect(withinFreeCancellation(checkIn, "2026-08-18")).toBe(false);
    });

    it("crosses a month boundary", () => {
        expect(withinFreeCancellation("2026-08-01", "2026-07-30")).toBe(true);
        expect(withinFreeCancellation("2026-08-01", "2026-07-31")).toBe(false);
    });
});

describe("todayISO", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("reports the viewer's day, not the villas'", () => {
        // The counterpart to propertyTodayISO: this one is client-only and deliberately
        // local. At 17:30 UTC it is already the 3rd in Jakarta (UTC+7), which is what a
        // browser there would compute.
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-02T17:30:00Z"));
        expect(todayISO()).toBe("2026-08-03");
    });
});

describe("propertyTodayISO", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("reports the villas' day, not the server's", () => {
        // Vercel's clock is UTC. At 23:00 UTC on the 2nd it is already 07:00 on the 3rd at
        // the villas (WITA, UTC+8), and that is the day `create_booking` compares check-in
        // against in supabase/migrations/0011_booking_writes.sql. The two must not drift.
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-02T23:00:00Z"));
        expect(propertyTodayISO()).toBe("2026-08-03");
    });

    it("is unaffected by the process timezone", () => {
        // The suite runs in Asia/Jakarta (UTC+7). At 16:30 UTC it is the 2nd in Jakarta and
        // the 3rd at the villas — so a result of the 2nd here would mean the function had
        // silently fallen back to local time.
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-08-02T16:30:00Z"));
        expect(propertyTodayISO()).toBe("2026-08-03");
    });

    it("returns a yyyy-mm-dd string", () => {
        expect(propertyTodayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe("Intl formatters", () => {
    // Thin coverage on purpose: these are one-line Intl wrappers and their exact output can
    // shift with the runtime's ICU version.
    it("formats the shapes the design asks for", () => {
        expect(formatFullDate("2026-08-18")).toBe("Aug 18, 2026");
        expect(formatDayMonth("2026-08-17")).toBe("Aug 17");
        expect(formatMonthYear("2026-08-01")).toBe("August 2026");
        expect(formatWeekdayDate("2026-08-18")).toBe("Tuesday, August 18, 2026");
    });
});
