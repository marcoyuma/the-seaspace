import { Josefin_Sans, Manrope } from "next/font/google";

/**
 * The only place `next/font` is imported. Loaders must run at module scope, and
 * a second declaration of the same family would ship a second copy of it.
 *
 * Both expose `variable` rather than `className`: the variables are mapped to
 * Tailwind tokens in app/_styles/globals.css, so components apply fonts with
 * plain utility classes (`font-sans`, `font-logo`) and never import from here.
 *
 * Note that in `variable` mode next/font only defines the custom property — it
 * does NOT apply `font-family` itself. app/layout.tsx must therefore put
 * `font-sans` on <body> explicitly, or nothing inherits a font at all.
 */

/** Body, UI and headings alike → `--font-sans`. */
export const manrope = Manrope({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-manrope",
});

/** Wordmark face, used only by app/ui/logo.tsx → `--font-logo`. */
export const josefin = Josefin_Sans({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-josefin",
});
