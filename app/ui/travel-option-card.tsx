import { ReactNode } from "react";

/**
 * One "how to get here" option: icon + lowercase title, a short description,
 * and a pill CTA that opens an external booking/navigation site in a new tab.
 * Plain <a> rather than next/link — every destination is off-site.
 */
export default function TravelOptionCard({
    icon,
    title,
    description,
    ctaLabel,
    href,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    ctaLabel: string;
    href: string;
}) {
    return (
        <div className="flex flex-col justify-between rounded-[16px] border border-black/[0.06] bg-white p-6">
            <div>
                <div className="flex items-center gap-2.5 text-black">
                    {icon}
                    <h3 className="text-[20px] tracking-[-1%]">{title}</h3>
                </div>

                <p className="mt-4 text-[16px] leading-[1.6] font-medium text-black/50">
                    {description}
                </p>
            </div>

            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 self-start rounded-full bg-black/[0.04] px-5 py-3 text-[16px] text-black transition-colors duration-200 ease-out hover:bg-black/[0.08] motion-reduce:transition-none"
            >
                {ctaLabel}
            </a>
        </div>
    );
}
