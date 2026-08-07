-- 0002_storage_bucket.sql
-- The `stays` storage bucket that holds every villa photo.
--
-- Run SECOND. Idempotent: safe to re-run.

-- Public, not private. Villa photos are meant to be seen, and signed URLs
-- would defeat CDN caching by minting a new URL on every request.
--
-- file_size_limit is a guard rail against the problem we are migrating away
-- from: the current repo has a 9 MB villa JPEG. The upload script targets
-- ~300-500 KB WebP, so 2 MB is generous and still catches a raw upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'stays',
    'stays',
    true,
    2 * 1024 * 1024,
    array['image/webp', 'image/jpeg', 'image/png', 'image/avif']
)
on conflict (id) do update
set public            = excluded.public,
    file_size_limit   = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- A public bucket already serves /storage/v1/object/public/** anonymously
-- without any policy. This one only widens `list`/metadata reads, which the
-- upload script's existence checks use. Writes stay closed: the script runs on
-- the service role key, which bypasses RLS.
--
-- If this block errors with "must be owner of table objects", skip it — the
-- bucket being public is enough. Storage policies can also be added under
-- Dashboard → Storage → Policies.
drop policy if exists "stay photos are publicly readable" on storage.objects;

create policy "stay photos are publicly readable"
    on storage.objects for select to anon, authenticated
    using (bucket_id = 'stays');
