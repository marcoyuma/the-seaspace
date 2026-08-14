"use client";

import { useState } from "react";

import { formatUsDate, parseUsDate } from "@/features/booking/lib/dates";

/**
 * One of the two CHECK-IN / CHECKOUT boxes above the calendar.
 *
 * Typed input as well as display, because the reference design shows a caret and an
 * `MM/DD/YYYY` placeholder — so the box has to accept a date, not merely echo one.
 *
 * Holds its own draft string while focused: parsing on every keystroke would reject
 * "08/1" as invalid and fight the person typing "08/18/2026". The draft is committed on
 * blur and on Enter, and silently discarded if it is not a real date or the picker
 * refuses it — the calendar below is the authority on what is bookable, and it is
 * already showing why.
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

    // The calendar is the other way into this field, so the draft has to follow the
    // committed value whenever it changes from outside. Adjusted DURING render rather
    // than in an effect — React re-runs this component immediately with the new state
    // and never paints the stale text, whereas an effect would flash it first.
    // https://react.dev/reference/react/useState#storing-information-from-previous-renders
    const [lastValue, setLastValue] = useState(value);
    if (value !== lastValue) {
        setLastValue(value);
        setDraft(asText);
    }

    function commit() {
        const parsed = parseUsDate(draft);
        if (parsed) onCommit(parsed);
        // Snap back to whatever is actually selected. If the commit was accepted the
        // adjustment above overwrites this on the next render; if it was rejected —
        // an unparseable date, or one the picker refused — this is what undoes the
        // invalid text.
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
