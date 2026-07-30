"use client";

import Image from "next/image";
// import bg from "@/public/bg.jpg";
import bg from "@/public/bg-1.jpg";
import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr";
import PillLink from "@/app/ui/pill-link";

export default function Hero() {
    return (
        <section className="z-50">
            {/* ===================== DESKTOP ( lg and up ) ===================== */}
            {/* Full-screen fixed background with the hero copy overlaid and
                centered. Kept as-is; only gated behind `lg` so it never shows
                on tablet/mobile. */}
            <div className="">
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
                        quality={100}
                        priority
                        sizes="100vw"
                        alt="Beach scape views"
                    />
                    <div className="absolute inset-0 bg-linear-to-r from-black/10 to-100% to-transparent" />
                </div>

                <div className="flex items-center w-full h-dvh pt-7.25">
                    <div className="flex flex-col items-center mb-40 justify-center inset-x-0 gap-y-5 fixed">
                        <h1 className="text-[64px] text-center text-white leading-14 font-bold tracking-[-0.03em] max-w-151.25">
                            Embrace the symphony of waves
                        </h1>
                        <p className="text-[16px] text-center text-white font-semibold tracking-[-0.03em] max-w-128.25">
                            Each stay is crafted with intention, finished with
                            elegance, and designed to feel like a home away from
                            home surrounded by ocean breeze.
                        </p>

                        <div className="flex flex-row gap-1">
                            {/* <button className="font-semibold px-8 py-3 bg-white text-black rounded-[40px]">
                                Stay a night
                            </button> */}
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
            {/* <div className="min-h-dvh bg-[#298BE0] lg:hidden"> */}
            <div className="min-h-dvh bg-[#298BE0] hidden">
                {/* Photo band */}
                <div className="relative h-[38dvh] w-full sm:h-[44dvh]">
                    <Image
                        className="object-cover object-[center_50%]"
                        src={bg}
                        fill
                        placeholder="blur"
                        quality={100}
                        priority
                        sizes="100vw"
                        alt="Beach scape views"
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
