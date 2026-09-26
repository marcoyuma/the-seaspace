export type PillVariant = "gradient" | "white" | "outline";

/**
 * Pill geometry only (no weight): px = half the height, i.e. the capsule's corner radius (Material
 * 3's ratio), with height = 2×py + leading. `md` bottoms out at 44px, the HIG tap minimum. Leading
 * is pinned because Tailwind v4 emits none with an arbitrary `text-[…]`, which would skew height.
 *
 * @example className={`rounded-full ${PILL_SIZE.md} font-medium bg-red-700 text-white`}
 */
export const PILL_SIZE = {
    sm: "px-3.5 py-1 text-[14px] leading-5",
    md: "px-5.5 py-3 text-[14px] leading-5 sm:px-6 sm:text-[16px] sm:leading-6",
    lg: "px-7 py-4 text-[16px] leading-6",
} as const;

/**
 * Chip geometry — a label over a card image, never a control. The card is the `<Link>`, so the 44px
 * tap minimum doesn't bind and chips may drop to 32–40px on phones; `PILL_SIZE` must never do that.
 * Same half-height padding rule and pinned leading; call sites supply `rounded-[20px]`.
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

    // No layer: bg/border colours transition natively, and the fill bleeds under the transparent
    // hairline. Plain `hover:` because `group-hover:` only matches the group's descendants —
    // without the fill the incoming white label would roll into white-on-white.
    outline: `border border-black text-black transition-colors ${TRANSITION} hover:border-transparent hover:bg-black focus-visible:border-transparent focus-visible:bg-black`,
};

/**
 * The class list for a pill's root element, shared so `PillLink` and `PillButton` can't drift.
 *
 * @param className - Layout only (margins, `shrink-0`): it's concatenated, not merged, so a
 * clashing utility is decided by generation order. To change a base value, add a variant.
 */
export function pillClasses(variant: PillVariant, className = ""): string {
    return `${PILL_BASE} ${VARIANT_SURFACE[variant]} ${className}`;
}

/**
 * A pill's inner markup: the hover gradient layer and a label that rolls out as a copy rolls in,
 * reversing mid-roll if the cursor leaves. Mirrors `RollingNavLink` in `menu-panel.tsx`.
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
            {/* `background-image` can't transition, so the gradient fades in as a layer.
                Painted before the `relative` label, so tree order keeps the text on top. */}
            {variant === "gradient" && (
                <span
                    aria-hidden
                    className={`absolute inset-0 bg-blue-gradient opacity-0 transition-opacity ${TRANSITION} group-hover:opacity-100 group-focus-visible:opacity-100`}
                />
            )}

            {/* The roll clip must equal `PILL_SIZE.md`'s leading at both breakpoints: shorter
                shaves descenders ("y" in Stays), taller grows the button past its derived height. */}
            <span className="relative block overflow-hidden leading-5 sm:leading-6">
                <span
                    className={`block transition-transform ${TRANSITION} group-hover:-translate-y-full group-focus-visible:-translate-y-full`}
                >
                    {children}
                </span>

                {/* Incoming copy, one line below and hidden from screen readers. White for both:
                    over `outline`'s black fill, and `gradient`'s resting colour (pure motion). */}
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
