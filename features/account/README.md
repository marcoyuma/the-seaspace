# Account — what `/account` does today, and what comes next

**Status: read/edit and avatar upload are built.** A signed-in guest can see their profile,
edit the three columns they own, upload an avatar, change their password, and sign out.
Everything else on this page is a plan.

This file is also the **single home for avatar documentation**. The schema for avatars was
finished long before any UI existed (migration `0008_guest_avatars.sql`), and the reasoning
used to be spread across `GUEST_PLANNING_TABLE.md` and `ACCOUNT-DELETION-POLICY.md`. It now
lives here, next to the page that will own the feature.

Auth itself — sign-in, sessions, `proxy.ts`, OAuth — is documented in
[features/auth/README.md](../auth/README.md), the single auth document.

## Contents

- [Built](#built)
- [Planned](#planned)
- [Avatar upload — the complete contract](#avatar-upload--the-complete-contract)
- [Avatar and account deletion](#avatar-and-account-deletion)
- [Verification](#verification)

---

## Built

| File | Role |
|---|---|
| `app/(auth)/account/page.tsx` | The route. Reads the session, redirects if absent |
| `app/(auth)/account/update-password/page.tsx` | Sets a new password. Reached from here, or from a recovery email |
| `features/account/components/profile-form.tsx` | Edits `display_name`, `full_name`, `nationality` |
| `features/account/components/avatar-upload.tsx` | Picks a photo and uploads it immediately — see the contract below |
| `features/account/components/sign-out-button.tsx` | A form posting to the `signOut` action |

The avatar write goes through `uploadAvatar` in `features/auth/server-actions.ts`, next to
`updateProfile` — same ownership model, same file. `oauth-avatar.ts`'s `ACCEPTED_TYPES` and
`MAX_BYTES` are exported and reused there rather than duplicated, and `avatar-limits.ts` does
the same for the ceiling on the way *in* — that one has to be readable from the browser too,
which is why it sits in a module of its own with no imports.

The write goes through `updateProfile` in `features/auth/server-actions.ts`. No ownership
check is written in application code, and none belongs there: the RLS policy
`guests update their own row` scopes the statement to `auth.uid() = id`, with a `with check`
clause so the row cannot be rewritten to point at somebody else.

**Email is deliberately absent from the form.** It lives in `auth.users`, not `guests` —
that table has no `email` column on purpose — and changing it is an auth flow with its own
confirmation step, not a profile field.

Emptied optional fields are stored as `NULL`, not `""`. Both columns are nullable, and an
empty string renders as a blank line rather than being absent.

`ui/menu-panel.tsx` has always linked to `/account`. Until this route existed that link was a
live 404; it now resolves.

## Planned

Ordered by what unblocks the most. None of it is built.

| Feature | Depends on | Notes |
|---|---|---|
| **My bookings** | nothing — `bookings` + RLS exist | `guests read their own bookings` already ships; 140 rows are seeded |
| **My reviews** | nothing | Read path exists; editing needs an RLS `update` policy on `reviews` |
| **Write a review** | `reviews.booking_id` | A review is "verified" structurally, by having a booking behind it — never by a flag |
| **Change email** | — | Two-step confirmation; touches `auth.users`, not `guests` |
| **Delete account** | route handler + service role key | Fully specified in [ACCOUNT-DELETION-POLICY.md](../../ACCOUNT-DELETION-POLICY.md) |

Two open questions inherited from `GUEST_PLANNING_TABLE.md` §5.7 that this page will
eventually have to answer:

- **Phone is unverified.** A number in `guests` is an unproven string until booking checkout
  verifies it. Any UI showing it must not imply otherwise.
- **Whether a legal name stays editable** once it has been used on a reservation.

## Avatar upload — the complete contract

**Built.** `features/account/components/avatar-upload.tsx` + `uploadAvatar` in
`features/auth/server-actions.ts`. This section is still written to stand on its own —
everything needed to understand *why* it works this way is here.

### ⚠️ A second writer exists

`avatar_path` is not written only by the upload form.
[features/auth/oauth-avatar.ts](../auth/oauth-avatar.ts) copies a GitHub or Google profile
photo into the bucket at first OAuth sign-in, following the same path convention below. Two
consequences that shaped the upload path:

- **It is adoption, not sync.** That helper returns early once `avatar_path` is set, so an
  uploaded photo is never overwritten by a provider one. Keep it that way.
- **It skips EXIF stripping, and is the only thing allowed to.** Those bytes were re-encoded
  by the provider's CDN and the identical file is already public at the provider's own URL, so
  copying it exposes nothing new. **That argument does not transfer to a file a guest picks
  from their phone** — see the upload contract below, where stripping is mandatory.

### What already exists after migration `0008`

| Object | What it holds |
|---|---|
| `guests.avatar_path` | Bucket-relative path, e.g. `a1b2…/f7c9.webp`. **Not a URL.** `NULL` = no photo |
| `reviews.author_avatar_path` | A copy of that path, taken when the review is written |
| bucket `guests` | Public, 512 KB limit, `image/webp\|jpeg\|png\|avif` |
| 4 policies on `storage.objects` | Read: anyone. Insert/update/delete: only into `auth.uid()`'s own folder |

512 KB rather than the 2 MB used for villa photos: an avatar renders at 38–54px, so anything
near that ceiling is an unprocessed upload.

### Why there are two columns and not one

`public.guests` has **no `anon` policy at all** — it holds phone numbers. A visitor who has
not logged in cannot read `avatar_path` from it, and the join returns nothing **without
raising an error**: the avatar would simply be blank forever and look like an unfinished
feature rather than a blocked read.

So the path is copied onto the review row, exactly as `author_display_name` and
`author_nationality` already are, for exactly the same reason. **Do not normalise it away.**

Accepted consequence: **changing your photo does not update older review cards.** A review is
a record of a moment, so this is defensible — but it is a choice, and if it ever becomes
unacceptable the fix is to update the guest's review rows at upload time, not to add a join.

### Path convention

```
<guest_uuid>/<random>.webp
```

- The **first folder is the owner**. The storage policies compare it to `auth.uid()`, so this
  is not cosmetic — get it wrong and either nobody can upload or everybody can overwrite
  everybody.
- The **filename must change on every upload**. A stable name means the CDN keeps serving the
  old photo after a replacement, and the guest concludes the upload failed. Delete the
  previous object after the new path is committed to the column.

### Reading it

`publicStorageUrl("guests", avatarPath)` from [lib/supabase.ts](../../lib/supabase.ts) —
already exists, nothing to write. `next.config.ts` `remotePatterns` already covers
`/storage/v1/object/public/**`, so `<Image>` needs no config change either.

Rendered in two places, both keeping `UserCircleIcon` as the fallback when the path is
`NULL`. The icon is not deleted, it changes role:

- [ui/profile-icon.tsx](../../ui/profile-icon.tsx) — 38px, **already implemented**: the
  header's third state renders the avatar when `avatarPath` is set
- [features/reviews/components/review-card.tsx](../reviews/components/review-card.tsx) —
  54px, still icon-only. `REVIEW_SELECT` in `features/reviews/actions.ts` does not select
  `author_avatar_path` yet

### ⚠️ Upload contract — the part that is actually dangerous

A publicly readable avatar URL is **not** a security problem; public buckets are designed for
it. The risk lives entirely in the upload pipeline, and it is not theoretical — but it is two
*different* risks, and they call for different fixes. Worth being precise about which applies
here, because the second one is easy to over-generalise from:

- **GPS in EXIF, on a public bucket.** Photos from a phone commonly carry GPS coordinates.
  John McAfee was located in 2012 from metadata in a photo that had been published.
  ([EDUCAUSE](https://er.educause.edu/articles/2021/6/privacy-implications-of-exif-data)) This
  applies in full here: anything stored byte-for-byte in the `guests` bucket is downloadable
  by anyone, metadata included.
- **EXIF rendered back as HTML.** A real advisory: a profile-photo feature exposed EXIF
  metadata, the app rendered HTML found inside it, and the result was a working phishing form
  leading to account takeover.
  ([GHSA-q68h-xwq5-mm7x](https://github.com/HumanSignal/label-studio/security/advisories/GHSA-q68h-xwq5-mm7x))
  This one does **not** transfer directly to this app — nothing here parses or displays EXIF
  fields, an avatar is only ever rendered through `<Image>`. It stays cited because the
  underlying lesson generalises: uploaded bytes are not safe to store or serve as-is just
  because they came in with an image extension.

**The fix for both is the same, and it has to live on the server, not the client.** A Server
Action is a plain HTTP endpoint — anyone can `POST` to it directly, so a check that only runs
in the browser is UX, not a security boundary. `uploadAvatar` re-encodes every upload through
`sharp`: a file `sharp` cannot decode is rejected outright (this *is* the MIME/extension check
— a real decode succeeding is a stronger guarantee than trusting a `Content-Type` header), and
the re-encoded `webp` output never carries EXIF forward, because `sharp` only copies metadata
when `.withMetadata()` is called. The client-side size check in `avatar-upload.tsx` is
deliberately just a fast-fail before the round-trip — the 512 KB ceiling is enforced by
`sharp`'s output size and by the bucket itself, not by the browser.

### Three ceilings, and why they differ

| Ceiling | Value | Enforced by |
|---|---|---|
| Request body | 4 MB | `serverActions.bodySizeLimit` in `next.config.ts` |
| Upload going in | 3 MB | `MAX_UPLOAD_BYTES` in `avatar-limits.ts`, checked on both sides |
| Stored file coming out | 512 KB | `sharp`'s output plus the bucket's own limit |

The body cap exists because Next's default is **1 MB**, which quietly rejected any ordinary
phone photo *before* `uploadAvatar` ran — no log, no message, nothing for the guest to act on.
4 MB rather than more: Vercel caps a serverless request body at 4.5 MB.

The upload ceiling sits a megabyte under the body cap on purpose. Next measures the whole
multipart body rather than the file, so setting the two equal would let a file slip past our
check and die at the framework instead — and a framework rejection cannot be turned into a
sentence anyone can read. The gap is what guarantees every refusal comes from our own code.

### Prerequisites — all met

This section used to list what was still missing before upload could be built: auth
(`@supabase/ssr`, `proxy.ts`, `/login`), and an image-processing dependency for the re-encode
step. Both are in now:

- Auth: `createClient()` from [lib/supabase-server.ts](../../lib/supabase-server.ts) gives an
  authenticated, uncached client — this is what `uploadAvatar` uses, same as `updateProfile`.
- Re-encode: `sharp` is a real `package.json` dependency now, added for this feature. It is
  not an unusual choice for this stack — it is the library Next itself recommends for
  self-hosted Image Optimization, and this project already uses that code path (`images` in
  `next.config.ts`, not a custom `loader`).

The old warning about `lib/supabase.ts` forcing `next: { revalidate, tags }` onto every
request no longer applies — that override was removed when the data layer moved to Cache
Components. Use the auth clients for anything authenticated; they are uncached by design.

## Avatar and account deletion

Moved here from `ACCOUNT-DELETION-POLICY.md`, which now points at this section. The policy
itself — the two options a guest chooses between, and the GDPR reasoning behind them — stays
in that document.

> ⚠️ **This is no longer hypothetical, and it got more likely.** An OAuth test account was
> deleted from the Supabase dashboard. Its `public.guests` row vanished by cascade — and its
> avatar stayed in the bucket, still publicly readable:
>
> ```
> /storage/v1/object/public/guests/3a677c11…/72c25054….png   → HTTP 200, 16,502 bytes
> ```
>
> **Storage objects have no foreign key to `auth.users`, so no cascade reaches them.** Deleting
> the file is application work, and nothing does it yet.
>
> What changed: `avatar_path` used to stay `NULL` until somebody uploaded a photo, so orphans
> were rare by default. Now [oauth-avatar.ts](../auth/oauth-avatar.ts) fills it on **every**
> first OAuth sign-in — so every deleted account leaves a face behind unless the deletion flow
> removes it. This raises the priority of that flow from "specified, not built" to a real gap.

**When a guest deletes their account and chooses to leave their reviews behind, the photo
must go.** A face is the most direct identifier stored anywhere in this schema. Anonymising
the name while leaving the picture attached defeats the entire exercise, and is precisely the
pseudonymisation trap that policy warns about: pseudonymised data is still personal data
under GDPR, and only genuinely anonymous data falls outside it.

The row-level half is enforced by the database. Constraint `reviews_orphan_is_anonymised`
(added in `0007`, strengthened in `0008`) **rejects** any review with no `guest_id` whose
`author_avatar_path` is not empty:

```sql
check (
    guest_id is not null
    or (author_display_name = 'Former guest' and author_avatar_path is null)
)
```

**Deleting the file from the bucket is not the constraint's job.** That is a step the
deletion flow has to perform, and that flow does not exist yet. The `guests` row is removed
by cascade, taking `guests.avatar_path` with it — so what survives a forgotten step is **the
file itself, in a public bucket, forever.**

Order of operations, because the constraint forces it:

```sql
-- 1. Overwrite the display columns first, or the constraint rejects step 3.
update public.reviews
   set author_display_name = 'Former guest',
       author_nationality  = '',
       author_avatar_path  = null
 where guest_id = :guest_id;

-- 2. Delete the avatar file from the 'guests' bucket via the storage API.
--    Read the path from guests.avatar_path BEFORE the row is deleted —
--    once the account is gone, nothing knows the filename any more.

-- 3. Delete the account with auth.admin.deleteUser() (not SQL). The cascade
--    removes the guests row; `on delete set null` clears reviews.guest_id.
```

## Verification

**Profile edit round-trip.** Sign in at `/login`, change the display name at `/account`, save,
then confirm the header updates and the database agrees:

```sql
select display_name, full_name, nationality, avatar_path
  from public.guests where id = '<uuid>';
```

**The header's third state**, without needing a real photo. Set a path by hand, load any page,
then put it back:

```sql
update public.guests set avatar_path = '<uuid>/probe.webp' where id = '<uuid>';
-- the header should render an <img> pointing at /_next/image?url=…/guests/<uuid>/probe.webp
update public.guests set avatar_path = null where id = '<uuid>';
```

No file needs to exist in the bucket for this — the point is the code path, not the picture.

**Avatar upload round-trip.** Sign in, upload a phone photo (ideally one with GPS EXIF) at
`/account`, confirm the header changes without a hard refresh, then navigate to another route
and back — the new avatar has to survive that (`revalidatePath("/", "layout")` busting the
Router Cache, not just the current page). Confirm on the server side too:

```sql
select avatar_path from public.guests where id = '<uuid>';
```

Download the file from `publicStorageUrl("guests", avatar_path)` and check its metadata (e.g.
`exiftool`) — it should be a `webp`, under 512 KB, with no EXIF block at all. Upload a second
photo and confirm the *first* object is gone from the `guests` bucket, not just unreferenced.
Finally, try uploading a non-image renamed to `.jpg` — `uploadAvatar` must reject it with a
message, not a 500.

**RLS on the update.** The same statement run as a different guest must change 0 rows, not
raise an error.
