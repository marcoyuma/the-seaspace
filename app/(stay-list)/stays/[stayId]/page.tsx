import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getStay, getStays } from "@/features/stays/actions";
import { getStayBookedRanges } from "@/features/booking/actions";
import {
    getStayRatingSummaries,
    getStayReviews,
} from "@/features/reviews/actions";
import Container from "@/ui/container";
import Skeleton from "@/ui/skeleton";
import StayImageCarousel, {
    FRAME_HEIGHT_CLASSES,
    FRAME_WIDTH_CLASSES,
} from "@/features/stays/components/stay-image-carousel";
import StayInfoSection from "@/features/stays/components/stay-info-section";
import StayLocationSection from "@/features/stays/components/stay-location-section";
import StayReviewsSection from "@/features/reviews/components/stay-reviews-section";

/**
 * How many of a villa's reviews this page loads.
 *
 * A ceiling, not a page size: the first six are rendered in the grid and the whole lot fills
 * the "show all" dialog, so one fetch serves both. The seed averages 25 per villa, which
 * leaves real headroom.
 *
 * Past this number the dialog stops being "all reviews". `get_stay_reviews` already takes
 * an offset for that day; the honest fix then is pagination inside the dialog, not a bigger
 * constant here.
 */
const STAY_REVIEWS_LIMIT = 50;

// Prerenders every stay at build time. `stay.id` is the `slug` column, so the URLs stay
// human-readable. Runs at BUILD time, which means the Supabase env vars must exist in the
// build environment (Vercel project settings), not just .env.local.
export async function generateStaticParams() {
    const stays = await getStays();
    return stays.map((stay) => ({ stayId: stay.id }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ stayId: string }>;
}): Promise<Metadata> {
    const { stayId } = await params;
    const stay = await getStay(stayId);

    return {
        title: stay ? `${stay.name}, ${stay.location}` : "Stay not found",
        description: stay?.description,
    };
}

/**
 * Stands in for the whole villa while it loads: an image rail and the first rows of the
 * block beneath it. Mirrors the carousel's own frame sizing so the swap does not shift.
 */
function StayDetailFallback() {
    return (
        <>
            <div className={`relative w-full overflow-hidden ${FRAME_HEIGHT_CLASSES}`}>
                {/* Three frames, same as the carousel's internal placeholder — enough to
                    read as a rail without outrunning the viewport. */}
                <div className="flex h-full w-max gap-6">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton
                            key={index}
                            className={`h-full ${FRAME_WIDTH_CLASSES} shrink-0 rounded-xl`}
                        />
                    ))}
                </div>
            </div>

            <Container>
                {/* Matches StayInfoSection's two-column grid and its spacing, so the
                    headline lands where the placeholder put it. */}
                <div className="grid grid-cols-1 gap-x-16 gap-y-10 pt-10 lg:grid-cols-2">
                    <div className="flex flex-col gap-4">
                        <Skeleton className="h-5 w-48 rounded-full" />
                        <Skeleton className="h-12 w-full max-w-140 rounded-lg" />
                        <Skeleton className="h-24 w-full rounded-lg" />
                    </div>
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
            </Container>
        </>
    );
}

/**
 * Sync on purpose, and it does NOT await `params`.
 *
 * `generateStaticParams()` below only covers the villas that existed at build time, so a
 * newer slug makes `params` request-time data. Under `cacheComponents` awaiting it here
 * would put a runtime read above every boundary and block the whole document — the
 * "Runtime data was accessed outside of <Suspense>" error. Passing the promise down
 * un-awaited keeps the shell prerenderable, the same shape `book/page.tsx` uses.
 */
export default function Page({
    params,
}: {
    params: Promise<{ stayId: string }>;
}) {
    return (
        <Suspense fallback={<StayDetailFallback />}>
            <StayDetail params={params} />
        </Suspense>
    );
}

/** The villa itself: every read this route makes, and everything they render. */
async function StayDetail({ params }: { params: Promise<{ stayId: string }> }) {
    // `params` is a Promise in Next 16 — synchronous access was removed.
    const { stayId } = await params;

    // In parallel: the four reads are independent, and they sit on different cache profiles
    // — availability is cached in minutes against the catalogue's hours, and the two review
    // reads carry their own tag so a posted review does not drop the catalogue. Folding any
    // of them into getStay() would flatten those differences.
    const [stay, bookedRanges, ratingSummaries, reviews] = await Promise.all([
        getStay(stayId),
        getStayBookedRanges(stayId),
        getStayRatingSummaries(),
        getStayReviews(stayId, STAY_REVIEWS_LIMIT),
    ]);

    // A slug with no stay also has no bookings and no reviews, so the wasted calls above
    // cost one round-trip on a 404 — cheaper than serialising the reads on every real page.
    if (!stay) notFound();

    // `undefined` for a villa nobody has rated: getStayRatingSummaries() omits those rather
    // than returning zeros. Both consumers treat it as "render no rating".
    const ratingSummary = ratingSummaries.get(stayId);

    return (
        <>
            {/* Sits outside Container so the rail runs edge to edge. */}
            <StayImageCarousel images={stay.gallery} />

            <Container>
                <StayInfoSection
                    stay={stay}
                    bookedRanges={bookedRanges}
                    ratingSummary={ratingSummary}
                />

                <StayLocationSection stay={stay} />
                <StayReviewsSection
                    stayName={stay.name}
                    reviews={reviews}
                    summary={ratingSummary}
                />
            </Container>
        </>
    );
}
