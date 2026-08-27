"use client";

import Image from "next/image";
import bg from "@/public/bg.jpg";

import { PRELOADER_GATE_ATTR } from "@/lib/preloader";
import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr";
import PillLink from "@/ui/pill-link";

export default function Hero() {
    return (
        <section className="z-50">
            {/* ===================== DESKTOP ( lg and up ) ===================== */}
            {/* Full-screen fixed background with the hero copy overlaid and
                centered. Kept as-is; only gated behind `lg` so it never shows
                on tablet/mobile. */}
            <div className="hidden lg:block">
                <div className="fixed inset-0 -z-10 overflow-hidden">
                    {/* Sized by HEIGHT only (`w-auto`), so the rendered width is
                        always 1.75x the height — the photo's own aspect ratio.
                        Widening/narrowing the window therefore never rescales
                        the photo, it only changes how much is clipped left and
                        right. `max-w-none` defeats preflight's `max-width:100%`;
                        `min-w-full` + `object-cover` is the fallback for
                        ultrawide-short viewports, where the photo already spans
                        100% of its width and there is nothing left to crop. */}
                    <Image
                        className="absolute left-1/2 top-0 -translate-x-1/2 h-[calc(100dvh+200px)] w-auto min-w-full max-w-none object-cover object-[center_50%]"
                        src={bg}
                        placeholder="blur"
                        quality={90}
                        // Neither variant may be `preload`ed or `loading="eager"`: BOTH sit in
                        // the DOM (only CSS picks one), so either would fetch this 4.6 MB
                        // photo twice. The Next 16 docs prescribe `fetchPriority` for exactly
                        // this art-direction case — default lazy loading then skips the
                        // `display:none` twin, which has no box to intersect the viewport.
                        fetchPriority="high"
                        // The photo is sized by HEIGHT (`w-auto`), so its painted width is
                        // 1.46 x (viewport height + 200px), floored at the viewport width by
                        // `min-w-full`. On 16:9 that lands near 100vw, but on a shorter or
                        // narrower window (1280x1024) it reaches ~140vw — where the old
                        // "100vw" served an image NARROWER than it was painted, i.e. real
                        // softness. 120vw covers the common cases; `deviceSizes` in
                        // next.config.ts carries the 2560 rung that keeps this off 3840.
                        sizes="(min-width: 1024px) 120vw, 100vw"
                        alt="Beach scape views"
                        {...{ [PRELOADER_GATE_ATTR]: "hero" }}
                    />
                    <div className="absolute inset-0 bg-linear-to-r from-black/20 to-100% to-transparent" />
                </div>

                <div className="flex items-center w-full h-dvh pt-7.25">
                    <div className="flex flex-col items-center mb-40 justify-center inset-x-0 gap-y-5 fixed">
                        {/* leading-[1.05], bukan `leading-14` (56px pada teks
                            64px) seperti dulu: pada leading serapat itu baris
                            kedua terasa menempel dan descender "y" pada
                            "symphony" nyaris menyentuhnya. */}
                        <h1 className="text-[64px] text-center text-white leading-[1.05] font-bold tracking-[-0.03em] max-w-151.25">
                            Embrace the symphony of waves
                        </h1>
                        <p className="text-[16px] text-center text-white font-semibold tracking-[-0.03em] max-w-128.25">
                            Each stay is crafted with intention, finished with
                            elegance, and designed to feel like a home away from
                            home surrounded by ocean breeze.
                        </p>

                        <div className="flex flex-row gap-1">
                            <PillLink href="/stays" variant="white">
                                Stay a night
                            </PillLink>
                            {/* <button className="w-10 h-10 bg-white rounded-[25px] flex justify-center items-center cursor-pointer">
                                <MapTrifoldIcon size={25} />
                            </button> */}
                        </div>
                    </div>
                </div>
            </div>

            {/* ================= TABLET / MOBILE ( below lg ) ================= */}
            {/* Stacked with plain block flow (no flex-direction) so the photo
                and copy always sit top-to-bottom. The photo band fades into a
                solid `#298BE0` panel (same blue as the amenity badge). The copy
                is horizontally centered via `text-center` + `mx-auto`, and the
                type scales fluidly with `clamp()` so it fits any viewport. */}
            <div className="min-h-dvh bg-[#298BE0] lg:hidden">
                {/* Photo band */}
                <div className="relative h-[38dvh] w-full sm:h-[44dvh]">
                    <Image
                        className="object-cover object-[center_50%]"
                        src={bg}
                        fill
                        placeholder="blur"
                        quality={90}
                        // Same reasoning as the desktop variant above.
                        fetchPriority="high"
                        sizes="100vw"
                        alt="Beach scape views"
                        {...{ [PRELOADER_GATE_ATTR]: "hero" }}
                    />
                    {/* Blend the bottom of the photo into the blue panel */}
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-b from-transparent to-[#298BE0]" />
                </div>

                {/* Copy */}
                <div className="px-6 pt-8 text-center">
                    <h1 className="mx-auto max-w-2xl text-[clamp(2rem,7vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.03em] text-white">
                        Embrace the symphony of waves
                    </h1>
                    <p className="mx-auto mt-4 max-w-md text-[clamp(0.875rem,2.5vw,1.125rem)] font-semibold tracking-[-0.03em] text-white">
                        Each stay is crafted with intention, finished with
                        elegance, and designed to feel like a home away from
                        home surrounded by ocean breeze.
                    </p>

                    <div className="mt-6 flex flex-row justify-center gap-1">
                        <button className="h-10 w-28 rounded-[20px] bg-white font-semibold text-black">
                            Book now
                        </button>
                        <button className="flex h-10 w-10 items-center justify-center rounded-[25px] bg-white cursor-pointer">
                            <MapTrifoldIcon size={25} />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
