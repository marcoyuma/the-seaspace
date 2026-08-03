import { PersonSimpleSwimIcon } from "@phosphor-icons/react/dist/ssr";
import React from "react";

export default function AmenityBadge({
    icon,
    text,
}: {
    icon: React.ReactNode;
    text: string;
}) {
    return (
        <div className="flex justify-center items-center gap-2 px-3.25 py-3.25 bg-[#298BE0] rounded-[20px] w-fit h-11">
            {icon}
            <h3 className="font-semibold text-[16px] text-white">{text}</h3>
        </div>
    );
}
