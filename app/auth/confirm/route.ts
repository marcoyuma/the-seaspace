import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase-server";
import { safeNextPath } from "@/features/auth/next-path";

/**
 * Landing point for every Supabase email link (`type` = signup/email or recovery). Templates must
 * point here, not `{{ .ConfirmationURL }}`, to allow a server-side PKCE exchange. A Route Handler,
 * since minting a session writes cookies.
 *
 * @example {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account
 */

/** Where a broken, expired or already-used link ends up. */
const FAILURE_PATH = "/login?error=link_invalid";

/**
 * Fallback destination, `/account` like the OAuth callback: a template typo renders an empty `next`,
 * and landing on `/` would look like a failed confirmation despite the new session.
 */
const DEFAULT_NEXT = "/account";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;

    const tokenHash = searchParams.get("token_hash");
    // Passed through to verifyOtp untouched instead of being hard-coded, so the route keeps
    // working whichever of `email` / `signup` the Confirm-signup template is written with.
    const type = searchParams.get("type") as EmailOtpType | null;

    // Validated even though the value comes from our own template: the whole URL is handed
    // to the guest by email, and anything reachable from a browser is attacker-controlled.
    const next = safeNextPath(searchParams.get("next"), DEFAULT_NEXT);

    if (!tokenHash || !type) {
        return NextResponse.redirect(new URL(FAILURE_PATH, request.url));
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
    });

    if (error) {
        // Deliberately one message for every failure. The three real causes — expired,
        // already used, tampered with — are indistinguishable to the person holding the
        // link, and naming which one applies tells an attacker whether a token was valid.
        return NextResponse.redirect(new URL(FAILURE_PATH, request.url));
    }

    return NextResponse.redirect(new URL(next, request.url));
}
