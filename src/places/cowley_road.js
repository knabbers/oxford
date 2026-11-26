// Cowley Road and East Oxford, c. 2013 — the character pass (see docs/research/east_oxford_jericho.md: sources, known
// vs guessed). places/east_oxford.js keeps the Victoria Fountain, the venue paints, the five gable murals, the kebab van
// and the takeaway queues; this module adds:
//
//   preMap   every business on and just off the Cowley Road is listed (for the shop dressing) under its real name, or
//            under ?invented=1 gets an invented name of its kind (_eo_names.js); the mosque on Manzil Way is skipped (rebuilt here); the church of
//            St Mary and St John restyled in stone with a tile roof
//   install  (all in the shared batch-4 atlas draw, _b4_kit.js: one draw call for every batch-4 site and both districts)
//            · the Ultimate Picture Palace ("The Empress" under ?invented=1) cinema front in Jeune Street: white render, stepped parapet, a small tower with the name
//              between rows of bulbs, the canopy and its lit "now showing" board
//            · the O2 Academy ("The East Ballroom" under ?invented=1) music venue front: black front, big fascia, lit gig board under a canopy
//            · the community arts centre's mural and lettering, a second mural on the record shop's side wall
//            · the mosque (polychrome brick, central dome, minaret, corner turrets) and the church tower: skyline markers,
//              drawn out to 1.5 km
//            · the shop parade: painted roller shutters after closing time, grocers' fruit and veg stalls, A-boards and
//              striped awnings by day; bike stands with bikes at the cinema, the venue, the arts centre, the record shop
//            · Truck Store ("Slow Spin Records" under ?invented=1), a walk-in record shop (_eo_records.js): flick through the crates, buy a record
//   sights   for the passport (game.cowleyRoad.sights)
//
// Test hooks: game.cowleyRoad = { sights, renamed, stats(), fronts, records }       tools/smoke_east.mjs
import { shared, addSite, RB } from './_b4_kit.js';
import { renameBusinesses, businessKind } from './_eo_names.js';
import { mergeFaces, buildingById, buildingAt, streetFaces, roadDist, centroid, faces } from './_eo_kit.js';
import { methodistFront, METHODIST, cinemaFront, venueFront, artsFront, muralOn, recordsSign, mosque, MOSQUE, churchTower, CHURCH, shopDress, bikeRow } from './_eo_build.js';
import { buildRecords, RECORDS, CLERK, PRICE, riff, recPlanSpec } from './_eo_records.js';
import { planWalkin, streetDoor, hoursOpen, roomCrowd } from './_walkin_city.js';
import { nearSet, QUEUE_LINES } from './_b4_life.js';
import { randomLook } from '../core/characters.js';
import { tn, inventedNames } from '../core/features.js';
import { EASTPASS } from '../world/terrain.js';
import { dayOf } from '../core/time.js';

export const ROADS = ['Cowley Road', 'The Plain'];
// c. 2013 names for premises the 2026 map shows under a later occupier (photo comparison east, 2026-11). Real names
// only, so real mode only (under ?invented=1 the map's names are replaced wholesale anyway). S = read off a dated
// photograph of that parade (docs/research/photo_comparison_east.md), K = remembered, G = guess at which unit it was.
export const ERA_2013 = [
  ['n4196909562', tn('Fishers', 'The Olive Tree')],                        // S 2014: St Clement's (later Cuttlefish)
  ['w123932871', tn('Angel & Greyhound', 'The Weavers Arms')],             // K: the pub's name until c. 2018
  ['n6576655585', tn('The Port Mahon', 'The Hop Pole'), 'pub'],            // S 2014 for the pub; G that this is its unit
  ['n9407807852', tn("Gino's Barber Shop", 'Clippers')],                   // S 2014 (the lettering is small: G)
  ['n504752032', tn('Refresh', 'The Green Cup')],                          // S 2013
  ['n504751932', tn('Mirch Masala', 'Spice Lantern')],                     // S 2013
  ['n11298641336', tn('Coin Wash', 'Bubbles Launderette'), 'shop:laundry'],   // S 2013; G the unit
  ['n11298641337', tn('Hair Salon', 'Hair by Design'), 'shop:hairdresser'],  // S 2013; G the unit
  ['n11298641338', tn("Youssef's", 'Golden Grocers'), 'shop:convenience'],   // S 2013; G the unit
  ['n11298641348', tn('SS20', 'Thread & Co'), 'shop:clothes'],             // S 2014: the skate shop
  ['n504745335', tn('Express Pizza', 'Oven Door Pizza')],                  // S 2010
  ['n9439770844', tn('The Co-operative Food', 'Corner Stores')],           // K
  // (not the east: 22 Cornmarket Street, the walk-in pilot of places/cornmarket_shops.js — kept in this one table because
  //  tools/audit_brands.mjs reads the c. 2013 names from here)
  ['n3320076101', tn('WHSmith', 'Quire & Quill'), 'shop:stationery'],      // K: the stationer's at no. 22 until 2025
  // Cornmarket Street c. 2013 (the walk-in batch of places/cornmarket_shops.js). From the per-building pages of
  // oxfordhistory.org.uk/cornmarket (web research, 2026-11): S = the source states it for 2012-14, L = likely from the
  // years either side, G = a guess (which unit, or the year). Unchanged since 2013 and so not listed: KFC (35), Timpson
  // (39), Snappy Snaps (40), Pret A Manger (26-27 and 2), Lloyds Bank (1), HSBC (62-65).
  ['n13987621040', tn('NatWest', 'Northgate Bank'), 'bank'],      // S occupier of no. 32 (1911-2017); G that this is no. 32
  ['n13090106587', tn('Oxford Drug Company', 'Northgate Chemist'), 'shop:chemist'],      // S 2012 photo, no. 31
  ['n3321532732', tn('Pandora', 'Charm & Bead'), 'shop:jewelry'],      // S no. 33-34 (2011-2020)
  ['n3321532700', tn('The Works', 'Bargain Books'), 'shop:books'],      // S no. 36 until 2013
  ['n13395473058', tn('Pylones', 'Bright Things'), 'shop:gift'],      // S occupier of no. 30 (2011-2018); G that this is no. 30
  ['n3321533074', tn('Virgin Media', 'Cable & Line'), 'shop:mobile_phone'],      // S no. 37 (2008-2017)
  ['n8625460100', tn('Austin Reed', 'Reed & Son Outfitters'), 'shop:clothes'],      // S no. 38 (1936-2016)
  ['n2957831731', tn('Chequepoint', 'Change Point'), 'bureau_de_change'],      // S no. 28 (2011-2019)
  ['n597707582', tn('Burger King', 'Flame Grill'), 'fast_food'],      // S no. 24-25 (1990-2020)
  ['n308768763', tn('HMV', 'Top Forty Records'), 'shop:music'],      // S no. 43 (1994-2015)
  ['n3321533091', tn('HMV', 'Top Forty Records'), 'shop:music'],      // S no. 44-46 (1986-2015)
  ['n3321533064', tn('3 Store', 'Triple Mobile'), 'shop:mobile_phone'],      // L (2008 table) no. 47; G for 2013
  ['n3321532710', tn('Thorntons', 'Toffee & Truffle'), 'shop:chocolate'],      // L (2008 table) no. 48; G for 2013
  ['n3321532664', tn('Clarks', 'Cobb & Last Shoes'), 'shop:shoes'],      // L no. 49-50
  ['n10967596405', tn('Lush', 'Suds & Scent'), 'shop:cosmetics'],      // L no. 51; G for 2013
  ['n11667092323', tn('Next', 'Hereafter'), 'shop:clothes'],      // S no. 20-21 (1984-2017)
  ['n12281936765', tn('River Island', 'Isis Island'), 'shop:clothes'],      // S occupier (2011-2017); L the unit
  ['n13017355332', tn('Fat Face', 'Broad Grin'), 'shop:clothes'],      // L (2008-09, still there 2018)
  ['n13017345224', tn('Carphone Warehouse', 'The Handset Shed'), 'shop:mobile_phone'],      // L occupier; G the unit
  ['n12688536338', tn('Vodafone', 'Voxphone'), 'shop:mobile_phone'],      // S no. 11-12 (2000-c. 2015)
  ['n471723341', tn('Argenteus', 'Silver Street Jewellers'), 'shop:jewelry'],      // S occupier of no. 6; G which unit
  ['n3320076026', tn('Starbucks', 'Second Mate Coffee'), 'cafe'],      // S no. 6/7 north unit (2001-c. 2015)
  ['n10777670607', tn('West Cornwall Pasty Co', 'The Pasty Shed'), 'fast_food'],      // S occupier of no. 6; G which unit
  ['n10967522805', tn('David Clulow', 'Clear View Opticians'), 'shop:optician'],      // S no. 4 (2005-c. 2015)
  ['n3320076073', tn('Republic', 'Commonwealth Clothing'), 'shop:clothes'],      // L no. 3 into early 2013
  ['n3321532720', tn('Moss Bros', 'Fern Brothers'), 'shop:clothes'],      // S no. 59-61 (1996-2018)
  // The High and Queen Street c. 2013 (the same batch). The High: the per-building pages of oxfordhistory.org.uk/high
  // (S = stated for 2012-14, L = likely, G = guess). Queen Street: oxfordhistory.org.uk/queen_street's one table has
  // columns for 1973 / 2008 / 2021 only, so every Queen Street name is L or G but Santander's. Unchanged since 2013 and
  // not listed: Taylors, Oxford Blue (from 2013), Reginald Davis, Queen's Lane Coffee House, Olives, the Oxford Bus
  // Company shop, Sahara, Fitrite, Honey's, The Rose, Brothers, Brora, Quod, Antiques on High, The Grand Cafe, Hoyle's,
  // Pens Plus; Beaverbrooks and Vision Express on Queen Street are kept as guesses.
  ['n3320076046', tn('Jack Wills', 'Will Jackson Outfitters'), 'shop:clothes'],      // S nos 6-7 (2012-2019)
  ['n12154041256', tn('Reed Employment', 'Rush Recruitment'), 'office'],      // S no. 8 (1990-2017)
  ['n3320076024', tn('Whistles', 'Piper & Co'), 'shop:clothes'],      // S no. 9 (c. 1988-2020)
  ['n12154041254', tn('Pia', 'Pearl & Pin'), 'shop:jewelry'],      // G: Pia was at no. 16 (2007-2017); that this is no. 16 is a guess
  ['n3320076094', tn("Tim's Newsagent", 'The Paper Shop'), 'shop:newsagent'],      // S no. 17 (2002-2022)
  ['n12942179735', tn('The Mitre', 'The Crozier'), 'restaurant'],      // L no. 18
  ['n12569164285', tn('Aspire', 'Upward'), 'shop:gift'],      // S no. 21 (2007-2019); the trade is a guess
  ['n3320076080', tn('Footprints', 'Tread Lightly Shoes'), 'shop:shoes'],      // S no. 23 (2009-2014)
  ['n3320076063', tn('Links Communications', 'Chain Mobile'), 'shop:mobile_phone'],      // S no. 33 (2006-2014)
  ['n3320076089', tn('The Oxford Gallery', 'The High Gallery'), 'shop:art'],      // S nos 35-36 (2013-2018)
  ['n3320076039', tn('High Street Barbers', 'Top of the High Barbers'), 'shop:hairdresser'],      // L no. 38 (undated in the source)
  ['n3320076053', tn("Neal's Yard Remedies", 'Herb Yard Remedies'), 'shop:cosmetics'],      // S no. 56 (2001-2017)
  ['n3320076009', tn('Imperial Foreign Exchange', 'Empire Exchange'), 'bureau_de_change'],      // S nos 59-60 (2006-2017)
  ['n12669775358', tn('Coast', 'Shoreline'), 'shop:clothes'],      // S no. 138 (1998-2014)
  ['n12160443437', tn('Fellows', "Scholars' Gifts"), 'shop:gift'],      // S no. 137 (by 1996-2019)
  ['n9502199061', tn('Reiss', 'Rice & Ray'), 'shop:clothes'],      // S no. 135 (2007-2019)
  ['n12154108363', tn('Hotel Chocolat', 'Cocoa House'), 'shop:chocolate'],      // S no. 132 (2009-2020)
  ['n12942179734', tn('NatWest', 'Northgate Bank'), 'bank'],      // S nos 120-122 (c. 1953-2017)
  ['n12953854625', tn('Hobbs', "Hobson's"), 'shop:clothes'],      // S no. 115 (1997-2017)
  ['n2612902271', tn('Sweaty Betty', 'Brisk Betty'), 'shop:clothes'],      // S no. 108 (2012-2022)
  ['n3320076091', tn('University of Oxford Shop', 'The Varsity Shop'), 'shop:gift'],      // S no. 106 (1996-2021)
  ['n11203152887', tn('Meller Merceux Gallery', 'Mercer Gallery'), 'shop:art'],      // S no. 105 (2010-2016)
  ['n522986710', tn('Patisserie Valerie', 'Patisserie Hortense'), 'cafe'],      // S no. 90 (2008-2020)
  ['n3320076070', tn('Podshop', 'The Pod Stop'), 'shop:mobile_phone'],      // S nos 86-87 (2010-2016); the trade is assumed
  ['n643775481', tn('Oxford Rendezvous', 'The Meeting Place'), 'cafe'],      // S nos 67-68 (2011-2013); the trade is assumed
  ['n12647539356', tn('Accessorize', 'Bits & Bows'), 'shop:fashion_accessories'],      // L no. 28
  ['n12647539355', tn("Levi's", 'Rivet Jeans'), 'shop:clothes'],      // G no. 29 (2008 column)
  ['n3321532668', tn('Early Learning Centre', 'First Steps Toys'), 'shop:toys'],      // G no. 30 (2008 column)
  ['n3321533087', tn('Miss Selfridge', 'Miss Ridge'), 'shop:clothes'],      // L no. 33
  ['n3321532719', tn('Monsoon', 'Rainy Season'), 'shop:clothes'],      // L no. 35
  ['n3321532733', tn('Evans', 'Evanson'), 'shop:clothes'],      // L no. 36
  ['n11018524096', tn('Crabtree & Evelyn', 'Appletree & Evelyn'), 'shop:cosmetics'],      // L no. 45
  ['n1625434216', tn('BHS', 'Home & Colonial Stores'), 'shop:department_store'],      // G (BHS or Topshop; no changeover date in the source)
  ['n12405785274', tn('Topshop', 'Topdeck'), 'shop:clothes'],      // L nos 11-12
  ['n8621332581', tn('Topman', 'Topdeck Man'), 'shop:clothes'],      // L nos 11-12 (the same shop's other door)
  ['n1492515919', tn('Dorothy Perkins', 'Dorothy Parkes'), 'shop:clothes'],      // L no. 9
  ['n3321533061', tn('Optical Express', 'Swift Optical'), 'shop:optician'],      // L no. 7
  ['n12663570400', tn('Jones Bootmaker', 'Johns the Bootmaker'), 'shop:shoes'],      // L no. 6
  ['n8634455556', tn('Swarovski', 'Crystal Swan'), 'shop:jewelry'],      // L nos 3-4
  ['n13374233843', tn('Santander', 'Santiago Bank'), 'bank'],      // S no. 1 (the bank, before the work café)
];
/** apply ERA_2013 to the map's points of interest and named buildings; returns [[id, from, to]] */
export function eraNames(map) {
  const out = [], by = new Map(ERA_2013.map((e) => [e[0], e]));
  for (const p of map.pois) { const e = by.get(p.id); if (e && p.name) { out.push([p.id, p.name, e[1]]); p.name = e[1]; if (e[2]) p.kind = e[2]; delete p.brand; } }
  for (const b of map.buildings) { const e = by.get(b.id); if (e && b.tags && b.tags.name) { out.push([b.id, b.tags.name, e[1]]); b.tags.name = e[1]; delete b.tags.brand; } }
  return out;
}
export const CINEMA_H = 6.6;
export const IDS = { cinema: 'w123914353', arts: 'w218948696', records: 'w146182879', venuePoi: 'n175707022' };
/** the set pieces' names: real by default, invented under ?invented=1 (core/features.js) */
export const VENUE = tn('O2 Academy Oxford', 'The East Ballroom'), RECS = tn('Truck Store', 'Slow Spin Records'), CINEMA = tn('The Ultimate Picture Palace', 'The Empress');
export const FIXED = { 'O₂ Academy': 'The East Ballroom', Glamorous: 'The Basement', 'The Ultimate Picture Palace': 'The Empress', 'Truck Store': 'Slow Spin Records' };
/** is (x, z) part of the Cowley Road district for renaming: east of The Plain, within 45 m of the road */
export const district = (map) => { const d = roadDist(map, ROADS); return (x, z) => x > 1090 && d(x, z) < 45; };

export const sights = [
  { id: 'eo-empress', name: tn('The Ultimate Picture Palace', 'The Empress picture house'), x: 1446, z: 686, blurb: tn('A little Edwardian picture house down Jeune Street (1911), its name in lights on a tower over the door: one of the oldest independent cinemas in the country still showing films.', 'A little Edwardian picture house down Jeune Street, its name in lights on a tower over the door. (An invented name for the real old cinema here, one of the oldest in the country still showing films.)') },
  { id: 'eo-ballroom', name: VENUE, x: 1760, z: 885, blurb: 'The Cowley Road\'s big music venue: a black front, a queue round the corner on gig nights and a board that always says "+ guests".' },
  { id: 'eo-arts', name: 'East Oxford community arts', x: 1560, z: 735, blurb: 'The community centre on Princes Street, its wall a riot of painted sunrise and bicycles — Cowley Road is known for its murals and its carnival.' },
  { id: 'eo-mosque', name: 'The Central Mosque', x: 2010, z: 800, blurb: 'The mosque on Manzil Way (opened 2005): red, blue and buff brick, a green dome and a minaret seen over the roofs of the terraces.' },
  { id: 'eo-church', name: 'St Mary and St John', x: 1972, z: 1060, blurb: 'The big Victorian church on the Cowley Road (1875-83). Its tower was built in 1892-93 to carry a spire that was never added.' },
  { id: 'eo-records', name: RECS, x: 1500, z: 724, blurb: 'A record shop with crates down the middle and a listening post at the back. Nobody has heard of anything in it, which is the point.' },
];

export default {
  id: 'cowley_road',
  preMap(game) {
    try {
      const m = game.map;
      if (m && !m._eoRenamed) {
        if (EASTPASS && !inventedNames() && !m._eoEra) { Object.defineProperty(m, '_eoEra', { value: eraNames(m), enumerable: false }); }
        const out = renameBusinesses(m, 'east', district(m), FIXED, { keep: !inventedNames() });
        Object.defineProperty(m, '_eoRenamed', { value: out, enumerable: false });
      }
      game.overrides.skip.add(MOSQUE.id);
      if (EASTPASS) game.overrides.heights.set(IDS.cinema, CINEMA_H);          // a low Edwardian hall (the map's 12 m made it a tower block)
      game.overrides.style.set(CHURCH.id, { wall: 'stone', roof: 'tile', tint: [0.92, 0.88, 0.8] });
    } catch (e) { console.error('[cowley_road] preMap', e); }
  },

  install(game) {
    const K = shared(game), me = K.join('cowley_road'), map = game.map, col = game.worldCollider;
    const S = { err: false, fronts: {}, shops: 0, bikes: 0, bought: 0, rec: null };
    const night = () => { const h = game.time.hour; return h >= 21.5 || h < 7; };
    try {
      const dCR = roadDist(map, ROADS), dJ = roadDist(map, ['Jeune Street']), dP = roadDist(map, ['Princes Street', 'Cowley Road']);
      const best = (b, dist) => { if (!b) return null; const fs = mergeFaces(streetFaces(b.poly, dist, 12)); fs.sort((a, c) => c.L - a.L); return fs[0] || null; };
      // the set pieces on their mapped buildings
      { const meth = EASTPASS ? buildingById(map, METHODIST.id) : null, fm = best(meth, dCR);
        if (fm) { S.fronts.methodist = fm; addSite(K, 'eo:methodist', [fm.mx, 8, fm.mz], 14, [110, 300, 700], [0, 1, 2].map((q) => { const B = new RB(); methodistFront(B, fm, q); return B; })); } }
      const cin = buildingById(map, IDS.cinema), fc = best(cin, dJ);
      if (fc) { S.fronts.cinema = fc; addSite(K, 'eo:cinema', [fc.mx, 7, fc.mz], 14, [90, 240, 450], [0, 1, 2].map((q) => { const B = new RB(); cinemaFront(B, fc, EASTPASS ? CINEMA_H : cin.h, q); if (q < 2) S.bikes += bikeRow(B, fc, fc.L / 2 + 2.2, 3, map, q, 1); return B; })); }
      const vp = map.pois.find((p) => p.id === IDS.venuePoi), vb = vp && buildingAt(map, vp.p[0], vp.p[1]), fv = best(vb, dCR);
      if (fv) { S.fronts.venue = fv; addSite(K, 'eo:venue', [fv.mx, 4, fv.mz], 16, [90, 220, 450], [0, 1, 2].map((q) => { const B = new RB(); venueFront(B, fv, vb.h, q); if (q < 2) S.bikes += bikeRow(B, fv, -Math.min(fv.L, 26) / 2 - 2, 4, map, q, 2); return B; })); }
      const ab = buildingById(map, IDS.arts), fa = best(ab, dP);
      if (fa) { S.fronts.arts = fa; addSite(K, 'eo:arts', [fa.mx, 5, fa.mz], 12, [90, 200, 330], [0, 1, 2].map((q) => { const B = new RB(); artsFront(B, fa, ab.h, q); if (q < 2) S.bikes += bikeRow(B, fa, 0, 3, map, q, 3); return B; })); }
      const rb = buildingById(map, IDS.records), fr = best(rb, dCR);
      if (fr) {
        S.fronts.records = fr;
        const side = faces(rb.poly).filter((f) => f !== fr && f.L > 6 && Math.abs(f.nx * fr.nx + f.nz * fr.nz) < 0.4).sort((a, b) => b.L - a.L)[0];
        addSite(K, 'eo:records', [fr.mx, 4, fr.mz], 12, [80, 200, 300], [0, 1].map((q) => { const B = new RB(); if (side) muralOn(B, side, rb.h, 'muralB'); recordsSign(B, fr); if (q < 2) S.bikes += bikeRow(B, fr, 0, 2, map, q, 4); return B; }).concat([null]));
      }
      // skyline markers
      const mb = map.buildings.find((b) => b.id === MOSQUE.id);
      if (mb) { addSite(K, 'eo:mosque', [2014, 10, 815], 26, [120, 420, 1250], [0, 1, 2].map((q) => { const B = new RB(); mosque(B, mb.poly, q); return B; })); col.addPolygon(mb.poly); col.addCircle(MOSQUE.minaret[0], MOSQUE.minaret[1], 1.5); }
      addSite(K, 'eo:church', [CHURCH.tower[0], 14, CHURCH.tower[1]], 16, [120, 420, 1250], [0, 1, 2].map((q) => { const B = new RB(); churchTower(B, q); return B; }));
      // the shop parade, in ~160 m cells along the road: night (shutters) and day (stalls, boards, awnings) chunks
      const cells = new Map(), done = new Set();
      const shopB = [];
      for (const r of map._eoRenamed || []) {
        let b = r.id.startsWith('n') ? null : buildingById(map, r.id);
        if (!b) { const p = map.pois.find((q) => q.id === r.id); if (p) b = buildingAt(map, p.p[0], p.p[1]); }
        if (!b || done.has(b.id) || [IDS.cinema, IDS.arts, IDS.records].includes(b.id) || b === vb) continue;
        done.add(b.id); shopB.push([b, r.kind]);
      }
      for (const [b, kind] of shopB) {
        const f = best(b, dCR); if (!f) continue;
        const key = Math.floor(f.mx / 160) + ',' + Math.floor(f.mz / 160);
        let c = cells.get(key); if (!c) cells.set(key, (c = { n: [new RB(), new RB(), new RB()], d: [new RB(), new RB()], x: 0, z: 0, k: 0, ids: [] }));
        const s = (parseInt(b.id.replace(/\D/g, ''), 10) % 997) / 997;
        for (let q = 0; q < 3; q++) shopDress(c.n[q], q < 2 ? c.d[q] : new RB(), f, kind, s, q, map);
        c.x += f.mx; c.z += f.mz; c.k++; S.shops++;
      }
      for (const [key, c] of cells) {
        const cx = c.x / c.k, cz = c.z / c.k;
        addSite(K, 'eo:night:' + key, [cx, 2, cz], 110, [70, 150, 260], c.n, { need: night });
        addSite(K, 'eo:day:' + key, [cx, 1, cz], 110, [60, 130, 0.01], [c.d[0], c.d[1], null], { need: () => !night(), farArea: 99 });
      }
      K.boxes.push([1400, 2120, 640, 1120]);
      void centroid; void businessKind;
    } catch (e) { console.error('[cowley_road] build', e); } finally { K.joined(me); }

    // ---- the record shop (walk-in; RECS)
    try {
      const fr = S.fronts.records;
      if (fr) {
        const door = [fr.mx + fr.nx * 1.0, fr.mz + fr.nz * 1.0];
        // (walk-in: the shop in place in its mapped building; shut out of hours — the door stays locked, a "Closed" card on it)
        let plan = null;
        try { plan = planWalkin(game, { id: 'eo_records', building: IDS.records, door: { pos: door, facing: Math.atan2(fr.nx, fr.nz) }, hours: { open: () => hoursOpen(game.time.hour, 10, 19.5), testShut: 3.5 }, ...recPlanSpec() }); } catch (e) { console.warn('[cowley_road] records plan', e); }
        if (plan) streetDoor(game, plan, { every: 35, dwell: [20, 60] });      // (the street's walkers go in to browse)
        // its people, there whenever the shop is shown (seen through the window and the door): whoever is behind the
        // counter today and a browser or two at the crates; the lights are low and nobody is in out of hours
        const recOpen = () => hoursOpen(game.time.hour, 10, 19.5), walkin = !!(plan && plan.poly && plan.fit.ok);
        const recLook = (seed, extra) => ({ ...randomLook(seed, { outfit: 'casual' }), hat: null, backpack: null, ...extra });
        let lamps = null;
        const setLamps = (on) => { if (!lamps || lamps.on === on) return; lamps.on = on; for (const [o, i] of lamps) o.intensity = i * (on ? 1 : 0.2); };
        const crowd = roomCrowd(game, 'eo_records', {
          cap: 5, signature: () => `${recOpen()}|${game.time.hour >= 15}|${dayOf(game.time.now())}`,
          populate(spawn) {
            if (!recOpen() || !walkin || !S.rec) return;
            const d = dayOf(game.time.now()), P = (x, z, h, look, opts) => { const p = spawn(x, z, look, { heading: h, ...opts }); if (p) p.character.noLod = true; return p; };
            P(S.rec.clerk[0], S.rec.clerk[1], 0, recLook('truck-clerk-' + (d % 3), { hat: d % 3 === 1 ? 'beanie' : null, hatColor: 0x2a2a2a }), { lines: CLERK, role: 'clerk' });
            const spots = [[1.2, 2.62, Math.PI], [-2.1, 1.5, -Math.PI / 2], [-1.0, -4.05, Math.PI], [2.4, 3.45, 0]];
            for (let i = 0; i < (game.time.hour >= 15 ? 3 : 2); i++) { const q = spots[(i + d) % spots.length]; P(q[0], q[1], q[2], recLook('truck-browser-' + d + '-' + i, { backpack: i ? 0x2a3a5a : null })); }
          },
        });
        // (from outside the crowd system neither shows nor poses a room's people: do it here)
        const people = (dt, inside) => { setLamps(recOpen()); crowd.tick(dt); for (const p of crowd.npcs) { const ch = p.character; if (!ch.group.visible) ch.group.visible = true; if (!inside) ch.update(dt, 0); } };
        game.interiors.register({
          id: 'eo_records', name: RECS, background: 0x15110e, ambient: 0.6,
          update(dt) { if (walkin) people(dt, true); }, updateShown(dt) { if (walkin) people(dt, false); },
          seamless: plan && plan.poly && plan.fit.ok ? plan.seamless : null,
          doors: [{ pos: door, facing: Math.atan2(fr.nx, fr.nz), label: 'Go into ' + RECS, locked: () => { const h = game.time.hour; return h >= 10 && h < 19.5 ? false : RECS + ' is shut (open 10:00 - 19:30). A sign says "BACK IN 5 MINS". It has said so since Tuesday.'; } }],
          build(ctx) {
            const R = buildRecords(ctx, game, plan); S.rec = { pick: 0, ...R };
            if (ctx.seamless) lamps = ctx.scene.children.filter((o) => o.isLight).map((o) => [o, o.intensity]);
            const I = (o) => game.interact.add({ place: ctx.id, radius: 1.6, ...o });
            for (const p of R.crates) I({ pos: p, label: 'Flick through the crate', onUse: () => { S.rec.pick = Math.floor(game.time.now() / 1000 + p[0] * 7) % RECORDS.length; const [a, t, g] = RECORDS[S.rec.pick]; game.ui.toast(`"${t}" by ${a} — ${g}. £${PRICE} at the counter.`, 5); } });
            I({ pos: R.counter, label: `Buy the record (£${PRICE})`, onUse: () => {
              if ((game.state.money ?? 0) < PRICE) { game.ui.toast('"Eight quid, mate." You do not have eight quid.', 4); return; }
              game.pay(-PRICE); S.bought++; const [a, t] = RECORDS[S.rec.pick];
              try { const fl = game.state.flags || (game.state.flags = {}); fl.eoRecords = (fl.eoRecords || 0) + 1; game.save(); } catch { /* */ }
              game.ui.toast(`You buy "${t}" by ${a}. "${CLERK[S.bought % CLERK.length]}"`, 6);
              try { const A = game.audio; if (A && A.ctx) for (const n of riff(S.rec.pick)) A.tone(n.f, 0.15, { gain: 0.05, when: n.t }); } catch { /* */ }
            } });
            I({ pos: R.post, label: 'Put the headphones on', onUse: () => { const i = Math.floor(game.time.now() / 4000) % RECORDS.length; game.ui.toast(`The listening post is playing ${RECORDS[i][0]}. You nod along as if you knew it.`, 5); try { const A = game.audio; if (A && A.ctx) for (const n of riff(i)) A.tone(n.f / 2, 0.15, { gain: 0.04, when: n.t }); } catch { /* */ } } });
            return { spawn: R.spawn, heading: R.heading };
          },
        });
      }
    } catch (e) { console.warn('[cowley_road] records', e); }

    // the queue outside the Ballroom on a gig night (19:30-23:30; spawned only near; existing voiced crowd lines)
    let queue = null;
    try {
      const f = S.fronts.venue;
      if (f) {
        const people = [];
        for (let i = 0; i < 7; i++) { const o = -Math.min(f.L, 26) / 2 + 3.2 - i * 0.85, x = f.mx + f.ux * o + f.nx * 1.0, z = f.mz + f.uz * o + f.nz * 1.0; people.push({ x, z, h: Math.atan2(f.ux, f.uz), look: randomLook('ballroom-q-' + i, { outfit: i % 3 ? 'clubbing' : 'casual' }), pose: i % 4 === 1 ? 'phone' : i % 4 === 3 ? 'talk' : 'stand', lines: i % 2 ? QUEUE_LINES : null }); }
        queue = nearSet(game, { c: [f.mx, f.mz], r: 70, h0: 19.5, h1: 23.5, people });
      }
    } catch (e) { console.warn('[cowley_road] queue', e); }
    game.cowleyRoad = {
      sights, renamed: map._eoRenamed || [], fronts: S.fronts,
      records: { price: PRICE, bought: () => S.bought, list: RECORDS },
      stats() { return { queue: queue ? queue.count() : 0, shops: S.shops, bikes: S.bikes, levels: K.lod.groups.filter((g) => /^eo:/.test(g.name)).map((g) => g.name + ':' + g.level), tris: Object.fromEntries(Object.entries(K.sites).filter(([k]) => /^eo:/.test(k)).map(([k, v]) => [k, v.tris])) }; },
    };
    return { update() { try { K.tick(me); if (queue) queue.tick(); } catch (e) { if (!S.err) { S.err = true; console.error('[cowley_road]', e); } } } };
  },
};
