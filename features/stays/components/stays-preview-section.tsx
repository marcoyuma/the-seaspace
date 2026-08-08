import Link from "next/link";

import Container from "@/ui/container";
import Heading from "@/ui/heading";
import OverlineText from "@/ui/overline-text";
import PillLink from "@/ui/pill-link";
import StayCardPreview from "@/features/stays/components/stay-card-preview";
import Text from "@/ui/text";
import { getFeaturedStays } from "@/features/stays/api";

// Centralized route reference — avoids magic strings scattered across
// components and keeps navigation targets in one place if routes change.
const STAYS_PAGE_PATH = "/stays";

/**
 * Curated subset of stays on the landing page, driving users toward the "Explore stays" CTA.
 *
 * The selection lives in the database (`stays.is_featured`), not in this file. It used to be
 * a hardcoded array that had drifted out of sync with the catalogue — both entries were
 * labelled "Tuscan Twilight Villa" while showing photos of two different villas. Reading
 * from the same source as /stays removes that failure mode entirely.
 *
 * Async Server Component: the query is cached and revalidated by the shared policy in
 * lib/supabase.ts, so this costs the landing page nothing per request.
 */
export default async function StaysPreviewSection() {
    const featuredStays = await getFeaturedStays();

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
                    {featuredStays.map((stay) => (
                        // The card looked clickable (cursor-pointer, zoom on hover) but went
                        // nowhere while the catalogue was hardcoded. Now that each entry is a
                        // real stay, the slug gives it somewhere to go.
                        <Link key={stay.id} href={`${STAYS_PAGE_PATH}/${stay.id}`}>
                            <StayCardPreview
                                imageSrc={stay.imageSrc}
                                villaNameText={stay.name}
                                locationText={stay.location}
                            />
                        </Link>
                    ))}
                </div>
            </section>
        </Container>
    );
}
