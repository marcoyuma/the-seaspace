import Image from "next/image";
import Link from "next/link";

import BookingSummary from "@/features/booking/components/booking-summary";
import type { GuestCounts } from "@/features/booking/types";
import type { Stay } from "@/features/stays/types";

/**
 * Checkout's right column: the villa and its price. ⚠️ A *quote*, not a record — `create_booking`
 * snapshots prices from `stays` at insert time, and the database's copy counts. Never make the
 * write path trust anything rendered here.
 *
 * @param stay The villa, already fetched by the page.
 * @param checkIn Arrival, `yyyy-mm-dd`.
 * @param checkOut Departure — exclusive, as everywhere else in this feature.
 */
export default function CheckoutRecap({
    stay,
    checkIn,
    checkOut,
    guests,
}: {
    stay: Stay;
    checkIn: string;
    checkOut: string;
    guests: GuestCounts;
}) {
    return (
        <aside
            aria-labelledby="recap-heading"
            className="rounded-3xl border border-black/10 p-8"
        >
            <h2 id="recap-heading" className="sr-only">
                Your reservation
            </h2>

            <div className="flex items-start gap-5">
                <div className="relative size-25 shrink-0 overflow-hidden rounded-2xl">
                    <Image
                        src={stay.imageSrc.src}
                        alt={stay.imageSrc.alt}
                        fill
                        // Fixed 100px box, so the optimizer never needs a wider source.
                        sizes="100px"
                        placeholder={stay.imageSrc.blurDataURL ? "blur" : "empty"}
                        blurDataURL={stay.imageSrc.blurDataURL}
                        className="object-cover"
                    />
                </div>

                <div>
                    <Link
                        href={`/stays/${stay.id}`}
                        className="text-[20px] leading-tight font-semibold text-black underline-offset-4 hover:underline"
                    >
                        {stay.name}
                    </Link>
                    <p className="mt-1 text-[16px] font-medium text-black/60">
                        {stay.location}
                    </p>
                </div>
            </div>

            {/* The same priced block the stay page shows under the picker, so the guest
                is reading a number they have already seen rather than a new one. */}
            <BookingSummary
                checkIn={checkIn}
                checkOut={checkOut}
                guests={guests}
                pricePerNight={stay.pricePerNight}
                discountPerNight={stay.discountPerNight}
            />

            <Link
                href={`/stays/${stay.id}`}
                className="mt-8 inline-block text-[16px] font-medium text-black underline underline-offset-4"
            >
                Change dates or guests
            </Link>
        </aside>
    );
}
