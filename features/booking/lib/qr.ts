import QRCode from "qrcode";

/**
 * Renders a QR to an inline SVG, ⚠️ server-only, so no encoder or image request ships. A dependency
 * beats hand-rolling Reed–Solomon for a door code. Error correction `M` (~15%), not `L`: it's scanned
 * off a phone in a dark doorway, at an angle, through fingerprints.
 *
 * @param value What the camera should resolve to — an absolute URL. See `checkInUrl()`.
 * @returns An `<svg>` element as a string, sized by its container rather than by pixels.
 *
 * @example
 * <div dangerouslySetInnerHTML={{ __html: await accessQrSvg(checkInUrl(origin, code)) }} />
 */
export async function accessQrSvg(value: string): Promise<string> {
    return QRCode.toString(value, {
        type: "svg",
        errorCorrectionLevel: "M",
        // The quiet zone is part of the spec — a QR flush against a border is one many
        // scanners refuse. 2 modules is the practical minimum.
        margin: 2,
        // Rendered with `width: 100%` by the caller, so this is only the viewBox scale.
        width: 256,
        color: {
            // Not pure black on pure white: the site's ink is #000 at full strength, and
            // maximum contrast is exactly what a scanner wants. Stated explicitly so a
            // future theme change cannot quietly lower it.
            dark: "#000000",
            light: "#FFFFFF",
        },
    });
}
