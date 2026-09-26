import { STAY_REVIEWS_PREVIEW_SIZE } from "@/features/reviews/actions";
import type { Review, StayRatingSummary } from "@/features/reviews/types";
import RatingSummary from "@/features/reviews/components/rating-summary";
import StayReviewItem from "@/features/reviews/components/stay-review-item";
import StayReviewsModal from "@/features/reviews/components/stay-reviews-modal";
import Heading from "@/ui/heading";
import HorizontalLine from "@/ui/horizontal-line";
import OverlineText from "@/ui/overline-text";

/**
 * A villa's reviews: a grid of the newest few plus a dialog with the rest. A pure view of props, not
 * self-fetching like `ReviewsSection`: the prerendered page already awaits its reads together, and a
 * nested async component would need its own <Suspense> for no gain (as with `StayInfoSection`).
 *
 * @param reviews - Newest first; the first `STAY_REVIEWS_PREVIEW_SIZE` show on the page, all in the modal.
 * @param summary - The villa's aggregate rating, or `undefined` when nobody has rated it.
 */
export default function StayReviewsSection({
    stayName,
    reviews,
    summary,
}: {
    stayName: string;
    reviews: Review[];
    summary?: StayRatingSummary;
}) {
    // Nothing to show and nothing to say about it — the same call ReviewsSection makes on
    // the landing page: a page is better off without the section than with an empty box.
    // Also guards the `summary` access below, since a villa with reviews always has one.
    if (reviews.length === 0 || !summary) return null;

    const preview = reviews.slice(0, STAY_REVIEWS_PREVIEW_SIZE);

    // The modal only ever holds what was actually fetched. `summary.total` counts every row
    // in the database, so the two disagree once a villa passes the page's fetch ceiling —
    // and promising "all 60" while showing 50 would be the worse half of that.
    const hasMore = reviews.length > preview.length;

    return (
        <section aria-labelledby="stay-reviews-heading" className="pt-10">
            {/* Left-aligned, unlike the landing page's centered ReviewsHeader: this page is
                left-aligned throughout (breadcrumb, h1, price), so centering one section
                would break the column. */}
            <div className="flex flex-col gap-3">
                <OverlineText>Reviews</OverlineText>

                <Heading id="stay-reviews-heading">
                    What guests said
                </Heading>

                <RatingSummary
                    average={summary.averageRating}
                    total={summary.total}
                />
            </div>

            <div className="mt-8">
                <HorizontalLine />
            </div>

            {/* Same gaps as StayInfoSection's grid on this page, so the two blocks share a
                rhythm instead of each inventing one. */}
            <ul className="mt-10 grid grid-cols-1 gap-x-16 gap-y-10 md:grid-cols-2">
                {preview.map((review) => (
                    <StayReviewItem key={review.id} review={review} />
                ))}
            </ul>

            {hasMore && (
                <div className="mt-10 flex">
                    <StayReviewsModal
                        triggerLabel={`Show all ${reviews.length} reviews`}
                        label={`Reviews for ${stayName}`}
                    >
                        <h2 className="text-[24px] leading-tight font-semibold text-black">
                            {stayName}
                        </h2>

                        <RatingSummary
                            average={summary.averageRating}
                            total={summary.total}
                            className="mt-2"
                        />

                        {/* One column: the dialog is narrower and `ui/modal.tsx` scrolls itself.
                            `divide-y`, not <HorizontalLine> — StayReviewItem is the <li>, so a
                            separator wrapper would nest <li>s. */}
                        <ul className="mt-8 flex flex-col divide-y divide-black/10">
                            {reviews.map((review) => (
                                <StayReviewItem
                                    key={review.id}
                                    review={review}
                                    className="py-6 first:pt-0 last:pb-0"
                                />
                            ))}
                        </ul>
                    </StayReviewsModal>
                </div>
            )}
        </section>
    );
}
