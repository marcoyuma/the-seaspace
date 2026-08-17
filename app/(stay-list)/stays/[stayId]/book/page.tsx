import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { getAuthUser } from "@/features/auth/actions";
import { getStayBookedRanges } from "@/features/booking/actions";
import CheckoutForm from "@/features/booking/components/checkout-form";
import CheckoutRecap from "@/features/booking/components/checkout-recap";
import {
    buildCheckoutUrl,
    parseCheckoutParams,
    type RawSearchParams,
} from "@/features/booking/lib/checkout-params";
import {
    expandBlockedDays,
    propertyTodayISO,
    rangeIsFree,
} from "@/features/booking/lib/dates";
import { getStay } from "@/features/stays/actions";
import { guestsBooked } from "@/features/booking/types";
import Container from "@/ui/container";

export const metadata: Metadata = {
    title: "Confirm and pay",
    // No index: every URL here is one person's half-finished booking.
    robots: { index: false, follow: false },
};

/**
 * Checkout. The selection arrives in the query string; everything else is looked up here.
 *
 * ⚠️ Nothing in the URL is trusted. The dates and headcount are re-parsed
 * (`parseCheckoutParams`), the price is re-read from the catalogue, availability is
 * re-checked against the database, and then `create_booking` checks all of it a second
 * time — because this page is not what performs the write.
 *
 * Dynamic by construction: it reads `searchParams` and the session cookie. The root
 * `app/loading.tsx` is the Suspense boundary that keeps Cache Components happy, the same
 * arrangement `/account` relies on.
 *
 * There is no `generateStaticParams()` here on purpose, unlike the stay page one level up:
 * a prerendered shell for a page that is entirely per-request buys nothing.
 */
export default async function BookPage({
    params,
    searchParams,
}: {
    params: Promise<{ stayId: string }>;
    searchParams: Promise<RawSearchParams>;
}) {
    const [{ stayId }, rawSearchParams] = await Promise.all([
        params,
        searchParams,
    ]);

    const parsed = parseCheckoutParams(rawSearchParams);

    // A truncated or hand-edited link. Back to the villa, where the picker can produce a
    // real one — a half-filled checkout would be a worse answer than starting over.
    if (!parsed) redirect(`/stays/${stayId}`);

    const { selection, guests } = parsed;
    const { checkIn, checkOut } = selection;

    const [user, stay, bookedRanges] = await Promise.all([
        getAuthUser(),
        getStay(stayId),
        getStayBookedRanges(stayId),
    ]);

    if (!stay) notFound();

    // The authoritative check. proxy.ts already bounces signed-out visitors from
    // `/stays/*/book` so the redirect is a real HTTP one rather than a delayed meta
    // refresh, but Proxy also runs on prefetches and must never be the only line of
    // defence — same reasoning as app/(auth)/account/page.tsx.
    if (!user) {
        const next = buildCheckoutUrl(stayId, checkIn, checkOut, guests);
        redirect(`/login?next=${encodeURIComponent(next)}`);
    }

    // Why the page checks availability at all when the database will reject an overlap
    // anyway: the guest may have sat on this page for an hour, or arrived from a
    // bookmarked link. Telling them now beats taking a payment intent and failing.
    const unavailable = !rangeIsFree(
        checkIn,
        checkOut,
        expandBlockedDays(bookedRanges),
    );

    const today = propertyTodayISO();
    const inThePast = checkIn < today;
    const overCapacity = guestsBooked(guests) > stay.capacity;

    const disabledReason = inThePast
        ? "Those dates have already started. Pick new ones."
        : unavailable
          ? "Someone booked these nights while this page was open. Pick different dates."
          : overCapacity
            ? `This villa sleeps ${stay.capacity}. Lower the party size to continue.`
            : undefined;

    return (
        <Container>
            <div className="pt-16 pb-24">
                <h1 className="text-[48px] leading-none font-semibold text-black">
                    Confirm and pay
                </h1>
                <p className="mt-6 max-w-160 text-[16px] font-medium text-black/60">
                    Your dates are held as soon as you confirm, and released again
                    straight away if the payment does not go through.
                </p>

                {/* Said once, up front, in the guest's own words. The same sentence
                    appears under the button, because that is where the decision is
                    actually made. */}
                <p className="mt-8 max-w-160 rounded-2xl border border-black/10 bg-black/3 px-5 py-4 text-[16px] font-medium text-black/60">
                    <span className="font-medium text-black">Demo checkout.</span>{" "}
                    No payment is processed and no card details are collected — the
                    reservation itself is real and will appear in your trips.
                </p>

                {/* Stacked on mobile/tablet, recap first — a guest should see which villa
                    and what it costs before working through payment and check-in.
                    `order-*` restores the original left-form/right-recap reading order at
                    lg, where the grid switches to two columns side by side. */}
                <div className="mt-14 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_26rem]">
                    <div className="order-1 lg:order-2">
                        <CheckoutRecap
                            stay={stay}
                            checkIn={checkIn}
                            checkOut={checkOut}
                            guests={guests}
                        />
                    </div>

                    <div className="order-2 lg:order-1">
                        <CheckoutForm
                            slug={stay.id}
                            checkIn={checkIn}
                            checkOut={checkOut}
                            guests={guests}
                            disabledReason={disabledReason}
                        />
                    </div>
                </div>
            </div>
        </Container>
    );
}
