import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase-server";
import { safeNextPath } from "@/features/auth/next-path";

/**
 * The landing point for every link Supabase mails out.
 *
 * One route serves both flows because they differ only in `type`: `email`/`signup` for a new
 * registration, `recovery` for a password reset. The link is built in the dashboard's email
 * templates, which must point here rather than at the default `{{ .ConfirmationURL }}` —
 * that URL goes straight to Supabase and cannot complete a server-side PKCE exchange.
 *
 * Template shape (Authentication → Email Templates):
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account
 *
 * A Route Handler rather than a page: verifying the token mints a session, which means
 * writing cookies, and Server Components may not.
 */

/** Where a broken, expired or already-used link ends up. */
const FAILURE_PATH = "/login?error=link_invalid";

/**
 * Where a verified link lands when it carried no destination of its own.
 *
 * `/account` rather than `/`, matching app/auth/callback/route.ts. A template with a typo, or
 * one written as `next={{ .RedirectTo }}` while `signUp` sends no `emailRedirectTo`, renders
 * an empty `next` — and landing on the homepage looks like the confirmation failed even though
 * the session was created. /account makes being signed in unmistakable.
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
