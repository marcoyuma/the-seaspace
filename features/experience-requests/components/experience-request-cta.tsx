import { Suspense } from "react";

import { getAuthUser, getGuestProfile } from "@/features/auth/actions";
import ExperienceRequestButton from "@/features/experience-requests/components/experience-request-button";
import type { ExperienceId } from "@/features/experience-requests/types";

/**
 * Leisure-hero CTA with the guest's name/email prefilled. The Suspense boundary is the point:
 * `getAuthUser()` reads cookies and would drag the page out of the static shell. ⚠️ The fallback is the
 * same button unfilled; if opened before the session resolves, the swap remounts and closes it.
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
