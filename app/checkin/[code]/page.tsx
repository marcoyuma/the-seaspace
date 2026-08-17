import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getCheckInInvite } from "@/features/booking/actions";
import CheckInButton from "@/features/booking/components/check-in-button";
import { formatFullDate } from "@/features/booking/lib/dates";

export const metadata: Metadata = {
    title: "Check in",
    // Never indexed, and never previewed. A crawler or a chat client that fetched one of
    // these would be fetching somebody's door.
    robots: { index: false, follow: false, nocache: true },
};

/**
 * What the QR on a reservation opens.
 *
 * Deliberately **outside** the `(auth)` group and outside `proxy.ts`'s protected routes:
 * whoever is standing at the door may not be signed in. The partner on the earlier flight,
 * the guest whose session expired mid-air, the friend collecting the keys — all of them
 * hold the code, and none of them can be asked to log in on a doorstep at midnight.
 *
 * The code is the credential, and what it can reach is bounded by the database rather than
 * by this page: `get_check_in_invite()` returns a villa, two dates and a boolean — its
 * return type is the allow-list — and `check_in_booking()` performs exactly one status
 * transition. Neither can see the price, the notes or the guest.
 *
 * ⚠️ **Opening this page checks nobody in.** It renders a button that POSTs to a Server
 * Action. Link prefetchers, chat previews and antivirus scanners all follow `GET`s, so a
 * URL that acted on sight would check a guest in from a WhatsApp preview of their own
 * booking — hours before they landed.
 */
export default async function CheckInPage({
    params,
}: {
    params: Promise<{ code: string }>;
}) {
    const { code } = await params;
    const invite = await getCheckInInvite(code);

    // One 404 for every failure: an unknown code, a cancelled booking, a stay that already
    // ended. Distinguishing them would tell whoever is guessing that they were close.
    if (!invite) notFound();

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col px-6 py-24">
            <p className="text-[18px] font-medium text-[#0F677D]">
                The Seaspace
            </p>

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
                            Press this to unlock the door and start your stay. If
                            nothing happens, the lock box beside the door takes
                            the same code.
                        </p>
                        <CheckInButton code={code} />
                    </>
                )}
            </div>
        </div>
    );
}
