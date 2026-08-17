"use client";

// Client-side only for the submit lifecycle, same split as ProfileForm: `useActionState`
// supplies pending/message, the write itself is a Server Action.
import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { uploadAvatar } from "@/features/auth/server-actions";
import { publicStorageUrl } from "@/lib/supabase";
import { FormBanner } from "@/features/auth/components/form-primitives";

const SIZE = 96;

/**
 * Lets a guest replace their avatar. Picking a file submits immediately — there is no
 * separate "Save" step, so the only affordance is the picture itself.
 *
 * @param avatarPath Current `guests.avatar_path`, or `null` for the icon fallback. Callers
 * should pass `key={user.id}` the same way `ProfileForm` does, so switching accounts drops
 * any stale local preview instead of reusing this component's state.
 */
export default function AvatarUpload({
    avatarPath,
}: {
    avatarPath: string | null;
}) {
    const [state, action, pending] = useActionState(uploadAvatar, undefined);
    const formRef = useRef<HTMLFormElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Cleanup-only: revokes the *previous* blob once a new one replaces it, and the last one
    // on unmount. Derived during render (below) rather than cleared here, so this effect never
    // calls setState — see the "you might not need an effect" write-up react-hooks lints for.
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    // Only trust the local blob while the upload is in flight. Once `pending` flips back to
    // false, the server action has already redirected/revalidated, so the parent Server
    // Component has re-rendered with a fresh `avatarPath` prop — falling back to it here
    // (instead of clearing `previewUrl` in an effect) is what keeps this a pure render.
    const src =
        pending && previewUrl
            ? previewUrl
            : avatarPath
              ? publicStorageUrl("guests", avatarPath)
              : null;

    return (
        <form ref={formRef} action={action} className="flex flex-col gap-4">
            {state?.message && (
                <FormBanner message={state.message} ok={state.ok} />
            )}

            <div className="flex items-center gap-6">
                <div
                    className="relative shrink-0 overflow-hidden rounded-full bg-black/5"
                    style={{ width: SIZE, height: SIZE }}
                >
                    {src ? (
                        <Image
                            src={src}
                            alt=""
                            width={SIZE}
                            height={SIZE}
                            aria-hidden
                            className="h-full w-full object-cover"
                            // The blob: preview isn't a domain Next's optimizer can fetch.
                            unoptimized={src === previewUrl}
                        />
                    ) : (
                        <UserCircleIcon
                            size={SIZE}
                            color="#000000"
                            weight="fill"
                        />
                    )}
                </div>

                <label
                    htmlFor="avatar"
                    className="cursor-pointer rounded-[40px] border border-black/15 px-6 py-3 text-[16px] font-medium text-black transition-opacity duration-300 ease-out motion-reduce:transition-none hover:opacity-70 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
                    aria-disabled={pending}
                >
                    {pending ? "Uploading…" : "Change photo"}
                </label>
                <input
                    id="avatar"
                    name="avatar"
                    type="file"
                    accept="image/*"
                    disabled={pending}
                    className="sr-only"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;

                        // Purely a size hint before the round-trip — sharp on the server is
                        // the real check, this just avoids uploading something doomed to fail.
                        if (file.size > 8 * 1024 * 1024) {
                            event.target.value = "";
                            return;
                        }

                        setPreviewUrl(URL.createObjectURL(file));
                        formRef.current?.requestSubmit();
                    }}
                />
            </div>
        </form>
    );
}
