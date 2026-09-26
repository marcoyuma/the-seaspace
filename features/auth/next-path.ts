/**
 * How the "where was I going?" destination travels through auth. Its own module because
 * server-actions.ts is `"use server"` and app/auth/ route handlers need it too. proxy.ts keeps a
 * deliberate copy, since Proxy shouldn't rely on shared modules.
 */

/**
 * Carries `next` across OAuth in a cookie, not on `redirectTo`, so exactly ONE callback URL matches
 * Supabase's allow-list; read and cleared by app/auth/callback/route.ts. `sameSite: "lax"` is
 * required: the return is a cross-site top-level navigation, which `strict` would strip.
 */
export const OAUTH_NEXT_COOKIE = "seaspace-oauth-next";

/** Ten minutes — long enough to finish a consent screen, short enough to be forgettable. */
export const OAUTH_NEXT_MAX_AGE = 600;

/**
 * Reduces an untrusted `next` to a same-origin path: exactly one leading slash, since both
 * `//evil.example` and `https://evil.example` would redirect off-site.
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
