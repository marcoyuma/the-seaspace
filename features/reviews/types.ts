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

/**
 * One villa's rating, as the detail page and the landing-page preview want it.
 *
 * A villa with no reviews has no summary at all rather than a zero one —
 * `get_stay_rating_summaries()` omits it. `0.00` would render as a number that reads like a
 * bad review, so "absent" is the honest shape for "nobody has rated this yet".
 */
export interface StayRatingSummary {
    /** `stays.slug`, which is also `Stay.id` in features/stays/types.ts. */
    staySlug: string;
    total: number;
    /** Mean rating, unrounded. The component decides the precision. */
    averageRating: number;
}

/**
 * What the review form gets back from `saveStayReview()` / `removeStayReview()`.
 *
 * `errors` + `values` rather than a single message, mirroring `RequestFormState` in
 * features/experience-requests: a rejected rating must not empty the words the guest just
 * typed.
 *
 * Unlike `CheckoutFormState` there IS a success shape here — the modal stays on the page
 * and closes itself, so there is no redirect to stand in for "it worked".
 */
export type ReviewFormState =
    | { ok: true }
    | {
          ok?: false;
          /** A whole-form failure: no session, wrong booking, database refused it. */
          message?: string;
          errors?: { rating?: string; quote?: string };
          /** Echoed back so a single bad field does not clear the other one. */
          values?: { rating?: string; quote?: string };
      }
    | undefined;
