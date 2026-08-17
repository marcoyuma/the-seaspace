"use client";

// Error boundaries must be Client Components — React needs to attach the boundary and run
// `reset` in the browser. This is the whole reason for "use client" here; nothing in the
// markup below is interactive beyond the retry button.

import { useEffect } from "react";

import Container from "@/ui/container";

/**
 * Catches failures from the Supabase queries in features/stays/api.ts.
 *
 * Scoped to the stays route group rather than the app root on purpose: a database outage
 * should not replace unrelated pages like /spa, which render entirely from local assets.
 *
 * The visible copy deliberately says nothing about databases or Supabase — that detail is
 * useless to a guest and leaks infrastructure. The real message goes to the console/logs.
 */
export default function StaysError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
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

                <button
                    type="button"
                    onClick={reset}
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
