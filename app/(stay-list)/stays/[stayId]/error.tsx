"use client";

// Error boundaries must be Client Components — React needs to attach the boundary and run
// `unstable_retry` in the browser. This is the whole reason for "use client" here; nothing in
// the markup below is interactive beyond the retry button.

import { useEffect } from "react";
import Link from "next/link";

import Container from "@/ui/container";

/**
 * The villa page's own boundary, so its failures (the map's included) stop showing the catalogue's
 * "couldn't load the collection"; a distinct log label tells them apart. The map's boundary catches
 * first. Copy never mentions Supabase — useless to guests, and it leaks infrastructure.
 */
export default function StayDetailError({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}) {
    useEffect(() => {
        // In production the message is stripped and only `digest` survives, which is what
        // correlates this render with the server-side log entry.
        console.error("Stay detail route failed:", error);
    }, [error]);

    return (
        <Container>
            <div className="py-24 text-center">
                <h1 className="font-semibold text-[48px] leading-none text-black">
                    We couldn&apos;t load this stay
                </h1>

                <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed font-medium text-black/60">
                    Something went wrong while opening this villa. This is
                    usually temporary — please try again in a moment.
                </p>

                <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                    {/* `unstable_retry` over `reset`: reset only clears the boundary and
                        re-renders, which cannot recover a Server Component read that failed.
                        Retry re-fetches the segment, which is what this button promises. */}
                    <button
                        type="button"
                        onClick={() => unstable_retry()}
                        className="inline-block rounded-[20px] bg-[#131A2B] px-8 py-4 text-[16px] font-medium text-white transition-opacity duration-200 ease-out hover:opacity-90 motion-reduce:transition-none"
                    >
                        Try again
                    </button>

                    {/* A way out that doesn't depend on this segment recovering. */}
                    <Link
                        href="/stays"
                        className="inline-block rounded-[20px] border border-black/15 px-8 py-4 text-[16px] font-medium text-black transition-opacity duration-200 ease-out hover:opacity-70 motion-reduce:transition-none"
                    >
                        Back to all stays
                    </Link>
                </div>

                {error.digest && (
                    // Gives support something to search the logs for without exposing the
                    // underlying error text.
                    <p className="mt-6 text-[16px] font-medium text-black/60">
                        Reference: {error.digest}
                    </p>
                )}
            </div>
        </Container>
    );
}
