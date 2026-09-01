import Container from "@/ui/container";
import Heading from "@/ui/heading";
import OverlineText from "@/ui/overline-text";
import ServiceCard from "@/features/services/components/service-card";
import Text from "@/ui/text";
import spaImg from "@/public/leisure/spa/bed-with-sea-view.jpg";
import eventVenueImg from "@/public/leisure/event-hall/event-venue.jpg";
import golfCourseImg from "@/public/leisure/golf-course/golf-course.jpg";
import { StaticImageData } from "next/image";

/**
 * Represents a single service/amenity entry shown in the homepage preview.
 * Decoupled from `ServiceCard`'s prop names so this data can later be
 * swapped for an API response without touching the render layer.
 */
interface ServicePreview {
    id: string;
    imageSrc: StaticImageData;
    serviceName: string;
    bookButtonText: string;
}

/**
 * Full list of bookable services, shown in their entirety on the landing
 * page (unlike `FEATURED_STAYS`, nothing is hidden here — see business
 * rationale: all three services are transactional and don't require an
 * extra "Explore all services" navigation step).
 *
 * TODO: move to CMS / API once service management is handed off to non-dev users.
 */
const FEATURED_SERVICES: ServicePreview[] = [
    {
        id: "spa-and-wellness",
        imageSrc: spaImg,
        serviceName: "Spa & Wellness",
        bookButtonText: "Book spa",
    },
    {
        id: "event-venue",
        imageSrc: eventVenueImg,
        // Was "Spa & Wellness" — a copy-paste typo from the design handoff,
        // since confirmed by product. The wrong label became visible once
        // `/spa` started excluding its own card: a "Spa & Wellness" tile over
        // an event-hall photo made the exclusion look broken.
        serviceName: "Event venue",
        bookButtonText: "Reserve now",
    },
    {
        id: "golf-course",
        imageSrc: golfCourseImg,
        serviceName: "Golf course",
        bookButtonText: "Swing yours",
    },
];

interface ServiceAndAmenitiesPreviewProps {
    /**
     * Omit the service the current page already *is* — e.g. `/spa` passes
     * "spa-and-wellness" so the row cross-sells the other two instead of
     * linking back to itself. Layout follows from the resulting count, so
     * callers state which service they are rather than picking a layout.
     */
    excludeId?: string;
    overline?: string;
    heading?: string;
    description?: string;
}

export default function ServiceAndAmenitiesPreview({
    excludeId,
    overline = "Exclusive Services and Amenities ",
    heading = "Bespoke Horizons",
    description = "Unlock experiences reserved only for those who dream deeply, Golf courses, wellness temples, and venues for your grandest visions.",
}: ServiceAndAmenitiesPreviewProps = {}) {
    const shownServices = excludeId
        ? FEATURED_SERVICES.filter((service) => service.id !== excludeId)
        : FEATURED_SERVICES;

    // The full trio leads the landing page (above the fold); a filtered pair
    // only ever appears further down an interior page, so it shouldn't preload.
    const isFullSet = shownServices.length === FEATURED_SERVICES.length;

    return (
        <Container>
            {/* `aria-labelledby` ties this landmark to its visible heading
                for screen readers, instead of relying on a generic <div>. */}
            <section
                aria-labelledby="services-preview-heading"
                // The cross-sell row on interior pages (`!isFullSet`) is
                // always centered, at every breakpoint, as a centred outro.
                // The landing page's full trio (`isFullSet`) is centered
                // only on mobile now (left-aligned felt cramped in a narrow
                // column) and reverts to the original left-aligned layout
                // from `md` up, matching the sections above it.
                className={`flex flex-col gap-5 items-center text-center ${
                    !isFullSet ? "" : "md:items-start md:text-left"
                }`}
            >
                {/* Intro block: `gap-3` (12px) is the site-wide spacing
                    between overline/heading/description — see
                    RESPONSIVE-AUDIT.md Bagian F. Isolated in its own wrapper
                    so the section's `gap-5` above only governs the (slightly
                    larger) gap to the card grid, not the spacing within
                    this block. */}
                <div
                    className={`flex flex-col gap-3 items-center text-center ${
                        !isFullSet ? "" : "md:items-start md:text-left"
                    }`}
                >
                    <OverlineText>{overline}</OverlineText>
                    <Heading id="services-preview-heading">
                        {heading}
                    </Heading>
                    <Text>{description}</Text>
                </div>

                {/* CSS Grid (not flex justify-between) keeps the gap fixed
                    regardless of item count, matching the spacing used in
                    StaysPreviewSection for visual consistency.
                    `w-full` is load-bearing: the parent's `items-center` makes
                    children shrink-to-fit, and fluid ServiceCards are entirely
                    absolutely positioned (0 max-content), so the row would
                    collapse to zero width without an explicit width. */}
                <div
                    // Both branches are written as complete, literal class
                    // strings (not built via `md:${...}` concatenation) —
                    // Tailwind's build-time scanner extracts candidates by
                    // regex over the source text, not by evaluating the
                    // template, so a split prefix/suffix would never match
                    // and the md: variant would silently be dropped.
                    className={`grid w-full grid-cols-1 gap-6 ${
                        isFullSet ? "md:grid-cols-3" : "md:grid-cols-2"
                    }`}
                >
                    {shownServices.map((service) => (
                        // `id` used as key, not the array index — `excludeId`
                        // changes which entries render, so index keys would
                        // reconcile the wrong card into the wrong slot.
                        <ServiceCard
                            key={service.id}
                            imageSrc={service.imageSrc}
                            serviceName={service.serviceName}
                            bookButtonText={service.bookButtonText}
                            fluid={!isFullSet}
                            preload={isFullSet}
                        />
                    ))}
                </div>
            </section>
        </Container>
    );
}
