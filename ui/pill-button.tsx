import { pillClasses, PillContents, type PillVariant } from "@/ui/pill-styles";

/**
 * `PillLink`'s visuals on a `<button>`, for CTAs that act instead of navigate. Not a Client
 * Component: passing `onClick` makes the *caller* the client boundary, where it belongs.
 * Disabled also sets `pointer-events-none`, or the label would still roll and read as clickable.
 *
 * @param variant - Same three surfaces as `PillLink`.
 * @param className - Layout only. Merged last so it wins.
 *
 * @example
 * <PillButton variant="gradient" onClick={() => setOpen(true)}>Book room</PillButton>
 */
export default function PillButton({
    variant,
    type = "button",
    disabled = false,
    onClick,
    className = "",
    children,
    ...rest
}: {
    variant: PillVariant;
    type?: "button" | "submit";
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
    children: React.ReactNode;
} & Pick<React.ComponentProps<"button">, "aria-expanded" | "aria-controls">) {
    return (
        <button
            type={type}
            disabled={disabled}
            onClick={onClick}
            className={pillClasses(
                variant,
                `${disabled ? "pointer-events-none opacity-40" : "cursor-pointer"} ${className}`,
            )}
            {...rest}
        >
            <PillContents variant={variant}>{children}</PillContents>
        </button>
    );
}
