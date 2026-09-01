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
               Background gradient — rendered FIRST in the DOM (not via
                negative z-index) so it paints behind the content below
                through normal stacking order alone. A `-z-10` approach was
                tried here but this `<section>` has `position:relative`
                without its own `z-index`, so it never becomes its own
                stacking context — the negative z-index escaped to whatever
                ancestor DOES establish one, painting the gradient behind
                other unrelated page content instead of just behind this
                section's own copy (the gradient and the heading over it both
                went invisible against the page's white background).
                <md: fills the section behind the in-flow content below.
                >=md: fixed height (h-160) to match the design, establishing
                the section's height itself.
            */}
            <div className="absolute inset-0 bg-linear-to-b from-[#2c8de2] via-[#267cc7] via-[#216cae] via-[#1c5c94] to-[#184d7c] md:static md:h-160" />

            {/*
                >=md: content is absolutely positioned over the gradient
                background, so the section's height is driven by the
                background div (h-160) while content centers independently.
                <md: badges wrap (see flex-wrap below) and can need more
                than 640px, so content instead flows normally and the
                background switches to `absolute inset-0` to fill whatever
                height that content ends up needing.
            */}
            <div className="relative flex flex-col items-center justify-center px-4 py-16 md:absolute md:inset-0 md:px-0 md:py-0">
                {/* Landing-page headings are pinned to 36px instead of
                    `ui/heading.tsx`'s default 48px. No overline/text here —
                    `mb-5` (20px) is the heading-to-content gap, a bit more
                    room than the 12px used within a full intro block — see
                    RESPONSIVE-AUDIT.md Bagian F. */}
                <Heading variant="white" className="text-center mb-5">
                    And so much more
                </Heading>

                {/*
                    <md: one single wrap container holding all badges, so the
                    row grouping is dropped (see `contents` below) and every
                    gap — horizontal and vertical — is the same 10px.
                    >=md: turns into a column whose `gap-5.75` (23px) is the
                    spacing between the pyramid's rows.
                */}
                <div className="flex flex-row flex-wrap justify-center gap-2.5 md:flex-col md:flex-nowrap md:gap-5.75">
                    {SERVICE_ROWS.map((row, rowIndex) => (
                        // `display:contents` drops this row box below md: the
                        // 4-3-2 pyramid can't survive a narrow viewport anyway,
                        // and keeping the rows there mixed two vertical rhythms
                        // — flex `gap` applies to BOTH axes, so wrapped badges
                        // sat 10px apart while the row groups sat 23px apart.
                        // Use the index as the key because the row order is static—it is not reordered.
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
