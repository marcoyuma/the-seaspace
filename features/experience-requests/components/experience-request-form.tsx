"use client";

// Client-side for the submit lifecycle only: `useActionState` supplies the pending flag
// while the row is written, the per-field errors afterwards, and the success state that
// swaps the fields for a confirmation. The write itself is a Server Action.
import { useActionState } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import {
    ERROR,
    Field,
    FormBanner,
    INPUT,
    LABEL,
    SUBMIT,
} from "@/features/auth/components/form-primitives";
import { EXPERIENCE_REQUESTS } from "@/features/experience-requests/lib/experiences";
import { submitExperienceRequest } from "@/features/experience-requests/server-actions";
import type { ExperienceId } from "@/features/experience-requests/types";

/**
 * A `<select>` in the shape of `Field`.
 *
 * Local rather than added to form-primitives: that file's own note says a shared field
 * invented for a single caller grows the wrong props, and this is the only select on the
 * site. It moves there when a second one appears.
 */
function SelectField({
    id,
    label,
    options,
    defaultValue,
    error,
}: {
    id: string;
    label: string;
    options: readonly string[];
    defaultValue?: string;
    error?: string;
}) {
    return (
        <div>
            <label htmlFor={id} className={LABEL}>
                {label}
                <span className="ml-2 font-medium text-black/40">optional</span>
            </label>

            <select
                id={id}
                name={id}
                defaultValue={defaultValue ?? ""}
                aria-describedby={error ? `${id}-error` : undefined}
                aria-invalid={error ? true : undefined}
                className={`${INPUT} cursor-pointer appearance-none`}
            >
                {/* Empty value, not a copy of the first option: "no preference stated" and
                    "the first thing on the list" are different answers, and the column is
                    nullable precisely so it can hold the first one. */}
                <option value="">No preference</option>
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>

            {error && (
                <p id={`${id}-error`} className={ERROR}>
                    {error}
                </p>
            )}
        </div>
    );
}

/** The free-text field, same markup as `Field` with a textarea in place of the input. */
function TextareaField({
    id,
    label,
    placeholder,
    defaultValue,
    error,
}: {
    id: string;
    label: string;
    placeholder: string;
    defaultValue?: string;
    error?: string;
}) {
    return (
        <div>
            <label htmlFor={id} className={LABEL}>
                {label}
                <span className="ml-2 font-medium text-black/40">optional</span>
            </label>

            <textarea
                id={id}
                name={id}
                rows={4}
                placeholder={placeholder}
                defaultValue={defaultValue}
                aria-describedby={error ? `${id}-error` : undefined}
                aria-invalid={error ? true : undefined}
                className={`${INPUT} resize-y`}
            />

            {error && (
                <p id={`${id}-error`} className={ERROR}>
                    {error}
                </p>
            )}
        </div>
    );
}

/**
 * The body of the request modal: six fields, or the confirmation that replaces them.
 *
 * One component for both leisure pages — the wording and the single dropdown come from
 * `EXPERIENCE_REQUESTS[experience]`, so golf and spa cannot drift apart in validation,
 * markup or accessibility. See lib/experiences.ts.
 *
 * ⚠️ Nothing on this page is a reservation. The copy says "request" and "confirm by email"
 * throughout, because that is all that happens — see `README.md` §1: there is no database
 * table behind this feature at all.
 *
 * @param experience Which page opened it. Travels to the action as a hidden input, and is
 *   re-checked there: the form is a convenience, never the validation.
 * @param defaultName @param defaultEmail Prefill for a signed-in guest, read on the server.
 * @param onDone Closes the modal from the confirmation panel.
 */
export default function ExperienceRequestForm({
    experience,
    defaultName,
    defaultEmail,
    onDone,
}: {
    experience: ExperienceId;
    defaultName?: string;
    defaultEmail?: string;
    onDone: () => void;
}) {
    const config = EXPERIENCE_REQUESTS[experience];
    const [state, action, pending] = useActionState(
        submitExperienceRequest,
        undefined,
    );

    if (state?.ok) {
        return (
            <div className="flex flex-col items-start gap-4 py-6">
                <CheckCircleIcon
                    size={40}
                    weight="light"
                    aria-hidden
                    className="text-black"
                />

                <h2 className="text-[24px] leading-tight font-semibold text-black">
                    Thank you
                </h2>

                {/* `role="status"`, not `alert`: this is an outcome, and `alert`
                    interrupts a screen reader mid-sentence. Same call as `FormBanner`. */}
                <p role="status" className="text-[16px] font-medium text-black/60">
                    {config.confirmation}
                </p>

                <button
                    type="button"
                    onClick={onDone}
                    className={`${SUBMIT} mt-2 px-8`}
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <form action={action} className="flex flex-col gap-5">
            <div>
                <h2 className="text-[24px] leading-tight font-semibold text-black">
                    {config.title}
                </h2>
                <p className="mt-2 text-[16px] font-medium text-black/60">
                    {config.subtitle}
                </p>
            </div>

            {/* Hidden rather than bound as an argument: a Server Action is a public
                endpoint either way, so a bound value is no safer than a form field — and
                this keeps it obvious that the action re-checks it. */}
            <input type="hidden" name="experience" value={experience} />

            {state?.message && <FormBanner message={state.message} />}

            <Field
                id="name"
                label="Name"
                required
                autoComplete="name"
                defaultValue={state?.values?.name ?? defaultName}
                error={state?.errors?.name}
            />

            <Field
                id="email"
                label="Email"
                type="email"
                required
                autoComplete="email"
                defaultValue={state?.values?.email ?? defaultEmail}
                error={state?.errors?.email}
            />

            <Field
                id="phone"
                label="Phone"
                type="tel"
                autoComplete="tel"
                defaultValue={state?.values?.phone}
                error={state?.errors?.phone}
                hint="Only if you would rather we called."
            />

            <div className="grid grid-cols-2 gap-4">
                <Field
                    id="partySize"
                    label={config.partyLabel}
                    type="number"
                    required
                    min={1}
                    max={config.maxPartySize}
                    defaultValue={state?.values?.partySize ?? "1"}
                    error={state?.errors?.partySize}
                />

                {/* No `min` on this one, deliberately. The modal is kept mounted, so it
                    renders during the prerender of a static marketing page — a date
                    computed here would be frozen at build time and would then grey out
                    days that are perfectly bookable. The action rejects past dates against
                    the villas' own timezone, which is the answer that counts. */}
                <Field
                    id="preferredDate"
                    label="Preferred date"
                    type="date"
                    defaultValue={state?.values?.preferredDate}
                    error={state?.errors?.preferredDate}
                />
            </div>

            <SelectField
                id="preference"
                label={config.choice.label}
                options={config.choice.options}
                defaultValue={state?.values?.preference}
                error={state?.errors?.preference}
            />

            <TextareaField
                id="message"
                label={config.messageLabel}
                placeholder={config.messagePlaceholder}
                defaultValue={state?.values?.message}
                error={state?.errors?.message}
            />

            <div className="mt-1 flex items-center justify-end gap-6">
                <button
                    type="button"
                    onClick={onDone}
                    className="cursor-pointer text-[16px] font-semibold text-black underline underline-offset-4"
                >
                    Cancel
                </button>

                <button type="submit" disabled={pending} className={SUBMIT}>
                    {pending ? "Sending…" : "Send request"}
                </button>
            </div>
        </form>
    );
}
