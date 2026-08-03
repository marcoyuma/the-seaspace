import Container from "@/components/ui/container";
import ServiceAndAmenitiesPreview from "@/features/services/components/service-and-amenities-preview";
import SpaHero from "@/features/spa/components/spa-hero";
import SpaRelaxationSection from "@/features/spa/components/spa-relaxation-section";

export const metadata = {
    title: "Spa",
};

export default function Page() {
    return (
        <>
            <Container>
                <SpaHero />
                <SpaRelaxationSection />
            </Container>

            {/* Renders its own Container, so it stays outside this page's —
                nesting the two would double the 120px inset. `excludeId`
                leaves golf course + event venue, which drops it to 2 columns. */}
            <ServiceAndAmenitiesPreview
                excludeId="spa-and-wellness"
                overline="Beyond the treatment room"
                heading="Carry On Unwinding"
                description="The calm doesn't end at the door — a fairway at golden hour, or a hall that holds your whole celebration."
            />
        </>
    );
}
