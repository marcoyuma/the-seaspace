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
 * Curated subset of stays on the landing page, driving users toward the "Explore stays" CTA.
 *
 * The selection lives in the database (`stays.is_featured`), not in this file. It used to be
 * a hardcoded array that had drifted out of sync with the catalogue — both entries were
 * labelled "Tuscan Twilight Villa" while showing photos of two different villas. Reading
 * from the same source as /stays removes that failure mode entirely.
 *
 * Async Server Component reading the UNCACHED featured query, so the strip always reflects
 * what is flagged in the database right now — a villa featured this morning shows up on the
 * next request, not on the next cache expiry. The <Suspense> boundary in app/page.tsx is what
 * makes that free: the rest of the landing page is still prerendered as a static shell, and
 * only this section waits on Supabase.
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
                // Centered on mobile (narrow columns make left-aligned text
                // feel cramped), back to the original left-aligned layout
                // from `md` up. `gap-5` (20px) is the site-wide gap from the
                // intro block (overline/heading/text/CTA) to the actual
                // content below it — a bit more breathing room than the
                // 12px used inside the intro block itself. See
                // RESPONSIVE-AUDIT.md Bagian F.
                className="flex flex-col items-center gap-5 text-center md:items-start md:text-left"
            >
                {/* Intro block: `gap-3` (12px) is the site-wide spacing
                    between overline/heading/text+CTA — see
                    RESPONSIVE-AUDIT.md Bagian F. Isolated in its own wrapper
                    so the section's `gap-5` above only governs the gap to
                    the card grid, not the spacing within this block. */}
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

                {/* CSS Grid (not flex justify-between) keeps the gap fixed
                    regardless of item count, matching the spacing used in
                    ServiceAndAmenitiesPreview for visual consistency.
                    `w-full` is load-bearing: the parent `<section>` is a
                    flex column with `items-center` (only switching to
                    `items-start` at `md:`), so without an explicit width
                    this grid shrinks to its own min-content instead of
                    stretching to the section's width. Each card's only
                    content is an absolutely-positioned `next/image fill`,
                    which contributes zero intrinsic width — so the
                    `minmax(0,1fr)` columns collapsed to 0px and the whole
                    grid (and every stay card in it) silently disappeared. */}
                <div className="w-full grid grid-cols-1 gap-6 md:grid-cols-2">
                    {featuredStays.map((stay) => (
                        // The card looked clickable (cursor-pointer, zoom on hover) but went
                        // nowhere while the catalogue was hardcoded. Now that each entry is a
                        // real stay, the slug gives it somewhere to go.
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

                {/* Two placeholder cards, same `aspect-3/2` as StayCardPreview, so the grid
                    doesn't jump in height once real cards stream in. The inner blocks stand
                    in for the card's floating info overlay, mirroring both of its forms:
                    two separate pills below `md`, one wide bar from `md` up. Keep these in
                    sync with stay-card-preview.tsx. */}
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
