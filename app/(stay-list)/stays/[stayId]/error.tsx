"use client";

// Error boundaries must be Client Components — React needs to attach the boundary and run
// `unstable_retry` in the browser. This is the whole reason for "use client" here; nothing in
// the markup below is interactive beyond the retry button.

import { useEffect } from "react";
import Link from "next/link";

import Container from "@/ui/container";

/**
 * Catches failures from the villa page itself, one segment below the catalogue's boundary.
 *
 * It exists because `app/(stay-list)/stays/error.tsx` was inheriting this segment: any failure
 * here — including a client-side one from the map — rendered "We couldn't load the collection"
 * on a page that had already resolved its villa. The copy now matches the route it guards, and
 * the log label differs so the two can be told apart in the console.
 *
 * Not a substitute for the map's own boundary in stay-location-section.tsx: that one catches
 * first and keeps the rest of the page alive. This is the outer net.
 *
 * As with the parent boundary, the visible copy says nothing about databases or Supabase —
 * useless to a guest, and it leaks infrastructure. The real message goes to the console/logs.
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
