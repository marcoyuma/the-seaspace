import { Josefin_Sans, Manrope } from "next/font/google";

/**
 * The only `next/font` import (a second declaration ships a second copy). Exposes `variable`s,
 * mapped to Tailwind tokens in globals.css; that mode sets no `font-family`, so app/layout.tsx
 * must put `font-sans` on <body> or nothing inherits a font.
 */

/** Body, UI and headings alike → `--font-sans`. */
export const manrope = Manrope({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-manrope",
});

/** Wordmark face, used only by ui/logo.tsx → `--font-logo`. */
export const josefin = Josefin_Sans({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-josefin",
});
