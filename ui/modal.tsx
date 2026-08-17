"use client";

import { useEffect, useRef } from "react";

/**
 * The dialog shell every modal on the site sits in: backdrop, panel, and the four
 * behaviours a modal is wrong without.
 *
 * Presentational only — it owns no feature state, just the open/close contract. The
 * behaviour here was written first inside
 * `features/booking/components/booking-modal.tsx`; extracting it means the next modal is
 * consistent by construction rather than by copy-paste.
 *
 * ⚠️ `booking-modal.tsx` has NOT been migrated onto this shell. It is on the critical path
 * of the paid flow, so that move belongs in its own commit with its own manual check.
 * Until then the two must be kept in step by hand.
 *
 * @param label - The dialog's accessible name. There is no visible-title convention here,
 *   so every caller must supply one.
 * @param maxWidth - A Tailwind `max-w-*` class. The panel is otherwise full-width.
 *
 * @example
 * <Modal isOpen={isOpen} onClose={close} label="Request a tee time" maxWidth="max-w-140">
 *     <RequestForm />
 * </Modal>
 */
export default function Modal({
    isOpen,
    onClose,
    label,
    maxWidth = "max-w-140",
    children,
}: {
    isOpen: boolean;
    onClose: () => void;
    label: string;
    maxWidth?: string;
    children: React.ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Escape closes it — same pattern as ui/menu-panel.tsx, listener attached only while
    // open so a closed modal is not sitting on every keystroke in the page.
    useEffect(() => {
        if (!isOpen) return;

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isOpen, onClose]);

    // Move focus into the dialog on open, and stop the page behind it scrolling. Without
    // the first, a keyboard user's focus stays on the CTA underneath and Tab walks the
    // page instead of the dialog.
    useEffect(() => {
        if (!isOpen) return;

        panelRef.current?.focus();

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);

    return (
        <div
            // Kept mounted rather than conditionally rendered, as ui/menu-panel.tsx does,
            // so the fade plays on the way out as well as in. `inert` while closed keeps
            // the whole subtree out of the tab order and away from screen readers, which
            // `invisible` alone would not guarantee.
            inert={!isOpen}
            onMouseDown={(event) => {
                // `mousedown`, and only when the press LANDED on the backdrop itself: a
                // drag that starts inside the panel bubbles up here too, and closing on
                // that would dismiss the modal every time someone selected text.
                if (event.target === event.currentTarget) onClose();
            }}
            className={`fixed inset-0 z-1150 flex items-center justify-center bg-black/40 p-6 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                isOpen
                    ? "opacity-100"
                    : "pointer-events-none invisible opacity-0"
            }`}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                className={`max-h-full w-full ${maxWidth} overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl transition-transform duration-200 ease-out focus:outline-none motion-reduce:transition-none ${
                    isOpen ? "scale-100" : "scale-95"
                }`}
            >
                {children}
            </div>
        </div>
    );
}
