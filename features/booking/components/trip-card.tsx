import Image from "next/image";
import Link from "next/link";

import BookingStatusBadge from "@/features/booking/components/booking-status-badge";
import { formatFullDate } from "@/features/booking/lib/dates";
import type { GuestBooking } from "@/features/booking/types";
import { idr } from "@/lib/format";

/**
 * One reservation in the `/account/trips` list.
 *
 * The whole card is a link to the reservation, not to the villa: from this page a guest is
 * looking for *their booking*, and the villa is one click further in. A card with two
 * competing links would make the target ambiguous for keyboard and screen-reader users.
 *
 * @param booking Already scoped to the signed-in guest by RLS — see `getGuestBookings()`.
 */
export default function TripCard({ booking }: { booking: GuestBooking }) {
    return (
        <li>
            <Link
                href={`/account/trips/${booking.id}`}
                className="flex gap-6 rounded-3xl border border-black/10 p-6 transition-colors duration-300 ease-out motion-reduce:transition-none hover:border-black/30"
            >
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

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h3 className="text-[20px] leading-tight font-semibold text-black">
                                {booking.stayName}
                            </h3>
                            <p className="mt-1 text-[16px] text-black/50">
                                {booking.stayLocation}
                            </p>
                        </div>

                        <BookingStatusBadge
                            status={booking.status}
                            paidAt={booking.paidAt}
                        />
                    </div>

                    <p className="mt-4 text-[16px] text-black">
                        {formatFullDate(booking.checkIn)} –{" "}
                        {formatFullDate(booking.checkOut)}
                        <span className="text-black/40">
                            {" · "}
                            {booking.nights}{" "}
                            {booking.nights === 1 ? "night" : "nights"}
                            {" · "}
                            {booking.numGuests}{" "}
                            {booking.numGuests === 1 ? "guest" : "guests"}
                        </span>
                    </p>

                    <p className="mt-1 text-[16px] font-semibold text-black tabular-nums">
                        {idr.format(booking.totalPrice)}
                    </p>
                </div>
            </Link>
        </li>
    );
}
