import ReviewCarousel from "@/features/reviews/components/review-carousel";
import type { Review, ReviewStats } from "@/features/reviews/types";

/**
 * The body of the reviews section: the carousel, and the aggregate figures under it.
 *
 * A Server Component wrapping a client one — only ReviewCarousel and what it imports cross
 * the boundary, so this layout and the stats row cost the browser no JavaScript.
 *
 * @param reviews - The carousel slice (newest few), not the whole table.
 * @param stats - Aggregates over *every* review, which is why the count here is larger than
 * `reviews.length`.
 */
export default function ReviewsPanel({
    reviews,
    stats,
}: {
    reviews: Review[];
    stats: ReviewStats;
}) {
    return (
        <div className="flex flex-col justify-center items-center gap-6.5">
            <ReviewCarousel reviews={reviews} />

            <div className="flex flex-row justify-evenly items-center border rounded-[20px] border-black/10 w-161 px-6.5 py-4.75">
                {/* Locale pinned rather than left to the runtime: an implicit
                    locale can format differently on server and client and trip
                    a hydration mismatch once the count reaches four digits. */}
                <StatItem
                    value={stats.total.toLocaleString("en-US")}
                    label="Reviews"
                />
                {/* vertical line as divider */}
                <div className="w-px h-[51px] bg-black/10" />
                <StatItem
                    value={stats.averageRating.toFixed(2)}
                    label="Ratings"
                />
                {/* vertical line as divider */}
                <div className="w-px h-[51px] bg-black/10" />
                {/* Replaces the old "Reply rate", which had no data behind it —
                    there is no owner-reply concept in the schema. "% rated 4 or
                    better" is computed from the same rows as the other two. */}
                <StatItem
                    value={`${Math.round(stats.recommendRate * 100)}%`}
                    label="Recommend"
                />
            </div>
        </div>
    );
}

function StatItem({ value, label }: { value: string; label: string }) {
    return (
        <div>
            <h3 className="font-semibold text-[24px] tracking-[0.5%]">
                {value}
            </h3>
            <span className="text-black/50">{label}</span>
        </div>
    );
}
