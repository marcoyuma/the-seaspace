import { after, NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase-server";
import { OAUTH_NEXT_COOKIE, safeNextPath } from "@/features/auth/next-path";
import { adoptProviderAvatar } from "@/features/auth/oauth-avatar";

/**
 * Where GitHub and Google send the guest back to, by way of Supabase.
 *
 * The provider's own callback is registered as
 * `https://<project-ref>.supabase.co/auth/v1/callback` — Supabase's URL, not ours. Supabase
 * verifies the provider's response and then redirects here with a one-time `code`, which
 * this handler trades for a session.
 *
 * A Route Handler rather than a page, for the same reason as /auth/confirm: minting a
 * session writes cookies, and Server Components may not.
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

    // @supabase/ssr defaults to `flowType: "pkce"`, so the code verifier travelled here in a
    // cookie written when signInWithProvider() started the flow.
    //
    // `flowId` selects that specific flow's verifier when several are in flight — it only
    // arrives with the experimental `appendPkceFlowIdToRedirects` option, so this is
    // forward-compatibility, not a requirement. Without it the most recent verifier is used.
    const flowId = searchParams.get("sb_flow_id");
    const { data, error } = await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
    );

    if (error || !data.user) return redirectTo(FAILURE_PATH);

    // Downloading somebody else's CDN image should never sit between a guest and their
    // account, so it runs after the redirect has already been sent. Reading cookies inside
    // `after` is supported in Route Handlers specifically, which is what keeps the
    // session-bound client usable in there.
    const user = data.user;
    after(() => adoptProviderAvatar(supabase, user));

    return redirectTo(next);
}
