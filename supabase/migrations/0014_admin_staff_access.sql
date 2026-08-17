-- 0014_admin_staff_access.sql
-- Read-only, scoped access into public.guests for the admin panel's staff and
-- managers, without touching public.guests itself.
--
-- Run FOURTEENTH, after 0013_booking_lifecycle_cron.sql.
-- Idempotent: safe to re-run.
--
-- ---------------------------------------------------------------------------
-- Why this exists
-- ---------------------------------------------------------------------------
-- ADMIN-PANEL-CONTEXT.md rules the admin panel out of public.guests entirely
-- — a product decision, not an RLS gap, because the admin panel writes with
-- the service role key, which bypasses RLS outright. That rule still holds
-- for WRITES. What changed is a genuine READ need: the admin panel has to
-- show who booked a stay and its check-in/check-out dates, which means a
-- guest's name (and, by explicit decision, their phone) legitimately has to
-- reach staff. Real PMS practice agrees: front desk sees the name and dates
-- of a guest who has a reservation, never a browsable directory of everyone
-- who ever signed up.
--
-- ---------------------------------------------------------------------------
-- Why three functions, not a second guests table
-- ---------------------------------------------------------------------------
-- The instinct that started this migration was "split guests into a PII
-- table and a statistical table." Rejected: Postgres RLS filters ROWS, not
-- COLUMNS. A staff SELECT policy on a split-off table would still be a
-- policy on a full row, so it does not actually stop a column it shouldn't
-- expose from being read the moment that row is visible at all. What
-- genuinely restricts columns is a function that only ever selects the
-- columns it means to return — the same `security definer` pattern this
-- schema already uses for handle_new_guest(), create_booking(),
-- settle_booking_payment(), check_in_booking() and
-- advance_booking_lifecycle(). public.guests is not touched by this file at
-- all: no new column, no new policy on it.
--
-- ---------------------------------------------------------------------------
-- Why the roster is scoped through bookings, not "every guest minus PII"
-- ---------------------------------------------------------------------------
-- A guest who only ever browsed and never booked has no operational reason
-- to appear to staff at all — showing them anyway would be exposing rows,
-- not just hiding columns. admin_booking_roster() below joins through
-- public.bookings, so staff only ever sees guests who actually reserved
-- something, scoped further by date range.
--
-- ---------------------------------------------------------------------------
-- Two roles, not three
-- ---------------------------------------------------------------------------
-- Industry practice for larger properties often has three tiers
-- (owner/manager/staff), separated mainly by export/approval power rather
-- than day-to-day visibility. For a single-property admin panel, two is
-- enough: 'staff' reads the booking roster; 'manager' additionally reads
-- aggregate nationality stats and can export guest contact data (logged).
-- Because role lives in a column rather than a second table, adding a third
-- tier later is an UPDATE to the check constraint, not a schema migration.

-- ---------------------------------------------------------------------------
-- public.staff
-- ---------------------------------------------------------------------------
-- Mirrors the identity pattern in public.guests (id IS auth.users.id, one
-- identity rather than two that can drift), but provisioning is
-- deliberately NOT automatic. Guests self-signup at volume, so
-- handle_new_guest() exists to keep up; staff are a handful of internal
-- accounts created by the project owner, so a row here is inserted by hand
-- (service role / SQL Editor) alongside the auth.users account. Do not
-- "fix" this by adding a signup trigger — that would let anyone who signs
-- up grant themselves staff access.
create table if not exists public.staff (
    id           uuid primary key references auth.users(id) on delete cascade,
    display_name text not null,
    role         text not null check (role in ('staff', 'manager')),
    created_at   timestamptz not null default now()
);

alter table public.staff enable row level security;

drop policy if exists "staff read their own row" on public.staff;

create policy "staff read their own row"
    on public.staff for select to authenticated
    using (auth.uid() = id);

-- No insert/update/delete policy: rows are managed by hand with the service
-- role, the same way bookings.status only ever changes through the
-- security-definer functions and the cron job, never a direct policy.

-- ---------------------------------------------------------------------------
-- admin_booking_roster(from, to) — staff and manager
-- ---------------------------------------------------------------------------
-- Returns exactly what a front desk needs: who is arriving or departing in a
-- date range, and how to reach them. nationality and avatar_path are never
-- selected here — they are not needed for this job and stay pure PII.
create or replace function public.admin_booking_roster(p_from date, p_to date)
returns table (
    booking_id          bigint,
    stay_name           text,
    guest_name          text,
    phone_country_code  text,
    phone               text,
    start_date          date,
    end_date            date,
    status              text
)
language sql
security definer
set search_path = public
as $$
    select b.id, s.name, g.full_name, g.phone_country_code, g.phone,
           b.start_date, b.end_date, b.status
    from public.bookings b
    join public.guests g on g.id = b.guest_id
    join public.stays s on s.id = b.stay_id
    where exists (select 1 from public.staff st where st.id = auth.uid())
      and b.start_date <= p_to
      and b.end_date >= p_from
    order by b.start_date;
$$;

revoke all on function public.admin_booking_roster(date, date) from public;
grant execute on function public.admin_booking_roster(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_guest_nationality_stats() — manager only, k-anonymised
-- ---------------------------------------------------------------------------
-- nationality is not treated as harmless "statistics": ACCOUNT-DELETION-
-- POLICY.md already anonymises it on account deletion, because paired with
-- a public review quote ("Amara L." + "Swedish" + her words) it can single
-- out one person on a small property. So it is never returned per-guest
-- here — only grouped counts, and any nationality with fewer than 5 guests
-- is folded into 'Other' so a manager's dashboard can never spotlight an
-- individual by elimination.
create or replace function public.admin_guest_nationality_stats()
returns table (nationality text, guest_count bigint)
language sql
security definer
set search_path = public
as $$
    with counts as (
        select g.nationality, count(*) as guest_count
        from public.guests g
        where exists (
            select 1 from public.staff st
            where st.id = auth.uid() and st.role = 'manager'
        )
        group by g.nationality
    )
    select case when guest_count >= 5 then nationality else 'Other' end as nationality,
           sum(guest_count) as guest_count
    from counts
    group by 1;
$$;

revoke all on function public.admin_guest_nationality_stats() from public;
grant execute on function public.admin_guest_nationality_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- admin_export_log + admin_export_guests() — manager only, always logged
-- ---------------------------------------------------------------------------
-- A full contact export is the one operation industry practice says should
-- not be silent ("managers should not be able to initiate a full guest data
-- export without an approval workflow"). A full approval workflow is more
-- process than a single-property admin panel needs, but an export that
-- leaves no trace is not acceptable either — so every successful export
-- writes who, when, and how many rows.
create table if not exists public.admin_export_log (
    id          bigint generated always as identity primary key,
    staff_id    uuid not null references public.staff(id),
    exported_at timestamptz not null default now(),
    row_count   integer not null
);

-- plpgsql, not sql: unlike the two functions above, this one has a side
-- effect (the log insert), which the `language sql` functions deliberately
-- avoid so their behaviour stays "just a scoped read".
create or replace function public.admin_export_guests()
returns table (
    guest_id            uuid,
    full_name           text,
    phone_country_code  text,
    phone               text,
    nationality         text,
    created_at          timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role  text;
    v_count int;
begin
    select role into v_role from public.staff where id = auth.uid();

    -- Not an exception: a non-manager caller gets zero rows, same shape as
    -- the other functions above returning nothing to a non-staff caller,
    -- rather than an error the admin panel would have to special-case.
    if v_role is distinct from 'manager' then
        return;
    end if;

    return query
        select g.id, g.full_name, g.phone_country_code, g.phone,
               g.nationality, g.created_at
        from public.guests g;

    get diagnostics v_count = row_count;

    insert into public.admin_export_log (staff_id, exported_at, row_count)
    values (auth.uid(), now(), v_count);
end;
$$;

revoke all on function public.admin_export_guests() from public;
grant execute on function public.admin_export_guests() to authenticated;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- The table and both functions exist with the right owner-side security.
-- Expect three rows: admin_booking_roster, admin_guest_nationality_stats,
-- admin_export_guests, all prosecdef = true.
select proname, prosecdef
from pg_proc
where proname in (
    'admin_booking_roster', 'admin_guest_nationality_stats', 'admin_export_guests'
);

-- RLS is on for staff, with exactly one policy (self-read). Expect rowsecurity
-- = true and 1 row from pg_policies.
select relrowsecurity from pg_class where relname = 'staff';
select policyname from pg_policies where tablename = 'staff';

-- Read the actual function bodies and confirm by eye that neither
-- `nationality` nor `avatar_path` is selected anywhere except inside
-- admin_guest_nationality_stats() (where nationality is grouped, never
-- returned per-row) and admin_export_guests() (manager-only, logged).
select proname, pg_get_functiondef(oid)
from pg_proc
where proname in (
    'admin_booking_roster', 'admin_guest_nationality_stats', 'admin_export_guests'
);

-- Manual smoke test once at least one staff/manager row exists (replace the
-- uuids with real auth.users ids before running, e.g. via
-- `select id, email from auth.users limit 5;`):
--
-- insert into public.staff (id, display_name, role)
--   values ('<uuid>', 'Test Staff', 'staff');
-- select * from public.admin_booking_roster(current_date, current_date + 30);
-- select * from public.admin_guest_nationality_stats(); -- expect 0 rows for 'staff'
-- select * from public.admin_export_guests();            -- expect 0 rows for 'staff'
