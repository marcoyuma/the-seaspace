import Link from "next/link";
import { redirect } from "next/navigation";

import { getAuthUser } from "@/features/auth/actions";
import { getGuestBookings } from "@/features/booking/actions";
import TripCard from "@/features/booking/components/trip-card";

export const metadata = { title: "Trips" };

/**
 * Every reservation belonging to the signed-in guest.
 *
 * The `redirect()` is the authoritative check even though proxy.ts already covers
 * `/account/*` — Proxy runs on prefetches and must never be the only line of defence. Same
 * arrangement, and the same reasoning, as app/(auth)/account/page.tsx.
 *
 * Not wrapped in <Suspense>: the whole page is per-guest, so a static shell would buy
 * nothing and would only delay the fallback redirect.
 */
export default async function TripsPage() {
    const [user, bookings] = await Promise.all([
        getAuthUser(),
        getGuestBookings(),
    ]);

    if (!user) redirect("/login?next=/account/trips");

    return (
        <div className="mx-auto w-full max-w-7xl px-6 py-24">
            <h1 className="text-[48px] leading-none font-semibold text-black">
                Trips
            </h1>
            <p className="mt-6 max-w-128.25 text-[16px] font-medium text-black/60">
                Newest stay first. Cancelled reservations stay on this list — they
                are records, not drafts.
            </p>

            {bookings.length === 0 ? (
                <div className="mt-16 border-t border-black/10 pt-12">
                    <p className="max-w-128.25 text-[16px] font-medium text-black/60">
                        You have not booked anything yet.
                    </p>
                    <Link
                        href="/stays"
                        className="mt-8 inline-block text-[16px] font-medium text-black underline underline-offset-4"
                    >
                        Browse the villas
                    </Link>
                </div>
            ) : (
                <ul className="mt-16 flex flex-col gap-5 border-t border-black/10 pt-12">
                    {bookings.map((booking) => (
                        <TripCard key={booking.id} booking={booking} />
                    ))}
                </ul>
            )}
        </div>
    );
}
