"use client";

import { useState } from "react";

import { formatUsDate, parseUsDate } from "@/features/booking/lib/dates";

/**
 * A CHECK-IN / CHECKOUT box that accepts typing (the design shows a caret and `MM/DD/YYYY`). Keeps a
 * draft while focused so "08/1" isn't rejected mid-typing; commits on blur/Enter, silently dropped if
 * invalid or refused — the calendar below is the authority, and already shows why.
 *
 * @param value - The committed day, or `null` for empty.
 * @param onCommit - Given a `yyyy-mm-dd`; may reject it by leaving `value` unchanged.
 */
export default function DateField({
    label,
    value,
    isActive,
    onFocus,
    onCommit,
}: {
    label: string;
    value: string | null;
    isActive: boolean;
    onFocus: () => void;
    onCommit: (day: string) => void;
}) {
    const asText = value ? formatUsDate(value) : "";
    const [draft, setDraft] = useState(asText);

    // Follow outside changes (the calendar) during render, not in an effect, so stale text never
    // paints. https://react.dev/reference/react/useState#storing-information-from-previous-renders
    const [lastValue, setLastValue] = useState(value);
    if (value !== lastValue) {
        setLastValue(value);
        setDraft(asText);
    }

    function commit() {
        const parsed = parseUsDate(draft);
        if (parsed) onCommit(parsed);
        // Snap back to the selected value: an accepted commit is overwritten by the adjustment
        // above, a rejected one is undone here.
        setDraft(asText);
    }

    return (
        <label
            className={`flex-1 cursor-text rounded-2xl border px-4 py-2.5 transition-colors duration-150 motion-reduce:transition-none ${
                isActive
                    ? "border-2 border-black bg-white"
                    : "border-black/10 bg-black/3"
            }`}
        >
            <span
                className={`block text-[12px] font-semibold tracking-[0.06em] uppercase ${
                    isActive ? "text-black" : "text-black/40"
                }`}
            >
                {label}
            </span>

            <input
                // `text`, not `date`: a native date input brings the browser's own
                // calendar popup, which would sit on top of this one and know nothing
                // about which dates are taken.
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM/DD/YYYY"
                value={draft}
                onFocus={onFocus}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        commit();
                    }
                }}
                className="mt-0.5 w-full bg-transparent text-[16px] text-black placeholder:text-black/30 focus:outline-none"
            />
        </label>
    );
}
