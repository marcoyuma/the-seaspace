"use client";

import { useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";

import type { Amenity } from "@/features/stays/types";
import HorizontalLine from "@/ui/horizontal-line";

/**
 * Expandable AMENITIES rows on the stay page. Unlike faq-section.tsx, rows toggle independently —
 * a spec sheet is compared across. Same grid-rows 0fr→1fr trick, animating to auto height.
 */
export default function AmenitiesPanel({
    amenities,
}: {
    amenities: Amenity[];
}) {
    const [openIds, setOpenIds] = useState<Set<string>>(new Set());

    const toggle = (id: string) =>
        setOpenIds((current) => {
            const next = new Set(current);
            if (!next.delete(id)) next.add(id);
            return next;
        });

    return (
        <div className="rounded-[20px] bg-[#F7F8F9] px-8 py-6">
            <h2 className="text-[16px] font-medium tracking-[0.03em] text-black/40 uppercase">
                Amenities
            </h2>

            <div className="mt-5">
                <HorizontalLine />
            </div>

            <ul className="divide-y divide-black/5">
                {amenities.map((amenity) => {
                    const isOpen = openIds.has(amenity.id);

                    return (
                        <li key={amenity.id}>
                            <button
                                type="button"
                                onClick={() => toggle(amenity.id)}
                                aria-expanded={isOpen}
                                className="flex w-full cursor-pointer items-center justify-between gap-4 py-4.5 text-left"
                            >
                                <span className="text-[16px] text-black">
                                    {amenity.label}
                                </span>
                                <CaretDownIcon
                                    size={20}
                                    weight="regular"
                                    aria-hidden
                                    className={`shrink-0 text-black/40 transition-transform duration-300 ease-out motion-reduce:transition-none ${
                                        isOpen ? "rotate-180" : ""
                                    }`}
                                />
                            </button>

                            <div
                                className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                                    isOpen
                                        ? "grid-rows-[1fr]"
                                        : "grid-rows-[0fr]"
                                }`}
                            >
                                <div className="overflow-hidden">
                                    <p className="pr-8 pb-4.5 text-[16px] leading-[1.6] font-medium text-black/60">
                                        {amenity.detail}
                                    </p>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
