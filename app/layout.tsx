import { Manrope } from "next/font/google";

const manrope = Manrope({
    subsets: ["latin"],
    display: "swap",
});

import "@/app/_styles/globals.css";
import Header from "@/app/ui/header";
import { ReactNode } from "react";
import { Metadata } from "next";
import seaspaceIcon from "@/public/icons/seaspace-logo-final.png";
import Footer from "@/app/ui/footer";
import ParallaxImageSection from "@/app/ui/parallax-image-section";

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
        >
            <body
                className={`${manrope.className} relative antialiased min-h-screen flex flex-col`}
            >
                <Header />

                <div className="flex-1 grid">
                    <main>{children}</main>
                </div>
                <Footer />
            </body>
        </html>
    );
}
