import {
    PRELOADER_ACTIVE_ATTR,
    PRELOADER_ROUTE,
    PRELOADER_SESSION_KEY,
} from "@/lib/preloader";

/**
 * Decides — before the first paint — whether this page load gets a preloader curtain.
 *
 * Blocking inline script, the same trick theme switchers use against a flash of the wrong
 * theme. It only ever ADDS the flag, which is what makes the whole feature fail safe: no JS
 * means no flag, which means CSS keeps the overlay `display:none` and nobody is ever stuck
 * behind a curtain that cannot lift. Crawlers read the fully server-rendered page underneath.
 *
 * Lives in app/layout.tsx rather than app/page.tsx so it runs before the header markup is
 * parsed — from inside the page it would sometimes let the header paint for a frame first.
 * That means the layout would have to know the current route, which a Server Component cannot;
 * the script sidesteps it by reading `location.pathname` itself, on the client, for free.
 *
 * Not a Client Component: this is static markup, so it costs the bundle nothing and keeps the
 * route's static shell intact under `cacheComponents`.
 */
export default function PreloaderFlashGuard() {
    // try/catch because sessionStorage throws outright in some privacy modes — and a throw
    // here would abort the script mid-document.
    const script =
        `try{if(location.pathname===${JSON.stringify(PRELOADER_ROUTE)}` +
        `&&!sessionStorage.getItem(${JSON.stringify(PRELOADER_SESSION_KEY)}))` +
        `document.documentElement.setAttribute(${JSON.stringify(PRELOADER_ACTIVE_ATTR)},"")}catch(e){}`;

    return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
