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
 * Services as rows (array of arrays), so the 4-3-2 pyramid renders via `map` without duplicated
 * JSX. Belongs in a CMS once non-developers manage it.
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
            {/* Gradient rendered FIRST, not via `-z-10`: this `relative` section has no z-index, so a
                negative one escaped to an ancestor's stacking context and vanished behind the page.
                Below `md` it fills the section; from `md` its fixed `h-160` sets the section height. */}
            <div className="absolute inset-0 bg-linear-to-b from-[#2c8de2] via-[#267cc7] via-[#216cae] via-[#1c5c94] to-[#184d7c] md:static md:h-160" />

            {/* From `md`, content sits absolutely over the gradient, which sets the height. Below
                `md`, wrapped badges can exceed 640px, so content flows and the gradient fills behind. */}
            <div className="relative flex flex-col items-center justify-center px-4 py-16 md:absolute md:inset-0 md:px-0 md:py-0">
                {/* No overline/text here, so `mb-5` (20px) is the heading-to-content gap — a bit
                    roomier than an intro block's 12px (RESPONSIVE-AUDIT.md Bagian F). */}
                <Heading variant="white" className="text-center mb-5">
                    And so much more
                </Heading>

                {/* Below `md`, one wrap container (rows dropped via `contents`) with a uniform 10px
                    gap; from `md`, a column whose 23px gap spaces the pyramid's rows. */}
                <div className="flex flex-row flex-wrap justify-center gap-2.5 md:flex-col md:flex-nowrap md:gap-5.75">
                    {SERVICE_ROWS.map((row, rowIndex) => (
                        // `contents` drops the row box below `md`: the 4-3-2 pyramid can't survive a
                        // narrow viewport, and flex `gap` on both axes mixed 10px and 23px rhythms.
                        // Index key is fine — row order is static.
                        <div
                            key={rowIndex}
                            className="contents md:flex md:flex-row md:flex-wrap md:justify-center md:gap-x-2.5 md:gap-y-5.75"
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
            </div>
        </section>
    );
}
