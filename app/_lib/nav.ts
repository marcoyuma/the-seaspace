/**
 * Whether a nav link points at the route currently being viewed.
 *
 * `/stays` also counts as active on `/stays/<stayId>` so the section stays
 * marked while you're deeper in it. Hash targets (`/#gallery`) are never
 * active — `usePathname` drops the fragment, so there's nothing to match on.
 *
 * Lives here rather than in header.tsx so menu-panel.tsx can share it without
 * importing back into its own parent.
 *
 * @example isActiveLink("/stays", "/stays/tuscan-twilight-villa") // true
 */
export function isActiveLink(href: string, pathname: string) {
    if (href.includes("#")) return false;
    if (href === "/") return pathname === "/";
    console.log(href, pathname);
    return pathname === href || pathname.startsWith(`${href}/`);
}
