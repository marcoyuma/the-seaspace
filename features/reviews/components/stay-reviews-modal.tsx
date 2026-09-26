"use client";

// Client only for the open flag. The contents are server-rendered `children`, so no review data
// or fetching crosses the boundary (as ReviewsPanel does around ReviewCarousel).
import { useState } from "react";

import Modal from "@/ui/modal";
import PillButton from "@/ui/pill-button";

/**
 * "Show all reviews" trigger + dialog, on `ui/modal.tsx` — not `booking-modal.tsx`, which predates
 * the shared shell, sits on the paid flow and is kept in step by hand until migrated.
 *
 * @param triggerLabel - Carries the count ("Show all 25 reviews"), so the button says what it opens.
 * @param label - The dialog's accessible name; `Modal` has no visible-title convention.
 * @param children - The full review list, server-rendered.
 *
 * @example <StayReviewsModal triggerLabel="Show all 25 reviews" label="Reviews"><ul>…</ul></StayReviewsModal>
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
