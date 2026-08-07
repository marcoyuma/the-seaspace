export default function Container({ children }: { children: React.ReactNode }) {
    // NOTE: was `px-[120]`, which Tailwind emits as `padding-inline: 120`
    // (no unit) — invalid CSS, so it silently resolved to 0 and the section
    // rendered full-bleed. Restored to the intended 120px inset. The expanded
    // Header (`app/ui/header.tsx`) mirrors this exact 120px inset so the pill
    // aligns to the section's edges — keep the two values in sync.
    return <div className="mx-30 mb-25">{children}</div>;
}
