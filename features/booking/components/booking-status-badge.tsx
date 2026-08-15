import type { BookingStatus } from "@/features/booking/types";

/**
 * What a guest is told about the state of their reservation.
 *
 * Two columns decide it, not one: `status` and `paid_at`. 0009 keeps them separate
 * because they answer different questions — a `confirmed` booking with no `paid_at` is a
 * real, reachable state (the row is created before the payment is attempted, see 0011 §5),
 * and calling that "Confirmed" would be a lie the guest could act on.
 *
 * Deliberately never shows the raw column value. `checked_out` is a hotel-desk word.
 */
function describe(status: BookingStatus, paidAt: string | null) {
    switch (status) {
        case "cancelled":
            return { label: "Cancelled", tone: "muted" as const };
        case "checked_in":
            return { label: "You're staying now", tone: "positive" as const };
        case "checked_out":
            return { label: "Completed", tone: "muted" as const };
        // Paid for, the stay has ended, and nobody ever opened the door. Named plainly
        // rather than dressed up as "Completed": the guest knows what happened, and the
        // one thing worse than a wasted booking is a record that pretends otherwise.
        case "no_show":
            return { label: "Not checked in", tone: "muted" as const };
        case "confirmed":
            return paidAt
                ? { label: "Confirmed", tone: "positive" as const }
                : { label: "Payment pending", tone: "warning" as const };
    }
}

const TONE = {
    positive: "border-black/10 bg-black/3 text-black",
    warning: "border-amber-600/25 bg-amber-50 text-amber-800",
    muted: "border-black/10 bg-white text-black/40",
};

export default function BookingStatusBadge({
    status,
    paidAt,
}: {
    status: BookingStatus;
    paidAt: string | null;
}) {
    const { label, tone } = describe(status, paidAt);

    return (
        <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-[14px] font-medium ${TONE[tone]}`}
        >
            {label}
        </span>
    );
}
