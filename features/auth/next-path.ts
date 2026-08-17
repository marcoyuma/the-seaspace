/**
 * How the "where was I going?" destination travels through an auth flow.
 *
 * Its own module rather than an export of server-actions.ts: that file is `"use server"`,
 * where every export becomes a public HTTP endpoint and non-async exports are rejected
 * outright. The route handlers under app/auth/ need this too, so it has to live somewhere
 * both can import.
 *
 * proxy.ts still keeps its own copy of the rule. That duplication is deliberate — Proxy can
 * be deployed separately to a CDN, and the Next.js docs warn against relying on shared
 * modules there. Two copies, not four.
 */

/**
 * Carries `next` across an OAuth round trip.
 *
 * A cookie rather than a query parameter on `redirectTo`, so the app registers exactly ONE
 * callback URL with Supabase. Supabase rejects any `redirectTo` outside the allow-list in
 * URL Configuration, and a URL that varies per sign-in is a URL that eventually does not
 * match. Read and cleared by app/auth/callback/route.ts.
 *
 * `sameSite: "lax"` is required, not incidental: the guest arrives back through a top-level
 * navigation from another site, which `strict` would strip the cookie from.
 */
export const OAUTH_NEXT_COOKIE = "seaspace-oauth-next";

/** Ten minutes — long enough to finish a consent screen, short enough to be forgettable. */
export const OAUTH_NEXT_MAX_AGE = 600;

/**
 * Reduces an untrusted `next` value to a same-origin path.
 *
 * `//evil.example` is a protocol-relative URL and `https://evil.example` an absolute one;
 * both are plausible `next` values and both would redirect off-site. Hence "starts with
 * exactly one slash" rather than merely "starts with a slash".
 *
 * @param value Raw value from a query string, form field or cookie.
 * @param fallback Where to go when the value is missing or rejected.
 * @returns A path safe to hand to `redirect()`.
 *
 * @example
 * safeNextPath("//evil.example");   // "/"
 * safeNextPath(null, "/account");   // "/account"
 */
export function safeNextPath(
    value: string | FormDataEntryValue | null | undefined,
    fallback = "/",
): string {
    const path = typeof value === "string" ? value : "";
    if (!path.startsWith("/") || path.startsWith("//")) return fallback;
    return path;
}
