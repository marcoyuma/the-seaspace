import {
    PRELOADER_ACTIVE_ATTR,
    PRELOADER_ROUTE,
    PRELOADER_SESSION_KEY,
} from "@/lib/preloader";

/**
 * Blocking inline script deciding, before first paint, whether this load gets the preloader
 * curtain. It only ADDS the flag, so without JS the overlay stays `display:none` (fail safe). In
 * the layout to beat the header's paint; it reads `location.pathname`, which the layout can't.
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
