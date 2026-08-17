"use client";

import { useActionState, useState } from "react";

import { deleteAccount } from "@/features/auth/server-actions";
import { ERROR, INPUT, LABEL } from "@/features/auth/components/form-primitives";
import Modal from "@/ui/modal";

/**
 * One of the two review outcomes a guest picks between when deleting their account. Kept
 * identical in every visual respect — size, weight, color — per the anti-dark-pattern rules
 * in ACCOUNT-DELETION-POLICY.md §2: neither may read as the "recommended" one.
 */
function ReviewOptionCard({
    value,
    title,
    description,
    note,
}: {
    value: string;
    title: string;
    description: string;
    note?: string;
}) {
    return (
        <label className="flex cursor-pointer flex-col gap-2 rounded-[16px] border border-black/15 p-5 transition-colors duration-300 ease-out has-checked:border-black has-checked:bg-black/[0.03] motion-reduce:transition-none">
            <div className="flex items-start gap-3">
                <input
                    type="radio"
                    name="option"
                    value={value}
                    // No `defaultChecked` on either card — an active choice is required,
                    // not defaulted away for the guest.
                    className="mt-1"
                    required
                />
                <div>
                    <p className="text-[16px] font-semibold text-black">{title}</p>
                    <p className="mt-1 text-[16px] font-medium text-black/60">
                        {description}
                    </p>
                </div>
            </div>
            {note && (
                <p className="ml-7 text-[13px] text-black/40">{note}</p>
            )}
        </label>
    );
}

/**
 * The "Delete account" flow: a trigger button plus the confirmation dialog it opens.
 *
 * @param hasPassword From `hasPasswordIdentity()` in features/auth/actions.ts. When false
 * (OAuth-only guest, never set a password) the password field is not rendered at all rather
 * than shown disabled — there is nothing to check it against.
 */
export default function DeleteAccountDialog({
    hasPassword,
}: {
    hasPassword: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [state, action, pending] = useActionState(deleteAccount, undefined);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="rounded-[40px] border border-red-700/30 px-6 py-3 text-[16px] font-medium text-red-700 transition-colors duration-300 ease-out motion-reduce:transition-none hover:border-transparent hover:bg-red-700 hover:text-white focus-visible:border-transparent focus-visible:bg-red-700 focus-visible:text-white"
            >
                Delete account
            </button>

            <Modal
                isOpen={isOpen}
                onClose={() => !pending && setIsOpen(false)}
                label="Delete your account"
            >
                <h2 className="text-[24px] font-semibold text-black">
                    Delete your account
                </h2>
                <p className="mt-3 text-[16px] font-medium text-black/60">
                    This permanently deletes your account, profile, and photo.
                    It cannot be undone. Your bookings are kept — they are
                    financial records, not something an account deletion can
                    remove.
                </p>

                <form action={action} className="mt-8 flex flex-col gap-6">
                    {state?.message && (
                        <p role="alert" className={ERROR}>
                            {state.message}
                        </p>
                    )}

                    <fieldset className="flex flex-col gap-3">
                        <legend className="text-[14px] font-semibold tracking-wide text-black">
                            What should happen to your reviews?
                        </legend>

                        <ReviewOptionCard
                            value="anonymize"
                            title="Keep my reviews, remove my name"
                            description="Your quote and rating stay up. Your name, nationality, and photo are replaced with 'Former guest'."
                            note="Changed your mind later? Email us and we can locate and fully remove them by hand."
                        />

                        <ReviewOptionCard
                            value="erase"
                            title="Delete everything, including my reviews"
                            description="Your quote and rating are removed along with your account. The property's review count and average will change."
                        />

                        {state?.errors?.option && (
                            <p role="alert" className={ERROR}>
                                {state.errors.option}
                            </p>
                        )}
                    </fieldset>

                    {hasPassword && (
                        <div>
                            <label htmlFor="delete-password" className={LABEL}>
                                Confirm your password
                            </label>
                            <input
                                id="delete-password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                aria-invalid={
                                    state?.errors?.password ? true : undefined
                                }
                                aria-describedby={
                                    state?.errors?.password
                                        ? "delete-password-error"
                                        : undefined
                                }
                                className={INPUT}
                            />
                            {state?.errors?.password && (
                                <p id="delete-password-error" className={ERROR}>
                                    {state.errors.password}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={pending}
                            className="rounded-[40px] bg-red-700 px-6 py-3.5 text-[16px] font-medium text-white transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {pending ? "Deleting…" : "Permanently delete account"}
                        </button>
                        <button
                            type="button"
                            disabled={pending}
                            onClick={() => setIsOpen(false)}
                            className="text-[16px] font-medium text-black/60 transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
