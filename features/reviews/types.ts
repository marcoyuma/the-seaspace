/**
 * One review as the render layer wants it — not the DB row (snake_case, `author_*` prefixes);
 * features/reviews/actions.ts owns the translation.
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
 * One villa's rating. Unrated villas have no summary at all (the RPC omits them) — 0.00 would read
 * as a bad review, so "absent" is the honest shape.
 */
export interface StayRatingSummary {
    /** `stays.slug`, which is also `Stay.id` in features/stays/types.ts. */
    staySlug: string;
    total: number;
    /** Mean rating, unrounded. The component decides the precision. */
    averageRating: number;
}

/**
 * The review form's result. `errors` + `values` (like `RequestFormState`) so a rejected rating keeps
 * the typed words; unlike `CheckoutFormState` it has a success shape, as the modal closes in place.
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
