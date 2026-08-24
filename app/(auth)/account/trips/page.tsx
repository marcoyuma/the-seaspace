import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getAuthUser } from "@/features/auth/actions";
import { getGuestBookings } from "@/features/booking/actions";
import TripCard from "@/features/booking/components/trip-card";

export const metadata = { title: "Trips" };

/**
 * Every reservation belonging to the signed-in guest.
 *
 * The heading and intro are static so Cache Components has a shell to prerender; the
 * reservations themselves read cookies, which is request-time data and must therefore sit
 * inside a <Suspense> boundary. Before aa44990 the deleted app/loading.tsx was that
 * boundary for the whole app — this page now carries its own.
 */
export default function TripsPage() {
    return (
        <div className="mx-auto w-full max-w-7xl px-6 py-24">
            <h1 className="text-[48px] leading-none font-semibold text-black">
                Trips
            </h1>
            <p className="mt-6 max-w-128.25 text-[16px] font-medium text-black/60">
                Newest stay first. Cancelled reservations stay on this list —
                they are records, not drafts.
            </p>

            <Suspense fallback={<TripsListFallback />}>
                <TripsList />
            </Suspense>
        </div>
    );
}

/**
 * The guest's reservations.
 *
 * The `redirect()` is the authoritative check even though proxy.ts already covers
 * `/account/*` — Proxy runs on prefetches and must never be the only line of defence. Same
 * arrangement, and the same reasoning, as app/(auth)/account/page.tsx.
 */
async function TripsList() {
    const [user, bookings] = await Promise.all([
        getAuthUser(),
        getGuestBookings(),
    ]);

    if (!user) redirect("/login?next=/account/trips");

    if (bookings.length === 0) {
        return (
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
        );
    }

    return (
        <ul className="mt-16 flex flex-col gap-5 border-t border-black/10 pt-12">
            {bookings.map((booking) => (
                <TripCard key={booking.id} booking={booking} />
            ))}
        </ul>
    );
}

/** Placeholder rows at roughly TripCard's height, so the shell does not jump on hydration. */
function TripsListFallback() {
    return (
        <div
            aria-hidden
            className="mt-16 flex flex-col gap-5 border-t border-black/10 pt-12"
        >
            {[0, 1, 2].map((row) => (
                <div
                    key={row}
                    className="h-48 rounded-3xl border border-black/10 bg-black/3"
                />
            ))}
        </div>
    );
}
