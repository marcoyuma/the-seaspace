"use client";

import type { ReactNode } from "react";

import { useRoutePathname } from "@/lib/nav";

/**
 * Full-viewport routes without header/footer: until you sign in, a nav bar is only a distraction.
 * `/account` and `/account/update-password` stay out — you reach them from the header.
 */
const CHROME_FREE_ROUTES = ["/login", "/forgot-password"];

/**
 * Hides the site chrome on the routes above. Client only for `usePathname()`; children are still
 * server-rendered props, so `<Footer />` stays out of the client bundle. SSR knows the path too
 * (no hydration mismatch), but hidden children's RSC payload is serialized anyway.
 *
 * @example <ChromeGate><Footer /></ChromeGate>
 */
export default function ChromeGate({ children }: { children: ReactNode }) {
    const pathname = useRoutePathname();

    if (CHROME_FREE_ROUTES.includes(pathname)) return null;

    return <>{children}</>;
}
