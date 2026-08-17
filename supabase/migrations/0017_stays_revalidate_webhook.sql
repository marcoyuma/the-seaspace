-- 0017_stays_revalidate_webhook.sql
-- Tells the customer site to drop its cached catalogue the moment a catalogue
-- row changes.
--
-- Run after 0016_stays_drop_unvalidated_fields.sql. Idempotent: safe to re-run.
--
-- ⚠️ PREREQUISITE 1: pg_net must be enabled first, in the Supabase dashboard
-- under Database → Extensions. `create extension` below succeeds once it is
-- available; on a project where it is not, this whole file can be skipped and
-- the application keeps working — the catalogue simply goes back to being up to
-- an hour stale, which is exactly the state described below.
--
-- ⚠️ PREREQUISITE 2: two secrets must exist in Supabase Vault before the
-- triggers can do anything. See "Filling the Vault" below — a missing secret is
-- not an error here, it makes the function do nothing, on purpose.
--
-- ---------------------------------------------------------------------------
-- The hole this closes
-- ---------------------------------------------------------------------------
-- Three files recorded that nothing invalidated the catalogue cache:
--
--   lib/supabase.ts: "The tag above is not invalidated by anything yet —
--     on-demand revalidation from a Supabase Database Webhook is a separate
--     phase."
--   ADMIN-PANEL-CONTEXT.md, "Kontrak revalidasi": "Status: belum dibangun."
--   ADMIN-PANEL-CONTEXT.md: "maksimal 1 jam" as the admin → customer lag.
--
-- This is that webhook. The customer site caches getStays/getStay/
-- getFeaturedStays under the tag 'stays' with a one-hour cacheLife, so until
-- now a villa added from the admin panel took up to an hour to appear.
--
-- ---------------------------------------------------------------------------
-- Why the trigger lives here and not in the admin panel
-- ---------------------------------------------------------------------------
-- A row-change trigger catches every write path: the admin panel, a correction
-- typed into the SQL Editor, a seed file, a data migration. A call made by the
-- admin panel after it saves would only ever catch its own. The first time
-- anyone touched the data another way, the cache would be wrong with nobody
-- aware of it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ Fire-and-forget, which is why the hourly timer stays
-- ---------------------------------------------------------------------------
-- net.http_post queues a request and returns immediately. It does not retry and
-- it cannot fail the transaction that triggered it — a write to `stays` commits
-- whether or not the site ever hears about it. A rotated secret, a redeploy
-- mid-request, a network blip: all of them lose the notification silently.
--
-- That is why cacheLife("hours") is still set on the customer site. This file
-- makes the common case take seconds; the timer is what stops the rare failure
-- from meaning "stale forever with no alarm".
--
-- ---------------------------------------------------------------------------
-- ⚠️ This never reaches a developer's localhost
-- ---------------------------------------------------------------------------
-- pg_net runs on Supabase's servers. http://localhost:3000 has no route from
-- there, so pointing the Vault URL at it produces nothing but failed rows in
-- net._http_response. Local development is handled instead by shortening
-- cacheLife to `seconds` when NODE_ENV is development (lib/supabase.ts) — no
-- tunnel, and no webhook involved.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Filling the Vault
-- ---------------------------------------------------------------------------
-- Two secrets, read by the function below. Run these ONCE by hand, with the
-- real values substituted — do not commit the values into this file, which is
-- in git.
--
--   select vault.create_secret(
--       'https://your-deployment.vercel.app',  -- origin only, no trailing slash
--       'stays_revalidate_url',
--       'Customer site origin the catalogue webhook POSTs to'
--   );
--
--   select vault.create_secret(
--       '<the same value as STAYS_REVALIDATE_SECRET>',
--       'stays_revalidate_secret',
--       'Shared secret for POST /api/revalidate/stays'
--   );
--
-- To rotate, update BOTH sides — here and in the Vercel environment variable:
--
--   select vault.update_secret(
--       (select id from vault.secrets where name = 'stays_revalidate_secret'),
--       '<new value>'
--   );
--
-- Changing only one leaves the site rejecting every webhook with a 401 and
-- nothing but net._http_response to say so.

-- ---------------------------------------------------------------------------
-- notify_stays_changed
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because the caller is whichever staff session performed the
-- write, and vault.decrypted_secrets is readable only by the owner. Empty
-- search_path for the reason 0010 spells out.
--
-- Returns null and ignores TG_OP: the customer site has a single tag for the
-- whole catalogue, so what changed and how does not affect what gets sent. The
-- body is informational, for reading in net._http_response when debugging.
create or replace function public.notify_stays_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_url    text;
    v_secret text;
begin
    select decrypted_secret into v_url
    from vault.decrypted_secrets
    where name = 'stays_revalidate_url';

    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'stays_revalidate_secret';

    -- Missing secrets are a no-op, not an exception. This function runs inside
    -- the writing transaction, so raising here would make an unconfigured Vault
    -- block every catalogue edit — turning a stale cache into an outage. The
    -- verification query at the foot of this file is how you find out instead.
    if v_url is null or v_secret is null then
        return null;
    end if;

    perform net.http_post(
        url     := v_url || '/api/revalidate/stays',
        body    := jsonb_build_object(
            'table', tg_table_name,
            'op',    tg_op,
            'at',    now()
        ),
        headers := jsonb_build_object(
            'Content-Type',        'application/json',
            'x-revalidate-secret', v_secret
        ),
        timeout_milliseconds := 5000
    );

    return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- The four triggers
-- ---------------------------------------------------------------------------
-- FOR EACH STATEMENT, not FOR EACH ROW. Publishing a villa inserts six
-- stay_amenities rows in one statement and five or six stay_images rows in
-- another; per-row would turn that into a dozen HTTP requests that all
-- invalidate the same single tag.
--
-- Dropped first so re-running this file replaces the triggers rather than
-- failing on a duplicate name.

drop trigger if exists stays_revalidate on public.stays;
create trigger stays_revalidate
after insert or update or delete on public.stays
for each statement execute function public.notify_stays_changed();

drop trigger if exists stay_images_revalidate on public.stay_images;
create trigger stay_images_revalidate
after insert or update or delete on public.stay_images
for each statement execute function public.notify_stays_changed();

drop trigger if exists amenities_revalidate on public.amenities;
create trigger amenities_revalidate
after insert or update or delete on public.amenities
for each statement execute function public.notify_stays_changed();

drop trigger if exists stay_amenities_revalidate on public.stay_amenities;
create trigger stay_amenities_revalidate
after insert or update or delete on public.stay_amenities
for each statement execute function public.notify_stays_changed();

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- Both secrets exist. Expect two rows. The values are not selected here —
-- reading them back into the SQL Editor's result pane defeats the point of a
-- vault.
select name, created_at, updated_at
from vault.secrets
where name in ('stays_revalidate_url', 'stays_revalidate_secret')
order by name;

-- All four triggers are installed and enabled. Expect four rows, tgenabled 'O'.
select c.relname as table_name, t.tgname, t.tgenabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where t.tgname like '%_revalidate'
order by c.relname;

-- Fire one by hand. A no-op update still counts as a statement, so this sends a
-- request without changing any data.
update public.stays set name = name where id = (select min(id) from public.stays);

-- What came back. Expect 200 within a second or two of the statement above.
-- ⚠️ pg_net writes the response asynchronously — an empty result usually means
-- "not yet", so re-run it. A 401 means the Vault secret and the site's
-- STAYS_REVALIDATE_SECRET have drifted apart; a timeout or a connection error
-- with a localhost URL is the case described at the top of this file.
select created, status_code, error_msg
from net._http_response
order by created desc
limit 20;
