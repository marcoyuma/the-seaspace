/**
 * Shared contract between the inline flash guard (ui/preloader-flash-guard.tsx), the overlay
 * itself (ui/preloader.tsx) and the CSS in app/_styles/globals.css.
 *
 * The guard runs as a raw string of JavaScript before React exists, so these values end up
 * interpolated into that string AND read by the component — one source of truth keeps the two
 * from drifting apart, which would silently leave the curtain up forever.
 */

/** sessionStorage key. Per-tab on purpose: a second visit within the same tab skips the curtain. */
export const PRELOADER_SESSION_KEY = "seaspace:preloader-seen";

/**
 * Set on <html> by the flash guard. CSS keeps the overlay `display:none` until it appears, so
 * a browser without JS — or a crawler that never runs it — never sees a curtain it cannot lift.
 */
export const PRELOADER_ACTIVE_ATTR = "data-preloader-active";

/** Marks the overlay element for the CSS rules above. */
export const PRELOADER_ROOT_ATTR = "data-preloader";

/**
 * Marks the <img> elements the curtain waits on. Value is descriptive only (`hero`, `gallery`);
 * the overlay counts every tagged image that is actually laid out.
 */
export const PRELOADER_GATE_ATTR = "data-gate";

/**
 * Marks images the curtain does NOT wait for, but warms in the background once it lifts —
 * the gallery frames that scroll in horizontally later. Without it they pop in mid-animation.
 */
export const PRELOADER_WARM_ATTR = "data-warm";

/** The only route that gets a curtain. */
export const PRELOADER_ROUTE = "/";

/**
 * Floor on how long the curtain stays up. Without it, a warm HTTP cache resolves every gate
 * within a frame or two and the overlay reads as a glitch rather than an intro.
 */
export const PRELOADER_MIN_VISIBLE_MS = 600;

/**
 * Ceiling. One stalled image must not hold the whole page hostage — past this the curtain
 * lifts regardless and the remaining photos fade in behind their blur placeholders.
 */
export const PRELOADER_MAX_WAIT_MS = 8000;
