import Link from "next/link";

import Container from "@/ui/container";
import Heading from "@/ui/heading";
import OverlineText from "@/ui/overline-text";
import PillLink from "@/ui/pill-link";
import StayCardPreview from "@/features/stays/components/stay-card-preview";
import Text from "@/ui/text";
import { getFeaturedStaysFresh } from "@/features/stays/actions";
import { getStayRatingSummaries } from "@/features/reviews/actions";
import LinkPendingOverlay from "@/ui/link-pending-overlay";
import Skeleton from "@/ui/skeleton";

// Centralized route reference — avoids magic strings scattered across
// components and keeps navigation targets in one place if routes change.
const STAYS_PAGE_PATH = "/stays";

/**
 * Featured stays on the landing page, flagged by `stays.is_featured` — one source with /stays, so
 * names and photos can't drift. Read UNCACHED, so a newly flagged villa shows on the next request;
 * app/page.tsx's <Suspense> keeps the rest of the page in the static shell.
 */
export default async function StaysPreviewSection() {
    // Parallel: neither read depends on the other. Ratings stay cached — they are an
    // aggregate that only moves when someone posts a review, and that write path already
    // invalidates the tag — while the featured list is read live.
    const [featuredStays, ratingSummaries] = await Promise.all([
        getFeaturedStaysFresh(),
        getStayRatingSummaries(),
    ]);

    return (
        <Container>
            {/* `aria-labelledby` ties this landmark to its visible heading
                for screen readers, instead of relying on a generic <div>. */}
            <section
                aria-labelledby="stays-preview-heading"
                // Centred on mobile, left-aligned from `md`. `gap-5` is the site-wide intro-to-
                // content gap, roomier than the intro's own 12px (RESPONSIVE-AUDIT.md Bagian F).
                className="flex flex-col items-center gap-5 text-center md:items-start md:text-left"
            >
                {/* `gap-3` is the site-wide intro spacing (RESPONSIVE-AUDIT.md Bagian F); its own
                    wrapper, so the section's `gap-5` only spaces it from the card grid. */}
                <div className="w-full flex flex-col items-center gap-3 md:items-start">
                    <OverlineText>Rooms and suites</OverlineText>
                    <Heading>Sea Escape</Heading>

                    <div className="w-full flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
                        {/* `width="narrow"`: the default 513px cap never binds on
                            mobile, so this paragraph would just follow the
                            container instead of holding a measure of its own. */}
                        <Text width="narrow">
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
                </div>

                {/* Grid keeps the gap fixed, as in ServiceAndAmenitiesPreview. `w-full` is load-
                    bearing: under `items-center` the grid shrinks to min-content, and the cards (just
                    an absolute `fill` image) have zero intrinsic width, so they silently vanished. */}
                <div className="w-full grid grid-cols-1 gap-6 md:grid-cols-2">
                    {featuredStays.map((stay) => (
                        // Each card links to its real stay via the slug.
                        <Link
                            key={stay.id}
                            href={`${STAYS_PAGE_PATH}/${stay.id}`}
                            // `relative` is what LinkPendingOverlay positions against.
                            className="relative block"
                        >
                            <StayCardPreview
                                imageSrc={stay.imageSrc}
                                villaNameText={stay.name}
                                locationText={stay.location}
                                // `stay.id` IS the slug column — see
                                // features/stays/types.ts. `undefined` for a villa with no
                                // reviews, which hides the chip rather than showing a zero.
                                ratingAverage={
                                    ratingSummaries.get(stay.id)?.averageRating
                                }
                            />
                            <LinkPendingOverlay />
                        </Link>
                    ))}
                </div>
            </section>
        </Container>
    );
}

/**
 * <Suspense> fallback for `StaysPreviewSection`, exported so app/page.tsx can use it without
 * duplicating the intro block. Only the card grid is skeletonized — the intro (overline,
 * heading, copy, CTA) is static copy, not data, so it renders immediately either way.
 */
export function StaysPreviewSectionFallback() {
    return (
        <Container>
            <section
                aria-labelledby="stays-preview-heading"
                className="flex flex-col items-center gap-5 text-center md:items-start md:text-left"
            >
                <div className="w-full flex flex-col items-center gap-3 md:items-start">
                    <OverlineText>Rooms and suites</OverlineText>
                    <Heading>Sea Escape</Heading>

                    <div className="w-full flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
                        <Text width="narrow">
                            Each stay is crafted with intention, finished with
                            elegance, and designed to feel like a home away from
                            home surrounded by ocean breeze.
                        </Text>

                        <PillLink
                            href={STAYS_PAGE_PATH}
                            variant="outline"
                            className="shrink-0"
                        >
                            Explore stays
                        </PillLink>
                    </div>
                </div>

                {/* Two placeholders at StayCardPreview's `aspect-3/2`, mirroring both overlay forms
                    (pills below `md`, one bar above) — keep in sync with stay-card-preview.tsx. */}
                <div className="w-full grid grid-cols-1 gap-6 md:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                        <div key={index} className="relative w-full aspect-3/2">
                            <Skeleton className="h-full w-full rounded-[20px]" />

                            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-x-3 md:hidden">
                                <div className="h-10 w-3/5 rounded-[20px] bg-white sm:h-12" />
                                <div className="size-10 shrink-0 rounded-full bg-white sm:size-12" />
                            </div>

                            <div className="absolute inset-x-3 bottom-3 hidden min-h-12 rounded-[20px] bg-white md:block" />
                        </div>
                    ))}
                </div>
            </section>
        </Container>
    );
}
