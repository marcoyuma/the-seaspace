import { StarIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * Kept out of the base class list rather than left to a caller's `className`: that prop is
 * concatenated, not merged, so a `text-*` passed in would clash with a baked-in one at equal
 * specificity. Same reasoning as `SIZE` in `ui/heading.tsx`.
 */
const TEXT = {
    default: "text-[16px]",
    // Matches CHIP_SIZE's ramp, so the star line sits at the chip's own type size.
    chip: "text-[14px] sm:text-[16px]",
} as const;

/**
 * A villa's rating on one line: one star, the average, the count. Not five partial stars —
 * `RatingStars` draws whole numbers only, and rounding would erase what an average distinguishes;
 * one star as the unit and the number as the precision, like Airbnb.
 *
 * @param average - Mean rating, unrounded. Printed to two decimals here.
 * @param total - Review count; omit to print the rating alone (the landing preview card does).
 * @param size - Star px, an SVG attribute so not responsive; 20 pairs with 16–20px text.
 * @param textScale - `"chip"` shrinks the line on phones for `StayCardPreview`'s chip; see `TEXT`.
 *
 * @example <RatingSummary average={4.66} total={25} /> // ★ 4.66 · 25 reviews
 */
export default function RatingSummary({
    average,
    total,
    size = 20,
    textScale = "default",
    className = "",
}: {
    average: number;
    total?: number;
    size?: number;
    textScale?: keyof typeof TEXT;
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
            className={`flex items-center gap-1.5 ${TEXT[textScale]} font-semibold text-black ${className}`}
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
