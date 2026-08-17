"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Routes that render without the site header and footer.
 *
 * Each is the whole viewport: nothing to navigate to until you are signed in, and a nav bar
 * offering the way out is a distraction from the one thing the page asks for. `/account` and
 * `/account/update-password` are deliberately NOT here — those are normal pages you arrive
 * at from the header, with somewhere to go afterwards.
 */
const CHROME_FREE_ROUTES = ["/login", "/forgot-password"];

/**
 * Hides the site chrome on the routes above.
 *
 * `"use client"` only for `usePathname()` — the root layout is a Server Component and cannot
 * know the current route. Its children are still rendered on the server and handed over as a
 * prop, so wrapping `<Footer />` here does not pull it (or `Heading`,
 * `ParallaxImageSection`) into the client bundle.
 *
 * `usePathname()` runs during SSR too, so a hidden footer never reaches the HTML and there is
 * no hydration mismatch to reconcile. What it does cost is the children's RSC payload, which
 * is serialized whether or not it ends up rendered.
 *
 * @example
 * <ChromeGate>
 *     <Footer />
 * </ChromeGate>
 */
export default function ChromeGate({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    if (CHROME_FREE_ROUTES.includes(pathname)) return null;

    return <>{children}</>;
}
