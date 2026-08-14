import { pillClasses, PillContents, type PillVariant } from "@/ui/pill-styles";

/**
 * `PillLink`'s visuals on a real `<button>`, for CTAs that act instead of navigate.
 *
 * Not a Client Component itself — it has no state and no effects, so it renders fine on
 * the server. Passing an `onClick` is what forces the *caller* to be a Client Component,
 * which is where that boundary belongs.
 *
 * Disabled pills drop to 40% and go `pointer-events-none` — without the latter the label
 * would still roll on hover, which reads as "clickable" and undoes the point of dimming
 * it.
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
