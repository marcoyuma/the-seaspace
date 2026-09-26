import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session per request (Server Components can't store rotated cookies);
 * Next 16's `middleware.ts`, on Node. Redirects only pre-filter — pages still authorize — but live
 * here because under Cache Components a page `redirect()` arrives as a 1s meta refresh.
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
 * Prefixes a signed-out visitor is bounced from (prefix match covers future sub-routes). Pages
 * still check for themselves — this only decides who is redirected early.
 */
const PROTECTED_PREFIXES = ["/account"];

/**
 * Checkout: protected, yet inside the public catalogue. create_booking needs `auth.uid()` (SB003
 * without it). Anchored at both ends so `/stays/book` or `/stays/a/b/book` can't match.
 */
const CHECKOUT_PATH = /^\/stays\/[^/]+\/book$/;

/**
 * Only same-origin paths survive: exactly one leading slash, as `//evil.example` redirects
 * off-site too. Twin of features/auth/next-path.ts — proxy.ts must not rely on shared modules.
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
    // Everything but static assets — a route left out silently stops refreshing its session.
    // `api` is excluded because the cookie-less stays webhook would waste a Supabase round-trip;
    // re-examine before adding routes under /api (auth lives under /auth and is covered).
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
    ],
};
