import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

export default function ReviewContent({
    displayName,
    nationality,
}: {
    displayName: string;
    nationality: string;
}) {
    return (
        <div className="flex gap-1">
            <UserCircleIcon size={54} color="black" weight="fill" />
            <div className="flex flex-col gap-0 inset-0 justify-center">
                <h3 className="text-[16px] font-semibold text-black">
                    {displayName}
                </h3>
                {/* Guarded, not rendered unconditionally. `author_nationality` is NOT NULL
                    but its "unknown" value is the empty string — the signup form makes
                    nationality optional, and the anonymise branch of account deletion
                    writes `''` outright (ACCOUNT-DELETION-POLICY.md). An empty <p> still
                    occupies a line box, so without this the card would carry a blank
                    second row for any guest who never gave one. */}
                {nationality && (
                    <p className="text-[16px] font-medium text-black/60">
                        {nationality}
                    </p>
                )}
            </div>
        </div>
    );
}
