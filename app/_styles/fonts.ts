import { Playfair_Display } from "next/font/google";

/**
 * Serif display face. next/font requires loaders to run at module scope, so the
 * single declaration lives here and components compose `playfair.className`
 * rather than re-declaring the font (which would ship a second copy of it).
 * Used by app/ui/section-heading.tsx and the stay detail page headline.
 */
export const playfair = Playfair_Display({
    subsets: ["latin"],
    display: "swap",
});
