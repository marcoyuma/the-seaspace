/**
 * Render-layer types for experience requests. camelCase here, snake_case in the table —
 * the same split features/auth and features/stays keep.
 */

/**
 * The leisure pages that can send a request.
 *
 * No database CHECK backs this — there is no `experience_requests` table (see the
 * feature's README, §2). This union is the entire vocabulary; adding a page means adding
 * it here, to `EXPERIENCE_REQUESTS` in `lib/experiences.ts`, and to `STAFF_INBOXES` in
 * `lib/email-gateway.ts`.
 */
export type ExperienceId = "golf-course" | "spa" | "event-venue";

/**
 * Shape returned by `submitExperienceRequest` to `useActionState`.
 *
 * `undefined` is the initial state — nothing submitted yet. Modelled on `AuthFormState`,
 * including `values`, so a rejected submit does not wipe what someone typed into six
 * fields.
 *
 * Unlike the auth actions, success returns a state instead of redirecting: the guest is
 * mid-page on a marketing route and should stay exactly where they are.
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
