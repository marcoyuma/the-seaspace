"use client";

import { useState } from "react";

import { EXPERIENCE_REQUESTS } from "@/features/experience-requests/lib/experiences";
import ExperienceRequestForm from "@/features/experience-requests/components/experience-request-form";
import type { ExperienceId } from "@/features/experience-requests/types";
import Modal from "@/ui/modal";
import PillButton from "@/ui/pill-button";

/**
 * The pill that opens the request modal, and the modal itself.
 *
 * This is the `"use client"` boundary for the whole feature, and it is drawn as small as
 * it can be on purpose: the heroes on `/golf-course` and `/spa` stay Server Components, so
 * their headlines, blur placeholders and the preloaded LCP image all keep prerendering.
 * Only this button and the dialog behind it ship as JavaScript.
 *
 * Prefer `ExperienceRequestCta` over importing this directly — it adds the signed-in
 * guest's details.
 *
 * @param experience Which page this sits on. Picks the copy, and travels to the action.
 */
export default function ExperienceRequestButton({
    experience,
    defaultName,
    defaultEmail,
}: {
    experience: ExperienceId;
    defaultName?: string;
    defaultEmail?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const config = EXPERIENCE_REQUESTS[experience];

    return (
        <>
            <PillButton variant="gradient" onClick={() => setIsOpen(true)}>
                {config.ctaLabel}
            </PillButton>

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                label={config.title}
            >
                <ExperienceRequestForm
                    experience={experience}
                    defaultName={defaultName}
                    defaultEmail={defaultEmail}
                    onDone={() => setIsOpen(false)}
                />
            </Modal>
        </>
    );
}
