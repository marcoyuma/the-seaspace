"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

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
 * @param onPrevMonth,@param onNextMonth - Only passed for the one month visible below
 * `lg`, where the two side arrows in BookingModal are hidden for lack of room. Rendered
 * here, next to the month title, and hidden again at `lg` so they do not duplicate those
 * side arrows once the second month reappears.
 */
export default function MonthCalendar({
    monthStart,
    today,
    blocked,
    selection,
    maxSelectable,
    checkoutOnlyDay,
    onSelectDay,
    onPrevMonth,
    onNextMonth,
    canGoPrev = true,
}: {
    monthStart: string;
    today: string;
    blocked: Set<string>;
    selection: DateSelection;
    maxSelectable: string | null;
    checkoutOnlyDay: string | null;
    onSelectDay: (day: string) => void;
    onPrevMonth?: () => void;
    onNextMonth?: () => void;
    canGoPrev?: boolean;
}) {
    const { checkIn, checkOut } = selection;

    return (
        <div>
            <div className="flex items-center justify-between">
                {onPrevMonth && (
                    <button
                        type="button"
                        disabled={!canGoPrev}
                        onClick={onPrevMonth}
                        aria-label="Previous month"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-black transition-colors duration-150 enabled:cursor-pointer enabled:hover:bg-black/6 disabled:opacity-25 motion-reduce:transition-none lg:hidden"
                    >
                        <CaretLeftIcon size={16} aria-hidden />
                    </button>
                )}

                <h3 className="flex-1 text-center text-[16px] font-semibold text-black">
                    {formatMonthYear(monthStart)}
                </h3>

                {onNextMonth && (
                    <button
                        type="button"
                        onClick={onNextMonth}
                        aria-label="Next month"
                        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-black transition-colors duration-150 hover:bg-black/6 motion-reduce:transition-none lg:hidden"
                    >
                        <CaretRightIcon size={16} aria-hidden />
                    </button>
                )}
            </div>

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
                                    // Smaller below `sm`: 7 columns of the desktop
                                    // size-11 (44px) do not fit the modal's mobile
                                    // width — see BookingModal's responsive padding.
                                    "mx-auto flex size-10 items-center justify-center rounded-full text-[16px] transition-colors duration-150 motion-reduce:transition-none sm:size-11",
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
