/**
 * Render-layer types for auth. camelCase, mapped from Supabase's snake_case in actions.ts,
 * matching how features/stays and features/reviews separate row shapes from view shapes.
 */

/** The signed-in person, reduced to what the UI actually renders. */
export interface AuthUser {
    /** `auth.users.id`, which is also `public.guests.id`. */
    id: string;
    /** From the JWT claims, not from `guests` — that table deliberately has no email column. */
    email: string;
}

/**
 * A guest's own row in `public.guests`.
 *
 * Readable only by that guest: the table has no `anon` RLS policy at all because it holds
 * phone numbers. A signed-out reader gets nothing back rather than an error.
 */
export interface GuestProfile {
    /** Rendered publicly on review cards, e.g. 'Amara L.'. Never null — the DB enforces it. */
    displayName: string;
    /** Administrative, never rendered publicly. Null for guests who never supplied one. */
    fullName: string | null;
    /** e.g. 'Swedish'. Feeds the review card's second line. */
    nationality: string | null;
    /**
     * Bucket-relative path in the public `guests` bucket, e.g. `a1b2…/f7c9.webp`.
     * Null means no photo — the UI falls back to a Phosphor icon.
     */
    avatarPath: string | null;
}

/** Which half of the /login form is showing. */
export type AuthMode = "sign-in" | "sign-up";

/**
 * Shape returned by the sign-in/sign-up actions to `useActionState`.
 *
 * `undefined` is the initial state — nothing submitted yet. A successful submit never
 * produces a state at all, because the action redirects instead of returning.
 */
export type AuthFormState =
    | {
          /** Shown above the form. Deliberately vague for failed sign-in (see actions.ts). */
          message?: string;
          /**
           * `true` when `message` is an outcome rather than a failure — e.g. an account was
           * created but still needs email confirmation. Renders neutral instead of red.
           * Mirrors `ProfileFormState` below.
           */
          ok?: boolean;
          /** Per-field validation messages, keyed by input `name`. */
          errors?: {
              email?: string;
              password?: string;
              displayName?: string;
          };
          /** Echoed back so a rejected submit does not wipe what was typed. */
          values?: {
              email?: string;
              displayName?: string;
              fullName?: string;
              nationality?: string;
          };
      }
    | undefined;

/** Shape returned by the profile update action on /account. */
export type ProfileFormState =
    | {
          message?: string;
          ok?: boolean;
          errors?: { displayName?: string };
      }
    | undefined;

/**
 * Shape returned by `uploadAvatar` on /account.
 *
 * No `errors` map like `ProfileFormState` — there is only one input (the file), so a failure
 * always belongs in `message`.
 */
export type AvatarFormState =
    | {
          message?: string;
          ok?: boolean;
      }
    | undefined;

/**
 * Shape returned by `updatePassword` on /account/update-password.
 *
 * Separate from `AuthFormState` rather than widening it: nothing is echoed back here on
 * purpose. A rejected submit clears both fields, because re-showing a password someone just
 * mistyped only helps them repeat the mistake.
 */
export type PasswordFormState =
    | {
          message?: string;
          ok?: boolean;
          errors?: { password?: string; confirmPassword?: string };
      }
    | undefined;

/**
 * Which fate a guest picked for their reviews when deleting their account. Matches "Opsi A"
 * / "Opsi B" in ACCOUNT-DELETION-POLICY.md.
 */
export type DeleteReviewOption = "anonymize" | "erase";

/**
 * Shape returned by `deleteAccount` on /account.
 *
 * No `ok` — a successful run never returns a state at all, it signs out and redirects
 * straight to `/`, the same as `signIn`.
 */
export type DeleteAccountFormState =
    | {
          message?: string;
          errors?: { option?: string; password?: string };
      }
    | undefined;
