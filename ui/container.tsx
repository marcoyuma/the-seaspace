export default function Container({ children }: { children: React.ReactNode }) {
    // The expanded Header (`ui/header.tsx`) mirrors this inset at every breakpoint so
    // the pill aligns to the section's edges — keep the two in sync.
    return (
        <div className="mx-10 mb-10 sm:mx-8 sm:mb-16 md:mx-16 md:mb-25 lg:mx-30">
            {children}
        </div>
    );
}
