import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { getAuthUser } from "@/features/auth/actions";
import { getGuestBooking } from "@/features/booking/actions";
import { getOwnBookingReview } from "@/features/reviews/actions";
import ReviewPrompt from "@/features/reviews/components/review-prompt";
import ArrivalInstructions from "@/features/booking/components/arrival-instructions";
import BookingStatusBadge from "@/features/booking/components/booking-status-badge";
import CancelBookingDialog from "@/features/booking/components/cancel-booking-dialog";
import { paymentMethodLabel } from "@/features/booking/lib/payment-methods";
import type { BookingStatus, GuestBooking } from "@/features/booking/types";
import {
    formatDayMonth,
    formatFullDate,
    freeCancellationDeadline,
    propertyTodayISO,
    withinFreeCancellation,
} from "@/features/booking/lib/dates";
import { idr } from "@/lib/format";
import HorizontalLine from "@/ui/horizontal-line";

export const metadata = { title: "Your reservation" };

/**
 * The page's opening line, one per state.
 *
 * A `Record` rather than a chain of ternaries so adding a sixth status is a compile error
 * here instead of a page that silently greets a cancelled booking with "You're booked".
 */
const HEADINGS: Record<BookingStatus, string> = {
    confirmed: "You're booked",
    checked_in: "Welcome in",
    checked_out: "Thanks for staying",
    cancelled: "Reservation cancelled",
    no_show: "This stay went unused",
};

/**
 * What cancelling this reservation costs, as one sentence for the dialog.
 *
 * Formatted here rather than in the dialog so no money formatter reaches the browser —
 * the same reason `ReviewPrompt` is handed an already-formatted date range.
 */
function cancelConsequence(booking: GuestBooking, isRefundable: boolean): string {
    if (!booking.paidAt) {
        return "Nothing was charged for this reservation, so there is nothing to refund. The nights go back on the market straight away.";
    }

    if (!isRefundable) {
        return "This is inside 24 hours of check-in, so there is no refund. The nights still go back on the market.";
    }

    return `Cancelling now refunds the full ${idr.format(booking.totalPrice)}. The nights go back on the market straight away.`;
}

/** A label/value line, same typography as the booking summary on the stay page. */
function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-6">
            <span className="text-[16px] font-medium text-black/60">
                {label}
            </span>
            <span className="text-[16px] font-semibold text-black tabular-nums">
                {value}
            </span>
        </div>
    );
}

/**
 * One reservation. Also the page a guest lands on straight after paying.
 *
 * The back link is all there is to prerender — the heading itself depends on the booking's
 * status. This route has no `generateStaticParams()`, so even `params` is request-time data
 * under Cache Components and has to be awaited inside the boundary below. `params` is
 * therefore passed down un-awaited, the same way /login hands `searchParams` to its form.
 */
export default function TripPage({
    params,
}: {
    params: Promise<{ bookingId: string }>;
}) {
    return (
        <div className="mx-auto w-full max-w-4xl px-6 py-24">
            <Link
                href="/account/trips"
                className="text-[16px] font-medium text-black/60 underline underline-offset-4 transition-opacity duration-300 ease-out hover:opacity-60 motion-reduce:transition-none"
            >
                ← All trips
            </Link>

            <Suspense fallback={<TripDetailFallback />}>
                <TripDetail params={params} />
            </Suspense>
        </div>
    );
}

/**
 * The reservation itself.
 *
 * No ownership check is written here and none belongs here: `getGuestBooking()` reads
 * through the "guests read their own bookings" policy, so somebody else's id returns
 * `null` and becomes a 404 — indistinguishable from an id that never existed, which is
 * what stops this page from being a way to enumerate other people's bookings.
 *
 * Every number below comes from the row's own snapshot columns, never from the catalogue.
 * A villa's price may have changed since; this reservation's did not.
 */
async function TripDetail({
    params,
}: {
    params: Promise<{ bookingId: string }>;
}) {
    const { bookingId } = await params;

    const user = await getAuthUser();
    if (!user) redirect(`/login?next=/account/trips/${bookingId}`);

    // `bookings.id` is a bigint identity column, so anything non-numeric cannot be a
    // booking. Rejected here rather than sent to PostgREST as a malformed filter.
    const id = Number(bookingId);
    if (!Number.isInteger(id) || id < 1) notFound();

    const booking = await getGuestBooking(id);
    if (!booking) notFound();

    const nightlyAfterDiscount =
        booking.pricePerNight - booking.discountPerNight;

    // Two different windows, and they close on different days. `start_date < today` is this
    // codebase's definition of "past", so the arrival day itself is still cancellable.
    const today = propertyTodayISO();
    const isCancellable =
        booking.status === "confirmed" && booking.checkIn >= today;
    const isRefundable =
        isCancellable && withinFreeCancellation(booking.checkIn, today);

    // Only a completed stay may be reviewed, and 'checked_out' is the one status that means
    // it: 0013's hourly job writes it, and that job is forbidden from writing 'checked_in'
    // because a calendar cannot know whether anybody walked through the door. 'no_show' is
    // excluded on purpose — paid for, but there is no experience to rate.
    //
    // Read only when it can matter. `getOwnBookingReview()` is uncached (it reads cookies),
    // so skipping it for the other four statuses skips a round trip on most page loads.
    // `upsert_stay_review` re-checks the same rule with SB017 regardless — this decides what
    // is rendered, not what is permitted.
    const canReview = booking.status === "checked_out";
    const ownReview = canReview ? await getOwnBookingReview(id) : null;

    return (
        <>
            <div className="mt-8 flex flex-wrap items-start justify-between gap-6">
                <h1 className="text-[48px] leading-none font-semibold text-black">
                    {HEADINGS[booking.status]}
                </h1>
                <BookingStatusBadge
                    status={booking.status}
                    paidAt={booking.paidAt}
                />
            </div>

            {/* The unpaid-but-confirmed case. Reachable when the process died between
                create_booking() and settle_booking_payment() — a real provider's
                "pending" state, and the one thing on this page a guest may need to
                chase. */}
            {booking.status === "confirmed" && !booking.paidAt && (
                <p className="mt-6 max-w-160 rounded-2xl border border-amber-600/25 bg-amber-50 px-5 py-4 text-[15px] text-amber-900">
                    These dates are held for you, but the payment was never
                    confirmed. On a live site a provider webhook would resolve
                    this within minutes.
                </p>
            )}

            <section className="mt-14 flex gap-6 rounded-3xl border border-black/10 p-8">
                {booking.image && (
                    <div className="relative size-30 shrink-0 overflow-hidden rounded-2xl">
                        <Image
                            src={booking.image.src}
                            alt={booking.image.alt}
                            fill
                            sizes="120px"
                            placeholder={
                                booking.image.blurDataURL ? "blur" : "empty"
                            }
                            blurDataURL={booking.image.blurDataURL}
                            className="object-cover"
                        />
                    </div>
                )}

                <div>
                    <Link
                        href={`/stays/${booking.staySlug}`}
                        className="text-[24px] leading-tight font-semibold text-black underline-offset-4 hover:underline"
                    >
                        {booking.stayName}
                    </Link>
                    <p className="mt-1 text-[16px] font-medium text-black/60">
                        {booking.stayLocation}
                    </p>
                    <p className="mt-4 text-[16px] font-semibold text-black">
                        {formatFullDate(booking.checkIn)} –{" "}
                        {formatFullDate(booking.checkOut)}
                    </p>
                    <p className="mt-1 text-[16px] font-medium text-black/60">
                        {booking.nights}{" "}
                        {booking.nights === 1 ? "night" : "nights"} ·{" "}
                        {booking.numGuests}{" "}
                        {booking.numGuests === 1 ? "guest" : "guests"}
                    </p>
                    {/* Check-in and check-out times are a property-wide policy rather
                        than per-booking data, which is why 0009 stores dates and not
                        timestamps. Stated here so the exclusive end date reads as
                        turnover instead of a missing night. */}
                    <p className="mt-4 text-[16px] font-medium text-black/60">
                        Check in from 3:00 PM, check out by 11:00 AM.
                    </p>
                </div>
            </section>

            <section
                aria-labelledby="payment-heading"
                className="mt-8 rounded-3xl border border-black/10 p-8"
            >
                <h2
                    id="payment-heading"
                    className="text-[20px] font-semibold text-black"
                >
                    What you paid
                </h2>

                <div className="mt-6 flex flex-col gap-3">
                    <Row
                        label={`${idr.format(booking.pricePerNight)} × ${booking.nights} ${
                            booking.nights === 1 ? "night" : "nights"
                        }`}
                        value={idr.format(
                            booking.pricePerNight * booking.nights,
                        )}
                    />
                    {booking.discountPerNight > 0 && (
                        <Row
                            label="Discount"
                            value={`−${idr.format(
                                booking.discountPerNight * booking.nights,
                            )}`}
                        />
                    )}
                </div>

                <div className="my-5">
                    <HorizontalLine />
                </div>

                <div className="flex items-baseline justify-between gap-6">
                    <span className="text-[16px] font-semibold text-black">
                        Total
                    </span>
                    <span className="text-[20px] font-semibold text-black tabular-nums">
                        {idr.format(booking.totalPrice)}
                    </span>
                </div>

                {/* What was paid with, and the receipt it produced. Both are NULL on the
                    140 seeded rows, whose `paid_at` records a payment that never happened
                    — so this block is absent rather than inventing a method for it. */}
                {booking.paymentMethod && (
                    <div className="mt-5 flex flex-col gap-3 border-t border-black/10 pt-5">
                        <Row
                            label="Paid with"
                            value={paymentMethodLabel(booking.paymentMethod)}
                        />
                        {booking.paymentReference && (
                            <Row
                                label="Reference"
                                value={booking.paymentReference}
                            />
                        )}
                        {booking.cancelledAt && (
                            <Row
                                label="Cancelled on"
                                value={formatFullDate(
                                    booking.cancelledAt.slice(0, 10),
                                )}
                            />
                        )}
                        {booking.refundReference && (
                            <Row
                                label="Refund reference"
                                value={booking.refundReference}
                            />
                        )}
                    </div>
                )}

                <p className="mt-4 text-[16px] font-medium text-black/60">
                    {/* The rate is the row's own snapshot, so it stays true even after the
                        villa's price changes. */}
                    Charged at {idr.format(nightlyAfterDiscount)} per night, the
                    rate on the day you booked. This was a simulated payment —
                    no money moved.
                </p>

                {/* Absent rather than disabled once the window closes, for the same reason
                    the review prompt below is: the badge already says where this stands. */}
                {isCancellable && (
                    <div className="mt-6 border-t border-black/10 pt-6">
                        <CancelBookingDialog
                            bookingId={booking.id}
                            consequence={cancelConsequence(
                                booking,
                                isRefundable,
                            )}
                            deadlineNote={
                                isRefundable
                                    ? `Free cancellation applies before ${formatDayMonth(
                                          freeCancellationDeadline(
                                              booking.checkIn,
                                          ),
                                      )}.`
                                    : null
                            }
                        />
                    </div>
                )}
            </section>

            <ArrivalInstructions booking={booking} />

            {/* Absent entirely for a stay that is not finished, rather than a disabled
                button: the status badge at the top of this page already says what state the
                reservation is in, and a dead control adds nothing to that. */}
            {canReview && (
                <ReviewPrompt
                    bookingId={booking.id}
                    stayName={booking.stayName}
                    // Formatted here so the client component ships no date formatter — the
                    // same reason every other date on this page is formatted server-side.
                    dateRange={`${formatFullDate(booking.checkIn)} – ${formatFullDate(
                        booking.checkOut,
                    )}`}
                    existing={ownReview}
                />
            )}

            {booking.guestNotes && (
                <section
                    aria-labelledby="notes-heading"
                    className="mt-8 rounded-3xl border border-black/10 p-8"
                >
                    <h2
                        id="notes-heading"
                        className="text-[20px] font-semibold text-black"
                    >
                        Your note to the villa team
                    </h2>
                    <p className="mt-4 text-[16px] font-medium whitespace-pre-line text-black/60">
                        {booking.guestNotes}
                    </p>
                </section>
            )}

            <p className="mt-8 text-[16px] font-medium text-black/60">
                Booking #{booking.id}, made on{" "}
                {formatFullDate(booking.createdAt.slice(0, 10))}.
                {isRefundable && (
                    <>
                        {" "}
                        Free cancellation before{" "}
                        {formatDayMonth(
                            freeCancellationDeadline(booking.checkIn),
                        )}
                        .
                    </>
                )}
            </p>
        </>
    );
}

/** Stands in for the heading, the villa card and the payment panel while they load. */
function TripDetailFallback() {
    return (
        <div aria-hidden>
            <div className="mt-8 h-12 w-96 max-w-full rounded bg-black/5" />
            <div className="mt-14 h-46 rounded-3xl border border-black/10 bg-black/3" />
            <div className="mt-8 h-72 rounded-3xl border border-black/10 bg-black/3" />
        </div>
    );
}
