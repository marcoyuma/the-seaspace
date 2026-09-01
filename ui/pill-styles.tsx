export type PillVariant = "gradient" | "white" | "outline";

/**
 * The geometry of a pill, at every size the site uses.
 *
 * Horizontal padding is half the pill's height — which, on a capsule, is exactly its
 * corner radius. Below that the label reads as crowded against the curve; much above it
 * and the pill reads as a stretched bar. It's the same ratio Material 3 uses across its
 * capsule button sizes (0.375–0.5 × height).
 *
 * Height is `2 × py + line-height`, so each row checks itself:
 * `sm` 4+4+20 = 28 → px-3.5 · `md` 12+12+20 = 44 → px-5.5, 12+12+24 = 48 → px-6 ·
 * `lg` 16+16+24 = 56 → px-7.
 *
 * `md` is the only row that ramps, and 44px is where it stops: that is the Apple HIG
 * minimum for a tap target (Material asks 48dp). `CHIP_SIZE` below goes to 40px because
 * nothing there is tappable — a button may never borrow that allowance.
 *
 * The leading is pinned rather than left to inherit: `text-[…]` is an arbitrary value,
 * and Tailwind v4 emits no line-height alongside one, so the height would otherwise ride
 * on whatever an ancestor happened to set — and the padding rule with it.
 *
 * Weight is deliberately absent. This token is geometry only.
 *
 * @example
 * // A hand-rolled pill that needs a surface these three variants don't cover:
 * className={`rounded-full ${PILL_SIZE.md} font-medium bg-red-700 text-white`}
 */
export const PILL_SIZE = {
    sm: "px-3.5 py-1 text-[14px] leading-5",
    md: "px-5.5 py-3 text-[14px] leading-5 sm:px-6 sm:text-[16px] sm:leading-6",
    lg: "px-7 py-4 text-[16px] leading-6",
} as const;

/**
 * The geometry of a chip — a label floating over a card image, never a control.
 *
 * Separate from `PILL_SIZE` because of what it is allowed to do: these sit inside a card
 * that is itself the `<Link>`, so nothing here is a tap target and the 44px (Apple HIG) /
 * 48dp (Material) minimum does not bind. That is what lets a chip drop to 32–40px on a
 * phone, where a 48px pill on a ~295px-wide card reads as desktop type dropped in whole.
 * `PILL_SIZE` must never take the same liberty.
 *
 * Same padding rule as above (horizontal padding = half the height = the corner radius on a
 * capsule), and the same pinned leading, checked at both ends of the ramp:
 * `sm` 6+6+20 = 32 → px-4 · 6+6+24 = 36 → px-4.5
 * `md` 10+10+20 = 40 → px-5 · 12+12+24 = 48 → px-6
 *
 * Radius is deliberately absent, as in `PILL_SIZE`. Call sites use `rounded-[20px]`.
 *
 * @example
 * <div className={`rounded-[20px] bg-white ${CHIP_SIZE.md}`}>{location}</div>
 */
export const CHIP_SIZE = {
    // 32 → 36px. Corner badges that only ever sit on the photo: rating, "New".
    sm: "px-4 py-1.5 text-[14px] leading-5 sm:px-4.5 sm:text-[16px] sm:leading-6",
    // 40 → 48px. The primary label along a card's bottom edge.
    md: "px-5 py-2.5 text-[14px] leading-5 sm:px-6 sm:py-3 sm:text-[16px] sm:leading-6",
} as const;

// Shape shared by both variants, so the CTAs can't drift apart again.
// `overflow-hidden` keeps the gradient layer inside the capsule.
const PILL_BASE = `group relative inline-flex items-center justify-center overflow-hidden rounded-full ${PILL_SIZE.md} font-medium`;

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
 * @param className - Layout only (margins, `shrink-0`). Appended after the base classes,
 * which is safe only while it stays layout-only: this is string concatenation, not a
 * merge, so a utility that clashes with a base one is decided by Tailwind's generation
 * order rather than by position here. To change a base value, add a variant above.
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
                off at rest. Must stay equal to the leading in `PILL_SIZE.md`
                at BOTH breakpoints — a shorter clip here would shave the
                glyphs, a taller one would grow the button past the height its
                padding was derived from. */}
            <span className="relative block overflow-hidden leading-5 sm:leading-6">
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
