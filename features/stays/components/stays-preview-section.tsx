import Container from "@/ui/container";
import Heading from "@/ui/heading";
import OverlineText from "@/ui/overline-text";
import PillLink from "@/ui/pill-link";
import StayCardPreview from "@/features/stays/components/stay-card-preview";
import Text from "@/ui/text";
import stay1 from "@/public/villas/villa1/stay1.jpg";
import stay4 from "@/public/villas/villa4/luxury-holiday-home-2.jpg";
import { StaticImageData } from "next/image";

/**
 * Represents a single stay/villa entry shown in the homepage preview.
 * Mirrors the subset of fields required by `StayCard`, decoupled from
 * the card's prop names so this data can later be swapped for an API
 * response without touching the render layer.
 */
interface StayPreview {
    id: string;
    imageSrc: StaticImageData;
    villaName: string;
    location: string;
}

/**
 * Curated subset of stays shown on the landing page.
 *
 * This is intentionally NOT the full stays catalog — only a hand-picked
 * preview is shown here to drive users toward the "Explore stays" CTA,
 * where the complete (and access-gated) listing lives.
 *
 * TODO: move to CMS / API once stay management is handed off to non-dev users.
 */
const FEATURED_STAYS: StayPreview[] = [
    {
        id: "tuscan-twilight-villa-1",
        imageSrc: stay1,
        villaName: "Tuscan Twilight Villa",
        location: "Ubud, Bali",
    },
    {
        id: "tuscan-twilight-villa-2",
        imageSrc: stay4,
        villaName: "Tuscan Twilight Villa",
        location: "Ubud, Bali",
    },
];

// Centralized route reference — avoids magic strings scattered across
// components and keeps navigation targets in one place if routes change.
const STAYS_PAGE_PATH = "/stays";

export default function StaysPreviewSection() {
    return (
        <Container>
            {/* `aria-labelledby` ties this landmark to its visible heading
                for screen readers, instead of relying on a generic <div>. */}
            <section
                aria-labelledby="stays-preview-heading"
                className="flex flex-col gap-6.5"
            >
                <OverlineText>Rooms and suites</OverlineText>
                <Heading>Sea Escape</Heading>

                <div className="w-full flex justify-between items-start gap-6">
                    <Text>
                        Each stay is crafted with intention, finished with
                        elegance, and designed to feel like a home away from
                        home surrounded by ocean breeze.
                    </Text>

                    {/* Navigation, not an in-place action — must be a link
                        (not a <button>) for correct semantics, SEO, and
                        keyboard/middle-click/new-tab behavior out of the box. */}
                    <PillLink
                        href={STAYS_PAGE_PATH}
                        variant="outline"
                        className="shrink-0"
                    >
                        Explore stays
                    </PillLink>
                </div>

                {/* CSS Grid (not flex justify-between) keeps the gap fixed
                    regardless of item count, matching the spacing used in
                    ServiceAndAmenitiesPreview for visual consistency. */}
                <div className="grid grid-cols-2 gap-6">
                    {FEATURED_STAYS.map((stay) => (
                        // `id` is used as key (not array index or villaName)
                        // since two entries currently share the same name —
                        // index/name keys would risk incorrect reconciliation.
                        <StayCardPreview
                            key={stay.id}
                            imageSrc={stay.imageSrc}
                            villaNameText={stay.villaName}
                            locationText={stay.location}
                        />
                    ))}
                </div>
            </section>
        </Container>
    );
}
