export default function Container({ children }: { children: React.ReactNode }) {
    // NOTE: was `px-[120]`, which Tailwind emits as `padding-inline: 120`
    // (no unit) — invalid CSS, so it silently resolved to 0 and the section
    // rendered full-bleed. Restored to the intended 120px inset. The expanded
    // Header (`app/ui/header.tsx`) mirrors this exact inset at every
    // breakpoint so the pill aligns to the section's edges — keep the two
    // in sync.
    return (
        <div className="mx-6 mb-10 sm:mx-8 sm:mb-16 md:mx-16 md:mb-25 lg:mx-30">
            {children}
        </div>
    );
}
