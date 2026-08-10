import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getStay, getStays } from "@/features/stays/actions";
import Container from "@/ui/container";
import StayImageCarousel from "@/features/stays/components/stay-image-carousel";
import StayInfoSection from "@/features/stays/components/stay-info-section";
import StayLocationSection from "@/features/stays/components/stay-location-section";

// Prerenders every stay at build time. `stay.id` is the `slug` column, so the URLs stay
// human-readable. Runs at BUILD time, which means the Supabase env vars must exist in the
// build environment (Vercel project settings), not just .env.local.
export async function generateStaticParams() {
    const stays = await getStays();
    return stays.map((stay) => ({ stayId: stay.id }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ stayId: string }>;
}): Promise<Metadata> {
    const { stayId } = await params;
    const stay = await getStay(stayId);

    return {
        title: stay ? `${stay.name}, ${stay.location}` : "Stay not found",
        description: stay?.description,
    };
}

export default async function Page({
    params,
}: {
    params: Promise<{ stayId: string }>;
}) {
    // `params` is a Promise in Next 16 — synchronous access was removed.
    const { stayId } = await params;
    const stay = await getStay(stayId);

    if (!stay) notFound();

    return (
        <>
            {/* Sits outside Container so the rail runs edge to edge. */}
            <StayImageCarousel images={stay.gallery} />

            <Container>
                <StayInfoSection stay={stay} />

                <StayLocationSection stay={stay} />
            </Container>
        </>
    );
}
