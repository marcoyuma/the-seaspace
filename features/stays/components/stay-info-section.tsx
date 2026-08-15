import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

import type { Stay } from "@/features/stays/types";
import type { BookedRange } from "@/features/booking/types";
import AmenitiesPanel from "@/features/stays/components/amenities-panel";
import BookingPanel from "@/features/booking/components/booking-panel";
import { idr } from "@/lib/format";
import HorizontalLine from "@/ui/horizontal-line";

/** Uppercase field label sitting above a hairline, e.g. "BED TYPE". */
function SpecField({
    label,
    value,
    note,
}: {
    label: string;
    value: string;
    note?: string;
}) {
    return (
        <div>
            <h3 className="text-[16px] font-medium tracking-[0.03em] text-black/40 uppercase">
                {label}
            </h3>

            <div className="mt-3.5">
                <HorizontalLine />
            </div>

            <p className="mt-4 text-[16px] text-black">{value}</p>
            {note && <p className="mt-1 text-[16px] text-black/40">{note}</p>}
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
 */
export default function StayInfoSection({
    stay,
    bookedRanges,
}: {
    stay: Stay;
    bookedRanges: BookedRange[];
}) {
    return (
        <div className="grid grid-cols-2 gap-x-16 pt-10">
            <div>
                <nav
                    aria-label="Breadcrumb"
                    className="flex items-center gap-2 text-[16px]"
                >
                    <Link href="/stays" className="text-black hover:underline">
                        All rooms
                    </Link>
                    <CaretRightIcon
                        size={14}
                        weight="bold"
                        aria-hidden
                        className="text-black/30"
                    />
                    <span className="text-black/50">{stay.name}</span>
                </nav>

                <h1 className="font-semibold mt-4 text-[48px] leading-none text-black">
                    {stay.name}
                </h1>

                {/* Same price treatment as the listing card (muted, semibold),
                    but at 20px so it reads as the headline's subtitle rather than
                    as body copy — 48/20 keeps a clear step while staying paired. */}
                <p className="mt-3 text-[24px] tracking-[-1%] font-semibold text-black/50">
                    {idr.format(stay.pricePerNight)} / night
                </p>

                <p className="mt-6 max-w-140 text-[16px] leading-[1.6] font-medium text-black/50">
                    {stay.description}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-x-6">
                    <SpecField
                        label="Bed type"
                        value={stay.bedType.label}
                        note={stay.bedType.note}
                    />
                    <SpecField label="Capacity" value={stay.capacityLabel} />
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
