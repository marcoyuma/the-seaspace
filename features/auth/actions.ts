import { cache } from "react";

import { createClient } from "@/lib/supabase-server";
import type { AuthUser, GuestProfile } from "@/features/auth/types";

/**
 * Session and profile reads (mutations are in server-actions.ts — `"use server"` exports are public
 * endpoints). No `use cache`: everything touches cookies, so callers sit inside <Suspense>.
 */

/**
 * The signed-in person, or `null`. `getClaims()`, not `getSession()`: it verifies the JWT signature
 * instead of trusting the cookie. React `cache` shares one verification per render.
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
 * Whether the guest has a password identity at all. OAuth-only guests don't, so `deleteAccount`
 * doesn't ask for one (inventing a password just to leave is a dead end). Uses `getUser()`, as
 * identities aren't in the JWT claims.
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
 * The signed-in guest's own row, or `null` — the expected result when signed out, since `guests`
 * has no `anon` RLS policy (the query succeeds with nothing).
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
