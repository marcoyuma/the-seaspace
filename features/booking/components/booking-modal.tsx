"use client";

import { useEffect, useRef, useState } from "react";
import {
    CaretLeftIcon,
    CaretRightIcon,
    KeyboardIcon,
} from "@phosphor-icons/react/dist/ssr";

import DateField from "@/features/booking/components/date-field";
import GuestStepper from "@/features/booking/components/guest-stepper";
import MonthCalendar from "@/features/booking/components/month-calendar";
import {
    addMonths,
    formatFullDate,
    nightsBetween,
    startOfMonth,
} from "@/features/booking/lib/dates";
import type { DateSelection, GuestCounts } from "@/features/booking/types";
import HorizontalLine from "@/ui/horizontal-line";

/** Which leg of the range the next calendar click fills. */
export type ActiveLeg = "checkIn" | "checkOut";

/**
 * The one modal: dates and guests together, centred, dismissed by the backdrop or Escape.
 *
 * Stateless about the booking itself — `BookingPanel` owns the selection so it survives
 * closing. The only thing kept here is which month pair is on screen, which is a property
 * of the view and should reset with it.
 *
 * @param today - Today in the viewer's timezone, resolved by the parent after mount.
 * @param blocked - Days already taken, from `expandBlockedDays()`.
 * @param maxSelectable - Cap for the check-out leg, or `null`. See `firstBlockedAfter()`.
 * @param checkoutOnlyDay - The one booked day that may still be chosen as a departure.
 */
export default function BookingModal({
    isOpen,
    onClose,
    stayName,
    location,
    capacity,
    today,
    blocked,
    maxSelectable,
    checkoutOnlyDay,
    selection,
    activeLeg,
    onActiveLegChange,
    onSelectDay,
    onClear,
    guests,
    onGuestsChange,
}: {
    isOpen: boolean;
    onClose: () => void;
    stayName: string;
    location: string;
    capacity: number;
    today: string;
    blocked: Set<string>;
    maxSelectable: string | null;
    checkoutOnlyDay: string | null;
    selection: DateSelection;
    activeLeg: ActiveLeg;
    onActiveLegChange: (leg: ActiveLeg) => void;
    onSelectDay: (day: string) => void;
    onClear: () => void;
    guests: GuestCounts;
    onGuestsChange: (next: GuestCounts) => void;
}) {
    const panelRef = useRef<HTMLDivElement>(null);

    // The left-hand month. The right-hand one is always the next along, so `‹` and `›`
    // move both together.
    const [leftMonth, setLeftMonth] = useState(() => startOfMonth(today));

    // Escape closes it — same pattern as ui/menu-panel.tsx, listener attached only while
    // open so a closed modal is not sitting on every keystroke in the page.
    useEffect(() => {
        if (!isOpen) return;

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    // Move focus into the dialog on open, and stop the page behind it scrolling. Without
    // the first, a keyboard user's focus stays on the CTA underneath and Tab walks the
    // page instead of the calendar.
    useEffect(() => {
        if (!isOpen) return;

        panelRef.current?.focus();

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);

    // Re-centre on today's month each time it opens, so a guest who paged six months
    // ahead and closed does not reopen somewhere they have forgotten about. Adjusted
    // during render rather than in an effect: the corrected month is painted on the
    // first frame instead of one frame after it.
    const [wasOpen, setWasOpen] = useState(isOpen);
    if (isOpen !== wasOpen) {
        setWasOpen(isOpen);
        if (isOpen) setLeftMonth(startOfMonth(today));
    }

    const { checkIn, checkOut } = selection;
    const hasRange = checkIn !== null && checkOut !== null;
    const nights = hasRange ? nightsBetween(checkIn, checkOut) : 0;

    // Nothing behind today is worth showing, and the calendar disables it all anyway.
    const canGoBack = leftMonth > startOfMonth(today);

    return (
        <div
            // Kept mounted rather than conditionally rendered, as ui/menu-panel.tsx does,
            // so the fade plays on the way out as well as in. `inert` while closed keeps
            // the whole subtree out of the tab order and away from screen readers, which
            // `invisible` alone would not guarantee.
            inert={!isOpen}
            onMouseDown={(event) => {
                // `mousedown`, and only when the press LANDED on the backdrop itself: a
                // drag that starts inside the panel bubbles up here too, and closing on
                // that would dismiss the modal every time someone selected text.
                if (event.target === event.currentTarget) onClose();
            }}
            className={`fixed inset-0 z-1150 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-200 ease-out motion-reduce:transition-none sm:p-6 ${
                isOpen
                    ? "opacity-100"
                    : "pointer-events-none invisible opacity-0"
            }`}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={`Select dates and guests for ${stayName}`}
                className={`max-h-full w-full max-w-225 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl transition-transform duration-200 ease-out focus:outline-none motion-reduce:transition-none sm:p-6 md:p-8 ${
                    isOpen ? "scale-100" : "scale-95"
                }`}
            >
                {/* Header. Before a full range exists it invites one; after, it states
                    what was chosen — the swap in the reference design. */}
                <div className="flex flex-wrap items-start justify-between gap-6">
                    <div>
                        <h2 className="text-[28px] leading-tight font-semibold text-black">
                            {hasRange
                                ? `${nights} ${nights === 1 ? "night" : "nights"} in ${location}`
                                : "Select dates"}
                        </h2>
                        <p className="mt-1 text-[16px] font-medium text-black/60">
                            {hasRange
                                ? `${formatFullDate(checkIn)} - ${formatFullDate(checkOut)}`
                                : "Add your travel dates for exact pricing"}
                        </p>
                    </div>

                    <div className="flex w-full max-w-105 gap-2">
                        <DateField
                            label="Check-in"
                            value={checkIn}
                            isActive={activeLeg === "checkIn"}
                            onFocus={() => onActiveLegChange("checkIn")}
                            onCommit={onSelectDay}
                        />
                        <DateField
                            label="Checkout"
                            value={checkOut}
                            isActive={activeLeg === "checkOut"}
                            onFocus={() => onActiveLegChange("checkOut")}
                            onCommit={onSelectDay}
                        />
                    </div>
                </div>

                {/* Calendars. Below `lg` only the left month is shown — see MonthCalendar's
                    own prev/next arrows next to its title, passed only here. The side
                    arrows below stay for `lg`+, where both months are visible and pinned
                    to the outer edges no matter how many rows a month needs. */}
                <div className="mt-8 flex items-start gap-4">
                    <button
                        type="button"
                        disabled={!canGoBack}
                        onClick={() => setLeftMonth(addMonths(leftMonth, -1))}
                        aria-label="Previous month"
                        className="mt-1 hidden size-9 shrink-0 items-center justify-center rounded-full text-black transition-colors duration-150 enabled:cursor-pointer enabled:hover:bg-black/6 disabled:opacity-25 motion-reduce:transition-none lg:flex"
                    >
                        <CaretLeftIcon size={18} aria-hidden />
                    </button>

                    <div className="grid flex-1 grid-cols-1 gap-x-10 lg:grid-cols-2">
                        <MonthCalendar
                            monthStart={leftMonth}
                            today={today}
                            blocked={blocked}
                            selection={selection}
                            maxSelectable={maxSelectable}
                            checkoutOnlyDay={checkoutOnlyDay}
                            onSelectDay={onSelectDay}
                            onPrevMonth={() =>
                                setLeftMonth(addMonths(leftMonth, -1))
                            }
                            onNextMonth={() =>
                                setLeftMonth(addMonths(leftMonth, 1))
                            }
                            canGoPrev={canGoBack}
                        />
                        <div className="hidden lg:block">
                            <MonthCalendar
                                monthStart={addMonths(leftMonth, 1)}
                                today={today}
                                blocked={blocked}
                                selection={selection}
                                maxSelectable={maxSelectable}
                                checkoutOnlyDay={checkoutOnlyDay}
                                onSelectDay={onSelectDay}
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setLeftMonth(addMonths(leftMonth, 1))}
                        aria-label="Next month"
                        className="mt-1 hidden size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-black transition-colors duration-150 hover:bg-black/6 motion-reduce:transition-none lg:flex"
                    >
                        <CaretRightIcon size={18} aria-hidden />
                    </button>
                </div>

                <div className="mt-8">
                    <HorizontalLine />
                </div>

                <div className="mt-8 max-w-105">
                    <GuestStepper
                        guests={guests}
                        capacity={capacity}
                        onChange={onGuestsChange}
                    />
                </div>

                <div className="mt-8">
                    <HorizontalLine />
                </div>

                <div className="mt-6 flex items-center justify-between gap-4">
                    {/* Decorative, exactly as in the reference: it marks the fields above
                        as typeable. Hidden from screen readers, which have the inputs
                        themselves. */}
                    <KeyboardIcon
                        size={24}
                        aria-hidden
                        className="text-black/70"
                    />

                    <div className="flex items-center gap-6">
                        <button
                            type="button"
                            onClick={onClear}
                            className="cursor-pointer text-[16px] font-semibold text-black underline underline-offset-4"
                        >
                            Clear dates
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="cursor-pointer rounded-2xl bg-[#131A2B] px-7 py-3 text-[16px] font-medium text-white transition-opacity duration-150 hover:opacity-85 motion-reduce:transition-none"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
