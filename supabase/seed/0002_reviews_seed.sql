-- 0002_reviews_seed.sql
-- 100 guest reviews across the four villas, written by 62 distinct guests.
--
-- Run FOURTH, after 0005_reviews.sql (and after 0001_stays_seed.sql, which this
-- joins against by slug).
-- Idempotent: the insert is gated on the table being empty, so re-running is a
-- no-op rather than a second copy.
--
-- ---------------------------------------------------------------------------
-- What this data is, honestly
-- ---------------------------------------------------------------------------
-- These are PLACEHOLDERS in the correct shape, not real guest reviews. They
-- exist so the landing page reads from the database instead of a hardcoded
-- array, and so the aggregate stats are computed rather than typed. Real rows
-- will arrive through a write path that does not exist yet (no auth, no
-- bookings). Do not present these numbers as real trading data.
--
-- ---------------------------------------------------------------------------
-- Why two CTEs instead of 100 self-contained rows
-- ---------------------------------------------------------------------------
-- Each guest's name and nationality is written ONCE in guest_seed and joined
-- in. Writing them inline on all 100 rows would mean the same person appears
-- 2-3 times, and hand-maintaining that is exactly how one guest ends up
-- Swedish in one review and Norwegian in the next.
--
-- Long text is dollar-quoted ($q$) rather than '' escaped, for the same reason
-- 0001_stays_seed.sql does it: the copy is full of apostrophes.
--
-- `days_ago` is deliberately unique per row. The carousel reads
-- `order by created_at desc limit 8`, so ties would make the visible selection
-- non-deterministic. The values step by 4 per villa (villa 1 = 4, 8, 12 ...,
-- villa 2 = 5, 9, 13 ...), which also guarantees the newest eight reviews are
-- spread evenly across all four villas.

begin;

with guest_seed (guest_ref, display_name, nationality) as (
    values
    -- Short display form ('Amara L.') rather than a full legal name: this is
    -- the string rendered publicly on the card. See GUEST_PLANNING_TABLE.md.
    ('amara-lindqvist',   'Amara L.',     'Swedish'),
    ('rafael-moreno',     'Rafael M.',    'Portuguese'),
    ('naomi-sato',        'Naomi S.',     'Japanese'),
    ('genie-junior',      'Genie J.',     'Emirati'),
    ('tomas-brandt',      'Tomas B.',     'German'),
    ('isabelle-caron',    'Isabelle C.',  'French'),
    ('hendrik-visser',    'Hendrik V.',   'Dutch'),
    ('priya-raghunathan', 'Priya R.',     'Indian'),
    ('lucas-fontaine',    'Lucas F.',     'Belgian'),
    ('mei-lin-chow',      'Mei Lin C.',   'Singaporean'),
    ('oscar-halvorsen',   'Oscar H.',     'Norwegian'),
    ('beatriz-alves',     'Beatriz A.',   'Brazilian'),
    ('daniel-okonkwo',    'Daniel O.',    'Nigerian'),
    ('siobhan-kelly',     'Siobhan K.',   'Irish'),
    ('yusuf-demir',       'Yusuf D.',     'Turkish'),
    ('clara-esposito',    'Clara E.',     'Italian'),
    ('martin-novak',      'Martin N.',    'Czech'),
    ('anya-volkova',      'Anya V.',      'Russian'),
    ('james-whitfield',   'James W.',     'British'),
    ('mariko-tanabe',     'Mariko T.',    'Japanese'),
    ('felipe-cardenas',   'Felipe C.',    'Chilean'),
    ('elena-petrova',     'Elena P.',     'Bulgarian'),
    ('sean-mcallister',   'Sean M.',      'Scottish'),
    ('nadia-benali',      'Nadia B.',     'Moroccan'),
    ('kristoffer-dahl',   'Kristoffer D.','Danish'),
    ('amelia-hartley',    'Amelia H.',    'Australian'),
    ('victor-nguyen',     'Victor N.',    'Vietnamese'),
    ('ingrid-solberg',    'Ingrid S.',    'Norwegian'),
    ('paulo-ribeiro',     'Paulo R.',     'Portuguese'),
    ('hana-kowalski',     'Hana K.',      'Polish'),
    ('theo-lambert',      'Theo L.',      'French'),
    ('rachel-goldstein',  'Rachel G.',    'Canadian'),
    ('arjun-mehta',       'Arjun M.',     'Indian'),
    ('lotte-jansen',      'Lotte J.',     'Dutch'),
    ('carlos-viera',      'Carlos V.',    'Spanish'),
    ('keiko-arata',       'Keiko A.',     'Japanese'),
    ('bruno-schmid',      'Bruno S.',     'Swiss'),
    ('leila-farahani',    'Leila F.',     'Iranian'),
    ('gavin-treharne',    'Gavin T.',     'Welsh'),
    ('sofia-lindberg',    'Sofia L.',     'Swedish'),
    ('marcus-oyelaran',   'Marcus O.',    'Nigerian'),
    ('tanya-pillai',      'Tanya P.',     'Malaysian'),
    ('emil-rasmussen',    'Emil R.',      'Danish'),
    ('valentina-rossi',   'Valentina R.', 'Italian'),
    ('jonas-weber',       'Jonas W.',     'German'),
    ('chloe-beaumont',    'Chloe B.',     'French'),
    ('dimitri-katsaros',  'Dimitri K.',   'Greek'),
    ('hollie-marsden',    'Hollie M.',    'British'),
    ('andres-quintero',   'Andres Q.',    'Colombian'),
    ('yuki-morishima',    'Yuki M.',      'Japanese'),
    ('petra-horvath',     'Petra H.',     'Hungarian'),
    ('samuel-adeyemi',    'Samuel A.',    'Nigerian'),
    ('linnea-kallio',     'Linnea K.',    'Finnish'),
    ('ravi-chandrasekar', 'Ravi C.',      'Indian'),
    ('margot-dubois',     'Margot D.',    'French'),
    ('stefan-bauer',      'Stefan B.',    'Austrian'),
    ('noor-haddad',       'Noor H.',      'Lebanese'),
    ('connor-flanagan',   'Connor F.',    'Irish'),
    ('wei-zhang',         'Wei Z.',       'Chinese'),
    ('adriana-lopes',     'Adriana L.',   'Brazilian'),
    ('henrik-nilsson',    'Henrik N.',    'Swedish'),
    ('zara-ibrahim',      'Zara I.',      'Malaysian')
),

-- Rating mix is deliberately skewed but not perfect: 72 fives, 22 fours, 6
-- threes. Average lands on 4.66 and the "recommend" share (rating >= 4) on
-- 94%. A wall of 5.00 would read as fabricated and would also never exercise
-- the averaging code.
review_seed (guest_ref, stay_slug, rating, days_ago, quote) as (
    values

    -- -----------------------------------------------------------------------
    -- Tuscan Twilight Villa — Ubud
    -- -----------------------------------------------------------------------
    ('amara-lindqvist',   'tuscan-twilight-villa', 5,   4, $q$We woke to mist sitting in the valley every single morning. The living pavilion opens so completely that breakfast felt like it was happening outdoors.$q$),
    ('james-whitfield',   'tuscan-twilight-villa', 5,   8, $q$Three bedrooms, three outdoor showers, and a garden corridor between them. Everyone had their own corner and we still ate together every night under the pergola.$q$),
    ('sofia-lindberg',    'tuscan-twilight-villa', 4,  12, $q$Beautiful house and staff who anticipated everything. The road down from the main gate is steeper than we expected with luggage, so ask for help on arrival.$q$),
    ('arjun-mehta',       'tuscan-twilight-villa', 5,  16, $q$The infinity pool at dusk, with the frogs starting up in the rice terraces below, is the single thing I would go back for.$q$),
    ('valentina-rossi',   'tuscan-twilight-villa', 5,  20, $q$Limewashed walls, low light, nothing shiny anywhere. It is a genuinely restful house rather than a photogenic one, which is rarer than it sounds.$q$),
    ('naomi-sato',        'tuscan-twilight-villa', 5,  24, $q$A rare place that looks exactly like its photos. We came for three nights and left already planning the next stay.$q$),
    ('isabelle-caron',    'tuscan-twilight-villa', 5,  28, $q$Absolute quiet, except for water. The Petanu runs somewhere below the terrace and you hear it all night.$q$),
    ('mei-lin-chow',      'tuscan-twilight-villa', 5,  32, $q$We booked for a family of six and the house absorbed us easily. The long teak table became the centre of the trip.$q$),
    ('daniel-okonkwo',    'tuscan-twilight-villa', 5,  36, $q$Staff were present when needed and invisible otherwise. That balance is very hard to get right and they had it.$q$),
    ('martin-novak',      'tuscan-twilight-villa', 4,  40, $q$Lovely villa, genuinely peaceful. Wifi in the far bedroom was patchy, which mattered only because I had two calls to take.$q$),
    ('elena-petrova',     'tuscan-twilight-villa', 5,  44, $q$The garden is not decoration, it is the point. Frangipani everywhere and a gardener who clearly loves it.$q$),
    ('kristoffer-dahl',   'tuscan-twilight-villa', 5,  48, $q$Coming from a Copenhagen winter this was a shock in the best way. Warm stone underfoot at seven in the morning.$q$),
    ('hana-kowalski',     'tuscan-twilight-villa', 5,  52, $q$Everything was effortless from check-in onwards. Someone had even noticed my daughter's birthday and left flowers.$q$),
    ('lotte-jansen',      'tuscan-twilight-villa', 4,  56, $q$Gorgeous, but be aware Ubud centre is a twenty minute drive and afternoon traffic doubles that. Plan around it and it is perfect.$q$),
    ('gavin-treharne',    'tuscan-twilight-villa', 5,  60, $q$The pergola dinners were the highlight. We asked the cook for something local on the second night and never went out again.$q$),
    ('emil-rasmussen',    'tuscan-twilight-villa', 5,  64, $q$Three nights was not enough. The house asks you to slow down and it takes about a day to actually agree to it.$q$),
    ('hollie-marsden',    'tuscan-twilight-villa', 5,  68, $q$Spotless. Not hotel-spotless, but properly cared-for-house spotless, which is different and much nicer.$q$),
    ('yuki-morishima',    'tuscan-twilight-villa', 4,  72, $q$Very beautiful and very quiet. Mosquitoes in the garden at dusk were persistent, so bring repellent and it is a non-issue.$q$),
    ('genie-junior',      'tuscan-twilight-villa', 5,  76, $q$It felt like a private retreat. Everything was effortless, from check-in to the little design details.$q$),
    ('hendrik-visser',    'tuscan-twilight-villa', 5,  80, $q$Floor to ceiling glass and no neighbours to see you through it. We stopped closing the curtains after the first day.$q$),
    ('lucas-fontaine',    'tuscan-twilight-villa', 5,  84, $q$The outdoor shower attached to the main bedroom is the best I have used anywhere. Open sky, hot water, done.$q$),
    ('beatriz-alves',     'tuscan-twilight-villa', 3,  88, $q$The villa itself is lovely and the staff kind. Building work on the neighbouring plot ran most mornings during our stay, which nobody had mentioned beforehand.$q$),
    ('siobhan-kelly',     'tuscan-twilight-villa', 5,  92, $q$We took the whole house for a family reunion. Ten of us, no arguments about rooms, which alone earns five stars.$q$),
    ('clara-esposito',    'tuscan-twilight-villa', 4,  96, $q$Mornings with mist over the terraces, evenings in the pool. I did not open my laptop once, which was not the plan.$q$),
    ('anya-volkova',      'tuscan-twilight-villa', 4, 100, $q$Wonderful house, thoughtful design. It is a long transfer from the airport, closer to two hours than one, so arrive with that in mind.$q$),

    -- -----------------------------------------------------------------------
    -- Coastal Arch Retreat — Uluwatu
    -- -----------------------------------------------------------------------
    ('amara-lindqvist',   'coastal-arch-retreat',  5,   5, $q$The sunset terrace is built around one job and it does it perfectly. We ate there every evening and watched the swell come in a hundred metres below.$q$),
    ('keiko-arata',       'coastal-arch-retreat',  5,   9, $q$Spare, calm, and completely uncluttered. Nothing in the house competes with the water, which is clearly deliberate.$q$),
    ('sofia-lindberg',    'coastal-arch-retreat',  5,  13, $q$Four bedrooms around a shared courtyard meant two families could travel together without living on top of each other.$q$),
    ('arjun-mehta',       'coastal-arch-retreat',  4,  17, $q$Spectacular position. The walk down to the beach is a serious set of stairs, so factor that in if anyone in your group struggles with knees.$q$),
    ('rafael-moreno',     'coastal-arch-retreat',  4,  21, $q$The sunset from the terrace alone was worth the trip. Quiet, unhurried, and beautifully put together.$q$),
    ('tomas-brandt',      'coastal-arch-retreat',  5,  25, $q$Arched openings everywhere and lime plaster that stays cool to the touch at midday. Whoever designed this understood the climate.$q$),
    ('priya-raghunathan', 'coastal-arch-retreat',  5,  29, $q$Biggest villa we have stayed in and it never felt empty. The built-in seating does a lot of work.$q$),
    ('oscar-halvorsen',   'coastal-arch-retreat',  5,  33, $q$You hear the ocean constantly. Not a distant hush, but actual breaking water, all night, from every room.$q$),
    ('martin-novak',      'coastal-arch-retreat',  5,  37, $q$We came for a wedding nearby and this was the calm end of a loud week. Exactly what we needed.$q$),
    ('elena-petrova',     'coastal-arch-retreat',  5,  41, $q$The courtyard is the best room in the house and it does not even have a roof.$q$),
    ('amelia-hartley',    'coastal-arch-retreat',  4,  45, $q$Uluwatu can feel overbuilt now. This place sits far enough along the headland that most of that noise does not reach you.$q$),
    ('ingrid-solberg',    'coastal-arch-retreat',  3,  49, $q$The house is stunning and the staff were lovely. Our dates were confirmed twice and still had to be sorted out on arrival, which soured the first afternoon.$q$),
    ('lotte-jansen',      'coastal-arch-retreat',  5,  53, $q$Two of the bedrooms convert to twins, which solved a problem I had assumed we would just live with.$q$),
    ('gavin-treharne',    'coastal-arch-retreat',  5,  57, $q$Watched a storm come across the strait from the terrace with a drink in hand. Best hour of the holiday.$q$),
    ('chloe-beaumont',    'coastal-arch-retreat',  5,  61, $q$Minimal in the good sense: everything you need, nothing you have to move out of the way first.$q$),
    ('yuki-morishima',    'coastal-arch-retreat',  5,  65, $q$The light through the arches changes all day. I took more photographs of the walls than of the ocean.$q$),
    ('margot-dubois',     'coastal-arch-retreat',  4,  69, $q$Beautiful house. The kitchen is smaller than the size of the villa suggests, so a group planning to cook a lot should know that.$q$),
    ('felipe-cardenas',   'coastal-arch-retreat',  5,  73, $q$We surfed every morning and came back to a pool with nobody else in it. Hard to improve on.$q$),
    ('sean-mcallister',   'coastal-arch-retreat',  5,  77, $q$Staff sorted a last-minute airport transfer at eleven at night without being asked twice. That is what you are paying for.$q$),
    ('nadia-benali',      'coastal-arch-retreat',  5,  81, $q$Utterly quiet apart from the sea. I slept better in four nights here than in the previous month.$q$),
    ('victor-nguyen',     'coastal-arch-retreat',  3,  85, $q$Lovely building in a great spot, but the pool was being resurfaced for two of our four days and we were only told after arrival.$q$),
    ('paulo-ribeiro',     'coastal-arch-retreat',  5,  89, $q$The limestone, the plaster, the arches. It feels like it grew out of the headland rather than landing on it.$q$),
    ('theo-lambert',      'coastal-arch-retreat',  4,  93, $q$Excellent stay overall. The drive to anywhere for dinner is twenty five minutes each way, so we mostly ate in.$q$),
    ('carlos-viera',      'coastal-arch-retreat',  5,  97, $q$Six adults, two children, nobody in anyone's way. The courtyard plan is genuinely clever.$q$),
    ('leila-farahani',    'coastal-arch-retreat',  5, 101, $q$I have stayed in a lot of cliff villas that are mostly a photograph. This one is a house you can actually live in.$q$),

    -- -----------------------------------------------------------------------
    -- Riverside Stone Lodge — Canggu
    -- -----------------------------------------------------------------------
    ('james-whitfield',   'riverside-stone-lodge', 5,   6, $q$Walked to Batu Bolong before breakfast every day. Five minutes inland is exactly the right distance from that beach.$q$),
    ('keiko-arata',       'riverside-stone-lodge', 5,  10, $q$The double-height living room with the timber roof above it is the nicest interior space I have stayed in on the island.$q$),
    ('sofia-lindberg',    'riverside-stone-lodge', 5,  14, $q$Compact and unfussy, and all the better for it. Nothing here is bigger than it needs to be.$q$),
    ('valentina-rossi',   'riverside-stone-lodge', 4,  18, $q$Really lovely lodge. Canggu traffic outside the lane is constant from about eight in the morning, which the photos do not convey.$q$),
    ('naomi-sato',        'riverside-stone-lodge', 5,  22, $q$Worked from the covered kitchen for a week with the plunge pool three steps away. It has ruined normal offices for me.$q$),
    ('tomas-brandt',      'riverside-stone-lodge', 5,  26, $q$Local andesite stone throughout, and it keeps the whole place cool without air conditioning during the day.$q$),
    ('priya-raghunathan', 'riverside-stone-lodge', 5,  30, $q$Two bedrooms, two of us, no wasted space. I would rather have this than a villa twice the size.$q$),
    ('daniel-okonkwo',    'riverside-stone-lodge', 5,  34, $q$The lane in is narrow and quiet, then you open the door and there is a double-height room and a pool. Complete surprise.$q$),
    ('yusuf-demir',       'riverside-stone-lodge', 4,  38, $q$Great value and a great location. The upstairs bedrooms get warm in the late afternoon before the fans catch up.$q$),
    ('mariko-tanabe',     'riverside-stone-lodge', 5,  42, $q$Everything worked. Hot water, pressure, wifi, the lot. That should not be remarkable but it is.$q$),
    ('kristoffer-dahl',   'riverside-stone-lodge', 5,  46, $q$Surfed at dawn, ate at the warung on the corner, swam, repeated. The lodge made that rhythm easy.$q$),
    ('hana-kowalski',     'riverside-stone-lodge', 5,  50, $q$Exposed timber, stone walls, and almost no decoration. Restful in a way that busier villas never manage.$q$),
    ('rachel-goldstein',  'riverside-stone-lodge', 4,  54, $q$Very good stay. It is a genuinely two-bedroom house though, and the sofa is not a third bed whatever the photos imply.$q$),
    ('bruno-schmid',      'riverside-stone-lodge', 5,  58, $q$The covered kitchen opening straight onto the plunge pool is the best single design decision in the house.$q$),
    ('emil-rasmussen',    'riverside-stone-lodge', 5,  62, $q$Quiet enough to work from, close enough to walk to the surf before breakfast. That description is accurate, which is rare.$q$),
    ('linnea-kallio',     'riverside-stone-lodge', 5,  66, $q$Stayed three weeks and never wanted to move. The staff started leaving fruit out without being asked.$q$),
    ('margot-dubois',     'riverside-stone-lodge', 4,  70, $q$Small, beautifully made, and honest about what it is. No infinity pool theatrics, which suited us.$q$),
    ('marcus-oyelaran',   'riverside-stone-lodge', 5,  74, $q$Best base in Canggu I have found. Far enough from the noise, close enough to everything.$q$),
    ('tanya-pillai',      'riverside-stone-lodge', 4,  78, $q$Charming lodge, very well kept. Parking is tight for anything bigger than a small car, worth knowing before you rent one.$q$),
    ('jonas-weber',       'riverside-stone-lodge', 5,  82, $q$The stone keeps the temperature steady all day. We barely used the air conditioning at all.$q$),
    ('dimitri-katsaros',  'riverside-stone-lodge', 3,  86, $q$The house is good and the location excellent. There was construction two doors down for most of our ten days and it started early.$q$),
    ('andres-quintero',   'riverside-stone-lodge', 5,  90, $q$Two of us, two bedrooms, one of which became a studio. Perfect for a working month.$q$),
    ('petra-horvath',     'riverside-stone-lodge', 4,  94, $q$Lovely and peaceful inside. Do not expect a view, though. The walls are the point here, not the outlook.$q$),
    ('samuel-adeyemi',    'riverside-stone-lodge', 5,  98, $q$Simple, solid, and quiet. I booked four nights and extended twice.$q$),
    ('ravi-chandrasekar', 'riverside-stone-lodge', 5, 102, $q$The plunge pool is small and that is fine, because you are in it every twenty minutes anyway.$q$),

    -- -----------------------------------------------------------------------
    -- Cliffside Ocean Villa — Nusa Penida
    -- -----------------------------------------------------------------------
    ('amara-lindqvist',   'cliffside-ocean-villa', 5,   7, $q$Watched the light go off Mount Agung from the pool on the third evening. I have not stopped thinking about it.$q$),
    ('james-whitfield',   'cliffside-ocean-villa', 5,  11, $q$Every room faces the strait. There is no bad bed in this house.$q$),
    ('keiko-arata',       'cliffside-ocean-villa', 4,  15, $q$Extraordinary setting. The journey is genuinely long, boat then twenty minutes on rough road, and worth doing once you accept it.$q$),
    ('arjun-mehta',       'cliffside-ocean-villa', 5,  19, $q$The remoteness is the product. Bring what you need and the island does the rest.$q$),
    ('valentina-rossi',   'cliffside-ocean-villa', 5,  23, $q$Three bedrooms, three views of the water, and nothing else for a long way in any direction.$q$),
    ('rafael-moreno',     'cliffside-ocean-villa', 5,  27, $q$We saw two other people in four days and both of them worked there. Exactly what we booked it for.$q$),
    ('isabelle-caron',    'cliffside-ocean-villa', 5,  31, $q$Sunsets over the strait every evening without fail. We stopped making other plans.$q$),
    ('mei-lin-chow',      'cliffside-ocean-villa', 3,  35, $q$Beautiful villa in an incredible spot. Our boat transfer was cancelled by weather and the villa had no contingency to offer, so we lost most of a day.$q$),
    ('oscar-halvorsen',   'cliffside-ocean-villa', 5,  39, $q$The most remote place I have stayed and the best serviced. Someone clearly plans very far ahead here.$q$),
    ('yusuf-demir',       'cliffside-ocean-villa', 5,  43, $q$Cliff, pool, strait, Agung on the horizon. The whole house is arranged around that one line of sight.$q$),
    ('mariko-tanabe',     'cliffside-ocean-villa', 5,  47, $q$Absolute silence at night apart from the water below. I had forgotten that was possible.$q$),
    ('amelia-hartley',    'cliffside-ocean-villa', 4,  51, $q$Wonderful stay. The nearest shop really is a village away, so do the big supermarket run in Sanur before the boat.$q$),
    ('rachel-goldstein',  'cliffside-ocean-villa', 5,  55, $q$Staff met us at the harbour, drove us up, and had lunch waiting. The logistics were handled completely.$q$),
    ('bruno-schmid',      'cliffside-ocean-villa', 5,  59, $q$Stood on the terrace for an hour the first evening without saying anything. That is the review.$q$),
    ('chloe-beaumont',    'cliffside-ocean-villa', 4,  63, $q$Penida is busy at the famous viewpoints and empty everywhere else. This villa is firmly in the second category.$q$),
    ('hollie-marsden',    'cliffside-ocean-villa', 5,  67, $q$The pool sits right on the cliff edge and the horizon lines up with the water. Simple trick, enormous effect.$q$),
    ('linnea-kallio',     'cliffside-ocean-villa', 4,  71, $q$Gorgeous and very peaceful. Power flickered twice in a storm. There is a generator, but it takes a minute to catch.$q$),
    ('stefan-bauer',      'cliffside-ocean-villa', 5,  75, $q$We came for three nights, moved everything around, and stayed six.$q$),
    ('noor-haddad',       'cliffside-ocean-villa', 5,  79, $q$Watching the ferries cross to Bali from bed in the morning is a small thing I will remember for a long time.$q$),
    ('connor-flanagan',   'cliffside-ocean-villa', 5,  83, $q$Getting here is a mission, and that is precisely why it is still like this.$q$),
    ('wei-zhang',         'cliffside-ocean-villa', 3,  87, $q$The location is unbeatable. Wifi was effectively unusable for the whole stay, which matters if you planned to work at all.$q$),
    ('adriana-lopes',     'cliffside-ocean-villa', 5,  91, $q$Three bedrooms and we still all ended up on the terrace every evening.$q$),
    ('henrik-nilsson',    'cliffside-ocean-villa', 5,  95, $q$Clear evening, Agung across the water, nobody else around. Worth every hour of the journey.$q$),
    ('zara-ibrahim',      'cliffside-ocean-villa', 4,  99, $q$Really special place. Roads on the island are rough, so book the villa driver rather than a scooter unless you are confident.$q$),
    ('ingrid-solberg',    'cliffside-ocean-villa', 5, 103, $q$Remote, quiet, and completely unhurried. The kind of place you have to actively decide to leave.$q$)
)

insert into public.reviews (
    guest_ref, author_display_name, author_nationality,
    stay_id, rating, quote, created_at
)
select
    r.guest_ref,
    g.display_name,
    g.nationality,
    s.id,
    r.rating,
    r.quote,
    now() - make_interval(days => r.days_ago)
from review_seed r
join guest_seed g using (guest_ref)
join public.stays s on s.slug = r.stay_slug
-- Idempotency guard. Evaluated against the snapshot taken at statement start,
-- so it does not flip partway through the insert: either all 100 rows go in
-- (empty table) or none do (already seeded).
where not exists (select 1 from public.reviews);

commit;

-- Expect: 100 | 62 | 4.66
select count(*)                    as reviews,
       count(distinct guest_ref)   as guests,
       round(avg(rating), 2)       as avg_rating
from public.reviews;

-- Expect 32 guests with more than one review (26 with two, 6 with three).
select count(*) as repeat_guests from (
    select guest_ref from public.reviews group by guest_ref having count(*) > 1
) t;
