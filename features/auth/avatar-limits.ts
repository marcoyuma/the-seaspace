/**
 * Avatar upload ceiling for both browser and `uploadAvatar`. Import-free, since a `"use server"` file
 * may export only async functions and the client mustn't pull in server code. The outgoing ceiling
 * is a different number — `MAX_BYTES` in oauth-avatar.ts.
 */

/** Stated in the message below, so both come from one place. */
const MAX_UPLOAD_MB = 3;

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Shown when a file is turned away for its size, on either side of the round trip. */
export const TOO_LARGE_MESSAGE = `That photo is too large. Try one under ${MAX_UPLOAD_MB} MB.`;
