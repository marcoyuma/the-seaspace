import Container from "@/ui/container";
import GolfCourseSection from "@/features/marketing/golf-course/components/golf-course-section";
import GolfHero from "@/features/marketing/golf-course/components/golf-hero";
import ServiceAndAmenitiesPreview from "@/features/services/components/service-and-amenities-preview";

export const metadata = {
    title: "Golf Course",
};

export default function Page() {
    return (
        <>
            <Container>
                <GolfHero />
                <GolfCourseSection />
            </Container>

            {/* Renders its own Container, so it stays outside this page's —
                nesting the two would double the 120px inset. `excludeId`
                leaves spa + event venue, which drops it to 2 columns. */}
            <ServiceAndAmenitiesPreview
                excludeId="golf-course"
                overline="Beyond the eighteenth green"
                heading="Round Off the Day"
                description="The day doesn't end at the clubhouse — an hour on the treatment bed, or a hall that holds your whole celebration."
            />
        </>
    );
}
