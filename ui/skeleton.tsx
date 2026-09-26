/**
 * Placeholder with a sweeping highlight — a pulse reads as "broken", a sweep as "on its way".
 * `className` carries the SHAPE (size, aspect, radius) so the swap doesn't shift the page. Pure
 * markup + CSS keyframe, so it's free for the client bundle and works in Server fallbacks.
 *
 * @example <Skeleton className="w-full aspect-600/570 rounded-[20px]" />
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
