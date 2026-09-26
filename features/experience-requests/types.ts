/**
 * Render-layer types for experience requests. camelCase here, snake_case in the table —
 * the same split features/auth and features/stays keep.
 */

/**
 * The leisure pages that can send a request — the entire vocabulary, with no DB CHECK behind it (no
 * table, README §2). Adding one means updating `EXPERIENCE_REQUESTS` and `STAFF_INBOXES` too.
 */
export type ExperienceId = "golf-course" | "spa" | "event-venue";

/**
 * What `submitExperienceRequest` returns to `useActionState`; `undefined` = nothing submitted. Like
 * `AuthFormState`, `values` survive a rejected submit — but success returns state, not a redirect.
 */
export type RequestFormState =
    | {
          /** Set only on success. The form swaps to its confirmation panel. */
          ok?: true;
          /** Shown above the form when something failed that is not a single field's fault. */
          message?: string;
          /** Per-field validation messages, keyed by input `name`. */
          errors?: {
              name?: string;
              email?: string;
              phone?: string;
              partySize?: string;
              preferredDate?: string;
              preference?: string;
              message?: string;
          };
          /** Echoed back so a rejected submit does not empty the form. */
          values?: {
              name?: string;
              email?: string;
              phone?: string;
              partySize?: string;
              preferredDate?: string;
              preference?: string;
              message?: string;
          };
      }
    | undefined;
