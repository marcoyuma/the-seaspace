import Container from "@/ui/container";
import EventVenueHero from "@/features/marketing/event-venue/components/event-venue-hero";
import EventVenueSection from "@/features/marketing/event-venue/components/event-venue-section";
import ServiceAndAmenitiesPreview from "@/features/services/components/service-and-amenities-preview";

export const metadata = {
    title: "Event Venue",
};

export default function Page() {
    return (
        <>
            <Container>
                <EventVenueHero />
                <EventVenueSection />
            </Container>

            {/* Renders its own Container, so it stays outside this page's —
                nesting the two would double the 120px inset. `excludeId`
                leaves golf course + spa, which drops it to 2 columns. */}
            <ServiceAndAmenitiesPreview
                excludeId="event-venue"
                overline="Beyond the hall"
                heading="Make a Day of It"
                description="The celebration doesn't need to end at the door — a fairway at golden hour, or an hour on the treatment bed."
            />
        </>
    );
}
