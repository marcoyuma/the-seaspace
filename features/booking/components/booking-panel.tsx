"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import BookingModal, {
    type ActiveLeg,
} from "@/features/booking/components/booking-modal";
import BookingSummary from "@/features/booking/components/booking-summary";
import {
    expandBlockedDays,
    firstBlockedAfter,
    selectionHorizon,
    todayISO,
} from "@/features/booking/lib/dates";
import type {
    BookedRange,
    DateSelection,
    GuestCounts,
} from "@/features/booking/types";
import PillButton from "@/ui/pill-button";

const NO_DATES: DateSelection = { checkIn: null, checkOut: null };
const ONE_ADULT: GuestCounts = { adults: 1, children: 0, infants: 0, pets: 0 };

// The clock is an external system, so useSyncExternalStore is the right hook for reading
// it — and the only one that can legally return a DIFFERENT value on the server than in
// the browser, which is exactly what is needed here (see `useToday` below). Nothing ever
// notifies, so the subscribe function hands back a no-op unsubscribe; it must be a stable
// reference or React would resubscribe on every render.
const neverChanges = () => () => {};

/**
 * Today in the viewer's timezone, or `null` while rendering on the server.
 *
 * The detail page is prerendered, so a date computed during render would be frozen at
 * build time and would also disagree with the browser's clock at hydration — two
 * different bugs with the same cause. `null` on the server, the real day after
 * hydration, and no effect needed to get there.
 */
function useToday(): string | null {
    return useSyncExternalStore(neverChanges, todayISO, () => null);
}

/**
 * The CTA, the summary it produces, and the modal behind it.
 *
 * The single client entry point for booking: `stay-info-section.tsx` stays a Server
 * Component and only has to render this. All the state lives here rather than in the
 * modal so a selection survives closing it.
 *
 * ⚠️ Nothing is written. `Reserve` is deliberately inert — see the note beside it.
 *
 * @param bookedRanges - From `getStayBookedRanges()`. `end` is exclusive.
 */
export default function BookingPanel({
    stayName,
    location,
    capacity,
    pricePerNight,
    discountPerNight,
    bookedRanges,
    className = "",
}: {
    stayName: string;
    location: string;
    capacity: number;
    pricePerNight: number;
    discountPerNight: number;
    bookedRanges: BookedRange[];
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [selection, setSelection] = useState<DateSelection>(NO_DATES);
    const [guests, setGuests] = useState<GuestCounts>(ONE_ADULT);
    const [activeLeg, setActiveLeg] = useState<ActiveLeg>("checkIn");

    // `null` on the server and for the first paint. Invisible either way: the modal
    // starts closed and the summary starts empty.
    const today = useToday();

    const blocked = useMemo(() => expandBlockedDays(bookedRanges), [bookedRanges]);

    // The furthest the "next booked day" scan needs to look. Derived from the data, so a
    // villa with nothing booked does not send the scan off into an unbounded loop.
    const horizon = useMemo(
        () => (today ? selectionHorizon(bookedRanges, today) : null),
        [bookedRanges, today],
    );

    // The first taken day after the chosen arrival. It doubles as two rules: nothing
    // beyond it may be picked, and it alone may be picked as a departure.
    const nextBlocked =
        selection.checkIn && !selection.checkOut && horizon
            ? firstBlockedAfter(selection.checkIn, blocked, horizon)
            : null;

    /**
     * One entry point for both the calendar and the typed date fields, so they cannot
     * disagree about what a click means.
     *
     * Restarting the range is the default: any day at or before the current arrival, and
     * any day once a full range already exists, begins a new selection. Only a day after
     * an arrival that is still waiting for a departure completes one.
     */
    function selectDay(day: string) {
        if (!today || day < today) return;

        const { checkIn, checkOut } = selection;

        // Completing a range. `day <= nextBlocked` rather than `<`: departing ON the day
        // the next booking starts is the turnover case, and every day between the
        // arrival and nextBlocked is free by that variable's definition.
        if (
            checkIn !== null &&
            checkOut === null &&
            day > checkIn &&
            (nextBlocked === null || day <= nextBlocked)
        ) {
            setSelection({ checkIn, checkOut: day });
            setActiveLeg("checkIn");
            return;
        }

        // Everything else starts a new range: a day at or before the current arrival, a
        // day past the next booking, or the first click of all. Chosen over clamping to
        // some nearby legal date, which would silently book dates nobody picked.
        //
        // An arrival, unlike a departure, can never be on a taken day.
        if (blocked.has(day)) return;

        setSelection({ checkIn: day, checkOut: null });
        setActiveLeg("checkOut");
    }

    function clearDates() {
        setSelection(NO_DATES);
        setActiveLeg("checkIn");
    }

    const { checkIn, checkOut } = selection;
    const hasRange = checkIn !== null && checkOut !== null;

    return (
        <div className={className}>
            {checkIn !== null && checkOut !== null && (
                <BookingSummary
                    checkIn={checkIn}
                    checkOut={checkOut}
                    guests={guests}
                    pricePerNight={pricePerNight}
                    discountPerNight={discountPerNight}
                />
            )}

            <div className="mt-10">
                {hasRange ? (
                    <>
                        {/* Disabled on purpose. There is no INSERT policy on `bookings`
                            and no checkout flow, so an enabled Reserve would be a button
                            that silently does nothing — worse than one that says so.
                            Enable it the moment the write path lands. */}
                        <PillButton variant="gradient" disabled>
                            Reserve
                        </PillButton>
                        <p className="mt-3 text-[15px] text-black/40">
                            Reservations aren&apos;t live yet — this is a preview of the
                            booking flow.
                        </p>
                    </>
                ) : (
                    <PillButton
                        variant="gradient"
                        onClick={() => setIsOpen(true)}
                        aria-expanded={isOpen}
                    >
                        Book room
                    </PillButton>
                )}

                {hasRange && (
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="mt-3 block cursor-pointer text-[16px] font-medium text-black underline underline-offset-4"
                    >
                        Edit dates and guests
                    </button>
                )}
            </div>

            {/* `today` gates the whole modal: every date decision inside it needs one,
                and there is nothing to show before the CTA has been clicked anyway. */}
            {today && horizon && (
                <BookingModal
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    stayName={stayName}
                    location={location}
                    capacity={capacity}
                    today={today}
                    blocked={blocked}
                    maxSelectable={nextBlocked}
                    checkoutOnlyDay={nextBlocked}
                    selection={selection}
                    activeLeg={activeLeg}
                    onActiveLegChange={setActiveLeg}
                    onSelectDay={selectDay}
                    onClear={clearDates}
                    guests={guests}
                    onGuestsChange={setGuests}
                />
            )}
        </div>
    );
}
