import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

import type { Stay } from "@/features/stays/types";
import type { BookedRange } from "@/features/booking/types";
import type { StayRatingSummary } from "@/features/reviews/types";
import AmenitiesPanel from "@/features/stays/components/amenities-panel";
import BookingPanel from "@/features/booking/components/booking-panel";
import RatingSummary from "@/features/reviews/components/rating-summary";
import { idr } from "@/lib/format";
import HorizontalLine from "@/ui/horizontal-line";

/** Uppercase field label sitting above a hairline, e.g. "CAPACITY". */
function SpecField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <h3 className="text-[16px] font-medium tracking-[0.03em] text-black/40 uppercase">
                {label}
            </h3>

            <div className="mt-3.5">
                <HorizontalLine />
            </div>

            <p className="mt-4 text-[16px] font-semibold text-black">{value}</p>
        </div>
    );
}

/**
 * The block beneath the image rail: breadcrumb, headline, description and
 * booking CTA on the left; the expandable amenities panel on the right.
 * Server Component — only the panels need interactivity.
 *
 * @param bookedRanges - Availability for this villa, from `getStayBookedRanges()`.
 * Fetched by the page and threaded through rather than read here, so this stays a pure
 * view of props like the rest of the stays components.
 * @param ratingSummary - This villa's aggregate rating, or `undefined` when nobody has
 * rated it yet. Threaded from the page for the same reason `bookedRanges` is.
 */
export default function StayInfoSection({
    stay,
    bookedRanges,
    ratingSummary,
}: {
    stay: Stay;
    bookedRanges: BookedRange[];
    ratingSummary?: StayRatingSummary;
}) {
    return (
        <div className="grid grid-cols-1 gap-x-16 gap-y-10 pt-10 lg:grid-cols-2">
            <div>
                <nav
                    aria-label="Breadcrumb"
                    className="flex items-center gap-2 text-[16px]"
                >
                    <Link href="/stays" className="text-black hover:underline">
                        All villas
                    </Link>
                    <CaretRightIcon
                        size={14}
                        weight="bold"
                        aria-hidden
                        className="text-black/30"
                    />
                    <span className="font-medium text-black/60">{stay.name}</span>
                </nav>

                <h1 className="font-semibold mt-4 text-[48px] leading-none text-black">
                    {stay.name}
                </h1>

                {/* Same price treatment as the listing card (muted, semibold),
                    but at 20px so it reads as the headline's subtitle rather than
                    as body copy — 48/20 keeps a clear step while staying paired. */}
                <p className="mt-3 text-[24px] tracking-normal font-semibold text-black/50">
                    {idr.format(stay.pricePerNight)} / night
                </p>

                {/* Price and rating are the two numbers people decide on, so both sit as
                    subtitles under the h1 — `mt-3` matches the gap from the h1 to the price,
                    which makes the three lines read as one block.

                    Absent entirely for a villa nobody has rated. Not "0 reviews" and not
                    "No rating yet": the same call ReviewsSection makes when the table is
                    empty, and a 0.00 average would read as a bad review rather than as no
                    reviews. */}
                {ratingSummary && (
                    <RatingSummary
                        average={ratingSummary.averageRating}
                        total={ratingSummary.total}
                        className="mt-3"
                    />
                )}

                <p className="mt-6 max-w-140 text-[16px] leading-[1.6] font-medium text-black/60">
                    {stay.description}
                </p>

                {/* capacity/beds/area are the only spec numbers the DB actually
                    validates (`stays_capacity_pos`), so the detail page renders
                    those directly instead of admin-typed free text. */}
                <div className="mt-6 grid grid-cols-3 gap-x-6">
                    <SpecField label="Capacity" value={`${stay.capacity} Guests`} />
                    <SpecField label="Beds" value={`${stay.beds}`} />
                    <SpecField label="Area" value={`${stay.area} m²`} />
                </div>

                {/* Replaces the old link to /stays/{slug}/book, which never existed as a
                    route. Picking dates happens here, in a modal, rather than on a
                    second page. */}
                <BookingPanel
                    // `Stay.id` IS the slug column — see features/stays/types.ts.
                    staySlug={stay.id}
                    stayName={stay.name}
                    location={stay.location}
                    capacity={stay.capacity}
                    pricePerNight={stay.pricePerNight}
                    discountPerNight={stay.discountPerNight}
                    bookedRanges={bookedRanges}
                />
            </div>

            <AmenitiesPanel amenities={stay.amenities} />
        </div>
    );
}
