import Heading from "@/ui/heading";
import AmenityBadge from "@/features/services/components/amenity-badge";
import {
    BarbellIcon,
    ChefHatIcon,
    ForkKnifeIcon,
    LetterCirclePIcon,
    PersonSimpleSnowboardIcon,
    PersonSimpleSwimIcon,
    RssIcon,
    SailboatIcon,
    WavesIcon,
} from "@phosphor-icons/react/dist/ssr";

/**
 * Data source for the list of services/amenities.
 * Structured row-by-row (array of arrays) to facilitate row-based grid/flex layouts
 * and allow rendering via `map` without duplicating JSX.
 *
 * Note: Ideally, this data should be moved to a CMS or a separate constants file
 * if the list of services is likely to change frequently or be managed by non-developers.
 */
const SERVICE_ROWS: { icon: React.ReactNode; text: string }[][] = [
    [
        {
            icon: <PersonSimpleSwimIcon size={24} fill="white" />,
            text: "Private infinity pool",
        },
        {
            icon: <ForkKnifeIcon size={24} fill="white" />,
            text: "Included breakfast",
        },
        { icon: <RssIcon size={24} fill="white" />, text: "Fast wifi" },
        {
            icon: <BarbellIcon size={24} fill="white" />,
            text: "GYM and wellness",
        },
    ],
    [
        {
            icon: <ChefHatIcon size={24} fill="white" />,
            text: "Dining area with beautiful views",
        },
        {
            icon: <LetterCirclePIcon size={24} fill="white" />,
            text: "Free private parking",
        },
        { icon: <SailboatIcon size={24} fill="white" />, text: "Kayakking" },
    ],
    [
        {
            icon: <PersonSimpleSnowboardIcon size={24} fill="white" />,
            text: "Surfing and snorkling",
        },
        {
            icon: <WavesIcon size={24} fill="white" />,
            text: "Private beach access",
        },
    ],
];

export default function MoreServiceAndAmenities() {
    return (
        <section className="relative mb-27.5" id="amenities">
            {/*
                The content is absolutely positioned over the gradient background.
                This approach is used so that the section's height is determined by
                the background div (h-160), while the content can be centered
                independently without affecting the surrounding document flow.
            */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Heading variant="white" classname="mb-13.25">
                    And so much more
                </Heading>

                {/* Render each service row from SERVICE_ROWS. */}
                {SERVICE_ROWS.map((row, rowIndex) => (
                    // Use the index as the key because the row order is static—it is not reordered.
                    <div
                        key={rowIndex}
                        className="flex flex-row gap-2.5 mb-5.75"
                    >
                        {row.map((service) => (
                            // Use `text` for the key because it is unique per item and stable across renders.
                            <AmenityBadge
                                key={service.text}
                                icon={service.icon}
                                text={service.text}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/*
               Background gradient section.
                Fixed height (h-160) to match the design; -z-10 to position it
                behind the absolutely positioned content above.
            */}
            <div className="bg-linear-to-b from-[#2c8de2] via-[#267cc7] via-[#216cae] via-[#1c5c94] to-[#184d7c] h-160 -z-10" />
        </section>
    );
}
