/**
 * The ceiling on an avatar *going in*, shared by the browser and the Server Action.
 *
 * Its own module with no imports because both sides need it: `uploadAvatar` in
 * server-actions.ts (a `"use server"` file, which may only export async functions) and
 * avatar-upload.tsx (a Client Component, which must not pull server code into its bundle).
 * One copy, so the check and the sentence shown to the guest can never disagree.
 *
 * The ceiling on an avatar coming *out* is a different number and lives with the bucket it
 * belongs to — `MAX_BYTES` in oauth-avatar.ts.
 */

/** Stated in the message below, so both come from one place. */
const MAX_UPLOAD_MB = 3;

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Shown when a file is turned away for its size, on either side of the round trip. */
export const TOO_LARGE_MESSAGE = `That photo is too large. Try one under ${MAX_UPLOAD_MB} MB.`;
