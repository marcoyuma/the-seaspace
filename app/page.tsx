import bg from "@/public/bg.jpg";

import ScrollRunningText from "@/features/home/components/scroll-running-text";
import FamilyHistorySection from "@/features/home/components/family-history-section";
import StaysPreviewSection from "@/features/stays/components/stays-preview-section";
import ServiceAndAmenitiesPreview from "@/features/services/components/service-and-amenities-preview";
import MoreServiceAndAmenities from "@/features/services/components/more-service-and-amenities";
import Gallery from "@/features/home/components/gallery";
import Reviews from "@/features/home/components/reviews";
import FaqSection from "@/features/home/components/faq-section";
import Hero from "@/features/home/components/hero";

// TODO: `bg` is not defined/imported anywhere — this will throw a ReferenceError at runtime.
// Remove this line or properly import/define `bg` before using it.
console.log(bg);

export default function Page() {
    return (
        <div className="relative">
            <Hero />

            {/* 
              NOTE: empty spacer div used purely for layout gap.
              Consider replacing with margin/padding on the adjacent element instead,
              since an empty div carries no semantic meaning and is harder to maintain.

              WARNING: `h-25` is not a default Tailwind spacing class (default scale jumps
              from h-24 to h-28). Verify this exists in tailwind.config, otherwise it has no effect.
            */}
            {/* <div className="h-25" /> */}

            <div className="relative bg-white">
                <ScrollRunningText />

                <FamilyHistorySection />

                {/* ADA MASALAH DI SINI MENGENAI RESPONSIVITAS HERO IMAGE TIDAK TERCROP */}
                <StaysPreviewSection />

                <ServiceAndAmenitiesPreview />

                <MoreServiceAndAmenities />

                {/* 
                  PERF: this section is likely heavy (image-heavy gallery).
                  Consider lazy-loading with next/dynamic + a loading fallback,
                  since it's below the fold and not needed on initial paint.
                */}
                <Gallery />

                <Reviews />

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
