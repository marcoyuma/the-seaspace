"use client";

// Client-side only for the open/closed flag. Everything shown inside is rendered on the
// server and handed in as `children`, so no review data and no data-fetching code crosses
// the boundary — the same arrangement ReviewsPanel (server) uses around ReviewCarousel
// (client).
import { useState } from "react";

import Modal from "@/ui/modal";
import PillButton from "@/ui/pill-button";

/**
 * "Show all reviews" — the trigger, and the dialog it opens.
 *
 * Built on `ui/modal.tsx`, which already owns the four behaviours a modal is wrong without
 * (Escape, backdrop click, focus move, scroll lock). Deliberately not on
 * `features/booking/components/booking-modal.tsx`: that one predates the shared shell, sits
 * on the critical path of the paid flow, and its own note says the two must be kept in step
 * by hand until it is migrated. Nothing here touches it.
 *
 * @param triggerLabel - Carries the count, e.g. "Show all 25 reviews", so the button says
 *   what it opens rather than making the reader guess how much more there is.
 * @param label - The dialog's accessible name. `Modal` has no visible-title convention, so
 *   every caller supplies one.
 * @param children - The full review list, server-rendered.
 *
 * @example
 * <StayReviewsModal triggerLabel="Show all 25 reviews" label="Reviews for Coastal Arch Retreat">
 *     <ul>…</ul>
 * </StayReviewsModal>
 */
export default function StayReviewsModal({
    triggerLabel,
    label,
    children,
}: {
    triggerLabel: string;
    label: string;
    children: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* `outline`, the same variant the "Explore stays" CTA uses — this is a
                secondary action next to the villa's own booking CTA, and a gradient pill
                here would compete with it. */}
            <PillButton
                variant="outline"
                onClick={() => setIsOpen(true)}
                aria-expanded={isOpen}
                className="shrink-0"
            >
                {triggerLabel}
            </PillButton>

            {/* Wider than Modal's 140 default: these are full-width quotes rather than a
                form, and at max-w-140 the longer ones run to six or seven lines. */}
            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                label={label}
                maxWidth="max-w-160"
            >
                {children}
            </Modal>
        </>
    );
}
