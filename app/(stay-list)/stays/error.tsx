"use client";

// Error boundaries must be Client Components — React needs to attach the boundary and run
// `unstable_retry` in the browser. This is the whole reason for "use client" here; nothing in
// the markup below is interactive beyond the retry button.

import { useEffect } from "react";

import Container from "@/ui/container";

/**
 * Catches features/stays/actions.ts query failures, scoped to the stays group so an outage never
 * replaces unrelated pages like /spa. Copy never mentions Supabase; the real message goes to logs.
 */
export default function StaysError({
    error,
    unstable_retry,
}: {
    error: Error & { digest?: string };
    unstable_retry: () => void;
}) {
    useEffect(() => {
        // In production the message is stripped and only `digest` survives, which is what
        // correlates this render with the server-side log entry.
        console.error("Stays route failed:", error);
    }, [error]);

    return (
        <Container>
            <div className="py-24 text-center">
                <h1 className="font-semibold text-[48px] leading-none text-black">
                    We couldn&apos;t load the collection
                </h1>

                <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed font-medium text-black/60">
                    Something went wrong while fetching our stays. This is
                    usually temporary — please try again in a moment.
                </p>

                {/* `unstable_retry` over `reset`: reset only re-renders, so a failed
                    features/stays/actions.ts query would fail again. Retry re-fetches. */}
                <button
                    type="button"
                    onClick={() => unstable_retry()}
                    className="mt-10 inline-block rounded-[20px] bg-[#131A2B] px-8 py-4 text-[16px] font-medium text-white transition-opacity duration-200 ease-out hover:opacity-90 motion-reduce:transition-none"
                >
                    Try again
                </button>

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
