"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import type { Provider } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getAuthUser } from "@/features/auth/actions";
import { MAX_BYTES as AVATAR_MAX_BYTES } from "@/features/auth/oauth-avatar";
import {
    MAX_UPLOAD_BYTES,
    TOO_LARGE_MESSAGE,
} from "@/features/auth/avatar-limits";
import {
    OAUTH_NEXT_COOKIE,
    OAUTH_NEXT_MAX_AGE,
    safeNextPath,
} from "@/features/auth/next-path";
import type {
    AuthFormState,
    AvatarFormState,
    DeleteAccountFormState,
    PasswordFormState,
    ProfileFormState,
} from "@/features/auth/types";

/**
 * Mutations for auth. Split from actions.ts because every export in a `"use server"` file
 * is reachable as a public endpoint — reads have no business being one.
 *
 * Each is shaped for `useActionState`: `(prevState, formData) => state`. On success they
 * redirect rather than return, so a successful submit produces no state at all.
 */

/** Supabase's own floor. Checked here too so the error lands on the field, not in a banner. */
const MIN_PASSWORD_LENGTH = 6;

function readString(formData: FormData, key: string): string {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
}

/**
 * Passwords are read raw — never trimmed.
 *
 * A trailing space is a legitimate character. Trimming it here would silently store a
 * different password than the one typed, and then silently fail to match it at sign-in.
 */
function readPassword(formData: FormData): string {
    const value = formData.get("password");
    return typeof value === "string" ? value : "";
}

/**
 * This deployment's own origin, e.g. `https://seaspace.example`.
 *
 * OAuth needs an absolute `redirectTo`, and deriving it from the request means the value
 * follows the deployment instead of needing an environment variable set correctly in three
 * places. The forwarded headers are spoofable, but they are not the security boundary:
 * Supabase only honours a `redirectTo` that matches URL Configuration → Redirect URLs, and
 * falls back to the Site URL otherwise — so a forged host never receives the code. That check
 * happens on the way back, not at /authorize; see features/auth/README.md.
 */
async function siteOrigin(): Promise<string> {
    const headerList = await headers();
    const host = headerList.get("host");
    // Absent in local dev, where the connection really is plain HTTP.
    const protocol = headerList.get("x-forwarded-proto") ?? "http";

    return `${protocol}://${host}`;
}

/**
 * Turns a Supabase auth error into something a guest can act on.
 *
 * Matched on `error.code`, not `error.message`: `ErrorCode` is a typed union in
 * @supabase/auth-js, while the message text is free to change between releases.
 *
 * Returns `null` when the code has no special copy, so the caller falls back to Supabase's
 * own message rather than swallowing an error nobody anticipated.
 */
function describeAuthError(
    code: string | undefined,
): { message?: string; errors?: NonNullable<AuthFormState>["errors"] } | null {
    switch (code) {
        case "user_already_exists":
        case "email_exists":
            return {
                message: "This email is already registered. Sign in instead.",
            };

        case "email_address_invalid":
            // Worth naming example.com explicitly: every seeded account in this project uses
            // it, so it is the first address anyone reaches for when testing sign-up — and
            // Supabase rejects the whole domain outright.
            return {
                errors: {
                    email: "Supabase rejected this address. Reserved domains such as example.com are never accepted — use a real one.",
                },
            };

        case "over_email_send_rate_limit":
            // Now that custom SMTP is configured this means the project's hourly send
            // allowance is genuinely spent, not that mail is impossible. Waiting works.
            return {
                message:
                    "Too many emails have been sent from this site in the past hour. Try again shortly.",
            };

        case "email_address_not_authorized":
            // Only reachable if custom SMTP is switched off again, putting Supabase's
            // built-in sender back in play — it delivers to project team members only.
            return {
                message:
                    "This site cannot send email to that address right now. See features/auth/README.md.",
            };

        case "weak_password":
            return { errors: { password: "Choose a stronger password." } };

        case "email_not_confirmed":
            return {
                message:
                    "This account exists but has not been confirmed yet. Check your inbox for the confirmation link.",
            };

        case "unexpected_failure":
            // What Supabase returns (HTTP 500) when the SMTP relay refuses the confirmation
            // email — its own message is the bare "Error sending confirmation email", which
            // tells a guest nothing they can act on and advertises that the site is broken.
            //
            // Points at the OAuth buttons deliberately: they sit above this form and do not
            // touch email at all, so a mail outage is an inconvenience rather than a locked
            // door. Diagnosing the outage: features/auth/README.md, "Email delivery".
            return {
                message:
                    "We could not send the confirmation email — that is a problem on our side, not with your address. Continue with GitHub or Google above, or try again later.",
            };

        default:
            return null;
    }
}

/**
 * Failures caused by whoever is filling in the form, not by the site.
 *
 * A wrong password is not an incident, and logging every one of them buries the failures that
 * do need someone's attention.
 */
const QUIET_ERROR_CODES = new Set([
    "invalid_credentials",
    "email_not_confirmed",
    "user_already_exists",
    "email_exists",
    "email_address_invalid",
    "weak_password",
    "same_password",
    "validation_failed",
]);

/**
 * Records an auth failure the site's operator needs to know about.
 *
 * Without this the only way to learn why a sign-up failed is to open the Supabase dashboard —
 * which is exactly how "Error sending confirmation email" cost an afternoon of guessing.
 *
 * ⚠️ **Logs the code, status and Supabase's own message — never the email address or the
 * password.** `error.code` is enough to diagnose with, and server logs are the wrong place
 * for anything that identifies a person.
 *
 * @param action Which action failed, e.g. `"signUp"`.
 *
 * @example
 * // [auth:signUp] code=unexpected_failure status=500 Error sending confirmation email
 */
function logAuthError(
    action: string,
    error: { code?: string; status?: number; message: string },
): void {
    if (error.code && QUIET_ERROR_CODES.has(error.code)) return;

    console.error(
        `[auth:${action}] code=${error.code ?? "none"} status=${error.status ?? "none"} ${error.message}`,
    );
}

/**
 * Signs an existing guest in, then returns them where they came from.
 *
 * @param formData `email`, `password`, and an optional `next` path.
 */
export async function signIn(
    _prevState: AuthFormState,
    formData: FormData,
): Promise<AuthFormState> {
    const email = readString(formData, "email");
    const password = readPassword(formData);
    const next = safeNextPath(formData.get("next"));

    const errors: NonNullable<AuthFormState>["errors"] = {};
    if (!email) errors.email = "Enter your email address.";
    if (!password) errors.password = "Enter your password.";

    if (Object.keys(errors).length > 0) {
        return { errors, values: { email } };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        logAuthError("signIn", error);

        // `email_not_confirmed` is worth naming: the person has already proven they know the
        // password, so saying the account exists leaks nothing they could not confirm anyway
        // — and without it, an unconfirmed account looks like a forgotten password forever.
        if (error.code === "email_not_confirmed") {
            return {
                ...describeAuthError(error.code),
                values: { email },
            };
        }

        // Everything else stays deliberately vague. Distinguishing "no such account" from
        // "wrong password" turns this form into a way to test whether an address is
        // registered here.
        return {
            message: "That email and password do not match an account.",
            values: { email },
        };
    }

    // Layouts do not re-render on client-side navigation, so the header would keep showing
    // the signed-out icon without this.
    revalidatePath("/", "layout");
    redirect(next);
}

/**
 * Creates an account.
 *
 * The metadata sent here is a contract with `handle_new_guest()` (migration 0006): the
 * trigger reads `display_name`, `full_name` and `nationality` out of `raw_user_meta_data`
 * to build the `public.guests` row. It fires ONCE (`on conflict (id) do nothing`), so
 * metadata edited later does not flow through — /account writes to `guests` directly.
 *
 * "Confirm email" is OFF, so this action signs the guest straight in: Supabase stamps
 * `email_confirmed_at` at once, the 0006 trigger fires, and the `public.guests` row exists
 * before the redirect. Check the setting with `GET /auth/v1/settings` → `mailer_autoconfirm`
 * (**true** means confirmation is off). Why it is off, and what changes when it is switched
 * back on: features/auth/README.md.
 */
export async function signUp(
    _prevState: AuthFormState,
    formData: FormData,
): Promise<AuthFormState> {
    const email = readString(formData, "email");
    const password = readPassword(formData);
    const displayName = readString(formData, "displayName");
    const fullName = readString(formData, "fullName");
    const nationality = readString(formData, "nationality");
    const next = safeNextPath(formData.get("next"));

    const values = { email, displayName, fullName, nationality };

    const errors: NonNullable<AuthFormState>["errors"] = {};
    if (!email) errors.email = "Enter your email address.";
    if (password.length < MIN_PASSWORD_LENGTH) {
        errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (!displayName) {
        errors.displayName = "Enter the name other guests will see.";
    }

    if (Object.keys(errors).length > 0) {
        return { errors, values };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            // Empty strings are filtered out rather than sent: handle_new_guest() runs each
            // value through nullif(), but only for values it receives — an empty string
            // that arrives still beats the coalesce() fallback chain for full_name.
            data: {
                display_name: displayName,
                ...(fullName ? { full_name: fullName } : {}),
                ...(nationality ? { nationality } : {}),
            },
        },
    });

    if (error) {
        logAuthError("signUp", error);

        // Fall back to Supabase's own wording rather than swallowing a code nobody planned for.
        return {
            ...(describeAuthError(error.code) ?? { message: error.message }),
            values,
        };
    }

    // Everything below is why this function cannot simply trust "no error".
    //
    // signUp() succeeds in three materially different ways, and two of them leave the guest
    // with no session at all. Redirecting on all three is what made a failed registration
    // look like a completed one.

    // An empty `identities` array means the address is already registered and Supabase chose
    // to obscure that rather than confirm it — its anti-enumeration behaviour when both
    // Confirm email and Confirm phone are on. No account was created.
    if (data.user && data.user.identities?.length === 0) {
        return {
            message: "This email is already registered. Sign in instead.",
            values,
        };
    }

    // A user without a session means the account was created and is waiting on email
    // confirmation. Unreachable while "Confirm email" is off, and kept because that is one
    // dashboard toggle away from changing — at which point this becomes the normal outcome
    // and the redirect below moves to app/auth/confirm/route.ts.
    if (!data.session) {
        return {
            ok: true,
            message:
                "Account created. Check your email for the confirmation link — opening it signs you in.",
            // Echoed back so React's post-action form reset does not wipe what was typed.
            values,
        };
    }

    revalidatePath("/", "layout");
    redirect(next);
}

/**
 * Starts an OAuth sign-in and hands the guest over to the provider.
 *
 * The provider's registered callback is Supabase's own
 * `https://<project-ref>.supabase.co/auth/v1/callback`; `redirectTo` is where Supabase sends
 * them afterwards, which is app/auth/callback/route.ts here.
 *
 * @param formData `provider` (`github` or `google`) and an optional `next` path.
 */
export async function signInWithProvider(formData: FormData): Promise<void> {
    const provider = readString(formData, "provider") as Provider;
    const next = safeNextPath(formData.get("next"), "/account");

    // The destination rides in a cookie rather than on `redirectTo`, so exactly one callback
    // URL ever needs to be in Supabase's allow-list. See features/auth/next-path.ts.
    const cookieStore = await cookies();
    const origin = await siteOrigin();

    cookieStore.set(OAUTH_NEXT_COOKIE, next, {
        httpOnly: true,
        sameSite: "lax",
        secure: origin.startsWith("https:"),
        maxAge: OAUTH_NEXT_MAX_AGE,
        path: "/",
    });

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${origin}/auth/callback`,
            // There is no browser here to redirect; this action only needs the URL back so
            // it can answer with it.
            skipBrowserRedirect: true,
        },
    });

    if (error || !data.url) {
        redirect("/login?error=oauth_failed");
    }

    // The one redirect in this file that leaves the site, and the one place safeNextPath()
    // deliberately does not apply: the URL is Supabase's own response, not user input.
    redirect(data.url);
}

/**
 * Emails a password reset link, or appears to.
 *
 * @param formData `email`.
 *
 * @example
 * const [state, action] = useActionState(requestPasswordReset, undefined);
 */
export async function requestPasswordReset(
    _prevState: AuthFormState,
    formData: FormData,
): Promise<AuthFormState> {
    const email = readString(formData, "email");

    if (!email) {
        return { errors: { email: "Enter your email address." } };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    // The result never reaches the guest. Answering differently for a registered and an
    // unregistered address would turn this form into a way to test who has an account here
    // — the same reasoning that keeps signIn's `invalid_credentials` message vague.
    //
    // It does reach the operator, though. An SMTP outage here is otherwise completely silent:
    // every guest sees the same reassuring notice while nothing is being delivered.
    if (error) logAuthError("requestPasswordReset", error);

    return {
        ok: true,
        message:
            "If that address has an account, a reset link is on its way. The link expires in an hour.",
    };
}

/**
 * Sets a new password for whoever the current session belongs to.
 *
 * Reached two ways, and it does not need to tell them apart: through a recovery link, which
 * app/auth/confirm/route.ts turns into a session, or by an already signed-in guest. Both are
 * legitimate, and in both cases Supabase scopes the update to the session's own user.
 *
 * @param formData `password` and `confirmPassword`.
 */
export async function updatePassword(
    _prevState: PasswordFormState,
    formData: FormData,
): Promise<PasswordFormState> {
    const user = await getAuthUser();
    if (!user) redirect("/login?next=/account/update-password");

    const password = readPassword(formData);
    const confirmValue = formData.get("confirmPassword");
    const confirmPassword = typeof confirmValue === "string" ? confirmValue : "";

    if (password.length < MIN_PASSWORD_LENGTH) {
        return {
            errors: {
                password: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
            },
        };
    }

    if (password !== confirmPassword) {
        return { errors: { confirmPassword: "The two passwords differ." } };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
        logAuthError("updatePassword", error);

        // Handled here rather than through describeAuthError(): that helper's field names
        // belong to the sign-in form, and only these two codes can reach this call.
        if (error.code === "weak_password") {
            return { errors: { password: "Choose a stronger password." } };
        }
        if (error.code === "same_password") {
            return {
                errors: { password: "That is already your password." },
            };
        }

        return { message: "Could not update your password. Try again." };
    }

    return { ok: true, message: "Password updated." };
}

/** Ends the session and returns to the homepage. */
export async function signOut(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();

    revalidatePath("/", "layout");
    redirect("/");
}

/**
 * Updates the signed-in guest's own row.
 *
 * No ownership check is written here because none belongs here: the RLS policy
 * "guests update their own row" scopes the statement to `auth.uid() = id`, with a
 * `with check` clause so the row cannot be rewritten to point at somebody else. The
 * `.eq("id", …)` below is what the policy matches against, not the authorisation itself.
 */
export async function updateProfile(
    _prevState: ProfileFormState,
    formData: FormData,
): Promise<ProfileFormState> {
    const user = await getAuthUser();
    if (!user) redirect("/login?next=/account");

    const displayName = readString(formData, "displayName");
    const fullName = readString(formData, "fullName");
    const nationality = readString(formData, "nationality");

    if (!displayName) {
        return { errors: { displayName: "Enter the name other guests will see." } };
    }

    const supabase = await createClient();
    const { error } = await supabase
        .from("guests")
        .update({
            display_name: displayName,
            // Emptied fields become NULL, not "". Both columns are nullable, and an empty
            // string would render as a blank line rather than being absent.
            full_name: fullName || null,
            nationality: nationality || null,
        })
        .eq("id", user.id);

    if (error) {
        return { message: "Could not save your changes. Try again." };
    }

    // The header renders display_name and the avatar, so it has to re-read.
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
}

/**
 * Replaces the signed-in guest's avatar.
 *
 * Unlike `adoptProviderAvatar` in oauth-avatar.ts, these bytes come straight from a guest's
 * device and are never trustworthy as-is — see the "Upload contract" section of
 * features/account/README.md. Re-encoding through `sharp` (rather than checking the
 * extension or MIME header) is the actual control: a Server Action is a plain HTTP endpoint
 * that can be hit directly, so anything enforced only in the browser is UX, not security.
 * A file `sharp` cannot decode is rejected outright, and the re-encoded output never carries
 * over EXIF because `sharp` only copies metadata when `.withMetadata()` is called.
 */
export async function uploadAvatar(
    _prevState: AvatarFormState,
    formData: FormData,
): Promise<AvatarFormState> {
    const user = await getAuthUser();
    if (!user) redirect("/login?next=/account");

    const file = formData.get("avatar");
    if (!(file instanceof File) || file.size === 0) {
        return { message: "Choose a photo first." };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return { message: TOO_LARGE_MESSAGE };
    }

    // Dynamic, not module-level: this file is "use server", so every export shares one
    // bundle — a native-binary load failure here must not take every auth action down.
    let sharp: typeof import("sharp");
    try {
        ({ default: sharp } = await import("sharp"));
    } catch (error) {
        // Deliberately not folded into the decode failure below: this one means sharp itself
        // is unusable on this host, which is ours to fix and invisible without a log.
        logAuthError("uploadAvatar:sharp", {
            message: error instanceof Error ? error.message : String(error),
        });
        return { message: "Photo uploads are unavailable right now. Try again later." };
    }

    let resized: Buffer;
    try {
        const original = Buffer.from(await file.arrayBuffer());
        resized = await sharp(original)
            .resize(256, 256, { fit: "cover" })
            .webp({ quality: 80 })
            .toBuffer();
    } catch {
        return { message: "That file isn't a photo Seaspace can read." };
    }

    if (resized.byteLength > AVATAR_MAX_BYTES) {
        return { message: "Couldn't shrink that photo enough. Try a simpler image." };
    }

    const supabase = await createClient();

    // Read the outgoing path before it is overwritten — nothing knows the old filename once
    // the column points at the new one.
    const { data: guest } = await supabase
        .from("guests")
        .select("avatar_path")
        .eq("id", user.id)
        .maybeSingle();
    const previousPath = guest?.avatar_path ?? null;

    const path = `${user.id}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabase.storage
        .from("guests")
        .upload(path, resized, {
            contentType: "image/webp",
            cacheControl: "31536000",
        });
    if (uploadError) {
        return { message: "Could not upload your photo. Try again." };
    }

    const { error: updateError } = await supabase
        .from("guests")
        .update({ avatar_path: path })
        .eq("id", user.id);
    if (updateError) {
        // The column update is what makes the new photo visible; a stray object with nothing
        // pointing at it is a smaller problem than telling the guest it worked when it didn't.
        await supabase.storage.from("guests").remove([path]);
        return { message: "Could not save your photo. Try again." };
    }

    if (previousPath) {
        // Best-effort: the new avatar already succeeded, so a delete failure here is an
        // orphaned file, not a user-facing error.
        await supabase.storage.from("guests").remove([previousPath]);
    }

    // Same reasoning as updateProfile: the header renders the avatar on every route, so the
    // Router Cache has to be told, not just the current page's data.
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
}

/**
 * Deletes the signed-in guest's account, following ACCOUNT-DELETION-POLICY.md.
 *
 * Runs on the service-role client (lib/supabase-admin.ts) for everything past the password
 * check, not the request-scoped one: `auth.admin.deleteUser()` requires it outright, and so
 * does touching `reviews` at all — that table has no RLS `update`/`delete` policy for
 * guests (see features/account/README.md → "Planned" → My reviews), so the anon-key client
 * could not do this even scoped to the guest's own rows.
 *
 * Order matters and is enforced here, not just documented: `reviews_orphan_is_anonymised`
 * (migration 0008) rejects a review with no `guest_id` whose author columns are not already
 * overwritten, so the review rows are handled *before* the account — and the avatar path
 * that names the file to delete — are gone.
 */
export async function deleteAccount(
    _prevState: DeleteAccountFormState,
    formData: FormData,
): Promise<DeleteAccountFormState> {
    const user = await getAuthUser();
    if (!user) redirect("/login?next=/account");

    const option = readString(formData, "option");
    if (option !== "anonymize" && option !== "erase") {
        return { errors: { option: "Choose what happens to your reviews." } };
    }

    const supabase = await createClient();

    // The password field is only present in the submitted form at all when the dialog
    // decided (via hasPasswordIdentity() in actions.ts) that this guest has one to check —
    // an OAuth-only guest has nothing to verify against, so there is nothing to enforce here.
    if (formData.has("password")) {
        const password = readPassword(formData);
        if (!password) {
            return { errors: { password: "Enter your password to confirm." } };
        }

        const { error } = await supabase.auth.signInWithPassword({
            email: user.email,
            password,
        });
        if (error) {
            return { errors: { password: "That password is incorrect." } };
        }
    }

    // Read while the row (and the RLS policy that scopes it to its owner) still exist —
    // nothing knows this guest's avatar path any more once the account is deleted.
    const { data: guest } = await supabase
        .from("guests")
        .select("avatar_path")
        .eq("id", user.id)
        .maybeSingle();
    const avatarPath = guest?.avatar_path ?? null;

    const admin = createAdminClient();

    if (option === "anonymize") {
        const { error } = await admin
            .from("reviews")
            .update({
                author_display_name: "Former guest",
                // NOT NULL, so the "no author" value is an empty string, not null — mirrors
                // ACCOUNT-DELETION-POLICY.md §"Urutan operasinya".
                author_nationality: "",
                author_avatar_path: null,
            })
            .eq("guest_id", user.id);

        if (error) {
            logAuthError("deleteAccount:anonymize", error);
            return { message: "Could not update your reviews. Try again." };
        }
    } else {
        const { error } = await admin
            .from("reviews")
            .delete()
            .eq("guest_id", user.id);

        if (error) {
            logAuthError("deleteAccount:erase", error);
            return { message: "Could not remove your reviews. Try again." };
        }
    }

    if (avatarPath) {
        // Best-effort, same reasoning as uploadAvatar(): the review rows are already
        // handled, and a stray file with nothing pointing at it is a smaller problem than
        // leaving the guest stuck mid-deletion over a storage hiccup.
        await admin.storage.from("guests").remove([avatarPath]);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
        logAuthError("deleteAccount:deleteUser", deleteError);
        return { message: "Could not delete your account. Try again." };
    }

    // The account is gone, but the browser still holds a session cookie for it — clear it
    // the same way signOut() does rather than leaving a dead session behind.
    await supabase.auth.signOut();

    revalidatePath("/", "layout");
    redirect("/");
}
