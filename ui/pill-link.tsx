import Link from "next/link";

import { pillClasses, PillContents, type PillVariant } from "@/ui/pill-styles";

/**
 * A CTA pill that navigates. See `PillButton` for the one that doesn't.
 *
 * The visuals live in `ui/pill-styles.tsx` — this file is only the `Link` half.
 *
 * @param href - Navigation target. Renders a `Link`, so every call site keeps
 * middle-click/new-tab behaviour for free.
 * @param variant - `gradient` fades its navy fill into the site's blue gradient;
 * `outline` fades from a black hairline to a solid black fill.
 * @param className - Layout only (margins, `shrink-0`). Merged last so it wins.
 *
 * @example
 * <PillLink href="/stays" variant="gradient">Book room</PillLink>
 */
export default function PillLink({
    href,
    variant,
    className = "",
    children,
}: {
    href: string;
    variant: PillVariant;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <Link href={href} className={pillClasses(variant, className)}>
            <PillContents variant={variant}>{children}</PillContents>
        </Link>
    );
}
