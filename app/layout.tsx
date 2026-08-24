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
        <html
            lang="en"
            style={{ overscrollBehavior: "none", overflowX: "hidden" }}
            data-scroll-behavior="smooth"
        >
            {/* both `.variable` just defining its css variable 
                and not implement any font-family, so that `font-sans`
                written explicitly so manrope can still be the app default font  */}
            <body
                className={`${manrope.variable} ${josefin.variable} font-sans relative antialiased min-h-screen flex flex-col`}
            >
                {/* ChromeGate hides both on the routes listed in ui/chrome-gate.tsx —
                    /login owns its whole viewport. It has to be a Client Component because
                    only the client knows the current path; a layout never re-renders on
                    navigation and cannot read one. */}
                {/* The outer boundary is about ChromeGate, not the session: it reads
                    usePathname(), and on a route whose dynamic segment has no
                    generateStaticParams (/account/trips/[bookingId], /stays/[slug]/book)
                    the path is not known until the request. Without a boundary here that
                    read sits in the layout, ABOVE app/loading.tsx, and blocks the whole
                    document — the "Uncached data was accessed outside of <Suspense>"
                    build error. `null` as the fallback because the header has no sensible
                    skeleton; on prerendered routes it resolves at build time as before. */}
                <Suspense fallback={null}>
                    <ChromeGate>
                        {/* ProfileIcon reads cookies, which is request-time data. This
                            inner boundary is what keeps that from dragging every route out
                            of the static shell: the fallback is prerendered and only the
                            session streams in. Passed as a prop because Header is a Client
                            Component and cannot import an async Server Component itself. */}
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
                    {/* `min-w-0`: a grid item's default `min-width` is
                        `auto`, which falls back to its content's min-content
                        size — so `<main>` could grow past this grid track
                        (and the viewport) if ANY descendant anywhere on the
                        page had non-shrinkable content, even one that's
                        visually clipped by its own `overflow-hidden`
                        wrapper. That single missing override was the actual
                        root cause behind several mobile-width bugs on `/`
                        that looked, from the descendant side, like
                        unrelated per-component overflow issues. */}
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
