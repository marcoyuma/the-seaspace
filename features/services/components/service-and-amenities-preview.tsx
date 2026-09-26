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
 * All bookable services — unlike `FEATURED_STAYS`, none hidden: all three are transactional and
 * need no "Explore all" step. TODO: move to a CMS/API once non-developers manage services.
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
     * The service the current page already *is* (e.g. `/spa` passes "spa-and-wellness"), so the
     * row cross-sells the rest. Layout follows from the resulting count.
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

    // The full trio is the landing page's row; a filtered pair is the cross-sell outro on an
    // interior page. Drives layout only — neither is above the fold, so neither preloads.
    const isFullSet = shownServices.length === FEATURED_SERVICES.length;

    return (
        <Container>
            {/* `aria-labelledby` ties this landmark to its visible heading
                for screen readers, instead of relying on a generic <div>. */}
            <section
                aria-labelledby="services-preview-heading"
                // Interior pages' cross-sell pair is always centred; the landing trio is centred
                // only on mobile, left-aligned from `md` like the sections above it.
                className={`flex flex-col gap-5 items-center text-center ${
                    !isFullSet ? "" : "md:items-start md:text-left"
                }`}
            >
                {/* `gap-3` is the site-wide intro spacing (RESPONSIVE-AUDIT.md Bagian F); its own
                    wrapper, so the section's `gap-5` only spaces it from the card grid. */}
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

                {/* Grid keeps the gap fixed at any item count, as in StaysPreviewSection. `w-full` is
                    load-bearing: `items-center` shrinks children to fit, and fluid cards are all
                    absolute (0 max-content), so the row would collapse to zero width. */}
                <div
                    // Complete literal class strings, not `md:${...}`: Tailwind's scanner reads source
                    // text, so a split class would never match and `md:` would silently vanish.
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
                        />
                    ))}
                </div>
            </section>
        </Container>
    );
}
