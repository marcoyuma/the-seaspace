/**
 * Whether a nav link points at the current route. `/stays` stays active on `/stays/<id>`; hash
 * links never are (`usePathname` drops the fragment). Lives here so menu-panel.tsx can share it.
 *
 * @example isActiveLink("/stays", "/stays/tuscan-twilight-villa") // true
 */
export function isActiveLink(href: string, pathname: string) {
    if (href.includes("#")) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
}
