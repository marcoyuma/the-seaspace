import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";

import { getCheckInInvite } from "@/features/booking/actions";
import CheckInButton from "@/features/booking/components/check-in-button";
import { formatFullDate } from "@/features/booking/lib/dates";
import OverlineText from "@/ui/overline-text";

export const metadata: Metadata = {
    title: "Check in",
    // Never indexed, and never previewed. A crawler or a chat client that fetched one of
    // these would be fetching somebody's door.
    robots: { index: false, follow: false, nocache: true },
};

/**
 * What the reservation QR opens — deliberately outside `(auth)` and Proxy's protection, as whoever is
 * at the door may be signed out; the DB bounds what the code reaches. ⚠️ **Opening this page checks
 * nobody in**: a button POSTs, since previews and scanners follow GETs.
 */
export default function CheckInPage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col px-6 py-24">
            <OverlineText>The Seaspace</OverlineText>

            <Suspense fallback={<InviteFallback />}>
                <Invite params={params} />
            </Suspense>
        </div>
    );
}

/**
 * The reservation the code opens — all request-time (no `generateStaticParams()`, and an uncached
 * invite that changes at check-in), so it sits behind a boundary; the wordmark is the static shell.
 */
async function Invite({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const invite = await getCheckInInvite(code);

    // One 404 for every failure: an unknown code, a cancelled booking, a stay that already
    // ended. Distinguishing them would tell whoever is guessing that they were close.
    if (!invite) notFound();

    return (
        <>
            <h1 className="mt-6 text-[48px] leading-none font-semibold text-black">
                {invite.alreadyCheckedIn ? "You're already in" : "Welcome"}
            </h1>

            <p className="mt-6 text-[16px] font-medium text-black/60">
                {invite.stayName}, {invite.stayLocation}
            </p>
            <p className="mt-2 text-[16px] font-medium text-black/60">
                {formatFullDate(invite.checkIn)} –{" "}
                {formatFullDate(invite.checkOut)}
            </p>

            <div className="mt-14 border-t border-black/10 pt-12">
                {invite.alreadyCheckedIn ? (
                    <p className="text-[16px] font-medium text-black/60">
                        This villa has already been checked into, so the door is
                        open. If it will not let you in, use the lock box beside
                        it — the same code works there.
                    </p>
                ) : (
                    <>
                        <p className="mb-8 max-w-140 text-[16px] font-medium text-black/60">
                            Press this to unlock the door and start your stay.
                            If nothing happens, the lock box beside the door
                            takes the same code.
                        </p>
                        <CheckInButton code={code} />
                    </>
                )}
            </div>
        </>
    );
}

/** Holds the heading and detail lines' space while the code is looked up. */
function InviteFallback() {
    return (
        <div aria-hidden>
            <div className="mt-6 h-12 w-72 max-w-full rounded bg-black/5" />
            <div className="mt-6 h-6 w-96 max-w-full rounded bg-black/5" />
            <div className="mt-2 h-6 w-80 max-w-full rounded bg-black/5" />
            <div className="mt-14 h-40 border-t border-black/10 pt-12" />
        </div>
    );
}
