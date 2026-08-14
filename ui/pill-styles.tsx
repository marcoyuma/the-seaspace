export type PillVariant = "gradient" | "white" | "outline";

// Shape shared by both variants, so the CTAs can't drift apart again.
// `overflow-hidden` keeps the gradient layer inside the 40px corners.
const PILL_BASE =
    "group relative inline-flex items-center justify-center overflow-hidden rounded-[40px] px-4 py-3 text-[16px] font-medium";

// Same 300ms/ease-out as the panel's nav links, so a CTA next to the menu
// feels like the same interaction.
const TRANSITION = "duration-300 ease-out motion-reduce:transition-none";

const VARIANT_SURFACE: Record<PillVariant, string> = {
    // Gradient hover lives in a separate layer (see PillContents), so the pill
    // itself only carries the resting fill.
    gradient: "bg-[#131A2B] text-white",

    white: `bg-white text-black ${TRANSITION} hover:bg-black`,

    // No layer needed here: background-color and border-color *are*
    // transitionable. Backgrounds paint under the border box, so the black fill
    // bleeds through the transparented hairline instead of leaving a 1px gap.
    //
    // Plain `hover:`, not `group-hover:` — these land on the element that *is*
    // the group, and `group-hover:` only ever matches descendants of it
    // (`:is(:where(.group):hover *)`). Without the fill, the incoming white
    // label would roll into white-on-white.
    outline: `border border-black text-black transition-colors ${TRANSITION} hover:border-transparent hover:bg-black focus-visible:border-transparent focus-visible:bg-black`,
};

/**
 * The class list for a pill's root element.
 *
 * Extracted from pill-link.tsx so `PillLink` and `PillButton` cannot drift apart —
 * they were one component until a CTA needed to open a modal instead of navigate.
 *
 * @param className - Layout only (margins, `shrink-0`). Merged last so it wins.
 */
export function pillClasses(variant: PillVariant, className = ""): string {
    return `${PILL_BASE} ${VARIANT_SURFACE[variant]} ${className}`;
}

/**
 * A pill's inner markup: the hover gradient layer and the rolling label.
 *
 * The visible label rolls up out of a clip while a duplicate copy rises into its place,
 * reversing from wherever it got to if the cursor leaves mid-roll. Mirrors
 * `RollingNavLink` in `menu-panel.tsx`.
 */
export function PillContents({
    variant,
    children,
}: {
    variant: PillVariant;
    children: React.ReactNode;
}) {
    return (
        <>
            {/* `background-image` isn't a transitionable property, so the
                gradient can't be animated with `transition-colors` — it rides
                in as a fading layer instead. Painted before the label, which is
                `relative`, so tree order alone keeps the text on top. */}
            {variant === "gradient" && (
                <span
                    aria-hidden
                    className={`absolute inset-0 bg-blue-gradient opacity-0 transition-opacity ${TRANSITION} group-hover:opacity-100 group-focus-visible:opacity-100`}
                />
            )}

            {/* `overflow-hidden` clips the roll, so the line box has to be tall
                enough to contain descenders ("y" in Stays) or they'd be shaved
                off at rest. 24px matches the default leading at 16px, so no
                button changes height. */}
            <span className="relative block overflow-hidden leading-6">
                <span
                    className={`block transition-transform ${TRANSITION} group-hover:-translate-y-full group-focus-visible:-translate-y-full`}
                >
                    {children}
                </span>

                {/* The incoming copy, parked exactly one line below. White for
                    both variants: over the black fill for `outline`, and already
                    the resting colour for `gradient` — whose roll is therefore
                    pure motion, no colour shift. Hidden from screen readers —
                    the label above already carries it. */}
                <span
                    aria-hidden
                    className={`absolute inset-0 block translate-y-full text-white transition-transform ${TRANSITION} group-hover:translate-y-0 group-focus-visible:translate-y-0`}
                >
                    {children}
                </span>
            </span>
        </>
    );
}
