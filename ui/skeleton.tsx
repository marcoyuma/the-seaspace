/**
 * Placeholder block with a sweeping highlight.
 *
 * Replaces the `bg-black/5 animate-pulse` divs that were being retyped per fallback. A pulse
 * dims the whole block at once, which reads as "broken"; a sweep reads as "on its way".
 *
 * `className` carries the SHAPE — size, aspect ratio, corner radius — so a caller can match
 * whatever it stands in for and the fallback swaps out without shifting the page.
 *
 * Server Component: it is pure markup driven by a CSS keyframe, so it costs the client bundle
 * nothing and works inside async Server Component fallbacks.
 *
 * @example
 * <Skeleton className="w-full aspect-600/570 rounded-[20px]" />
 */
export default function Skeleton({ className = "" }: { className?: string }) {
    return (
        <div
            aria-hidden
            className={`relative overflow-hidden bg-black/5 ${className}`}
        >
            {/* `translateX` on a child rather than an animated background-position: the sweep
                stays on the compositor, which matters when a grid of these is on screen while
                the page is already busy decoding the real images. */}
            <span className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-black/6 to-transparent motion-reduce:animate-none" />
        </div>
    );
}
