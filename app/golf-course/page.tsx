import Container from "@/app/ui/container";
import SectionHeading from "@/app/ui/section-heading";

export const metadata = {
    title: "Golf Course",
};

export default function Page() {
    return (
        <Container>
            <SectionHeading
                title="Eighteen holes between the cliffs and the sea"
                description="A championship layout that follows the coastline hole for hole, with prevailing sea breezes that make no two rounds alike. Clubs, carts and caddies are arranged at the pro shop."
            />
        </Container>
    );
}
