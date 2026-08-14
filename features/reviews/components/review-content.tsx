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
                <p className="text-[16px] font-semibold text-black/30">
                    {nationality}
                </p>
            </div>
        </div>
    );
}
