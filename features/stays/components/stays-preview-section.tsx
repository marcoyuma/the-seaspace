import Link from "next/link";

import Container from "@/ui/container";
import Heading from "@/ui/heading";
import OverlineText from "@/ui/overline-text";
import PillLink from "@/ui/pill-link";
import StayCardPreview from "@/features/stays/components/stay-card-preview";
import Text from "@/ui/text";
import { getFeaturedStays } from "@/features/stays/actions";

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
 *
 * Still needs a <Suspense> boundary in app/page.tsx despite that caching: `"use cache"` lives
 * on `getFeaturedStays()`, not on this component, so from the prerenderer's point of view this
 * is an ordinary async component awaiting a promise — not something it can inline into the
 * static shell on its own.
 */
export default async function StaysPreviewSection() {
    const featuredStays = await getFeaturedStays();

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
                    {/* `ui/heading.tsx`'s default `text-[48px]` is flat across
                        every breakpoint. Landing-page headings are pinned to a
                        single 36px instead of scaling per breakpoint — see
                        RESPONSIVE-AUDIT.md Bagian F. `!` forces this to win over
                        that default (same-specificity utility clashes are
                        otherwise decided by Tailwind's generation order, not
                        source position — see `faq-section.tsx`'s `!font-normal`
                        for the same pattern already in use elsewhere). */}
                    <Heading classname="!text-[36px]">Sea Escape</Heading>

                    <div className="w-full flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
                        {/* `ui/text.tsx`'s default `max-w-128.25` (513px) never
                            binds below that width, so on mobile this paragraph
                            just wraps at whatever width `Container` leaves —
                            i.e. it "follows" the container instead of having a
                            width of its own. Every `<Text>` needs a DIFFERENT
                            cap depending on its own copy length, so this can't
                            live in the shared default; `!` overrides it here
                            for this specific paragraph. */}
                        <Text classname="!max-w-70 sm:!max-w-96 md:!max-w-105 lg:!max-w-128.25">
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
                        >
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
                    <Heading classname="!text-[36px]">Sea Escape</Heading>

                    <div className="w-full flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-between">
                        <Text classname="!max-w-70 sm:!max-w-96 md:!max-w-105 lg:!max-w-128.25">
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

                {/* Two placeholder cards, same aspect ratio as StayCardPreview, so the grid
                    doesn't jump in height once real cards stream in. */}
                <div className="w-full grid grid-cols-1 gap-6 md:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                        <div
                            key={index}
                            className="w-full aspect-600/570 rounded-[20px] bg-black/5 animate-pulse"
                        />
                    ))}
                </div>
            </section>
        </Container>
    );
}
