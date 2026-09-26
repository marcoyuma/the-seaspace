import { josefin, manrope } from "@/app/_styles/fonts";

import "@/app/_styles/globals.css";
import Header from "@/ui/header";
import { ReactNode, Suspense } from "react";
import { Metadata } from "next";
import seaspaceIcon from "@/public/icons/seaspace-logo-final.png";
import Footer from "@/ui/footer";
import ProfileIcon, { ProfileIconFallback } from "@/ui/profile-icon";
import ChromeGate from "@/ui/chrome-gate";
import { Analytics } from "@vercel/analytics/next";
import PreloaderFlashGuard from "@/ui/preloader-flash-guard";

export const metadata: Metadata = {
    title: {
        template: "%s | The Seaspace",
        default: "Welcome | The Seaspace",
    },

    // icons used for browser tab preview
    icons: {
        icon: seaspaceIcon.src,
        apple: seaspaceIcon.src,
    },
    description:
        "Luxurious cabin hotel, located in the heart of the Italian Dolomites, surrounded by beautiful mountains and dark forests",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        // The flash guard stamps `data-preloader-active` on <html> before hydration, so its attributes
        // legitimately differ. Scoped to <html> only; real mismatches below still surface.
        <html
            lang="en"
            suppressHydrationWarning
            style={{ overscrollBehavior: "none", overflowX: "hidden" }}
            data-scroll-behavior="smooth"
        >
            {/* both `.variable` just defining its css variable 
                and not implement any font-family, so that `font-sans`
                written explicitly so manrope can still be the app default font  */}
            <body
                className={`${manrope.variable} ${josefin.variable} font-sans relative antialiased min-h-screen flex flex-col`}
            >
                {/* First in the body so the curtain decision beats the header's first paint.
                    Static markup, so the route keeps its static shell. */}
                <PreloaderFlashGuard />

                {/* ChromeGate hides header and footer on ui/chrome-gate.tsx's routes; client-side,
                    as a layout never re-renders on navigation and can't read the path. */}
                {/* This boundary is for ChromeGate's usePathname(): on dynamic routes without
                    generateStaticParams the path is request-time and would block the document.
                    `null` fallback — the header has no sensible skeleton. */}
                <Suspense fallback={null}>
                    <ChromeGate>
                        {/* ProfileIcon reads cookies; this boundary keeps every route's shell static.
                            A prop, since Client Component Header can't import an async Server one. */}
                        <Header
                            profileSlot={
                                <Suspense fallback={<ProfileIconFallback />}>
                                    <ProfileIcon />
                                </Suspense>
                            }
                        />
                    </ChromeGate>
                </Suspense>
                <div className="flex-1 grid">
                    {/* `min-w-0`: a grid item's `min-width: auto` let <main> outgrow the viewport
                        whenever any descendant had unshrinkable content — the root cause of several
                        mobile overflow bugs on `/` that looked component-specific. */}
                    <main className="min-w-0">{children}</main>
                    <Analytics />
                </div>
                {/* Same reason as the header's boundary above. */}
                <Suspense fallback={null}>
                    <ChromeGate>
                        <Footer />
                    </ChromeGate>
                </Suspense>
            </body>
        </html>
    );
}
