import { usePathname } from "next/navigation";

/**
 * Maps `/index` back to `/`. Vercel invokes the homepage's function at `/index`, and Next renders
 * with that raw URL, so `/`'s regenerated shell sees `/index`. No route is actually named that.
 *
 * @example normalizePathname("/index") // "/"
 */
export function normalizePathname(pathname: string) {
    return pathname === "/index" ? "/" : pathname;
}

/**
 * `usePathname()` through {@link normalizePathname}. Use it for every route check in the chrome,
 * or the homepage shell bakes in the interior-route header until hydration swaps it.
 */
export function useRoutePathname() {
    return normalizePathname(usePathname());
}

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
    return pathname === href || pathname.startsWith(`${href}/`);
}
