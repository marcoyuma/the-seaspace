import Heading from "@/ui/heading";
import OverlineText from "@/ui/overline-text";

/**
 * Eyebrow + heading for the reviews section.
 *
 * The `id` feeds the section's `aria-labelledby`, so the landmark is announced by its
 * visible title rather than as an unnamed region.
 */
export default function ReviewsHeader() {
    return (
        <div className="flex flex-col justify-center items-center gap-6.5 mb-17.5">
            <OverlineText>Reviews</OverlineText>
            <Heading id="reviews-heading">Read our guests thought</Heading>
        </div>
    );
}
