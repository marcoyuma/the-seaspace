-- 0008_guest_avatars.sql
-- Lets a guest upload one profile photo, replacing the Phosphor icon that
-- stands in for it today.
--
-- Run ELEVENTH, after 0007 and seed/0003. Idempotent: safe to re-run.
--
-- Additive on purpose: 0006_guests.sql has already run against the live
-- database and is committed. A migration file is an append-only ledger — a
-- rewrite would stop describing what actually happened, and anyone who already
-- ran it would end up with a different schema from someone starting fresh.
--
-- ---------------------------------------------------------------------------
-- The upload path does not exist yet
-- ---------------------------------------------------------------------------
-- This migration builds the seam only: columns, bucket, policies. Uploading
-- needs an authenticated session, and this app has no auth yet. The full
-- contract for whoever builds it — including EXIF stripping, which is not
-- optional — is in GUEST_PLANNING_TABLE.md.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
-- Bucket-relative path, never a full URL. Same reason as stay_images.storage_path:
-- the URL is assembled at read time by publicStorageUrl() in lib/supabase.ts, so
-- moving project or region stays an env change instead of a data migration.
--
-- Path convention: '<guest_uuid>/<random>.webp'
--   * the first folder is the owner — the storage policies below depend on it
--   * a unique filename means replacing a photo produces a NEW url, so the CDN
--     can never keep serving the old one
alter table public.guests
    add column if not exists avatar_path text;

-- Denormalised onto the review row, and it has to be.
--
-- public.guests has no `anon` policy at all — it holds phone numbers. A visitor
-- who has not logged in therefore cannot read avatar_path from there, and the
-- join returns nothing WITHOUT raising an error: the avatar would simply be
-- blank forever and look like an unfinished feature rather than a blocked read.
--
-- So this follows author_display_name / author_nationality, which live on the
-- review row for exactly the same reason. Do NOT "normalise" it away.
--
-- Accepted consequence: changing your photo does not update older review cards.
-- A review is a record of a moment, so that is defensible — but it is a choice,
-- not an oversight.
alter table public.reviews
    add column if not exists author_avatar_path text;

-- ---------------------------------------------------------------------------
-- An anonymised review must not still show the person's face
-- ---------------------------------------------------------------------------
-- Strengthens the constraint added in 0007: clearing guest_id was already only
-- allowed alongside overwriting the display name; now the photo has to go too.
-- Otherwise "anonymised" would leave the single most identifying field intact,
-- which is precisely the pseudonymisation trap ACCOUNT-DELETION-POLICY.md warns
-- about. Deleting the file itself is the deletion flow's job; this only makes
-- the row-level half impossible to forget.
alter table public.reviews drop constraint if exists reviews_orphan_is_anonymised;

alter table public.reviews add constraint reviews_orphan_is_anonymised
    check (
        guest_id is not null
        or (author_display_name = 'Former guest' and author_avatar_path is null)
    );

-- ---------------------------------------------------------------------------
-- The `guests` bucket
-- ---------------------------------------------------------------------------
-- Named after the table it serves, matching the `stays` bucket ↔ stays table.
--
-- Public, for the same reason the stays bucket is: these avatars appear on
-- review cards that anonymous visitors see, and signed URLs would defeat CDN
-- caching by minting a new URL on every request.
--
-- 512 KB rather than the 2 MB used for villa photos — an avatar renders at
-- 38-54px, so anything approaching that ceiling is an unprocessed upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'guests',
    'guests',
    true,
    512 * 1024,
    array['image/webp', 'image/jpeg', 'image/png', 'image/avif']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Storage policies
-- ---------------------------------------------------------------------------
-- Read is open; writing is confined to the uploader's own folder. The folder
-- name IS the ownership check: '<guest_uuid>/…' and guests.id is auth.users.id,
-- so auth.uid() matches the first path segment exactly.
--
-- If this block errors with "must be owner of table objects", skip it — the
-- bucket being public already covers reads — and add the write policies under
-- Dashboard → Storage → Policies instead. Do not skip them silently: without
-- them the bucket has no write path at all for a logged-in guest.
drop policy if exists "guest avatars are publicly readable" on storage.objects;
drop policy if exists "guests upload their own avatar"      on storage.objects;
drop policy if exists "guests replace their own avatar"     on storage.objects;
drop policy if exists "guests delete their own avatar"      on storage.objects;

create policy "guest avatars are publicly readable"
    on storage.objects for select to anon, authenticated
    using (bucket_id = 'guests');

create policy "guests upload their own avatar"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'guests'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- `using` AND `with check`: `using` decides which rows may be updated, while
-- `with check` validates the result. Without the second, a guest could update
-- their own object and move it into somebody else's folder.
create policy "guests replace their own avatar"
    on storage.objects for update to authenticated
    using (
        bucket_id = 'guests'
        and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
        bucket_id = 'guests'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

create policy "guests delete their own avatar"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'guests'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

-- Expect: 62 | 0 | 100 | 0  — columns exist, nothing filled in yet.
select (select count(*) from public.guests)                                as guests,
       (select count(avatar_path) from public.guests)                      as with_avatar,
       (select count(*) from public.reviews)                               as reviews,
       (select count(author_avatar_path) from public.reviews)              as reviews_with_avatar;
