-- 0003_guests_full_name.sql
-- Fills public.guests.full_name for the 62 seeded accounts.
--
-- Run NINTH, after scripts/create-seed-accounts.mjs (step 7) — the rows must
-- exist before they can be updated.
-- Idempotent: guarded on `full_name is null`, so a second run changes 0 rows.
--
-- ---------------------------------------------------------------------------
-- Why the names are written out instead of derived from the email
-- ---------------------------------------------------------------------------
-- Do NOT "simplify" this into
--     initcap(replace(split_part(u.email, '@', 1), '.', ' '))
--
-- Two reasons, and the second one is not hypothetical:
--
-- 1. GUEST_PLANNING_TABLE.md §5.2 forbids deriving a legal name from an email.
--    Plenty of people use an address containing no part of their name. A name
--    is the one field that must never be guessed — it is what gets printed on
--    the reservation.
--
-- 2. initcap() capitalises the first letter of each word and LOWERCASES the
--    rest, so 'sean.mcallister' becomes 'Sean Mcallister' — not McAllister.
--    The same breakage awaits van Dijk, de Boer, O'Brien and Al-Farsi the day
--    a real guest signs up.
--
-- Using the email as a JOIN KEY (below) is a different thing from deriving a
-- name from it: one is a row's address, the other is a guess at an identity.
-- The pairs here are explicit data, copied from GUEST_PLANNING_TABLE.md §5.6,
-- where each was verified to reproduce its live display_name and its live email.
--
-- The join goes through auth.users because public.guests deliberately has no
-- email column, and guests.id is a per-project random uuid that cannot be
-- written into a portable seed file. The email is the only stable key.

begin;

with seed (email, full_name) as (
    values
    ('adriana.lopes@example.com',      'Adriana Lopes'),
    ('amara.lindqvist@example.com',    'Amara Lindqvist'),
    ('amelia.hartley@example.com',     'Amelia Hartley'),
    ('andres.quintero@example.com',    'Andres Quintero'),
    ('anya.volkova@example.com',       'Anya Volkova'),
    ('arjun.mehta@example.com',        'Arjun Mehta'),
    ('beatriz.alves@example.com',      'Beatriz Alves'),
    ('bruno.schmid@example.com',       'Bruno Schmid'),
    ('carlos.viera@example.com',       'Carlos Viera'),
    ('chloe.beaumont@example.com',     'Chloe Beaumont'),
    ('clara.esposito@example.com',     'Clara Esposito'),
    ('connor.flanagan@example.com',    'Connor Flanagan'),
    ('daniel.okonkwo@example.com',     'Daniel Okonkwo'),
    ('dimitri.katsaros@example.com',   'Dimitri Katsaros'),
    ('elena.petrova@example.com',      'Elena Petrova'),
    ('emil.rasmussen@example.com',     'Emil Rasmussen'),
    ('felipe.cardenas@example.com',    'Felipe Cardenas'),
    ('gavin.treharne@example.com',     'Gavin Treharne'),
    -- Inherited from the original hardcoded review; does not read as an
    -- Emirati name, but the live display_name and email are both built from
    -- it. See GUEST_PLANNING_TABLE.md §5.6.
    ('genie.junior@example.com',       'Genie Junior'),
    ('hana.kowalski@example.com',      'Hana Kowalski'),
    ('hendrik.visser@example.com',     'Hendrik Visser'),
    ('henrik.nilsson@example.com',     'Henrik Nilsson'),
    ('hollie.marsden@example.com',     'Hollie Marsden'),
    ('ingrid.solberg@example.com',     'Ingrid Solberg'),
    ('isabelle.caron@example.com',     'Isabelle Caron'),
    ('james.whitfield@example.com',    'James Whitfield'),
    ('jonas.weber@example.com',        'Jonas Weber'),
    ('keiko.arata@example.com',        'Keiko Arata'),
    ('kristoffer.dahl@example.com',    'Kristoffer Dahl'),
    ('leila.farahani@example.com',     'Leila Farahani'),
    ('linnea.kallio@example.com',      'Linnea Kallio'),
    ('lotte.jansen@example.com',       'Lotte Jansen'),
    ('lucas.fontaine@example.com',     'Lucas Fontaine'),
    ('marcus.oyelaran@example.com',    'Marcus Oyelaran'),
    ('margot.dubois@example.com',      'Margot Dubois'),
    ('mariko.tanabe@example.com',      'Mariko Tanabe'),
    ('martin.novak@example.com',       'Martin Novak'),
    -- Two-part given name: display_name is 'Mei Lin C.', not 'Mei L.'
    ('mei.lin.chow@example.com',       'Mei Lin Chow'),
    ('nadia.benali@example.com',       'Nadia Benali'),
    ('naomi.sato@example.com',         'Naomi Sato'),
    ('noor.haddad@example.com',        'Noor Haddad'),
    ('oscar.halvorsen@example.com',    'Oscar Halvorsen'),
    ('paulo.ribeiro@example.com',      'Paulo Ribeiro'),
    ('petra.horvath@example.com',      'Petra Horvath'),
    ('priya.raghunathan@example.com',  'Priya Raghunathan'),
    ('rachel.goldstein@example.com',   'Rachel Goldstein'),
    ('rafael.moreno@example.com',      'Rafael Moreno'),
    ('ravi.chandrasekar@example.com',  'Ravi Chandrasekar'),
    ('samuel.adeyemi@example.com',     'Samuel Adeyemi'),
    -- The row that proves the point of this whole file: initcap() would store
    -- 'Sean Mcallister' here.
    ('sean.mcallister@example.com',    'Sean McAllister'),
    ('siobhan.kelly@example.com',      'Siobhan Kelly'),
    ('sofia.lindberg@example.com',     'Sofia Lindberg'),
    ('stefan.bauer@example.com',       'Stefan Bauer'),
    ('tanya.pillai@example.com',       'Tanya Pillai'),
    ('theo.lambert@example.com',       'Theo Lambert'),
    ('tomas.brandt@example.com',       'Tomas Brandt'),
    ('valentina.rossi@example.com',    'Valentina Rossi'),
    ('victor.nguyen@example.com',      'Victor Nguyen'),
    ('wei.zhang@example.com',          'Wei Zhang'),
    ('yuki.morishima@example.com',     'Yuki Morishima'),
    ('yusuf.demir@example.com',        'Yusuf Demir'),
    ('zara.ibrahim@example.com',       'Zara Ibrahim')
)
update public.guests g
   set full_name = s.full_name
  from seed s
  join auth.users u on u.email = s.email
 where g.id = u.id
   -- Never overwrite a guest who has already filled in their own profile.
   -- This is also what makes the file idempotent.
   and g.full_name is null
   -- Technically redundant — every address above is @example.com — but kept as
   -- a guard against the future. If somebody ever adds a real address to the
   -- list, this clause makes the statement a no-op instead of stamping a
   -- fictional name over a real person's. Do not delete it as dead weight.
   and u.email like '%@example.com';

commit;

-- Expect: 62 | 62 | 0
-- (`phone` stays NULL on purpose: there is no source for it, no UI reads it,
--  and an invented +62 number can be somebody's real number. See §5.5.)
select count(*)          as guests,
       count(full_name)  as named,
       count(phone)      as with_phone
from public.guests;
