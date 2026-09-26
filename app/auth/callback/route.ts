import { after, NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase-server";
import { OAUTH_NEXT_COOKIE, safeNextPath } from "@/features/auth/next-path";
import { adoptProviderAvatar } from "@/features/auth/oauth-avatar";

/**
 * Where GitHub/Google return, via Supabase's own `/auth/v1/callback`, with a one-time `code` traded
 * here for a session. A Route Handler, like /auth/confirm: minting a session writes cookies.
 */

const FAILURE_PATH = "/login?error=oauth_failed";

/** Where an OAuth sign-in lands when no destination was remembered. */
const DEFAULT_NEXT = "/account";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;

    // Read before any early return: the cookie has served its purpose either way, and a
    // stale one would misdirect the guest's next sign-in.
    const next = safeNextPath(
        request.cookies.get(OAUTH_NEXT_COOKIE)?.value,
        DEFAULT_NEXT,
    );

    /** Every exit from this handler goes through here, so the cookie is always cleared. */
    function redirectTo(path: string) {
        const response = NextResponse.redirect(new URL(path, request.url));
        response.cookies.delete(OAUTH_NEXT_COOKIE);
        return response;
    }

    // Present when the guest declined on the provider's consent screen, or the provider
    // rejected the request. Not an error worth explaining — they chose to back out.
    if (searchParams.get("error")) return redirectTo(FAILURE_PATH);

    const code = searchParams.get("code");
    if (!code) return redirectTo(FAILURE_PATH);

    const supabase = await createClient();

    // PKCE (the @supabase/ssr default): the verifier arrived in a cookie from signInWithProvider().
    // `flowId` (only with experimental `appendPkceFlowIdToRedirects`) picks among concurrent flows.
    const flowId = searchParams.get("sb_flow_id");
    const { data, error } = await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
    );

    if (error || !data.user) return redirectTo(FAILURE_PATH);

    // Fetching a CDN avatar must never delay sign-in, so it runs after the redirect; `after` in a
    // Route Handler may read cookies, keeping the session client usable.
    const user = data.user;
    after(() => adoptProviderAvatar(supabase, user));

    return redirectTo(next);
}
