// Invented business names for the Cowley Road (places/cowley_road.js) and Walton Street / Jericho (places/jericho.js)
// passes. Pure (no DOM, no three.js), used by both modules' preMap and by tools/smoke_east.mjs.
//
// The map is OpenStreetMap as surveyed in 2026, with real (and many post-2013) shop, café, pub and chain names that the
// world draws as fascia lettering. In these two districts every BUSINESS name is replaced, in preMap, by an invented one
// of the same kind (and its `brand` / `operator` tags dropped), so no real business or brand is shown. Places of worship,
// schools, college buildings, community centres, libraries, street names and bus stops keep their names. Nothing else
// about the map changes (same elements, same ids, same positions).
//
// Real names are the default (core/features.js): callers pass { keep: true } unless ?invented=1, and the businesses are
// listed (to === from) without renaming — the districts still dress every shop on that list.
//
// The names are made up in the spirit of the streets (independent grocers, takeaways, cafés from everywhere, charity
// shops, pubs with old trade names) — any match with a real business is accidental.

export const BUSINESS = /^(pub|bar|cafe|restaurant|fast_food|nightclub|pharmacy|cinema|ice_cream|hookah_lounge)$|^shop:/;
const ALIAS = { ice_cream: 'cafe', hookah_lounge: 'bar', 'shop:coffee': 'cafe', 'shop:tea': 'cafe', 'shop:barber': 'shop:hairdresser', 'shop:greengrocer': 'shop:convenience', 'shop:supermarket': 'shop:convenience', 'shop:wine': 'shop:alcohol', 'shop:second_hand': 'shop:charity' };
const KEEP_AMENITY = /^(place_of_worship|school|university|college|library|community_centre|bus_station|townhall|hospital|doctors|kindergarten|childcare|arts_centre|theatre|police|fire_station|post_office|toilets|training_and_support_centre)$/;

export const NAMES = {
  east: {
    cafe: ['The Copper Kettle', 'Steam & Crumb', 'Café Tamarind', 'The Green Cup', 'Little Teapot', 'Morning Glory Café', 'The Bicycle Café', 'Beans & Bagels', 'Café Anatolia', 'The Reading Room Café'],
    restaurant: ['Spice Lantern', 'Golden Lotus', 'Casa Lucia', 'Silk Road Kitchen', 'Saffron House', 'Little Lisbon', 'Bamboo Garden', 'The Olive Tree', 'Taste of Kerala', 'Habesha Table', 'Mezze Garden', 'Pho Corner', 'Tbilisi Table', 'Dhaka Nights', 'La Piccola Cucina', 'Sichuan Pepper', 'The Jollof Pot', 'Kathmandu Kitchen', 'Bombay Brasserie Cowley', 'Damascus Rose'],
    fast_food: ['Night Owl Kebabs', 'Golden Fry', 'Chick Inn', 'Pizza Napoli Express', 'The Chip Shop', 'Kebab Corner', 'Burger Shack', 'Falafel House', 'Peri Peri Grill House', 'Noodle Box', 'Oven Door Pizza', 'Late Bite'],
    pub: ['The Weavers Arms', 'The Brickmakers Arms', 'The Old Bell', 'The Plough & Harrow', 'The Wheatsheaf', 'The Boatman', 'The Hop Pole', 'The Coach & Horses', 'The Duke of Cowley'],
    bar: ['Velvet Lounge', 'The Back Room', 'Juniper Bar', 'Moonshine Bar', 'Blue Note Bar', 'The Cellar Bar'],
    nightclub: ['The East Ballroom', 'The Basement'],
    cinema: ['The Empress'],
    pharmacy: ['Green Cross Chemist', 'Cowley Dispensary'],
    'shop:convenience': ['Cowley Food & Wine', 'Corner Stores', 'Fresh Mart', 'Al-Noor Supermarket', 'Golden Grocers', 'Krakow Deli & Grocer', 'Daily Needs', 'Asia Food Centre', 'Mediterranean Market', 'Bismillah Stores', 'Eastern Spice Grocers', 'Ten Till Late'],
    'shop:hairdresser': ['Clippers', 'Sharp Cuts', 'The Barber Shop', 'Kut Above', 'Hair by Design', 'Fade Masters', 'Curl Up & Dye', 'Mane Street'],
    'shop:beauty': ['Glow Beauty', 'Nail Studio', 'Brow Bar'],
    'shop:charity': ['Second Chance Charity Shop', 'Helping Hands', 'The Hospice Shop'],
    'shop:bicycle': ['Cowley Cycle Works'],
    'shop:music': ['Slow Spin Records'],
    'shop:musical_instrument': ['Strings & Things', 'The Piano Room'],
    'shop:bakery': ['Daily Bread Bakery', 'Sweet Crumbs'],
    'shop:pastry': ['Sweet Crumbs'],
    'shop:deli': ['The Little Deli', 'Casa Delicatessen'],
    'shop:butcher': ['Family Halal Butchers'],
    'shop:alcohol': ['Corner Cellar'],
    'shop:mobile_phone': ['Phone Fix', 'Mobile Mend'],
    'shop:computer': ['Byte Repairs', 'Laptop Doctor'],
    'shop:estate_agent': ['Cowley Homes', 'East Side Lettings', 'Terrace & Co'],
    'shop:clothes': ['Thread & Co', 'Bazaar Fashions', 'Vintage Attic'],
    'shop:dry_cleaning': ['Press & Clean'],
    'shop:laundry': ['Bubbles Launderette'],
    'shop:e-cigarette': ['Cloud Nine Vapes'],
    'shop:massage': ['Balance Therapies'],
    'shop:health_food': ['Wholesome Wholefoods'],
    'shop:furniture': ['Second Home Furniture'],
    'shop:jewelry': ['Golden Hands Jewellers'],
    'shop:kitchen': ['Kitchen Corner'],
    'shop:erotic': ['Gifts & Cards'],
    'shop:tattoo': ['Ink & Needle Studio'], 'shop:bookmaker': ['Turf Accountants'], 'shop:confectionery': ['The Sweet Jar'], 'shop:pawnbroker': ['Cash & Gold'],
    'shop:video_games': ['Game Exchange'], 'shop:houseware': ['Pots & Pans', 'Home & Hardware'], 'shop:florist': ['Petals'], 'shop:travel_agency': ['Faraway Travel'], 'shop:money_lender': ['Cash & Gold'],
    other: ['General Stores', 'Hardware & Keys', 'Fabrics & Saris', 'Picture Framing', 'Print & Copy', 'Cards & Gifts', 'The Bargain Shop', 'Pots & Pans'],
  },
  jericho: {
    cafe: ['The Lock Keeper Café', 'Inkwell Coffee', 'The Canal Café', 'Bookbinders Café', 'Little Jericho Coffee'],
    restaurant: ['Trattoria Ponte', 'The Lantern House', 'Bistro du Canal', 'Thai Orchid', 'The Hidden Table', 'Mezze & More', 'Sakura', 'Olivetti', 'The Printers Kitchen', 'Café Rouge et Noir'],
    fast_food: ['The Burger Press', 'Walton Fish Bar', 'Slice of Jericho'],
    pub: ['The Printers Arms', 'The Brickmakers', 'The Kingfisher', 'The Narrowboat', 'The Old Type Foundry', 'The Lock & Key'],
    bar: ['The Ink Bar', 'Galley Bar', 'The Reading Lounge', 'Wine Press'],
    cinema: ['The Walton Cinema'],
    pharmacy: ['Walton Street Chemist'],
    'shop:convenience': ['Walton Street Stores', 'Jericho Food & Wine'],
    'shop:bicycle': ['Canal Cycles'],
    'shop:books': ['Paper & Ink Books', 'The Second Folio'],
    'shop:stationery': ['Walton Pens & Paper'],
    'shop:charity': ['Helping Hands'],
    'shop:deli': ['The Jericho Larder'],
    'shop:bakery': ['Daily Bread Bakery'],
    'shop:hairdresser': ['The Jericho Barber', 'Hair on Walton'],
    'shop:clothes': ['Thread & Needle', 'The Linen Press'],
    'shop:cheese': ['The Cheese Board'],
    'shop:health_food': ['Honey & Oats'],
    'shop:music': ['Riverside Records'],
    other: ['Picture Framing', 'Cards & Gifts', 'The Gift Box', 'Gallery 54', 'Hardware & Keys', 'Antiques & Curios'],
  },
};

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const distSeg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1; let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
/** distance from (x, z) to the nearest polyline of the given roads */
export function nearRoads(roads) { return (x, z) => { let d = Infinity; for (const r of roads) for (let i = 0; i < r.pts.length - 1; i++) d = Math.min(d, distSeg(x, z, r.pts[i], r.pts[i + 1])); return d; }; }

/** the kind of a building or POI as a business (or null) */
export function businessKind(tags, poiKind) {
  if (poiKind) return BUSINESS.test(poiKind) && !KEEP_AMENITY.test(poiKind) ? poiKind : null;
  const t = tags || {};
  if (t.amenity && KEEP_AMENITY.test(t.amenity)) return null;
  if (t.shop && t.shop !== 'vacant') return 'shop:' + t.shop;
  if (t.amenity && BUSINESS.test(t.amenity)) return t.amenity;
  if (t.building === 'pub') return 'pub';
  return null;
}

/**
 * Rename every business inside `inside(x, z)` with a name from NAMES[district] (deterministic: sorted by id, a hashed
 * start in each kind's list, no name used twice while the list lasts). Mutates map buildings' / POIs' tags and names.
 * With opts.keep (the default game: real names) nothing is renamed: the same list comes back with to === from.
 * -> [{id, kind, from, to}]
 */
export function renameBusinesses(map, district, inside, fixed = {}, opts = {}) {
  const pool = NAMES[district], used = new Map(), out = [];
  const pick = (kind, id) => {
    kind = ALIAS[kind] || kind;
    const list = pool[kind] || pool[kind.replace(/^shop:.*/, 'other')] || pool.other;
    const u = used.get(list) || new Set(); used.set(list, u);
    const h = hash(district + id);
    for (let k = 0; k < list.length; k++) { const n = list[(h + k) % list.length]; if (!u.has(n)) { u.add(n); return n; } }
    return list[h % list.length];
  };
  const items = [];
  for (const n of Object.values(fixed)) for (const list of Object.values(pool)) if (list.includes(n)) { const u = used.get(list) || new Set(); u.add(n); used.set(list, u); }
  for (const b of map.buildings) { if (!b.tags || !b.tags.name || b.part) continue; const k = businessKind(b.tags); if (k && inside(b.c[0], b.c[1])) items.push({ o: b, tags: b.tags, kind: k, poi: false }); }
  for (const p of map.pois) { if (!p.name) continue; const k = businessKind(null, p.kind); if (k && inside(p.p[0], p.p[1])) items.push({ o: p, kind: k, poi: true }); }
  items.sort((a, b) => (a.o.id < b.o.id ? -1 : a.o.id > b.o.id ? 1 : 0));
  // a POI inside a building of the same business keeps the building's new name (the world skips the doubled sign)
  const byName = new Map();
  for (const it of items) {
    const from = it.poi ? it.o.name : it.tags.name;
    const key = from + '|' + it.kind.replace(/^shop:/, '');
    if (opts.keep) { out.push({ id: it.o.id, kind: it.kind, from, to: from }); continue; }
    let to = byName.get(key); if (!to) { to = fixed[from] || pick(it.kind, it.o.id); byName.set(key, to); }
    if (it.poi) { it.o.name = to; delete it.o.brand; delete it.o.operator; }
    else { it.tags.name = to; delete it.tags.brand; delete it.tags.operator; delete it.tags['brand:wikidata']; }
    out.push({ id: it.o.id, kind: it.kind, from, to });
  }
  return out;
}
