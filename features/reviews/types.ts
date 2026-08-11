/**
 * One guest review, as the render layer wants it.
 *
 * Deliberately not a mirror of the database row: the DB uses snake_case and prefixes the
 * author columns (`author_display_name`), because there it has to coexist with a future
 * `guest_id`. features/reviews/actions.ts owns that translation, so the schema can change
 * without rippling into components.
 */
export interface Review {
    id: number;
    /** Short public form, e.g. "Amara L." — never the guest's full legal name. */
    displayName: string;
    /** Nationality ("Swedish"), not a city. The card's second line. */
    nationality: string;
    /** Whole stars, 1–5. Drives how many `StarIcon`s are rendered. */
    rating: number;
    quote: string;
    /**
     * Slug of the villa reviewed. Absent for a general testimonial that names no stay —
     * `reviews.stay_id` is nullable.
     */
    stayId?: string;
}

/**
 * Aggregate figures for the stats row under the carousel.
 *
 * Computed over every review, not just the eight the carousel shows — the count is meant to
 * describe the property, not the slice on screen.
 */
export interface ReviewStats {
    total: number;
    /** Mean of all ratings, unrounded. The component decides the precision. */
    averageRating: number;
    /** Share of reviews rated 4 or better, 0–1. */
    recommendRate: number;
}
