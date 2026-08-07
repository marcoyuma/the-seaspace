-- 0001_stays_seed.sql
-- The four villas, transcribed verbatim from the STAYS array in
-- features/stays/data.ts so the migrated site renders identical copy.
--
-- Run THIRD, after 0001_stays_schema.sql and 0002_storage_bucket.sql.
-- Idempotent: every statement upserts on a natural key, so re-running it
-- refreshes the text without duplicating rows or churning ids.
--
-- Photos are NOT seeded here — scripts/upload-stays-images.ts fills
-- stay_images once it has compressed the files and generated blur data.
--
-- Long text is dollar-quoted ($txt$) rather than escaped: the copy contains
-- apostrophes and em dashes, and '' escaping is where transcription bugs hide.

begin;

-- ---------------------------------------------------------------------------
-- stays
-- ---------------------------------------------------------------------------
-- Insert order matches the STAYS array, so the identity ids ascend in the same
-- order the /stays grid currently renders — `order by id` reproduces it.
insert into public.stays (
    slug, name, location, price_per_night, capacity, beds, area, is_new,
    description, bed_type_label, bed_type_note, capacity_label,
    lat, lng, airport_code, airport_city
) values
(
    'tuscan-twilight-villa', 'Tuscan Twilight Villa', 'Ubud, Bali',
    3500000, 6, 3, 220, true,
    $txt$Set into the terraced slope above the Petanu river, Tuscan Twilight Villa pairs warm limewashed walls with floor-to-ceiling glass that opens the whole living pavilion to the valley. Three bedrooms sit along a quiet garden corridor, each with its own outdoor shower. Mornings arrive with mist over the rice fields; evenings belong to the infinity pool and the long teak dining table under the pergola.$txt$,
    'Superking', 'Crib on request', '4 adults and 2 children',
    -8.506900, 115.262500, 'DPS', 'Denpasar'
),
(
    'coastal-arch-retreat', 'Coastal Arch Retreat', 'Uluwatu, Bali',
    5200000, 8, 4, 340, true,
    $txt$Coastal Arch Retreat sits on the limestone headland where the Indian Ocean swell breaks a hundred metres below. The architecture is deliberately spare — lime plaster, arched openings, built-in seating — so that nothing competes with the water. Four bedrooms open onto a shared courtyard, and the west-facing terrace is built around the sunset. This is the largest villa in our portfolio.$txt$,
    'Superking', 'Two rooms convert to twins', '6 adults and 2 children',
    -8.829100, 115.084900, 'DPS', 'Denpasar'
),
(
    'riverside-stone-lodge', 'Riverside Stone Lodge', 'Canggu, Bali',
    2800000, 4, 2, 180, false,
    $txt$A two-bedroom lodge built from local andesite stone, five minutes inland from Batu Bolong beach. The plan is compact and unfussy: a double-height living room, a covered kitchen that opens onto the plunge pool, and two bedrooms upstairs under an exposed timber roof. Quiet enough to work from, close enough to walk to the surf before breakfast.$txt$,
    'King', 'Second room has twin beds', '4 adults',
    -8.647800, 115.138500, 'DPS', 'Denpasar'
),
(
    'cliffside-ocean-villa', 'Cliffside Ocean Villa', 'Nusa Penida, Bali',
    4100000, 6, 3, 260, false,
    $txt$The most remote stay we operate: a three-bedroom villa on the western cliffs of Nusa Penida, reached by fast boat from Sanur and then a twenty-minute drive. Every room faces the strait toward Bali, and on a clear evening you can watch the light go off Mount Agung from the pool. Bring what you need — the nearest shop is a village away, which is rather the point.$txt$,
    'Superking', 'Crib on request', '4 adults and 2 children',
    -8.727800, 115.544400, 'DPS', 'Denpasar'
)
on conflict (slug) do update set
    name            = excluded.name,
    location        = excluded.location,
    price_per_night = excluded.price_per_night,
    capacity        = excluded.capacity,
    beds            = excluded.beds,
    area            = excluded.area,
    is_new          = excluded.is_new,
    description     = excluded.description,
    bed_type_label  = excluded.bed_type_label,
    bed_type_note   = excluded.bed_type_note,
    capacity_label  = excluded.capacity_label,
    lat             = excluded.lat,
    lng             = excluded.lng,
    airport_code    = excluded.airport_code,
    airport_city    = excluded.airport_city;

-- ---------------------------------------------------------------------------
-- amenities — 6 shared + 11 villa-specific
-- ---------------------------------------------------------------------------
insert into public.amenities (slug, label, detail, is_shared) values
-- The SHARED_AMENITIES block: stored once, referenced by all four villas.
('housekeeping', 'Daily housekeeping',
 $txt$Our team refreshes the villa every morning between 9am and 11am, and turns down the beds at dusk on request.$txt$, true),
('wifi', 'Fibre Wi-Fi throughout',
 $txt$Dedicated 300 Mbps fibre line with mesh access points in every room and on the terrace — fast enough for calls and streaming at the same time.$txt$, true),
('kitchen', 'Full kitchen & Nespresso bar',
 $txt$Induction hob, oven, dishwasher and a stocked Nespresso bar. A private chef can be arranged with 24 hours' notice.$txt$, true),
('air-conditioning', 'Climate control',
 $txt$Silent split-unit air conditioning in every bedroom, plus ceiling fans in the living areas for cooler evenings.$txt$, true),
('safe', 'In-room electronic safe',
 $txt$Laptop-sized safe in the primary bedroom wardrobe, with a personal code you set on arrival.$txt$, true),
('airport-transfer', 'Private airport transfer',
 $txt$Complimentary one-way transfer from Ngurah Rai International (DPS) in a private car. Return transfers are billed at cost.$txt$, true),

-- tuscan-twilight-villa
('infinity-pool', 'Private infinity pool',
 $txt$14-metre heated pool overlooking the valley, cleaned daily and lit from within after sunset.$txt$, false),
('yoga-deck', 'Riverside yoga deck',
 $txt$Covered teak deck above the river with mats and props provided. A resident instructor is available each morning at 7am.$txt$, false),

-- coastal-arch-retreat
('clifftop-pool', 'Clifftop horizon pool',
 $txt$20-metre saltwater pool cantilevered over the headland, with a submerged bench along the ocean edge.$txt$, false),
('butler', 'Dedicated villa host',
 $txt$A host is on site from 7am to 9pm to handle bookings, transport and anything the villa needs. Overnight contact is by phone.$txt$, false),
('surf-storage', 'Surf store & outdoor rinse',
 $txt$Locked board store beside the entry court, with a freshwater rinse station and wetsuit rail.$txt$, false),

-- riverside-stone-lodge
('plunge-pool', 'Plunge pool & sun deck',
 $txt$6-metre plunge pool shaded by frangipani, with four loungers and an outdoor shower.$txt$, false),
('workspace', 'Dedicated workspace',
 $txt$Desk, ergonomic chair and a second monitor in the mezzanine nook, on the same fibre line as the rest of the villa.$txt$, false),
('bicycles', 'Two bicycles included',
 $txt$Step-through bikes with locks and helmets, enough for the ten-minute ride to Batu Bolong.$txt$, false),

-- cliffside-ocean-villa
('ocean-pool', 'Cliff-edge pool',
 $txt$12-metre pool set flush with the cliff terrace, facing the strait and the Bali coastline.$txt$, false),
('snorkel-kit', 'Snorkelling kit & boat charter',
 $txt$Masks, fins and dry bags for six. Half-day charters to Crystal Bay and Manta Point can be booked through your host.$txt$, false),
('generator', 'Backup generator',
 $txt$Automatic changeover generator covers the whole villa — island outages never reach the guest areas.$txt$, false)
on conflict (slug) do update set
    label     = excluded.label,
    detail    = excluded.detail,
    is_shared = excluded.is_shared;

-- ---------------------------------------------------------------------------
-- stay_amenities — villa-specific links (sort_order 0-9)
-- ---------------------------------------------------------------------------
-- Joined on slugs rather than hardcoded ids so the seed survives a table
-- rebuild that renumbers the identity sequence.
with per_stay (stay_slug, amenity_slug, sort_order) as (
    values
        ('tuscan-twilight-villa', 'infinity-pool', 0),
        ('tuscan-twilight-villa', 'yoga-deck',     1),

        ('coastal-arch-retreat',  'clifftop-pool', 0),
        ('coastal-arch-retreat',  'butler',        1),
        ('coastal-arch-retreat',  'surf-storage',  2),

        ('riverside-stone-lodge', 'plunge-pool',   0),
        ('riverside-stone-lodge', 'workspace',     1),
        ('riverside-stone-lodge', 'bicycles',      2),

        ('cliffside-ocean-villa', 'ocean-pool',    0),
        ('cliffside-ocean-villa', 'snorkel-kit',   1),
        ('cliffside-ocean-villa', 'generator',     2)
)
insert into public.stay_amenities (stay_id, amenity_id, sort_order)
select s.id, a.id, p.sort_order::smallint
from per_stay p
join public.stays     s on s.slug = p.stay_slug
join public.amenities a on a.slug = p.amenity_slug
on conflict (stay_id, amenity_id) do update set sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- stay_amenities — shared links (sort_order 10+), cross-joined to every villa
-- ---------------------------------------------------------------------------
-- Reproduces `...SHARED_AMENITIES` being spread last in each villa's list.
-- Any villa added later needs this block re-run to inherit the shared set.
with shared_order (amenity_slug, sort_order) as (
    values
        ('housekeeping',     10),
        ('wifi',             11),
        ('kitchen',          12),
        ('air-conditioning', 13),
        ('safe',             14),
        ('airport-transfer', 15)
)
insert into public.stay_amenities (stay_id, amenity_id, sort_order)
select s.id, a.id, o.sort_order::smallint
from public.stays s
cross join shared_order o
join public.amenities a on a.slug = o.amenity_slug
on conflict (stay_id, amenity_id) do update set sort_order = excluded.sort_order;

commit;

-- Expect: 4 stays, 17 amenities (6 shared), 35 stay_amenities.
select
    (select count(*) from public.stays)                     as stays,
    (select count(*) from public.amenities)                 as amenities,
    (select count(*) from public.amenities where is_shared) as shared,
    (select count(*) from public.stay_amenities)            as links;
