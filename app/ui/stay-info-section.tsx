import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

import type { Stay } from "@/app/_lib/stays";
import { playfair } from "@/app/_styles/fonts";
import AmenitiesPanel from "@/app/ui/amenities-panel";
import HorizontalLine from "@/app/ui/horizontal-line";

/** Uppercase field label sitting above a hairline, e.g. "BED TYPE". */
function SpecField({
    label,
    value,
    note,
}: {
    label: string;
    value: string;
    note?: string;
}) {
    return (
        <div>
            <h3 className="text-[16px] font-medium tracking-[0.03em] text-black/40 uppercase">
                {label}
            </h3>

            <div className="mt-3.5">
                <HorizontalLine />
            </div>

            <p className="mt-4 text-[16px] text-black">{value}</p>
            {note && <p className="mt-1 text-[16px] text-black/40">{note}</p>}
        </div>
    );
}

/**
 * The block beneath the image rail: breadcrumb, headline, description and
 * booking CTA on the left; the expandable amenities panel on the right.
 * Server Component — only the panel needs interactivity.
 */
export default function StayInfoSection({ stay }: { stay: Stay }) {
    return (
        <div className="grid grid-cols-2 gap-x-16 pt-10">
            <div>
                <nav
                    aria-label="Breadcrumb"
                    className="flex items-center gap-2 text-[16px]"
                >
                    <Link href="/stays" className="text-black hover:underline">
                        All rooms
                    </Link>
                    <CaretRightIcon
                        size={14}
                        weight="bold"
                        aria-hidden
                        className="text-black/30"
                    />
                    <span className="text-black/50">{stay.name}</span>
                </nav>

                <h1
                    className={`${playfair.className} mt-4 text-[56px] leading-[1.1] text-black`}
                >
                    {stay.name}
                </h1>

                <p className="mt-6 max-w-140 text-[16px] leading-[1.6] font-medium text-black/50">
                    {stay.description}
                </p>

                <Link
                    href={`/stays/${stay.id}/book`}
                    className="mt-10 inline-block rounded-[40px]  bg-[#131A2B] px-8 py-3 text-[16px] font-medium text-white transition-opacity duration-200 ease-out hover:opacity-90 motion-reduce:transition-none"
                >
                    Book room
                </Link>

                <div className="mt-14 grid grid-cols-2 gap-x-6">
                    <SpecField
                        label="Bed type"
                        value={stay.bedType.label}
                        note={stay.bedType.note}
                    />
                    <SpecField label="Capacity" value={stay.capacityLabel} />
                </div>
            </div>

            <AmenitiesPanel amenities={stay.amenities} />
        </div>
    );
}
