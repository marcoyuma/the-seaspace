-- 0015_staff_catalog_writes.sql
-- Write access into the four catalogue tables and the `stays` bucket for the
-- admin panel's staff and managers.
--
-- Run FIFTEENTH, after 0014_admin_staff_access.sql.
-- Idempotent: safe to re-run.
--
-- ---------------------------------------------------------------------------
-- Why this exists
-- ---------------------------------------------------------------------------
-- 0001 closed the catalogue to every writer on purpose: "writes happen through
-- the service role key, which bypasses RLS entirely, so no insert/update/delete
-- policy is defined". That assumed the admin panel would grow a server of its
-- own to hold that key. It did not — it is a pure SPA, and a service role key
-- in a browser bundle is a full-database credential handed to anyone who opens
-- devtools.
--
-- So the catalogue gets the other half of the pattern 0014 already established:
-- an ordinary `authenticated` session whose auth.uid() is checked against
-- public.staff. The admin panel then needs no privileged key at all, which is
-- strictly safer than the arrangement this replaces.
--
-- ---------------------------------------------------------------------------
-- Why staff may create and edit but only managers may delete
-- ---------------------------------------------------------------------------
-- Deleting a stay is not the same size of action as editing one. stay_images
-- and stay_amenities cascade from stays, and reviews.stay_id is `on delete set
-- null` — so removing one never-booked villa also destroys all of its image
-- rows and silently detaches its reviews from any stay. Adding and correcting
-- villas is daily work; that is not.
--
-- Same split for public.amenities: a row there can be shared by every villa
-- (is_shared), so deleting one reaches outside the villa in front of you.
-- stay_images and stay_amenities rows are per-villa and destroy nothing beyond
-- themselves, so staff may delete those freely — that is just editing.
--
-- This is the line 0014 already drew: admin_booking_roster() checks membership
-- only, while admin_guest_nationality_stats() and admin_export_guests() require
-- role = 'manager'.
--
-- A villa that has ever been booked still cannot be deleted by anyone, manager
-- included — bookings.stay_id is `on delete restrict` (0009). That is a
-- constraint, not a permission, and this file does not change it.

-- ---------------------------------------------------------------------------
-- public.is_staff(min_role)
-- ---------------------------------------------------------------------------
-- One helper so the policies below do not each repeat the same subquery, and
-- so the membership rule lives in exactly one place when a third role is added.
--
-- `security definer` because the only policy on public.staff exposes a caller's
-- own row (0014). That happens to be enough here, but a policy is a thing that
-- can change; a definer function does not quietly start returning false when it
-- does. Matches the admin_* functions in 0014.
create or replace function public.is_staff(p_min_role text default 'staff')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.staff st
        where st.id = auth.uid()
          and (p_min_role = 'staff' or st.role = 'manager')
    );
$$;

revoke all on function public.is_staff(text) from public;
grant execute on function public.is_staff(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Catalogue write policies
-- ---------------------------------------------------------------------------
-- The SELECT policies from 0001 are untouched: the catalogue stays publicly
-- readable, and the customer site's behaviour does not change at all.
--
-- Every UPDATE policy carries `using` AND `with check`. `using` picks which
-- rows may be updated, `with check` validates the result — see the note in
-- 0008 on why omitting the second one is a real hole rather than boilerplate.
-- Here it means a staff session cannot edit a row into a state it would not
-- have been allowed to create.

drop policy if exists "staff insert stays"    on public.stays;
drop policy if exists "staff update stays"    on public.stays;
drop policy if exists "managers delete stays" on public.stays;

create policy "staff insert stays"
    on public.stays for insert to authenticated
    with check (public.is_staff());

create policy "staff update stays"
    on public.stays for update to authenticated
    using (public.is_staff())
    with check (public.is_staff());

create policy "managers delete stays"
    on public.stays for delete to authenticated
    using (public.is_staff('manager'));

drop policy if exists "staff insert stay images" on public.stay_images;
drop policy if exists "staff update stay images" on public.stay_images;
drop policy if exists "staff delete stay images" on public.stay_images;

create policy "staff insert stay images"
    on public.stay_images for insert to authenticated
    with check (public.is_staff());

create policy "staff update stay images"
    on public.stay_images for update to authenticated
    using (public.is_staff())
    with check (public.is_staff());

create policy "staff delete stay images"
    on public.stay_images for delete to authenticated
    using (public.is_staff());

drop policy if exists "staff insert amenities"    on public.amenities;
drop policy if exists "staff update amenities"    on public.amenities;
drop policy if exists "managers delete amenities" on public.amenities;

create policy "staff insert amenities"
    on public.amenities for insert to authenticated
    with check (public.is_staff());

create policy "staff update amenities"
    on public.amenities for update to authenticated
    using (public.is_staff())
    with check (public.is_staff());

create policy "managers delete amenities"
    on public.amenities for delete to authenticated
    using (public.is_staff('manager'));

drop policy if exists "staff insert stay amenities" on public.stay_amenities;
drop policy if exists "staff update stay amenities" on public.stay_amenities;
drop policy if exists "staff delete stay amenities" on public.stay_amenities;

create policy "staff insert stay amenities"
    on public.stay_amenities for insert to authenticated
    with check (public.is_staff());

create policy "staff update stay amenities"
    on public.stay_amenities for update to authenticated
    using (public.is_staff())
    with check (public.is_staff());

create policy "staff delete stay amenities"
    on public.stay_amenities for delete to authenticated
    using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Storage policies for the `stays` bucket
-- ---------------------------------------------------------------------------
-- 0002 gave this bucket a read policy only, because uploads ran on the service
-- role key from a one-shot script. That script is gone and uploads now happen
-- from the admin panel, so the bucket needs a write path for staff sessions.
--
-- No per-folder ownership check, unlike the `guests` bucket in 0008: villa
-- photos are shared property of the whole team, not one uploader's. The folder
-- segment is the stay slug, not a user id, so there is nothing to match against
-- auth.uid() anyway.
--
-- If this block errors with "must be owner of table objects", skip it and add
-- the same three policies under Dashboard → Storage → Policies. Do not skip
-- them silently: without them the admin panel can write stay_images rows that
-- point at files it was never able to upload.
drop policy if exists "staff upload stay photos"  on storage.objects;
drop policy if exists "staff replace stay photos" on storage.objects;
drop policy if exists "staff delete stay photos"  on storage.objects;

create policy "staff upload stay photos"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'stays' and public.is_staff());

create policy "staff replace stay photos"
    on storage.objects for update to authenticated
    using (bucket_id = 'stays' and public.is_staff())
    with check (bucket_id = 'stays' and public.is_staff());

create policy "staff delete stay photos"
    on storage.objects for delete to authenticated
    using (bucket_id = 'stays' and public.is_staff());

-- ---------------------------------------------------------------------------
-- What this migration deliberately does NOT do
-- ---------------------------------------------------------------------------
-- - It does not touch public.guests, public.reviews or public.bookings. The
--   admin panel's boundary in ADMIN-PANEL-CONTEXT.md is unchanged: those are
--   still written by guests and by the security-definer booking functions only.
--
-- - It does not add a trigger that attaches the six is_shared amenities to a
--   new stay. Membership stays explicit in stay_amenities on purpose (0001), so
--   a villa can opt out; the admin panel inserts those six rows itself.
--
-- - It does not add an is_listed / archived_at column to stays. A villa that
--   has been booked still cannot be removed from the site at all — that gap is
--   open and needs its own migration.
--
-- Verify (as a staff session, not the service role):
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public'
--     and tablename in ('stays','stay_images','amenities','stay_amenities')
--   order by tablename, cmd;
-- Expect: 4 select + 12 write policies across the four tables.
