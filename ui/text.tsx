/**
 * Measure caps for body copy.
 *
 * `default` (513px) never binds below that width, so a paragraph in a narrow
 * column just wraps at whatever its container leaves. Copy that needs its own
 * measure at small breakpoints uses `narrow`.
 *
 * Kept out of the base class list for the same reason as `SIZE` in `heading.tsx`:
 * `className` is concatenated, not merged, so a baked-in `max-w-*` would clash at
 * equal specificity with a caller's and force an `!` to break the tie.
 */
const WIDTH = {
    default: "max-w-128.25",
    narrow: "max-w-70 sm:max-w-96 md:max-w-105 lg:max-w-128.25",
    none: "",
} as const;

const WEIGHT = {
    medium: "font-medium",
    normal: "font-normal",
} as const;

/**
 * Body copy (`<p>`) at the site's default 16px / 60% black.
 *
 * @param width - Measure cap; see `WIDTH`. Defaults to `"default"`.
 * @param weight - Defaults to `"medium"`; `"normal"` for long-form answers.
 * @param className - Layout only (`text-center`, padding). Do not pass `max-w-*`
 *   or `font-*` here — add a `WIDTH`/`WEIGHT` entry instead.
 *
 * @example
 * <Text>Answers for most wonderer wonders</Text>
 * <Text width="narrow">Each stay is crafted with intention…</Text>
 */
export default function Text({
    children,
    width = "default",
    weight = "medium",
    className = "",
}: {
    children: React.ReactNode;
    width?: keyof typeof WIDTH;
    weight?: keyof typeof WEIGHT;
    className?: string;
}) {
    return (
        <p
            className={`text-[16px] text-black/60 ${WEIGHT[weight]} tracking-normal ${WIDTH[width]} ${className}`}
        >
            {children}
        </p>
    );
}
