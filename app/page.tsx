import { Suspense } from "react";

import ScrollRunningText from "@/features/home/components/scroll-running-text";
import FamilyHistorySection from "@/features/home/components/family-history-section";
import StaysPreviewSection, {
    StaysPreviewSectionFallback,
} from "@/features/stays/components/stays-preview-section";
import ServiceAndAmenitiesPreview from "@/features/services/components/service-and-amenities-preview";
import MoreServiceAndAmenities from "@/features/services/components/more-service-and-amenities";
import Gallery from "@/features/home/components/gallery";
import ReviewsSection, {
    ReviewsSectionFallback,
} from "@/features/reviews/components/reviews-section";
import FaqSection from "@/features/home/components/faq-section";
import Hero from "@/features/home/components/hero";
import Preloader from "@/ui/preloader";

export default function Page() {
    return (
        <div className="relative">
            {/* An OVERLAY, never a gate on rendering: everything below still server-renders
                into the HTML, so a crawler reads the full page and the curtain is only a
                fixed layer stacked on top of it. Whether it shows at all is decided before
                paint by <PreloaderFlashGuard /> in app/layout.tsx. */}
            <Preloader />

            <Hero />

            <div className="relative bg-white">
                <ScrollRunningText />

                <FamilyHistorySection />

                {/* ADA MASALAH DI SINI MENGENAI RESPONSIVITAS HERO IMAGE TIDAK TERCROP */}
                {/* `"use cache"` lives on getFeaturedStays(), not on this component, so it
                    still needs an explicit Suspense boundary for the build to produce a
                    static shell — loading.tsx used to provide this implicitly, but that would
                    gate the whole static page behind one fallback instead of just this section. */}
                <Suspense fallback={<StaysPreviewSectionFallback />}>
                    <StaysPreviewSection />
                </Suspense>

                <ServiceAndAmenitiesPreview />

                <MoreServiceAndAmenities />

                {/* 
                  PERF: this section is likely heavy (image-heavy gallery).
                  Consider lazy-loading with next/dynamic + a loading fallback,
                  since it's below the fold and not needed on initial paint.
                */}
                <Gallery />

                {/* Same reasoning as StaysPreviewSection's boundary above. */}
                <Suspense fallback={<ReviewsSectionFallback />}>
                    <ReviewsSection />
                </Suspense>

                <FaqSection />

                {/* <ParallaxImageSection /> */}

                {/* ADA MASALAH DI SINI MENGENAI RESPONSIVITAS HERO IMAGE TIDAK TERCROP */}
                {/* <Footer /> */}
            </div>
        </div>
    );
}

// TODO: consider adding `export const metadata = {...}` or `generateMetadata()`
// for SEO purposes (title, description, og:image) if not defined elsewhere for this route.
