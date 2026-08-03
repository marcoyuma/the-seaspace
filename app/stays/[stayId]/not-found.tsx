import Link from "next/link";

import Container from "@/app/ui/container";

export default function NotFound() {
    return (
        <Container>
            <div className="py-24 text-center">
                <h1 className="font-display text-[56px] leading-[1.1] text-black">
                    We couldn&apos;t find that stay
                </h1>

                <p className="mx-auto mt-6 max-w-xl text-[18px] leading-relaxed font-medium text-black/50">
                    The suite you were looking for may have been renamed or is
                    no longer part of the collection.
                </p>

                <Link
                    href="/stays"
                    className="mt-10 inline-block rounded-[20px] bg-[#131A2B] px-8 py-4 text-[16px] font-medium text-white transition-opacity duration-200 ease-out hover:opacity-90 motion-reduce:transition-none"
                >
                    Browse all stays
                </Link>
            </div>
        </Container>
    );
}
