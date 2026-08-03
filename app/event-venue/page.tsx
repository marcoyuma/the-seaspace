import Container from "@/components/ui/container";
import SectionHeading from "@/components/ui/section-heading";

export const metadata = {
    title: "Event Venue",
};

export default function Page() {
    return (
        <Container>
            <SectionHeading
                title="One address for weddings, retreats and everything after"
                description="A pavilion, a walled garden and two private dining rooms, each bookable on its own or together. Tell us the date and the headcount, and our events team will shape the rest around it."
            />
        </Container>
    );
}
