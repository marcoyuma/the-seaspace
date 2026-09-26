/**
 * Door-code presentation helpers. ⚠️ The code is minted only by `create_booking()` — never
 * generated, derived or validated here; two producers means two definitions of valid.
 */

/** Eight uppercase hex characters, e.g. `A3F72C9B`. Anything else is not one of ours. */
const ACCESS_CODE = /^[0-9A-F]{8}$/;

/**
 * Rejects obvious URL rubbish before the database. Not a security check — `get_check_in_invite()`
 * decides; this only saves a round trip on `/checkin/hello`.
 */
export function looksLikeAccessCode(value: string): boolean {
    return ACCESS_CODE.test(value.trim().toUpperCase());
}

/**
 * `A3F72C9B` → `A3F7 2C9B`.
 *
 * Split in two because eight unbroken characters is what people misread and mistype; four
 * and four is the same grouping a keypad instruction or a bank card uses.
 */
export function formatAccessCode(code: string): string {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
}

/** Where the QR points, and where a typed code goes. Relative — see `checkInUrl()`. */
export function checkInPath(code: string): string {
    return `/checkin/${code}`;
}

/**
 * The absolute URL in the QR, since a camera app has no origin to resolve against. The origin is
 * passed in (from request headers) rather than an env var, so it follows the deployment.
 *
 * @param origin e.g. `https://seaspace.example`, no trailing slash.
 *
 * @example
 * checkInUrl("https://seaspace.example", "A3F72C9B");
 * // "https://seaspace.example/checkin/A3F72C9B"
 */
export function checkInUrl(origin: string, code: string): string {
    return `${origin}${checkInPath(code)}`;
}
