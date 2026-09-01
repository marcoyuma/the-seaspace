import { Suspense } from "react";
import Link from "next/link";

import { getStaysFresh } from "@/features/stays/actions";
import Container from "@/ui/container";
import SectionHeading from "@/ui/section-heading";
import StayCard from "@/features/stays/components/stay-card";
import StayCardSkeleton from "@/features/stays/components/stay-card-skeleton";
import LinkPendingOverlay from "@/ui/link-pending-overlay";

export const metadata = {
    title: "Stays",
};

// Cards drawn while the catalogue query is in flight. Six fills the fold on a laptop at
// `sm:grid-cols-2` without inventing a scrollbar the real grid may not need.
const SKELETON_CARD_COUNT = 6;

// One grid definition, used by both the real grid and its fallback: the two must break to
// one column at the same width, or the placeholder stops predicting the layout it replaces.
const GRID_CLASSES = "grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2";

/**
 * The catalogue itself. Reads the uncached query, so this component is the request-time
 * hole in an otherwise static page — everything outside the <Suspense> below is prerendered.
 */
async function StaysGrid() {
    const stays = await getStaysFresh();

    return (
        <div className={GRID_CLASSES}>
            {stays.map((stay) => (
                // `relative` is what LinkPendingOverlay positions against; it confirms
                // the click on a cold connection, where the prefetch has not landed yet.
                <Link
                    key={stay.id}
                    href={`/stays/${stay.id}`}
                    className="relative block"
                >
                    <StayCard
                        imageSrc={stay.imageSrc}
                        name={stay.name}
                        location={stay.location}
                        pricePerNight={stay.pricePerNight}
                        capacity={stay.capacity}
                        beds={stay.beds}
                        area={stay.area}
                        isNew={stay.isNew}
                    />
                    <LinkPendingOverlay />
                </Link>
            ))}
        </div>
    );
}

function StaysGridFallback() {
    return (
        <div className={GRID_CLASSES}>
            {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
                <StayCardSkeleton key={index} />
            ))}
        </div>
    );
}

/**
 * Sync on purpose. The heading is fixed copy, so under `cacheComponents` the prerenderer
 * lifts this whole shell into static HTML and only the grid waits on Supabase — the guest
 * sees the page immediately, and the list that streams in behind it is never stale.
 */
export default function Page() {
    return (
        <Container>
            <SectionHeading
                title="Allow us to guide you to your suite"
                description="Every bedroom in our Grade-II listed Mansion and contemporary West Wing has been given the luxury treatment. So no matter where you lay your head, sink-into-me sheets and a king-size bed come as standard."
            />

            <Suspense fallback={<StaysGridFallback />}>
                <StaysGrid />
            </Suspense>
        </Container>
    );
}
