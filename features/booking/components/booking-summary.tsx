import {
    formatDayMonth,
    formatFullDate,
    freeCancellationDeadline,
    nightsBetween,
} from "@/features/booking/lib/dates";
import { guestsBooked, type GuestCounts } from "@/features/booking/types";
import { idr } from "@/lib/format";
import HorizontalLine from "@/ui/horizontal-line";

/** A label/value pair on one line, matching the SpecField typography above it. */
function Row({ label, value }: { label: React.ReactNode; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-6">
            <span className="text-[16px] text-black/50">{label}</span>
            <span className="text-[16px] text-black tabular-nums">{value}</span>
        </div>
    );
}

/**
 * What the guest picked, priced out — sits between the spec fields and the CTA.
 *
 * Not a Client Component: it only renders props. The state lives one level up in
 * `BookingPanel`, so this stays a pure view and can be read as one.
 *
 * ⚠️ Prices are computed from the CATALOGUE here, which is right for a quote. A real
 * booking snapshots them into `bookings.unit_price_per_night` at the moment it is made —
 * see 0009. Do not later "simplify" the write path into re-reading these.
 */
export default function BookingSummary({
    checkIn,
    checkOut,
    guests,
    pricePerNight,
    discountPerNight,
}: {
    checkIn: string;
    checkOut: string;
    guests: GuestCounts;
    pricePerNight: number;
    discountPerNight: number;
}) {
    const nights = nightsBetween(checkIn, checkOut);
    const nightsLabel = `${nights} ${nights === 1 ? "night" : "nights"}`;

    // Same arithmetic as bookings.total_price, which is
    // `(unit_price_per_night - discount_per_night) * num_nights`.
    const subtotal = pricePerNight * nights;
    const discount = discountPerNight * nights;
    const total = subtotal - discount;

    const counted = guestsBooked(guests);
    const guestParts = [`${counted} ${counted === 1 ? "guest" : "guests"}`];
    // Infants are listed but not counted — the same rule the modal's footnote states.
    if (guests.infants > 0) {
        guestParts.push(
            `${guests.infants} ${guests.infants === 1 ? "infant" : "infants"}`,
        );
    }

    return (
        <div className="mt-10 max-w-140">
            <HorizontalLine />

            <div className="mt-5 flex flex-col gap-3">
                <Row
                    label={`${formatFullDate(checkIn)} – ${formatFullDate(checkOut)}`}
                    value={nightsLabel}
                />
                <Row label="Guests" value={guestParts.join(" · ")} />
                <Row
                    label={`${idr.format(pricePerNight)} × ${nightsLabel}`}
                    value={idr.format(subtotal)}
                />
                {discountPerNight > 0 && (
                    <Row label="Discount" value={`−${idr.format(discount)}`} />
                )}
            </div>

            <div className="mt-5">
                <HorizontalLine />
            </div>

            <div className="mt-5 flex items-baseline justify-between gap-6">
                <span className="text-[16px] font-semibold text-black">Total</span>
                <span className="text-[20px] font-semibold text-black tabular-nums">
                    {idr.format(total)}
                </span>
            </div>

            {/* Airbnb's "Flexible" policy, adapted: a full refund if cancelled at least
                24 hours before check-in. The date comes from freeCancellationDeadline(),
                which is where the rule is written down. */}
            <p className="mt-4 text-[16px] text-black/50">
                Free cancellation before{" "}
                <span className="font-medium text-black">
                    {formatDayMonth(freeCancellationDeadline(checkIn))}
                </span>
                . After that, this reservation is non-refundable.
            </p>
        </div>
    );
}
