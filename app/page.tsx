import bg from "@/public/bg.jpg";

import ScrollRunningText from "@/app/ui/scroll-running-text";
import FamilyHistorySection from "@/app/ui/family-history-section";
import StaysPreviewSection from "@/app/ui/stays-preview-section";
import ServiceAndAmenitiesPreview from "@/app/ui/service-and-amenities-preview";
import MoreServiceAndAmenities from "@/app/ui/more-service-and-amenities";
import Gallery from "@/app/ui/gallery";
import Reviews from "@/app/ui/reviews";
import FaqSection from "@/app/ui/faq-section";
import ParallaxImageSection from "@/app/ui/parallax-image-section";
import Footer from "@/app/ui/footer";
import Hero from "@/app/ui/hero";

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
