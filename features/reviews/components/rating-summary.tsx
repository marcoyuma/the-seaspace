import { StarIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * A villa's rating as one line: a single filled star, the average, and the review count.
 *
 * Deliberately NOT five stars with a partial fill. `RatingStars` renders
 * `Array.from({ length: rating })`, which only works for the whole numbers a single review
 * carries — an average is fractional, and rounding 4.5 and 5.0 to the same five stars would
 * flatten the only distinction the number is there to make. One star acts as the unit label
 * and the number carries the precision, which is how Airbnb prints it too.
 *
 * No `"use client"`: no state, no handlers.
 *
 * @param average - Mean rating, unrounded. Printed to two decimals here.
 * @param total - How many reviews the average is over. Omit to print the rating alone,
 *   which is what the landing-page preview card does.
 * @param size - Star size in px. 20 pairs with 16-20px text; the review cards use
 *   `RatingStars` at 24 instead.
 *
 * @example
 * <RatingSummary average={4.66} total={25} />  // ★ 4.66 · 25 reviews
 * <RatingSummary average={4.66} />             // ★ 4.66
 */
export default function RatingSummary({
    average,
    total,
    size = 20,
    className = "",
}: {
    average: number;
    total?: number;
    size?: number;
    className?: string;
}) {
    // Locale pinned rather than left to the runtime, the same reason ReviewsPanel pins it:
    // an implicit locale can format differently on server and client and trip a hydration
    // mismatch once a count reaches four digits.
    const formattedAverage = average.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return (
        <p
            className={`flex items-center gap-1.5 text-[16px] font-semibold text-black ${className}`}
        >
            {/* Same fill as RatingStars, so the site has one star colour rather than two. */}
            <StarIcon weight="fill" fill="#FFC533" size={size} aria-hidden />

            <span className="tabular-nums">{formattedAverage}</span>

            {total !== undefined && (
                <span className="font-medium text-black/60">
                    {" · "}
                    {total.toLocaleString("en-US")}{" "}
                    {total === 1 ? "review" : "reviews"}
                </span>
            )}
        </p>
    );
}
