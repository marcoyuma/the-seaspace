import { josefin, manrope } from "@/app/_styles/fonts";

import "@/app/_styles/globals.css";
import Header from "@/ui/header";
import { ReactNode } from "react";
import { Metadata } from "next";
import seaspaceIcon from "@/public/icons/seaspace-logo-final.png";
import Footer from "@/ui/footer";
import ParallaxImageSection from "@/ui/parallax-image-section";

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
            {/* both `.variable` just defining its css variable 
                and not implement any font-family, so that `font-sans`
                written explicitly so manrope can still be the app default font  */}
            <body
                className={`${manrope.variable} ${josefin.variable} font-sans relative antialiased min-h-screen flex flex-col`}
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
