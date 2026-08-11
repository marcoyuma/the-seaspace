-- 0006_guests.sql
-- Guest identity, kept in lockstep with Supabase Auth.
--
-- Run SIXTH, after 0005_reviews.sql.
-- Idempotent: safe to re-run.
--
-- NOTE: 0007_reviews_guest_id.sql must NOT run straight after this one. The
-- accounts have to exist in between — see supabase/README.md, and
-- scripts/create-seed-accounts.mjs.
--
-- ---------------------------------------------------------------------------
-- Why the primary key is also a foreign key
-- ---------------------------------------------------------------------------
-- `guests.id` IS `auth.users.id`. Not a bigint identity like the four catalogue
-- tables, and not a separate `public_id` alongside an `auth_user_id`.
--
-- Two identity columns can drift apart; one cannot. There is no email matching,
-- no linking step, and no window in which a guest exists without an account.
-- The two tables are synchronised by construction rather than by reconciliation.
--
-- The consequence is a deliberate product rule: **no account, no guest** — and
-- therefore no booking and no review without an account. A guest can never
-- pre-exist their own account, which is why this schema needs no "claim your
-- profile" mechanism, and why it never grows one as an attack surface.

-- ---------------------------------------------------------------------------
-- guests
-- ---------------------------------------------------------------------------
create table if not exists public.guests (
    id uuid primary key references auth.users(id) on delete cascade,

    -- Rendered publicly on review cards, e.g. 'Amara L.'. NOT NULL because the
    -- trigger below always derives something, even from a bare email address.
    display_name text not null,

    -- Administrative, never rendered. Nullable: the 62 imported identities only
    -- ever had a short form, and a real signup form may not ask for it either.
    full_name text,

    -- `text`, not a number: 088888888 as an integer loses its leading zero, and
    -- international numbers overflow the range. Nobody does arithmetic on these.
    phone_country_code text,
    phone              text,

    -- e.g. 'Swedish'. A nationality, not a city — the review card's second line.
    nationality text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- There is deliberately NO `email` column. auth.users already holds it, that
-- copy is managed by Supabase and unreachable with the anon key, and a second
-- copy here would be one more PII surface plus a sync trigger that fails
-- silently the day a guest changes their address.
--
-- There is deliberately NO `guest_ref` column either. The seed emails are
-- derived from it deterministically, so 0007 can backfill by joining
-- auth.users.email directly — which keeps the trigger below at one permanent
-- version instead of an import-time one and a post-import one.

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
-- `default now()` only fires on INSERT. Without this trigger the column would
-- state a creation time forever while claiming to be an update time.
-- Hand-written rather than the `moddatetime` extension, for the same reason
-- lower(email) was chosen over citext elsewhere: one less extension to install.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists guests_touch_updated_at on public.guests;

create trigger guests_touch_updated_at
    before update on public.guests
    for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- The seam to Supabase Auth
-- ---------------------------------------------------------------------------
-- `security definer` is required, not stylistic: the trigger runs under the
-- identity of whoever signed up, and that role has no write access to
-- public.guests. `set search_path` is pinned for the same reason it always is
-- on a definer function — without it, a caller-controlled search_path could
-- point `guests` at an attacker's schema.
create or replace function public.handle_new_guest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.guests (id, display_name, full_name, nationality)
    values (
        new.id,
        -- nullif() at every step: metadata arriving as an empty string must
        -- still fall through, otherwise display_name becomes '' and the review
        -- card renders a nameless guest.
        --
        -- The literal at the end is not decoration. display_name is NOT NULL,
        -- and an exception raised inside a trigger on auth.users fails the
        -- signup itself — so a provider that returns no email (phone auth, or
        -- an OAuth provider with no verified address) would lock people out
        -- entirely. Better a placeholder name than a broken sign-up.
        coalesce(
            nullif(new.raw_user_meta_data->>'display_name', ''),
            nullif(new.raw_user_meta_data->>'full_name', ''),
            nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
            'Guest'
        ),
        nullif(new.raw_user_meta_data->>'full_name', ''),
        nullif(new.raw_user_meta_data->>'nationality', '')
    )
    -- The trigger fires on INSERT *and* on UPDATE, so an account whose email is
    -- confirmed later fires it twice. Without this the second firing raises a
    -- unique violation and breaks the email-confirmation flow itself.
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_guest_confirmed on auth.users;

-- Keyed on `email_confirmed_at`, not on INSERT.
--
-- With "Confirm email" switched OFF in the dashboard (the current dev setting),
-- Supabase stamps email_confirmed_at at insert time, so a guest row still
-- appears immediately and a dummy address plus a password is enough to sign in.
-- The day that setting is switched on, this trigger is already correct and
-- linking waits for proof of the mailbox — with no code change at all. An
-- `after insert` trigger would have baked the dev shortcut into the database
-- permanently.
create trigger on_auth_guest_confirmed
    after insert or update of email_confirmed_at on auth.users
    for each row
    when (new.email_confirmed_at is not null)
    execute function public.handle_new_guest();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- A deliberate departure from the four catalogue tables, which all use
-- `for select to anon, authenticated using (true)`.
--
-- That policy is correct there because those tables hold public marketing copy.
-- THIS TABLE HOLDS PHONE NUMBERS, and the anon key ships to the browser. One
-- policy copied across from 0001_stays_schema.sql hands every guest's contact
-- details to anyone who opens DevTools.
--
-- So: no `anon` policy exists at all, and none may be added. A guest sees
-- exactly their own row and nothing else.
--
-- No INSERT policy either — rows are created only by handle_new_guest() above,
-- which bypasses RLS as a definer function. No DELETE policy: removing a guest
-- means removing the account, which cascades here. That flow is specified in
-- ACCOUNT-DELETION-POLICY.md and is not implemented yet.
alter table public.guests enable row level security;

drop policy if exists "guests read their own row"   on public.guests;
drop policy if exists "guests update their own row" on public.guests;

create policy "guests read their own row"
    on public.guests for select to authenticated
    using (auth.uid() = id);

-- `with check` as well as `using`: without it a guest could pass the row-level
-- read test and then rewrite `id` to point at somebody else's row.
create policy "guests update their own row"
    on public.guests for update to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Expect 0 before scripts/create-seed-accounts.mjs runs, 62 after.
select count(*) as guests from public.guests;
