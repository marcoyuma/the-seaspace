"use client";

// Client-only because error boundaries are: React catches render errors in the browser, and
// `unstable_catchError` must live in the client module graph.
import { unstable_catchError } from "next/error";

/**
 * Drops one failed landing section instead of the whole page, which with no boundary falls to the
 * root "This page couldn't load" screen. Renders nothing — the page reads fine without a section.
 *
 * @example <SectionErrorBoundary><Suspense …><ReviewsSection /></Suspense></SectionErrorBoundary>
 */
const SectionErrorBoundary = unstable_catchError(() => null);

export default SectionErrorBoundary;
