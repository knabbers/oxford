// Invented trade names for every business the map names — the one shared mapping (pure: no DOM, no three.js).
//
// Project rule: the game shows invented business names only, never a real business, brand or logo (it is published).
// The map is OpenStreetMap as surveyed in 2026, so its shops, cafés, pubs, banks, hotels and chains carry real names
// (and `brand` / `operator` tags) that the world would paint on fascias, jobs would read out as taxi destinations, and
// so on. applyTradeNames(map) replaces, once, after every place module's preMap and before anything is built from the
// map (world/index.js buildWorld calls it), the name of every commercial premises with an invented one of the same
// kind: a fried-chicken takeaway becomes an invented fried-chicken takeaway, a bookmaker an invented bookmaker. Its
// `brand`, `operator` and wikidata tags go. Nothing else of the map changes (same elements, ids, positions).
//
//   stable     a premises' name comes from a hash of its OSM id (the lowest id of all premises sharing its real name,
//              so the branches of one chain share one invented chain name), with collisions stepped past in id order
//   unique     no invented name is used twice for different businesses (pools are big: curated parts combined)
//   clean      an invented name never equals (ignoring case, "the", punctuation, "&"/"and") any real name in the map
//              data nor contains a well-known chain's name (CHAINS); tools/audit_brands.mjs checks what is displayed
//   kept       street names, colleges, departments, churches, museums, libraries, parks, rivers, bridges, public
//              buildings, bus stops; a business's own name inside an institution ("… College Bar", "Museum Café")
//   first      the hand-built places' invented names win for their footprints: the districts that rename in their own
//              preMap (places/_eo_names.js for Cowley Road and Jericho, The Bastion in broad_street.js, …) — anything a
//              preMap renamed is left alone (systems/tradenames.js notes the raw names before the preMaps run), and
//              their invented names are taken out of the pools here so nothing else gets them
//
// The names are made up in the spirit of a 2013 city centre — any match with a real business is accidental.
import { NAMES as DISTRICT_NAMES } from '../places/_eo_names.js';

// ------------------------------------------------------------------------------------------------ what is a business
const KEEP_NAME = /\b(College|University|Museum|Library|Bodleian|Ashmolean|Cathedral|Church|Chapel|Chaplaincy|Union|Faculty|Department|Institute|School|Hospital|Council|Town Hall|Oxfordshire County|Railway Station Ticket Office|Visitor Centre|Botanic|Pitt Rivers|Sheldonian|Playhouse|Modern Art Oxford|Old Fire Station)\b/;
const POI_KIND = {
  pub: 'pub', biergarten: 'pub', bar: 'bar', nightclub: 'club', cafe: 'cafe', ice_cream: 'sweet', restaurant: 'restaurant', fast_food: 'fast_food',
  hotel: 'hotel', guest_house: 'hotel', hostel: 'hotel', motel: 'hotel', apartment: 'hotel',
  bank: 'bank', atm: 'bank', bureau_de_change: 'exchange', pharmacy: 'chemist', cinema: 'cinema', casino: 'bookie', adult_gaming_centre: 'bookie',
  fitness_centre: 'gym', dentist: 'dentist', veterinary: 'vet', fuel: 'garage', car_rental: 'garage', escape_game: 'shop', photo_booth: 'shop', parcel_locker: 'shop',
};
const SHOP_KIND = {
  coffee: 'cafe', tea: 'cafe', convenience: 'grocer', supermarket: 'grocer', greengrocer: 'grocer', newsagent: 'news', department_store: 'dept', variety_store: 'gifts',
  clothes: 'clothes', boutique: 'clothes', fashion_accessories: 'clothes', fashion: 'clothes', shoes: 'shoes', jewelry: 'jeweller', watches: 'jeweller', optician: 'optician',
  books: 'books', stationery: 'stationer', copyshop: 'stationer', bakery: 'bakery', pastry: 'bakery', confectionery: 'sweet', chocolate: 'sweet', deli: 'deli', cheese: 'deli', butcher: 'deli',
  hairdresser: 'hair', barber: 'hair', beauty: 'beauty', cosmetics: 'beauty', perfumery: 'beauty', massage: 'beauty', tattoo: 'beauty', chemist: 'chemist', health_food: 'chemist',
  charity: 'charity', second_hand: 'charity', gift: 'gifts', souvenir: 'gifts', bookmaker: 'bookie', lottery: 'bookie', estate_agent: 'estate', mobile_phone: 'phone', computer: 'phone',
  electronics: 'phone', travel_agency: 'travel', ticket: 'travel', alcohol: 'wine', wine: 'wine', beverages: 'wine', bicycle: 'cycles', car: 'garage', car_repair: 'garage',
};
/** the business group of a building's tags or a POI's kind, or null (not a business, or kept) */
export function tradeKind(tags, poiKind) {
  if (poiKind) {
    if (poiKind.startsWith('shop:')) { const s = poiKind.slice(5); return s === 'vacant' || s === 'mall' ? null : SHOP_KIND[s] || 'shop'; }
    return POI_KIND[poiKind] || null;
  }
  const t = tags || {};
  if (t.shop) return t.shop === 'vacant' || t.shop === 'mall' ? null : SHOP_KIND[t.shop] || 'shop';
  if (t.amenity && POI_KIND[t.amenity] && t.amenity !== 'fitness_centre') return POI_KIND[t.amenity];
  if (t.tourism && /^(hotel|guest_house|hostel|motel|apartment)$/.test(t.tourism)) return 'hotel';
  if (t.building === 'pub') return 'pub';
  if (t.building === 'hotel' && t.name && /Hotel|Inn\b/.test(t.name)) return 'hotel';
  return null;
}
/** restaurants and takeaways by what they serve (the cuisine tag) */
function cuisineGroup(kind, cuisine) {
  const c = String(cuisine || '').split(';')[0];
  const fast = kind === 'fast_food';
  if (/^(indian|nepalese|sri_lankan|bangladeshi|pakistani|curry)$/.test(c)) return fast ? 'ff_curry' : 'r_indian';
  if (/^(chinese|asian|noodle|cantonese|malaysian|dim_sum)$/.test(c)) return fast ? 'ff_chinese' : 'r_chinese';
  if (/^(japanese|sushi|ramen|korean)$/.test(c)) return fast ? 'ff_sushi' : 'r_japanese';
  if (/^(thai|vietnamese|indonesian|filipino)$/.test(c)) return fast ? 'ff_chinese' : 'r_thai';
  if (/^(italian|pizza|pasta)$/.test(c)) return fast ? 'ff_pizza' : 'r_italian';
  if (/^(lebanese|syrian|turkish|persian|kurdish|mediterranean|greek|falafel|kebab|middle_eastern|moroccan|arab)$/.test(c)) return fast ? 'ff_kebab' : 'r_mezze';
  if (/^(chicken|fried_chicken|wings|portuguese)$/.test(c)) return fast ? 'ff_chicken' : 'r_grill';
  if (/^(burger|american|hot_dog|steak_house|bbq|diner)$/.test(c)) return fast ? 'ff_burger' : 'r_grill';
  if (/^(sandwich|bagel|salad|coffee_shop|breakfast)$/.test(c)) return fast ? 'ff_sandwich' : 'r_british';
  if (/^(mexican|tex-mex|burrito|latin_american)$/.test(c)) return fast ? 'ff_mexican' : 'r_mexican';
  if (/^(fish_and_chips|fish)$/.test(c)) return fast ? 'ff_chips' : 'r_british';
  if (/^(caribbean|african|eritrean|ethiopian|nigerian|jamaican)$/.test(c)) return fast ? 'ff_kebab' : 'r_caribbean';
  if (/^(crepe|donut|milkshake|juice|ice_cream|dessert|cake|frozen_yogurt|waffle)$/.test(c)) return 'sweet';
  if (/^(french|tapas|spanish|european|slovak|fine_dining|brasserie|international|regional|british|modern_british)$/.test(c)) return fast ? 'ff_sandwich' : c === 'tapas' || c === 'spanish' ? 'r_tapas' : 'r_british';
  return fast ? 'ff_sandwich' : 'r_british';
}

// ------------------------------------------------------------------------------------------------ the pools
// each pool: names in full (`n`) plus parts combined (`a` × `b`, as "a b" or by `f`); built once, in a fixed order
const P = {
  pub: { n: ['The Tallow Chandler', 'The Drover\'s Rest', 'The Ferryman', 'The Quill & Candle', 'The Hollow Oak', 'The Lantern & Key', 'The Saddler\'s Arms', 'The Owl & Ivy', 'The Three Feathers Inn', 'The Cooper\'s Barrel', 'The Wherry', 'The Bell & Bushel', 'The Locksmith\'s Arms', 'The Watchman', 'The Toll House', 'The Shepherd\'s Crook', 'The Fleece & Shuttle', 'The Lamplighter'],
    a: ['The Copper', 'The Silver', 'The Crooked', 'The Black', 'The Old', 'The Golden', 'The Blue', 'The Painted', 'The Jolly', 'The Sleeping', 'The Wandering', 'The Merry'],
    b: ['Kettle', 'Heron', 'Lantern', 'Ram', 'Pike', 'Tankard', 'Weathervane', 'Boatman', 'Hound', 'Otter', 'Barge', 'Thatcher', 'Cooper', 'Fiddler', 'Goose', 'Bargeman'] },
  bar: { n: ['The Velvet Room', 'Copper & Cane', 'The Ink Well', 'Nightjar Lounge', 'The Gin Lantern', 'Cellar Seven', 'The Glass House Bar', 'Amber Lounge', 'The Tipsy Owl', 'Marble Bar', 'The Back Parlour', 'Sapphire Lounge', 'The Cork & Candle', 'Dusk Cocktail Bar'],
    a: ['Indigo', 'Ember', 'Juniper', 'Neon', 'Lantern', 'Midnight', 'Gilded', 'Electric', 'Opal', 'Paper Moon'], b: ['Bar', 'Lounge', 'Cocktail Bar', 'Rooms', 'Wine Bar'] },
  club: { n: ['The Vault', 'Undercroft', 'Club Kinetic', 'The Engine Room', 'Strobe', 'The Night Kitchen', 'Halcyon', 'The Boiler House'] },
  cafe: { n: ['The Copper Kettle', 'Thimble & Spoon', 'The Quiet Cup', 'Wren\'s Café', 'Bramble Coffee House', 'The Gilded Teapot', 'Magpie Coffee', 'Clementine\'s', 'The Reading Lamp Café', 'Cup & Saucer', 'Morning Bell Café', 'The Steam Room', 'Little Larder Café', 'The Lazy Bean'],
    a: ['Bramble', 'Quill', 'Thimble', 'Juniper', 'Larkspur', 'Wren', 'Marigold', 'Pebble', 'Kestrel', 'Honeycomb', 'Chestnut', 'Teasel', 'Puffin', 'Lantern', 'Willow', 'Mulberry', 'Cobble', 'Hazel', 'Moorhen', 'Biscuit', 'Fennel', 'Tinder', 'Merlin', 'Poppy'],
    b: ['Café', 'Coffee House', 'Coffee', 'Tea Rooms', 'Kitchen', 'Espresso Bar', 'Coffee Co.', 'Bakehouse Café'] },
  sweet: { n: ['Sugar & Spice', 'The Whisk', 'Scoops', 'Jam Jar Sweets', 'The Crêpe Stand', 'Frosted', 'Sundae Best', 'Glazed & Confused', 'The Doughnut Hole', 'Shake Station', 'Squeeze Juice Bar', 'The Gelato Cart', 'Toffee Apple', 'Honeypot Sweets'] },
  r_indian: { a: ['Saffron', 'Cardamom', 'Monsoon', 'Jaipur', 'Malabar', 'Tamarind', 'Chilli', 'Bengal', 'Kashmir', 'Lotus', 'Masala', 'Himalaya', 'Goa', 'Ganges', 'Indigo', 'Coriander'], b: ['House', 'Palace', 'Lounge', 'Kitchen', 'Nights', 'Tiffin Room', 'Brasserie', 'Garden'] },
  r_chinese: { a: ['Jade', 'Golden', 'Red', 'Silver', 'Lucky', 'Bamboo', 'Peony', 'Lotus', 'Dragon Pearl', 'Plum Blossom', 'Twin Lantern', 'Sichuan'], b: ['Garden', 'Palace', 'House', 'Pavilion', 'Kitchen', 'Lantern', 'Dynasty', 'Court'] },
  r_japanese: { a: ['Hana', 'Koi', 'Sakura', 'Momiji', 'Kumo', 'Umi', 'Tsuki', 'Yuki', 'Kaze', 'Hoshi'], b: ['Sushi', 'Ramen Bar', 'Noodle House', 'Izakaya', 'Kitchen', 'Bento'] },
  r_thai: { a: ['Orchid', 'Lemongrass', 'Siam', 'Mango', 'Lotus', 'Galangal', 'Basil', 'Bangkok'], b: ['Thai Kitchen', 'House', 'Garden', 'Thai', 'Street Kitchen'] },
  r_italian: { a: ['Trattoria', 'Osteria', 'Pizzeria', 'Ristorante', 'Caffè'], b: ['Lucia', 'Ponte Vecchio', 'Bella Vista', 'Il Forno', 'Rosmarino', 'Mamma Teresa', 'Da Gino', 'La Lanterna', 'Toscana', 'Sorrento', 'Il Pozzo', 'Vesuvio', 'Il Giardino', 'Al Duomo'] },
  r_mezze: { a: ['Cedar', 'Olive', 'Pomegranate', 'Damascus', 'Sumac', 'Anatolia', 'Byblos', 'Fig Tree', 'Zaatar', 'Aleppo'], b: ['Mezze', 'Grill', 'Kitchen', 'House', 'Table', 'Garden'] },
  r_grill: { n: ['The Smokehouse', 'Rib Shack', 'Ember Grill', 'The Flame Pit', 'Liberty Diner', 'The Charcoal Room', 'Prairie Grill', 'The Griddle', 'Route Six Diner', 'Hickory'] },
  r_british: { n: ['The Pantry', 'The Long Table', 'Thyme & Sorrel', 'The Larder', 'The Brasserie on the Corner', 'Bistro Vingt', 'The Dining Room', 'Quince', 'The Kitchen Garden', 'Rook & Rafter', 'The Scullery', 'Marrow', 'The Mulberry Room', 'Bistro Lune', 'The Walled Kitchen', 'Hearth', 'The Potting Shed', 'Le Petit Coin', 'The Pewter Plate', 'Sage & Salt'] },
  r_tapas: { n: ['Pimentón', 'La Bodega Azul', 'El Rincón', 'Casa Olivo', 'Sal y Limón'] },
  r_mexican: { n: ['Cantina Azul', 'El Sombrerito', 'Taquería Luna', 'Casa Chile'] },
  r_caribbean: { n: ['Island Pot', 'Blue Mountain Kitchen', 'Sunshine Grill', 'Asmara Table', 'Ackee Tree', 'Calabash'] },
  ff_chicken: { n: ['Southern Star Chicken', 'Bluegrass Fried Chicken', 'Golden Wing', 'Chicken Shack', 'Crispy Coop', 'Cluckers', 'Hen House Chicken', 'Rooster Fried Chicken', 'Drumstick Fried Chicken'] },
  ff_burger: { n: ['Patty Wagon', 'The Burger Joint', 'Bun & Brisket', 'Big Stack Burgers', 'Grill Brothers', 'Double Decker Burgers', 'The Patty Shop', 'Stack Attack', 'Burger Garage', 'Flip Burgers', 'The Bun Shop'] },
  ff_pizza: { n: ['Pizza Roma Express', 'Slice of Naples', 'Stone Oven Pizza', 'Doughboy Pizza', 'Napoli Pizza & Grill', 'Pizza Corner', 'Hot Slice', 'Pizza Piazza'] },
  ff_kebab: { n: ['Night Owl Kebabs', 'Kebab Corner', 'Charcoal Kebab House', 'Istanbul Grill', 'The Doner Stop', 'Falafel Garden', 'Ottoman Grill', 'Late Kebab', 'Kebab Express', 'The Shawarma House', 'Golden Doner'] },
  ff_chinese: { n: ['Wok Inn', 'Noodle Box', 'Golden Chopsticks', 'Lucky Star Takeaway', 'Happy Garden Takeaway', 'Wok This Way', 'Bamboo Express', 'Fortune Wok'] },
  ff_sushi: { n: ['Sushi Go Round', 'Bento Box', 'Maki Bar', 'Noodle Bento'] },
  ff_curry: { n: ['Curry in a Hurry', 'Spice Box', 'Tiffin Express'] },
  ff_mexican: { n: ['Burrito Barn', 'Wrap & Roll', 'Taco Truck'] },
  ff_chips: { n: ['The Codfather', 'Golden Fry', 'The Chip Shop', 'Batter Up', 'Plaice & Chips'] },
  ff_sandwich: { n: ['The Sandwich Box', 'Bread & Butter', 'Daily Bread', 'Crust', 'The Bap Shop', 'Butty Bar', 'Fill Your Face Sandwiches', 'The Lunch Box', 'Baguette Bar', 'Crumbs', 'The Deli Counter', 'Sarnie Station', 'Take Five Sandwiches', 'Toast & Co', 'The Bagel Stop', 'Loaf', 'Picnic Sandwiches'] },
  hotel: { n: ['The Thames Reach Hotel', 'Bellfounder\'s House Hotel', 'The Cherwell Hotel', 'Spires View Hotel', 'The Quadrangle Hotel', 'St Frideswide Lodge', 'The Clarendon Arms Hotel', 'Cloister House', 'The Riverside Lodge', 'Turnstile House Hotel', 'Meadowsweet Guest House', 'The Old Bindery Hotel', 'The Tolbooth Hotel', 'Lamplight Guest House', 'The Gatehouse Hotel', 'Bridewell Court Hotel', 'Wolvercote House', 'The Bargeman\'s Inn', 'Dreaming Spires Guest House', 'The Ivy Lodge', 'The Stationmaster\'s House', 'Thameside Hotel', 'Osney Lodge', 'The Bookbinder Hotel', 'The Weaver\'s House', 'Cloth Hall Hotel', 'The Ferry House Hotel', 'Carfax Lodge'] },
  bank: { n: ['Albion Bank', 'Thames Valley Building Society', 'Mercia Bank', 'Shire Savings', 'Union & County Bank', 'Wessex Building Society', 'Northgate Bank', 'Cotswold Mutual', 'Crown & Anchor Bank', 'Vale Mutual', 'Penny Bank', 'Cheapside Bank', 'Heartland Building Society', 'Guildhall Bank'] },
  exchange: { n: ['Globe Currency', 'Change Point', 'Sterling Exchange', 'Compass Money'] },
  chemist: { n: ['Green Cross Chemist', 'The Dispensary', 'Apothecary & Co', 'Health First Chemist', 'Mortar & Pestle Pharmacy', 'Wellbeing Chemist', 'Remedy Pharmacy', 'Family Chemist', 'Nature\'s Pantry', 'The Herbalist'] },
  cinema: { n: ['The Bijou Picture House', 'The Starlight', 'The Lyric Cinema', 'Roxy Cinema'] },
  bookie: { n: ['Turf Accountants', 'Lucky Horseshoe Bets', 'Fairplay Bookmakers', 'Odds On', 'Silver Spur Betting', 'Photo Finish Bets', 'Winning Post', 'Golden Arcade', 'Lucky Sevens Arcade'] },
  estate: { n: ['Hanbury & Lowe', 'Quarter & Key', 'Harcastle Homes', 'Spire Lettings', 'Merrow & Finch', 'Brook & Bishop Estates'] },
  phone: { n: ['Phone Fix', 'Mobile Mend', 'Talk Shop', 'Cellular City', 'Signal Mobile', 'Fone Zone', 'Byte Repairs', 'Handset Hospital', 'Pocket Phones', 'Connect Mobile', 'The Phone Box', 'Tech Doctor', 'Gadget Garage', 'Screen Savers Repairs'] },
  grocer: { n: ['Corner Stores', 'Fresh Mart', 'Daily Needs', 'Golden Grocers', 'Ten Till Late', 'City Food & Wine', 'Thrifty Stores', 'The Larder Store', 'Quickstop', 'Village Stores', 'Spires Food & Wine', 'Late Shop', 'Market Fresh', 'Family Foods', 'Eastern Pantry', 'Oriental Food Store', 'Nonstop Foods', 'Wayside Stores', 'Cheap & Cheerful Foods', 'High Street Stores', 'Union Stores', 'Orchard Grocers', 'Value Foods', 'Pick & Go', 'The Food Hall', 'Handy Stores'] },
  news: { n: ['The Paper Shop', 'Headlines News', 'Read All About It', 'City News', 'Corner News'] },
  dept: { n: ['Haddon & Pryce', 'Barnaby\'s', 'Ashworth\'s', 'Ludgate & Co', 'Cavendish & Webb'] },
  clothes: { a: ['Hartley', 'Aldous', 'Mallory', 'Ashby', 'Rowan', 'Thistle', 'Linden', 'Hollis', 'Marlow', 'Ellery', 'Pemberton', 'Selwyn', 'Garnet', 'Corbin', 'Elstow', 'Haverford'], b: ['& Co', 'Clothing', 'Outfitters', 'Menswear', 'Boutique', 'Tailoring', 'Fashion', '& Daughters'] },
  shoes: { n: ['Footnote Shoes', 'Heel & Toe', 'Cobble Shoes', 'Stride', 'Lace & Last', 'Sole Mates', 'Step Ahead Shoes', 'The Boot Room', 'Brogue & Co', 'Tread Lightly'] },
  jeweller: { n: ['Garnet & Gold', 'Kemble Jewellers', 'The Silver Thread', 'Hallmark & Sons', 'Aurum Jewellers', 'Carat Jewellers', 'Locket', 'Jasper & Pearl', 'Ashworth & Daughter Jewellers', 'Facets'] },
  optician: { n: ['Clearview Opticians', 'Focus Eyecare', 'Lens & Frame', 'Spectacle Makers', 'Brightside Opticians', 'Sightlines', 'Visage Optical'] },
  books: { n: ['Paper & Ink Books', 'Quire Books', 'The Second Folio', 'Leaf & Spine', 'Spine Booksellers', 'The Bookworm', 'Colophon Books', 'Endpaper Books', 'Dogear Books', 'Octavo Books', 'Margins Bookshop'] },
  stationer: { n: ['Nib & Ink', 'Paper Trail', 'The Print Room', 'Pencil Case', 'Copy & Print Shop', 'Quillon Stationers'] },
  bakery: { n: ['Daily Bread Bakery', 'Rise & Shine Bakery', 'The Crumb', 'Sheaf & Sickle Bakehouse', 'Flour & Water', 'Golden Crust', 'The Bread Basket', 'Proof Bakery', 'Rolling Pin Patisserie', 'Butter & Crumb'] },
  deli: { n: ['The Little Deli', 'The Cheese Board', 'Larder & Co', 'Olive & Vine Deli', 'The Pantry Deli', 'Saltbox Delicatessen', 'Fine Fare Deli', 'The Butcher\'s Block', 'Rind & Rye'] },
  hair: { a: ['Sharp', 'Clipper', 'Fringe', 'Snips', 'Mane', 'Crown', 'Razor', 'Strand', 'Lather', 'Curl', 'Comb', 'Blade', 'Trim', 'Shear', 'Tease'], b: ['Barbers', 'Hair Studio', 'Cuts', 'Salon', 'Hair & Beauty', 'Gents'] },
  beauty: { n: ['Glow Beauty', 'Polished Nails', 'Brow & Lash', 'Serenity Spa', 'Pure Skin Clinic', 'Lotus Nails', 'Velvet Beauty', 'Bloom Beauty Bar', 'The Nail Room', 'Radiance', 'Petal Nails', 'Silk & Satin', 'Blossom Beauty', 'The Soap Kitchen', 'Body Balm', 'Fragrance House', 'Ink & Needle Studio', 'Calm Massage', 'Perfect Ten Nails', 'Pamper Room', 'Scents & Sensibility', 'Bath & Bubble'] },
  charity: { n: ['Helping Hands', 'Second Chance Charity Shop', 'The Hospice Shop', 'Heart & Home Charity Shop', 'Kind Hearts', 'Children First Charity Shop', 'Hope Shop', 'Good Turn Charity Shop'] },
  gifts: { n: ['Spires Souvenirs', 'Dreaming Spires Gifts', 'The Gift Box', 'Treasure Trove', 'Postcards & Presents', 'Gown & Mortar Gifts', 'Varsity Keepsakes', 'Memento', 'Curiosity Shop', 'Pomp & Pageantry', 'Bits & Bobs', 'The Trinket Box', 'Three Spires Gifts', 'Bargain Bazaar', 'Tea Towel & Tankard', 'Quad Gifts', 'Spires & Gowns'] },
  travel: { n: ['Faraway Travel', 'Globetrotter Travel', 'Far Horizons Travel', 'Wanderlust Travel', 'Bus & Coach Travel Shop'] },
  wine: { n: ['Corner Cellar', 'The Wine Rack', 'Vine & Barrel', 'Cask & Cork', 'The Bottle Shop'] },
  cycles: { n: ['Spoke & Chain', 'Wheel Works', 'Freewheel Cycles', 'Gearbox Bikes'] },
  garage: { n: ['Station Garage', 'Northside Motors', 'Ace Autos', 'Ox Motors'] },
  gym: { n: ['Iron Works Gym', 'The Fitness Rooms', 'Lotus Yoga Studio', 'Peak Fitness'] },
  dentist: { n: ['Bright Smile Dental', 'Spires Dental Practice', 'Molar & Co Dental', 'Gentle Dental', 'The Tooth Fairy Dental Studio', 'Smile Studio', 'Pearl Dental', 'Enamel Dental Care', 'Floss & Gloss Dental', 'Crown Dental'] },
  vet: { n: ['Paws & Claws Vets', 'Ark Veterinary', 'Whiskers Vets'] },
  shop: { n: ['General Stores', 'Hardware & Keys', 'Picture Framing', 'Print & Copy', 'Cards & Gifts', 'The Bargain Shop', 'Pots & Pans', 'The Toy Cupboard', 'Games & Puzzles', 'Ironmongers', 'Fabric & Wool', 'The Tobacconist', 'Art & Frame', 'The Craft Box', 'Keys & Heels', 'The Camera Shop', 'Snapshot Photo', 'Lamp & Shade', 'Bed & Bath', 'Kitchen & Home', 'The Gallery Shop', 'Crystal Cave', 'Prints & Maps', 'Sew Good', 'Locker Point', 'Puzzle Room Escapes', 'Photo Booth', 'Antiques & Curios', 'The Music Box', 'Garden & Pot', 'Patch & Mend', 'The Junk Shop', 'Old Curiosities', 'Strings & Things', 'Pianos & Organs', 'Carpet & Rug', 'Trade Counter', 'The Pine Shop', 'Hats & Gowns', 'The Model Shop', 'Tick Tock Clocks', 'Rocking Horse Toys', 'Cut & Key', 'Laundrette', 'The Card Shop', 'Hobby Corner', 'Cloth & Thread', 'Odds & Ends', 'The Pen Shop', 'Silver Lining Antiques'] },
};

// well-known UK / international chains and marks (lower-case, normalised as norm() does) — the audit's list too
export const CHAINS = ['kfc', 'kentucky fried', 'mcdonald', 'burger king', 'subway', 'domino', 'pizza hut', 'papa john', 'nando', 'greggs', 'pret a manger', 'pret', 'costa', 'starbucks', 'caffe nero', 'cafe nero', 'wagamama', 'pizza express', 'pizzaexpress', 'zizzi', 'prezzo', 'byron', 'gourmet burger kitchen', 'five guys', 'shake shack', 'leon', 'itsu', 'wasabi', 'yo sushi', 'tesco', 'sainsbury', 'clubcard', 'nectar card', 'asda', 'morrisons', 'waitrose', 'marks and spencer', 'm and s', 'co-op', 'co op', 'cooperative', 'lidl', 'aldi', 'iceland', 'londis', 'spar', 'budgens', 'nisa', 'boots', 'superdrug', 'whsmith', 'wh smith', 'waterstones', 'blackwell', 'hmv', 'primark', 'h and m', 'zara', 'gap', 'tk maxx', 'john lewis', 'debenhams', 'house of fraser', 'lush', 'the body shop', 'specsavers', 'vision express', 'barclays', 'hsbc', 'lloyds', 'natwest', 'santander', 'halifax', 'nationwide', 'tsb', 'metro bank', 'coventry building society', 'bank of ireland', 'ladbrokes', 'william hill', 'coral', 'betfred', 'paddy power', 'vodafone', 'o2', 'carphone warehouse', 'phones 4u', 't-mobile', 'premier inn', 'travelodge', 'holiday inn', 'mercure', 'malmaison', 'ibis', 'hilton', 'marriott', 'randolph', 'odeon', 'vue', 'cineworld', 'curzon', 'picturehouse', 'wetherspoon', 'greene king', 'fuller', 'slug and lettuce', 'all bar one', 'be at one', 'revolution', 'walkabout', 'yates', 'oxfam', 'british heart foundation', 'cancer research', 'barnardo', 'age uk', 'sue ryder', 'timpson', 'clarks', 'schuh', 'ryman', 'paperchase', 'hotel chocolat', 'thorntons', 'holland and barrett', 'pandora', 'swarovski', 'goldsmiths', 'ernest jones', 'h samuel', 'beaverbrooks', 'accessorize', 'monsoon', 'fat face', 'white stuff', 'jigsaw', 'reiss', 'gant', 'hobbs', 'whistles', 'anthropologie', 'the white company', 'apple store', 'lego', 'toys r us', 'warhammer', 'games workshop', 'cex', 'flying tiger', 'robert dyas', 'wilko', 'poundland', 'ann summers', 'snappy snaps', 'trailfinders', 'tui', 'thomas cook', 'sta travel', 'stagecoach', 'oxford bus company', 'megabus', 'national express', 'first great western', 'great western railway', 'chiltern railways', 'crosscountry', 'thames travel', 'oxford tube', 'puregym', 'pure gym', 'gail', 'ole and steen', 'bill\'s', 'jamie\'s italian', 'carluccio', 'cote brasserie', 'las iguanas', 'turtle bay', 'wahaca', 'honest burgers', 'mission burrito', 'chipotle', 'tortilla', 'benugo', 'patisserie valerie', 'krispy kreme', 'ben\'s cookies', 'millie\'s cookies', 'haagen-dazs', 'amorino', 'morley', 'chicken cottage', 'dixy', 'medivet', 'bupa', 'sephora', 'rituals', 'l\'occitane', 'jo malone', 'neal\'s yard', 'the perfume shop', 'the fragrance shop', 'skechers', 'office shoes', 'russell and bromley', 'ecco', 'sunglass hut', 'david clulow', 'smiggle', 'whittard', 'bird and blend', 'miniso', 'pop mart', 'procook', 'and so to bed', 'london camera exchange', 'ede and ravenscroft', 'shepherd and woodward', 'george and danver', 'the varsity shop', 'kebab king', 'slug & lettuce', 'purple turtle', 'eagle and child', 'turf tavern', 'lamb and flag', 'jericho tavern', 'king\'s arms', 'kings arms', 'old tom', 'the bear inn', 'the trout', 'the perch', 'the mitre', 'the chequers', 'the bulldog', 'white horse', 'the wheatsheaf', 'the grapes', 'the royal oak', 'the red lion', 'the anchor', 'the victoria', 'the lighthouse', 'the porterhouse', 'the oxford blue', 'the rickety press', 'royal blenheim', 'three goats heads', 'rose and crown', 'gardeners arms', 'harcourt arms', 'the four candles', 'the swan and castle', 'the oxford retreat', 'duke of cambridge', 'the mad hatter', 'kazbar', 'raoul\'s', 'the old bookbinders', 'the punter', 'the isis farmhouse', 'the fishes', 'the cape of good hope', 'the half moon', 'the big society', 'the magdalen arms', 'the rusty bicycle', 'the cricketers arms', 'the angel and greyhound', 'the white rabbit', 'the bookbinders', 'the jolly farmers', 'the old black horse', 'the port mahon', 'the city arms', 'the james street tavern', 'o2 academy', 'plush', 'the turf', 'the varsity club', 'quod', 'browns', 'brown\'s', 'gee\'s', 'the ivy', 'the cherwell boathouse', 'pierre victoire', 'branca', 'al-shami', 'edamame', 'g and d', 'moo-moo', 'hassan', 'najar', 'vaults and garden', 'the grand cafe', 'queen\'s lane coffee house', 'knoops'];

export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/₂/g, '2').replace(/&/g, ' and ').replace(/[’']/g, '\'').replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim();
const normCore = (s) => norm(s).replace(/^the /, '').replace(/'/g, '').trim();
// chain names as whole words (so "Gap" does not catch "Singapore", nor "Coral" "Coralie")
const CHAIN_RE = CHAINS.map((c) => new RegExp('(^|[^a-z0-9])' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)'));
/** does the name contain a well-known chain / mark (whole words, normalised)? -> the chain or null */
export function chainIn(name) { const s = norm(name); for (let i = 0; i < CHAINS.length; i++) if (CHAIN_RE[i].test(s)) return CHAINS[i]; return null; }

// invented surnames for the "<Surname> <trade>" names every pool falls back on (and the odd-trade shops use)
const SURNAMES = ['Ashcombe', 'Bramwell', 'Cotterill', 'Dunmore', 'Elphick', 'Fairley', 'Gostelow', 'Harwood', 'Ingham', 'Kimber', 'Lyndhurst', 'Merriman', 'Norbury', 'Oakden', 'Pargeter', 'Quennell', 'Tapsell', 'Underhill', 'Wareham', 'Abbot', 'Chalcroft', 'Edgworth', 'Fennimore', 'Gadsby', 'Hobday', 'Ivens', 'Loveday', 'Pinnock', 'Swaffield', 'Tuckwell', 'Upcott', 'Wilmot', 'Belgrove', 'Crake', 'Dorley', 'Ebbutt', 'Fawdry', 'Greenhalgh', 'Hollyer', 'Lidstone'];
// the trade word(s) of each group, for those names
const WORD = {
  pub: ['Arms'], bar: ['Bar'], club: ['Club'], cafe: ['Café', 'Tea Rooms'], sweet: ['Sweets', 'Confectioners'], hotel: ['House Hotel', 'Guest House', 'Lodge'], bank: ['Bank', 'Savings Bank'],
  exchange: ['Bureau de Change'], chemist: ['Chemist', 'Pharmacy'], cinema: ['Picture House'], bookie: ['Bookmakers', 'Turf Accountants'], estate: ['Estate Agents', 'Lettings'],
  phone: ['Mobile', 'Phone Repairs'], grocer: ['Stores', 'Food & Wine', 'Mini Market'], news: ['News', 'Newsagents'], dept: ['& Co'], clothes: ['Clothing', 'Outfitters'], shoes: ['Shoes'],
  jeweller: ['Jewellers'], optician: ['Opticians'], books: ['Books', 'Booksellers'], stationer: ['Stationers'], bakery: ['Bakery', 'Bakers'], deli: ['Delicatessen', 'Fine Foods'], hair: ['Hair', 'Barbers'],
  beauty: ['Beauty', 'Nails & Beauty', 'Skincare'], charity: ['Trust Charity Shop'], gifts: ['Gifts', 'Souvenirs'], travel: ['Travel'], wine: ['Wines'], cycles: ['Cycles'], garage: ['Motors'],
  gym: ['Fitness', 'Yoga'], dentist: ['Dental Practice'], vet: ['Veterinary Surgery'], shop: ['& Co', 'Stores'],
  r_indian: ['Tandoori'], r_chinese: ['Chinese Restaurant'], r_japanese: ['Sushi'], r_thai: ['Thai Kitchen'], r_italian: ['Trattoria'], r_mezze: ['Mezze'], r_grill: ['Grill'], r_british: ['Kitchen', 'Bistro', 'Dining Rooms'],
  r_tapas: ['Tapas'], r_mexican: ['Cantina'], r_caribbean: ['Kitchen'], ff_chicken: ['Fried Chicken'], ff_burger: ['Burgers'], ff_pizza: ['Pizza'], ff_kebab: ['Kebabs'], ff_chinese: ['Takeaway'],
  ff_sushi: ['Sushi Bar'], ff_curry: ['Curry House'], ff_mexican: ['Burritos'], ff_chips: ['Fish Bar'], ff_sandwich: ['Sandwiches'],
};
// the odd trades (group "shop:<type>"): what goes after the surname
const SHOP_WORD = {
  art: 'Fine Art', craft: 'Crafts', musical_instrument: 'Music', music: 'Records', toys: 'Toys', games: 'Games', video_games: 'Games', antiques: 'Antiques', hardware: 'Hardware', doityourself: 'Hardware',
  houseware: 'Home', furniture: 'Furniture', bed: 'Beds', interior_decoration: 'Interiors', erotic: 'Gifts', locksmith: 'Keys & Locks', dry_cleaning: 'Dry Cleaners', laundry: 'Launderette',
  tailor: 'Tailors', fabric: 'Fabrics', camera: 'Cameras', photo: 'Photo', tobacco: 'Tobacconist', psychic: 'Crystals', garden_centre: 'Garden Centre', trade: 'Fruiterers', florist: 'Flowers',
  'e-cigarette': 'Vapour', yes: 'Fair Trade', outdoor: 'Outdoors', sports: 'Sports', bag: 'Bags', leather: 'Leather', hifi: 'Hi-Fi', frame: 'Framing', pawnbroker: 'Pawnbrokers', money_lender: 'Loans',
  car_parts: 'Motor Spares', kitchen: 'Kitchens', escape_game: 'Escape Rooms', photo_booth: 'Photo Booth', parcel_locker: 'Parcel Lockers', pet: 'Pets', mall: 'Arcade', variety_store: 'Bargains',
};
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const poolCache = new Map();
function pool(group) {
  let L = poolCache.get(group); if (L) return L;
  const sub = group.startsWith('shop:') ? group.slice(5) : null;
  const p = sub ? {} : P[group] || P.shop; L = [...(p.n || [])];
  const scatter = (list) => list.sort((x, y) => hash(group + x) - hash(group + y));
  // parts combined, in a fixed scattered order (so neighbours in the list do not share their first word)
  if (p.a) { const combos = []; for (const a of p.a) for (const b of p.b) combos.push(`${a} ${b}`); L.push(...scatter(combos)); }
  // then "<Surname> <trade>" (the only names of an odd trade): never runs out
  const words = sub ? [SHOP_WORD[sub] || '& Co'] : WORD[group] || WORD.shop, more = [];
  for (const sn of SURNAMES) for (const w of words) more.push(w.startsWith('&') ? `${sn} ${w}` : sub || group === 'pub' ? `${sn} ${w}` : `${sn}'s ${w}`.replace(/'s (House Hotel|Guest House|Lodge|Arms)/, ' $1'));
  if (group === 'pub') for (let k = 0; k < more.length; k++) more[k] = 'The ' + more[k];
  L = { main: L, extra: scatter(more) };
  poolCache.set(group, L);
  return L;
}
/** every name a pool can give (for the audit / tests) */
export function poolNames() { const out = new Map(); for (const g of Object.keys(P)) out.set(g, [...pool(g).main, ...pool(g).extra]); return out; }

/** the group a premises' name is drawn from (kind 'shop' = an odd trade: 'shop:<type>') */
export function tradeGroup(kind, cuisine, sub) {
  if (kind === 'restaurant' || kind === 'fast_food') return cuisineGroup(kind, cuisine);
  if (kind === 'shop') return 'shop:' + (sub || 'other');
  return kind;
}

/** names the hand-built places already use (their invented names win, so nobody else gets one) */
function placeNames(map) {
  const out = new Set(['the bastion']);
  for (const d of Object.values(DISTRICT_NAMES)) for (const list of Object.values(d)) for (const n of list) out.add(normCore(n));
  for (const k of ['_eoRenamed', '_jerRenamed']) for (const r of (map && map[k]) || []) out.add(normCore(r.to));
  return out;
}

/** a premises' map element: building or POI, with its business group, or null */
function premises(o, isPoi) {
  const name = isPoi ? o.name : o.tags && o.tags.name;
  if (!name || (!isPoi && o.part)) return null;
  const kind = isPoi ? tradeKind(null, o.kind) : tradeKind(o.tags);
  if (!kind) return null;
  if (KEEP_NAME.test(name) && !chainIn(name)) return null;
  const cuisine = isPoi ? o.cuisine : o.tags.cuisine;
  const k0 = isPoi ? o.kind : o.tags.amenity || '', sub = isPoi ? o.kind.replace(/^shop:/, '') : o.tags.shop || o.tags.amenity;
  return { o, isPoi, name, kind, x: isPoi ? o.p[0] : o.c[0], z: isPoi ? o.p[1] : o.c[1], group: tradeGroup(k0 === 'restaurant' || k0 === 'fast_food' ? k0 : kind, cuisine, sub) };
}

/** every business premises the map names (no change to the map): [{ id, name, kind, group, poi }] — for the audit */
export function tradePremises(map) {
  const out = [];
  for (const b of map.buildings || []) { const it = premises(b, false); if (it) out.push({ id: b.id, name: it.name, kind: it.kind, group: it.group, poi: false }); }
  for (const p of map.pois || []) { const it = premises(p, true); if (it) out.push({ id: p.id, name: it.name, kind: it.kind, group: it.group, poi: true }); }
  return out;
}
export { normCore };

/** note the map's raw business names (before any preMap renames some): systems/tradenames.js preMap */
export function noteRawNames(map) {
  if (!map || map._rawTrade) return;
  const raw = new Map();
  for (const b of map.buildings || []) if (b.tags && b.tags.name) raw.set(b.id, b.tags.name);
  for (const p of map.pois || []) if (p.name) raw.set(p.id, p.name);
  Object.defineProperty(map, '_rawTrade', { value: raw, enumerable: false });
}

/**
 * Replace every real business name in `map` with an invented one (idempotent: a second call does nothing).
 * -> [{ id, kind, group, from, to }] (also kept on map._tradeNames, non-enumerable)
 */
export function applyTradeNames(map) {
  if (!map || map._tradeNames) return (map && map._tradeNames) || [];
  const raw = map._rawTrade || null;
  const already = new Set([...((map._eoRenamed || []).map((r) => r.id)), ...((map._jerRenamed || []).map((r) => r.id))]);
  const items = [];
  for (const b of map.buildings || []) { const it = premises(b, false); if (it) items.push(it); }
  for (const p of map.pois || []) { const it = premises(p, true); if (it) items.push(it); }
  items.sort((a, b) => (a.o.id < b.o.id ? -1 : a.o.id > b.o.id ? 1 : 0));
  // never hand out a real name from the map (any element, any kind), a chain's or a hand-built place's
  const banned = new Set();
  for (const b of map.buildings || []) if (b.tags && b.tags.name) banned.add(normCore(b.tags.name));
  for (const p of map.pois || []) if (p.name) banned.add(normCore(p.name));
  if (raw) for (const n of raw.values()) banned.add(normCore(n));
  const used = placeNames(map);
  const out = [], byName = new Map();
  const pick = (group, seed) => {
    const { main, extra } = pool(group), h = hash(seed);
    // the curated names first (from a hashed start), "<Surname> <trade>" once they are all taken
    for (const L of [main, extra]) for (let k = 0; k < L.length; k++) { const n = L[(h + k) % L.length], c = normCore(n); if (!used.has(c) && !banned.has(c) && !chainIn(n)) { used.add(c); return n; } }
    for (let i = 2; ; i++) { const n = `${extra[h % extra.length]} ${i}`; if (!used.has(normCore(n))) { used.add(normCore(n)); return n; } }   // (never: 40+ surname names per group)
  };
  // one name, one invented name: a building and a POI in it under the same name keep sharing it (the world draws one
  // sign), and a chain's branches share one invented chain name (so the sign atlas holds as many names as before)
  for (const it of items) {
    const rawName = raw && raw.get(it.o.id);
    // renamed by a hand-built place's preMap (its name differs from the raw map's), or by a district pass: theirs wins
    if ((rawName && rawName !== it.name) || already.has(it.o.id)) { used.add(normCore(it.name)); continue; }
    const from = it.name;
    let to = byName.get(from);
    if (!to) { to = pick(it.group, it.o.id); byName.set(from, to); }
    if (it.isPoi) { it.o.name = to; for (const k of ['brand', 'operator', 'brand:wikidata', 'operator:wikidata']) delete it.o[k]; }
    else {
      // the map's own name and operator stay readable (not enumerable) for the world's style heuristics only (a
      // "Lodge" or "House" in an invented name must not change how a building is drawn): world/buildings.js
      const t = it.o.tags;
      if (!('osmName' in t)) Object.defineProperty(t, 'osmName', { value: from, enumerable: false, configurable: true });
      if (t.operator && !('osmOperator' in t)) Object.defineProperty(t, 'osmOperator', { value: t.operator, enumerable: false, configurable: true });
      t.name = to; for (const k of ['brand', 'operator', 'brand:wikidata', 'operator:wikidata', 'brand:wikipedia', 'operator:wikipedia', 'old_name', 'alt_name']) delete t[k]; }
    out.push({ id: it.o.id, kind: it.kind, group: it.group, from, to });
  }
  Object.defineProperty(map, '_tradeNames', { value: out, enumerable: false });
  return out;
}
