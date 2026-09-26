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
 * A `<select>` shaped like `Field`. Local, not in form-primitives: it's the only select on the site,
 * and a shared field for one caller grows the wrong props. Moves there when a second appears.
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
 * The request modal's body: six fields, or the confirmation. One component for every leisure page —
 * copy and dropdown come from `EXPERIENCE_REQUESTS`, so validation and a11y can't drift. ⚠️ Not a
 * reservation: no table exists behind it (README §1), hence "request" and "confirm by email".
 *
 * @param experience Which page opened it; a hidden input, re-checked by the action.
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
                    className={`${SUBMIT} mt-2`}
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

                {/* No `min`: the kept-mounted modal renders in the static prerender, so a computed
                    date would freeze at build time. The action rejects past dates in villa time. */}
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
