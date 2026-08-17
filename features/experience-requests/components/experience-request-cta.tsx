import { Suspense } from "react";

import { getAuthUser, getGuestProfile } from "@/features/auth/actions";
import ExperienceRequestButton from "@/features/experience-requests/components/experience-request-button";
import type { ExperienceId } from "@/features/experience-requests/types";

/**
 * The CTA the leisure heroes render: the request pill, with the signed-in guest's name and
 * email already filled in.
 *
 * The Suspense boundary is the whole point of this file. `getAuthUser()` reads cookies,
 * which is request-time data — without a boundary that read sits in the hero and drags the
 * entire marketing page, preloaded LCP image and all, out of the static shell. Same
 * pattern, and the same reasoning, as `ProfileIcon` in app/layout.tsx.
 *
 * The fallback is the identical button without the prefill, so a visitor can open the
 * modal before the session resolves rather than staring at a gap where a CTA should be.
 * ⚠️ The trade-off: if someone opens the modal in that window, the swap remounts it and
 * closes it again. It is a few milliseconds on a streamed response, and the alternative —
 * a dead-looking placeholder — is worse on a page whose job is this button.
 */
export default async function ExperienceRequestCta({
    experience,
}: {
    experience: ExperienceId;
}) {
    return (
        <Suspense fallback={<ExperienceRequestButton experience={experience} />}>
            <PrefilledCta experience={experience} />
        </Suspense>
    );
}

/** The half that touches cookies, kept behind the boundary above. */
async function PrefilledCta({ experience }: { experience: ExperienceId }) {
    const [user, profile] = await Promise.all([getAuthUser(), getGuestProfile()]);

    return (
        <ExperienceRequestButton
            experience={experience}
            // `fullName` first: `displayName` is the public review-card form ('Amara L.'),
            // which is not the name to ask for at the clubhouse desk. Both are undefined
            // for a signed-out visitor, and the fields render empty.
            defaultName={profile?.fullName ?? profile?.displayName ?? undefined}
            defaultEmail={user?.email || undefined}
        />
    );
}
