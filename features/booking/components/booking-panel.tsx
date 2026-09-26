"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import BookingModal, {
    type ActiveLeg,
} from "@/features/booking/components/booking-modal";
import BookingSummary from "@/features/booking/components/booking-summary";
import { buildCheckoutUrl } from "@/features/booking/lib/checkout-params";
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
import PillLink from "@/ui/pill-link";

const NO_DATES: DateSelection = { checkIn: null, checkOut: null };
const ONE_ADULT: GuestCounts = { adults: 1, children: 0, infants: 0, pets: 0 };

// The clock is an external system, and useSyncExternalStore alone may return a DIFFERENT server
// value (see `useToday`). Nothing notifies, so subscribe returns a stable no-op unsubscribe.
const neverChanges = () => () => {};

/**
 * Today in the viewer's timezone, or `null` on the server — a render-time date on this prerendered
 * page would freeze at build time and mismatch hydration. No effect needed.
 */
function useToday(): string | null {
    return useSyncExternalStore(neverChanges, todayISO, () => null);
}

/**
 * The CTA, its summary and the modal — booking's single client entry, so `stay-info-section.tsx`
 * stays a Server Component. State lives here so a selection survives closing the modal. `Reserve`
 * hands off to /stays/{slug}/book through the URL; nothing is written from here.
 *
 * @param staySlug - `stays.slug`, which is also the `/stays/[stayId]` segment.
 * @param bookedRanges - From `getStayBookedRanges()`. `end` is exclusive.
 */
export default function BookingPanel({
    staySlug,
    stayName,
    location,
    capacity,
    pricePerNight,
    discountPerNight,
    bookedRanges,
    className = "",
}: {
    staySlug: string;
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
     * One entry point for calendar clicks and typed dates, so they agree on what a click means.
     * Only a day after an arrival still awaiting its departure completes a range; else it restarts.
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

        // Anything else starts a new range — not clamped to a nearby legal date, which would
        // silently book dates nobody picked. An arrival can never be on a taken day.
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
                        {/* A link, not a button: the selection lives in the URL, so checkout can be
                            reopened, bookmarked or reloaded (lib/checkout-params.ts — untrusted there). */}
                        <PillLink
                            href={buildCheckoutUrl(
                                staySlug,
                                checkIn,
                                checkOut,
                                guests,
                            )}
                            variant="gradient"
                        >
                            Reserve
                        </PillLink>
                        <p className="mt-3 text-[16px] font-medium text-black/60">
                            You won&apos;t be charged — checkout is simulated.
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
