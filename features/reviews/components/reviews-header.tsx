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
        // `gap-3` (12px) between overline/heading — the site-wide intro-
        // block spacing. `mb-5` (20px) from heading to the reviews panel
        // that follows, a bit more room than the 12px used inside the
        // block itself — see RESPONSIVE-AUDIT.md Bagian F.
        <div className="flex flex-col justify-center items-center gap-3 mb-5">
            <OverlineText>Reviews</OverlineText>
            <Heading id="reviews-heading" className="text-center">
                Read our guests thought
            </Heading>
        </div>
    );
}
