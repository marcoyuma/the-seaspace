"use client";

/**
 * The pieces every auth form is built from.
 *
 * These started out local to auth-form.tsx, with a note that a shared field component
 * invented for a single caller tends to grow the wrong props. There are four callers now —
 * sign in, sign up, forgot password, update password — so the reason to keep them private
 * has expired.
 *
 * Styling matches the site's hairline-and-fill language; see ui/pill-link.tsx.
 */

export const LABEL = "block text-[14px] font-semibold tracking-wide text-black";

export const INPUT =
    "mt-2 w-full rounded-[12px] border border-black/15 bg-white px-4 py-3 text-[16px] text-black placeholder:text-black/30 transition-colors duration-300 ease-out motion-reduce:transition-none focus:border-black focus:outline-none";

export const ERROR = "mt-2 text-[14px] font-medium text-red-700";

export const SUBMIT =
    "mt-2 rounded-[40px] bg-black px-4 py-3.5 text-[16px] font-medium text-white transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * One labelled input with its validation message.
 *
 * @param id Used as the input's `name` too, so it is also the FormData key the server action
 * reads.
 * @param hint Replaced by `error` when one is present — they never show together.
 * @param min @param max Passed straight to the input, for `type="number"` and
 * `type="date"`. Convenience only — the browser's own limits are trivially bypassed, so
 * the server action still checks the same bounds.
 *
 * @example
 * <Field id="email" label="Email" type="email" required error={state?.errors?.email} />
 */
export function Field({
    id,
    label,
    type = "text",
    defaultValue,
    error,
    required,
    autoComplete,
    hint,
    min,
    max,
}: {
    id: string;
    label: string;
    type?: string;
    defaultValue?: string;
    error?: string;
    required?: boolean;
    autoComplete?: string;
    hint?: string;
    min?: string | number;
    max?: string | number;
}) {
    return (
        <div>
            <label htmlFor={id} className={LABEL}>
                {label}
                {!required && (
                    <span className="ml-2 font-medium text-black/40">
                        optional
                    </span>
                )}
            </label>

            <input
                id={id}
                name={id}
                type={type}
                defaultValue={defaultValue}
                autoComplete={autoComplete}
                min={min}
                max={max}
                // `aria-describedby` points at whichever of the two exists; both ids are
                // stable so this stays correct when the error appears and disappears.
                aria-describedby={
                    error ? `${id}-error` : hint ? `${id}-hint` : undefined
                }
                aria-invalid={error ? true : undefined}
                className={INPUT}
            />

            {hint && !error && (
                <p id={`${id}-hint`} className="mt-2 text-[16px] font-medium text-black/60">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-error`} className={ERROR}>
                    {error}
                </p>
            )}
        </div>
    );
}

/**
 * The message shown above a form.
 *
 * @param ok Marks the message as an outcome rather than a failure. `alert` interrupts a
 * screen reader mid-sentence, which is wrong for "account created, now confirm it".
 */
export function FormBanner({ message, ok }: { message: string; ok?: boolean }) {
    return (
        <p
            role={ok ? "status" : "alert"}
            className={`rounded-[12px] px-4 py-3 text-[15px] font-medium ${
                ok
                    ? "border border-black/10 bg-black/[0.03] text-black"
                    : "border border-red-700/20 bg-red-50 text-red-800"
            }`}
        >
            {message}
        </p>
    );
}
