"use client";

import {
    formatMonthYear,
    formatWeekdayDate,
    monthGrid,
} from "@/features/booking/lib/dates";
import type { DateSelection } from "@/features/booking/types";

// Sunday-first, matching the reference design. Single letters repeat (S/T/S), so the
// visible label is decorative and the real name goes in the column header's aria-label.
const WEEKDAYS = [
    { short: "S", long: "Sunday" },
    { short: "M", long: "Monday" },
    { short: "T", long: "Tuesday" },
    { short: "W", long: "Wednesday" },
    { short: "T", long: "Thursday" },
    { short: "F", long: "Friday" },
    { short: "S", long: "Saturday" },
];

/**
 * One month of the date-range picker. Rendered twice side by side.
 *
 * Owns no state: every decision about what is selectable arrives as props, so the two
 * months cannot disagree about the same day.
 *
 * @param monthStart - Any day in the month to render.
 * @param today - Today in the viewer's timezone. Passed in, never computed here — see
 * the note on `todayISO()` about prerendering.
 * @param blocked - Days already taken, from `expandBlockedDays()`.
 * @param maxSelectable - Last day that may be chosen as a check-out, or `null` for no
 * limit. Set once a check-in exists so a range cannot span someone else's booking.
 * @param checkoutOnlyDay - A booked day that may nevertheless be chosen as a check-out,
 * because leaving on the morning someone else arrives is normal turnover. See the note
 * where it is used.
 */
export default function MonthCalendar({
    monthStart,
    today,
    blocked,
    selection,
    maxSelectable,
    checkoutOnlyDay,
    onSelectDay,
}: {
    monthStart: string;
    today: string;
    blocked: Set<string>;
    selection: DateSelection;
    maxSelectable: string | null;
    checkoutOnlyDay: string | null;
    onSelectDay: (day: string) => void;
}) {
    const { checkIn, checkOut } = selection;

    return (
        <div>
            <h3 className="text-center text-[18px] font-semibold text-black">
                {formatMonthYear(monthStart)}
            </h3>

            <div className="mt-6 grid grid-cols-7 gap-y-2">
                {WEEKDAYS.map((weekday, index) => (
                    <abbr
                        // Index, not the letter: three of the seven repeat.
                        key={index}
                        title={weekday.long}
                        className="pb-2 text-center text-[13px] font-medium text-black/60 no-underline"
                    >
                        {weekday.short}
                    </abbr>
                ))}

                {monthGrid(monthStart).map((day, index) => {
                    if (!day) return <div key={`blank-${index}`} />;

                    const isPast = day < today;

                    // A booked day is normally unselectable — except the FIRST one after
                    // a chosen arrival. `end_date` is exclusive, so departing on the
                    // morning the next guest arrives is same-day turnover, not a clash
                    // (0009 spells this out). Refusing it would quietly cost a night at
                    // every boundary.
                    const isCheckoutOnly = day === checkoutOnlyDay;
                    const isBooked = blocked.has(day) && !isCheckoutOnly;

                    // The cap only applies forward of the arrival. Clicking a day
                    // *before* the current check-in restarts the range from there, which
                    // has to stay possible even when the cap sits between them.
                    const isBeyondCap =
                        checkIn !== null &&
                        !checkOut &&
                        maxSelectable !== null &&
                        day > checkIn &&
                        day > maxSelectable;

                    const isDisabled = isPast || isBooked || isBeyondCap;

                    const isEndpoint = day === checkIn || day === checkOut;
                    const isBetween =
                        checkIn !== null &&
                        checkOut !== null &&
                        day > checkIn &&
                        day < checkOut;

                    return (
                        <div
                            key={day}
                            // The band behind the middle of a range is painted on the
                            // cell, not the button: the button is a circle, so a fill on
                            // it would leave gaps between days instead of a continuous
                            // strip.
                            className={isBetween ? "bg-black/3" : undefined}
                        >
                            <button
                                type="button"
                                disabled={isDisabled}
                                onClick={() => onSelectDay(day)}
                                aria-label={formatWeekdayDate(day)}
                                aria-pressed={isEndpoint}
                                className={[
                                    "mx-auto flex size-11 items-center justify-center rounded-full text-[16px] transition-colors duration-150 motion-reduce:transition-none",
                                    isDisabled
                                        ? // Struck through rather than merely greyed:
                                          // this is the only affordance telling a guest
                                          // that a date is taken as opposed to simply
                                          // dim, and it is what the reference design uses.
                                          "cursor-not-allowed text-black/25 line-through"
                                        : "cursor-pointer font-medium text-black hover:bg-black/6",
                                    isEndpoint
                                        ? "bg-[#131A2B] font-medium text-white hover:bg-[#131A2B]"
                                        : "",
                                ].join(" ")}
                            >
                                {Number(day.slice(-2))}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
