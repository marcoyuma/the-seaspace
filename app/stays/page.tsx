import Link from "next/link";

import { getStays } from "@/app/_lib/stays";
import Container from "@/app/ui/container";
import SectionHeading from "@/app/ui/section-heading";
import StayCard from "@/app/ui/stay-card";

export const metadata = {
    title: "Stays",
};

export default async function Page() {
    const stays = await getStays();

    return (
        <Container>
            <SectionHeading
                title="Allow us to guide you to your suite"
                description="Every bedroom in our Grade-II listed Mansion and contemporary West Wing has been given the luxury treatment. So no matter where you lay your head, sink-into-me sheets and a king-size bed come as standard."
            />

            <div className="grid grid-cols-2 gap-x-6 gap-y-12">
                {stays.map((stay) => (
                    <Link key={stay.id} href={`/stays/${stay.id}`}>
                        <StayCard
                            imageSrc={stay.imageSrc}
                            name={stay.name}
                            location={stay.location}
                            pricePerNight={stay.pricePerNight}
                            capacity={stay.capacity}
                            beds={stay.beds}
                            area={stay.area}
                            isNew={stay.isNew}
                        />
                    </Link>
                ))}
            </div>
        </Container>
    );
}
