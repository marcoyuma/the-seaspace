import { cache } from "react";

import { createClient } from "@/lib/supabase-server";
import type { AuthUser, GuestProfile } from "@/features/auth/types";

/**
 * Session and profile reads.
 *
 * `actions.ts` means the same thing here as in features/stays and features/reviews — the
 * feature's data access. The mutations that write are in server-actions.ts, kept apart
 * because a `"use server"` export is a public endpoint and these reads should not be one.
 *
 * Nothing here can use `use cache`: every function touches cookies, which is request-time
 * data. Callers must sit inside a <Suspense> boundary so the rest of the page still
 * prerenders — see app/layout.tsx.
 */

/**
 * The signed-in person, or `null` when nobody is.
 *
 * `getClaims()` rather than `getSession()`: it verifies the JWT signature against the
 * project's published keys instead of trusting the cookie, so the identity it returns can
 * be relied on in server code. `getSession()` cannot.
 *
 * Wrapped in React's `cache` so the header, the page and any leaf component asking the same
 * question during one render share a single verification.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data?.claims?.sub) return null;

    return {
        id: data.claims.sub,
        // Absent for providers that return no verified address. Only email/password sign-up
        // exists today, so in practice this is always present.
        email: data.claims.email ?? "",
    };
});

/**
 * Whether the signed-in guest can prove who they are with a password at all.
 *
 * An OAuth-only guest (signed up via GitHub or Google, never set a password) has no
 * `email` entry in `auth.users.identities`. `deleteAccount` in server-actions.ts uses this
 * to decide whether to ask for one before deleting the account — asking someone who has
 * never set a password to invent one just to leave would be a dead end, not a safeguard.
 *
 * Uses `getUser()` rather than `getClaims()`: identities are not carried in the JWT claims
 * that `getAuthUser` reads, so this makes its own round trip to Supabase.
 */
export const hasPasswordIdentity = cache(async (): Promise<boolean> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return false;

    return (data.user.identities ?? []).some(
        (identity) => identity.provider === "email",
    );
});

/**
 * The signed-in guest's own row, or `null`.
 *
 * Returns `null` rather than throwing when the read comes back empty, because "empty" is
 * the *expected* result for a signed-out visitor: `public.guests` has no `anon` RLS policy,
 * so the query succeeds and returns nothing instead of erroring.
 */
export const getGuestProfile = cache(async (): Promise<GuestProfile | null> => {
    const user = await getAuthUser();
    if (!user) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
        .from("guests")
        .select("display_name, full_name, nationality, avatar_path")
        .eq("id", user.id)
        .maybeSingle();

    if (error || !data) return null;

    return {
        displayName: data.display_name,
        fullName: data.full_name,
        nationality: data.nationality,
        avatarPath: data.avatar_path,
    };
});
