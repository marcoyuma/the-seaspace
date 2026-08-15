import QRCode from "qrcode";

/**
 * Renders a QR code to an inline SVG string, on the server.
 *
 * ⚠️ Server-side only. Importing this from a Client Component would ship an encoder to the
 * browser to draw a picture that never changes after render — the SVG is inlined into the
 * HTML instead, so the page costs no JavaScript and no image request at all.
 *
 * The alternative to the dependency was hand-rolling the encoder: masking, error
 * correction and Reed–Solomon arithmetic, several hundred lines nobody should have to
 * review to trust a door code.
 *
 * Error correction is deliberately `M` (~15% recoverable) rather than the default `L`. This
 * particular QR gets scanned off a phone screen in a doorway at night, at an angle, with a
 * fingerprint across it.
 *
 * @param value What the camera should resolve to — an absolute URL. See `checkInUrl()`.
 * @returns An `<svg>` element as a string, sized by its container rather than by pixels.
 *
 * @example
 * const svg = await accessQrSvg(checkInUrl(origin, booking.accessCode));
 * <div dangerouslySetInnerHTML={{ __html: svg }} />
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
