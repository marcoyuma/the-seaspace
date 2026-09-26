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
                    {/* Sized by HEIGHT (`w-auto`), so resizing only changes the side crop, never
                        the photo's scale. `max-w-none` beats preflight's `max-width:100%`;
                        `min-w-full` + `object-cover` handle ultrawide-short viewports. */}
                    <Image
                        className="absolute left-1/2 top-0 -translate-x-1/2 h-[calc(100dvh+200px)] w-auto min-w-full max-w-none object-cover object-[center_50%]"
                        src={bg}
                        placeholder="blur"
                        quality={90}
                        // No `preload`/eager: BOTH variants are in the DOM, so either would fetch this
                        // 4.6 MB photo twice. `fetchPriority` is Next 16's answer for art direction;
                        // lazy loading then skips the `display:none` twin.
                        fetchPriority="high"
                        // Painted width is 1.46 × (viewport height + 200px), floored at 100vw — up to
                        // ~140vw on short windows, where "100vw" served too narrow a file. 120vw covers
                        // common cases; next.config.ts's 2560 `deviceSizes` rung keeps it off 3840.
                        sizes="(min-width: 1024px) 120vw, 100vw"
                        alt="Beach scape views"
                        {...{ [PRELOADER_GATE_ATTR]: "hero" }}
                    />
                    <div className="absolute inset-0 bg-linear-to-r from-black/20 to-100% to-transparent" />
                </div>

                <div className="flex items-center w-full h-dvh pt-7.25">
                    <div className="flex flex-col items-center mb-40 justify-center inset-x-0 gap-y-5 fixed">
                        {/* `leading-[1.05]`: a 56px line box on 64px text crowded line two against
                            the "y" descender in "symphony". */}
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
            {/* Plain block flow so photo and copy always stack. The photo band fades into a
                solid `#298BE0` panel (the amenity badge blue); type scales with `clamp()`. */}
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
