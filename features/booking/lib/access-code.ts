/**
 * Presentation helpers for a booking's door code.
 *
 * ⚠️ The code itself is minted by `create_booking()` in the database and is never generated,
 * derived or validated here. A credential produced in two places is a credential with two
 * definitions of what counts as valid.
 */

/** Eight uppercase hex characters, e.g. `A3F72C9B`. Anything else is not one of ours. */
const ACCESS_CODE = /^[0-9A-F]{8}$/;

/**
 * Whether a string could be an access code, for rejecting obvious rubbish out of a URL
 * before it reaches the database.
 *
 * Not a security check — `get_check_in_invite()` is what decides whether a code opens
 * anything. This only saves a round trip on `/checkin/hello`.
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
 * The absolute URL encoded into the QR.
 *
 * Absolute because a QR is scanned by a camera app, which has no origin to resolve a
 * relative path against. The origin is passed in rather than read from an environment
 * variable so it follows the deployment — the page already has the request's headers, and
 * one fewer env var is one fewer thing set correctly in only two of three places.
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
