import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Keeps the Supabase session alive across requests.
 *
 * `middleware.ts` in Next 15 and earlier; renamed to `proxy.ts` in Next 16. Runs on the
 * Node.js runtime, so @supabase/ssr works here without an Edge-compatible build.
 *
 * This exists because Server Components cannot write cookies. Supabase access tokens last
 * about an hour, and the rotated token has to be stored somewhere — without this file a
 * visitor appears signed out mid-session and has to log in again.
 *
 * The redirects below are OPTIMISTIC, in the sense the Next.js auth guide uses: they
 * pre-filter, they do not authorize. The real check is on the page (see
 * app/(auth)/account/page.tsx), because Proxy also runs on prefetches and must never be the
 * only line of defence.
 *
 * They still have to be here rather than only on the page. With Cache Components the root
 * layout's static shell is flushed before a page finishes rendering, so a `redirect()`
 * reached later can only be delivered as `<meta http-equiv="refresh" content="1;…">` — a
 * visible one-second stall. Redirecting here happens before anything is rendered, so it is
 * a real HTTP redirect.
 *
 * Depends on NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
            "Set both in .env.local for local dev and in the Vercel project settings for builds.",
    );
}

const SUPABASE_ORIGIN = new URL(SUPABASE_URL).origin;

// Re-bound after the guard above so the narrowing survives into the closure below:
// TypeScript does not carry a module-level `string | undefined` narrowing into a function body.
const ANON_KEY: string = SUPABASE_ANON_KEY;

const LOGIN_PATH = "/login";

/**
 * Routes a signed-out visitor is bounced away from.
 *
 * Prefix match, so a future /account/bookings is covered without editing this list. Every
 * entry still needs its own check on the page — this list only decides who gets redirected
 * early, not who is allowed in.
 */
const PROTECTED_PREFIXES = ["/account"];

/**
 * Checkout, which is protected but is not under a shared prefix.
 *
 * `/stays/{slug}/book` sits inside the public catalogue, one segment below a page anyone
 * may read. A booking needs `auth.uid()` to attach to (create_booking raises SB003 without
 * one), so there is no useful signed-out version of it.
 *
 * Anchored at both ends so it cannot match `/stays/book` or `/stays/a/b/book`.
 */
const CHECKOUT_PATH = /^\/stays\/[^/]+\/book$/;

/**
 * Only same-origin paths survive.
 *
 * `//evil.example` and `https://evil.example` are both valid values for a `next` query
 * parameter and both would redirect off-site, so the check is "starts with exactly one
 * slash" rather than merely "starts with a slash".
 *
 * Twin of the helper in features/auth/actions.ts. Duplicated rather than shared because
 * proxy.ts must not rely on shared modules — it can be deployed separately to a CDN.
 */
function safeNextPath(value: string | null): string {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
    return value;
}

export async function proxy(request: NextRequest) {
    // Built up front and mutated by setAll below: the cookies Supabase rotates have to land
    // on THIS response object, and creating a fresh NextResponse later would drop them.
    let response = NextResponse.next({ request });

    const supabase = createServerClient(SUPABASE_ORIGIN, ANON_KEY, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet, headers) {
                // Written twice on purpose. `request.cookies` makes the refreshed token
                // visible to Server Components rendering THIS request; `response.cookies`
                // sends it to the browser for the next one.
                for (const { name, value } of cookiesToSet) {
                    request.cookies.set(name, value);
                }

                response = NextResponse.next({ request });

                for (const { name, value, options } of cookiesToSet) {
                    response.cookies.set(name, value, options);
                }

                // Supabase supplies no-store headers alongside rotated cookies. Without
                // them a CDN could cache a response carrying someone's session token and
                // serve it to the next visitor.
                for (const [key, value] of Object.entries(headers)) {
                    response.headers.set(key, value);
                }
            },
        },
    });

    // getClaims(), not getSession(): it verifies the JWT signature rather than trusting the
    // cookie, and it refreshes an about-to-expire token as a side effect — which is the
    // whole reason this file exists. getSession() must never be trusted in server code.
    const { data } = await supabase.auth.getClaims();
    const isSignedIn = Boolean(data?.claims?.sub);
    const { pathname, search, searchParams } = request.nextUrl;

    // Someone already signed in has no use for the login form.
    if (isSignedIn && pathname === LOGIN_PATH) {
        return NextResponse.redirect(
            new URL(safeNextPath(searchParams.get("next")), request.url),
        );
    }

    // Send signed-out visitors to the form, remembering where they were headed.
    if (
        !isSignedIn &&
        (PROTECTED_PREFIXES.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
        ) ||
            CHECKOUT_PATH.test(pathname))
    ) {
        const loginUrl = new URL(LOGIN_PATH, request.url);
        // Query string included, not just the path: on checkout the dates and party size
        // live entirely in it, so a `next` of the bare path would sign the guest in and
        // then drop them on a page with nothing selected.
        loginUrl.searchParams.set("next", `${pathname}${search}`);
        return NextResponse.redirect(loginUrl);
    }

    return response;
}

export const config = {
    // Everything except static assets and image files. Auth is meant to run broadly — a
    // route left out here is a route whose session silently stops being refreshed.
    //
    // `api` is excluded deliberately, and that exclusion has to be re-examined before any
    // route under it is added: /api/revalidate/stays is called by a Supabase webhook that
    // carries no cookies at all, so refreshing a session for it is a wasted round-trip to
    // Supabase on every catalogue write. Auth routes live under /auth, not /api, and are
    // still covered.
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
    ],
};
