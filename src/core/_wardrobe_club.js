// The clubbing wardrobe: c. 2013 UK student night out (Purple Turtle, Park End, Bridge, college bops), November, no coats.
// Pure data / logic, no THREE: the look generator (`clubLook`, used by randomLook(seed, {outfit:'clubbing'})), the
// state-of-the-night helpers, and `resolveClub` (look.club -> fully defaulted garment spec for the geometry builders in
// _wardrobe_geo.js). See docs/CHARACTERS_API.md "Clubbing wardrobe".

export const CLUB_DRESSES = ['bodycon', 'colourblock', 'sequin', 'skater', 'bandage', 'backless', 'cutout', 'cami', 'playsuit', 'maxi', 'toga', 'onesie'];
export const CLUB_TOPS = ['crop', 'bralette', 'bandeau', 'bodysuit', 'peplum', 'cami', 'shirt', 'shirt-tied', 'polo', 'vneck', 'scoop', 'vest', 'rugby',
  'dinner', 'tee', 'bare'];
export const CLUB_BOTTOMS = ['mini', 'skater', 'pleated', 'tutu', 'disco', 'leather', 'hotpants', 'chinos', 'skinny', 'jeans', 'shorts', 'trousers', 'dinner'];
export const CLUB_SHOES = ['platform', 'stiletto', 'wedge', 'ankle-boot', 'flats', 'sandal', 'barefoot', 'boat', 'desert', 'brogue', 'patent', 'hightop', 'trainer'];
export const CLUB_ACC = ['clutch', 'chain-bag', 'necklace', 'hoops', 'glowsticks', 'facepaint', 'cape', 'wristband', 'watch', 'bowtie', 'tie', 'socks',
  'legwarmers', 'laurel', 'cowboy', 'cone-hat', 'tie-band', 'logo'];
export const CLUB_THEMES = ['bop-toga', 'bop-neon', 'bop-school', 'bop-onesie', 'bop-superhero', 'bop-cowboy', 'black-tie', 'stash'];
export const CLUB_ANIMALS = ['tiger', 'cow', 'panda', 'dino', 'pikachu', 'leopard', 'bear'];
export const HEELS = { platform: 0.09, stiletto: 0.08, wedge: 0.065, 'ankle-boot': 0.045 };
const BOPS = CLUB_THEMES.slice(0, 6);

// ------------------------------------------------------------------------------------------------ palettes (c. 2013)
const BLACK = 0x111113;
const W_DRESS = [BLACK, BLACK, BLACK, 0xc0182a, 0x1d3fb0, 0xf07a6a, 0x8fdcc4, 0xeeeeea, 0x0e6a4a, 0xd81f78, 0x5a1424, 0x3a1f6a, 0xf2a0c0, 0x1fa8b0, 0xd8b830];
const SEQUIN = [0xc8a850, 0xb8b8c4, BLACK, 0x8a2040, 0x2a3a9a, 0xd02070, 0x7a2a8a];
const NEON = [0x39ff14, 0xff2fb0, 0xfff01f, 0x00e5ff, 0xff7a00];
const DISCO = [BLACK, BLACK, 0x1a1f40, 0x5a1424, 0x7a0f20];
const DENIM = [0x4a6a9a, 0x3a5684, 0x2a3e66, 0x1e2a44, 0x8aa4c4];
const W_TOP = [BLACK, 0xeeeeea, 0xc0182a, 0x1d3fb0, 0xf07a6a, 0x8fdcc4, 0xd81f78, 0xc8a850, 0x0e6a4a, 0xf2a0c0, 0xe8d0c0];
const SKIRT = [BLACK, BLACK, 0x1a1f40, 0x5a1424, 0xeeeeea, 0xc0182a, 0x1d3fb0];
const W_SHOES = [BLACK, BLACK, BLACK, 0xd8b090, 0xb01828, 0xc8a850, 0xc0c0c8, 0x1d3fb0];
const BAGS = [BLACK, BLACK, 0xc8a850, 0xd8b090, 0xb01828, 0xeeeeea, 0x5a3a22];
const LIPS = [0xb01828, 0xc83a4a, 0x8a1a3a, 0xd86a7a];
const M_SHIRT = [0xa8c8e8, 0xa8c8e8, 0xb4d0ec, 0xf4f4f0, 0xf4f4f0, 0xf2c4cc, 0x1c2a48, 0x6a8ab0, 0x2a2a2e, 0x8a1a2a];
const CHECKS = [[0xeef2f6, 0x3a5a9a], [0xf6eeee, 0xa82a32], [0xeef2ea, 0x2a6a3a], [0xe8eef6, 0x1c2a48], [0xf2f0e8, 0x8a5a2a], [0x2a3a6a, 0x8a2a2a]];
const FLORALS = [[0x1c2a48, 0xf0a0b0], [0xf4f0e8, 0x3a6aa8], [0x2a2a2e, 0xe8c040], [0x8ab8d8, 0xf4f4f4], [0xf2c4cc, 0x2a5a3a]];
const CHINOS = [0xa83a32, 0xa83a32, 0xc8a040, 0xc8a040, 0x23304a, 0x23304a, 0xcbb994, 0xcbb994, 0x5a5a3a, 0xd88a7a, 0x8a9ab8];
const SKINNY = [0x1e2a44, 0x1e2a44, 0x141418, 0x2a3e66, 0x4a4a52];
const POLO = [0x1c2a48, 0xf4f4f0, 0xf2c4cc, 0x2a6a3a, 0xa8c8e8, 0x7a1a2a, 0xe8c040, 0x141414];
const TEE = [0x141414, 0xf4f4f0, 0x6a6a70, 0x1c2a48, 0x8a2a3a, 0x2a5a4a, 0xd8d0c0];
const HOOPS = [[0x1a2a5a, 0xc8a030], [0x7a1a2a, 0x101010], [0x1a4a2a, 0xe0e0e0], [0xa01a1a, 0xf0f0f0], [0x2a2a6a, 0xa0c0e0], [0x5a1a5a, 0xe0c040],
  [0x101010, 0xe08aa8], [0x8a1a1a, 0x1a3a7a]];
const SHEETS = [0xf4f4f0, 0xf4f4f0, 0xf4f4f0, 0xeae4d8, 0xc8d8f0, 0xf0d8e0];
const M_SHOE = { boat: [0x8a5a32, 0x6a4024, 0x2a3048], desert: [0xb8946a, 0xa8845a, 0x5a4a3a], brogue: [0x7a4a26, 0x3a2216, 0x5a3018], patent: [0x0c0c0e],
  hightop: [0xf2f2f2, 0x141414, 0xb02020, 0x1c2a48], trainer: [0xf2f2f2, 0xf2f2f2, 0x141414, 0x8a8a8a], flats: [BLACK, 0xd8b090, 0xb01828], 'ankle-boot': [BLACK, 0x3a2416, 0x6a4a2a] };
const ONESIE = { tiger: [0xe8761a, 0xf4eee4], cow: [0xf2f2f0, 0xf0b0b8], panda: [0xf2f2f0, 0xf2f2f0], dino: [0x4aa04a, 0xe8d050], pikachu: [0xf2d22a, 0xf2d22a],
  leopard: [0xd8b070, 0xf0e4cc], bear: [0x6a4428, 0xc8a078] };

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** deterministic 0..1 from (seed, k) */
function h01(seed, k) { let x = (Math.imul((seed >>> 0) + 0x9e37 * (k + 1), 2654435761) ^ (k * 40503)) >>> 0; x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; }

/** How far into the night (0 pristine .. 1 dishevelled) at `hour` (0..24), with a little per-person spread from `seed`. */
export function clubState(hour, seed = 0) {
  const x = ((((+hour || 0) - 21) % 24) + 24) % 24;          // hours since 21:00
  if (x > 9) return 0;                                         // daytime / early evening: getting ready
  const base = clamp01((x - 0.6) / 5.2);                       // ~21:30 fresh .. ~03:00 wrecked
  return Math.round(clamp01(base + (h01(seed, 7) - 0.5) * 0.3) * 100) / 100;
}

/** Copy of a clubbing look with its `club.state` set for `hour` (other looks are returned unchanged). */
export function clubLookAt(look, hour) {
  if (!look || look.outfit !== 'clubbing' || !look.club) return look;
  const L = JSON.parse(JSON.stringify(look));
  L.club.state = clubState(hour, L.seed >>> 0);
  return L;
}

// ------------------------------------------------------------------------------------------------ generator
/**
 * Fill a clubbing look. `rnd` is randomLook's seeded stream, `L` the base look (skin, hair, height...). opts:
 *   skimpy 0..1 (default 0.4: about a third of all outfits come out "quite skimpy"), theme (one of CLUB_THEMES, 'bop' = any bop theme,
 *   'none' = no theme), range ('womens'|'mens'), state 0..1, hour (sets state via clubState).
 */
export function clubLook(rnd, L, opts = {}) {
  const pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
  const chance = (p) => rnd() < p;
  const range = opts.range === 'womens' || opts.range === 'mens' ? opts.range : chance(0.5) ? 'womens' : 'mens';
  const W = range === 'womens';
  let theme = opts.theme;
  const tr = rnd();
  if (theme === 'bop') theme = pick(BOPS);
  else if (theme === undefined || theme === null) theme = tr < 0.1 ? pick(BOPS) : tr < 0.15 ? 'black-tie' : tr < 0.2 ? 'stash' : null;
  else if (!CLUB_THEMES.includes(theme)) theme = null;
  const p = opts.skimpy === undefined ? 0.4 : clamp01(+opts.skimpy || 0);
  const skimpy = chance(W ? clamp01(p * 1.6) : clamp01(p * 0.42 + Math.max(0, p - 0.6) * 1.45));
  // body & hair (same neutral body; heights are typical of each range)
  L.height = Math.round(Math.max(1.52, Math.min(1.98, L.height + (W ? -0.08 : 0.04))) * 100) / 100;
  if (W) {
    L.build = Math.round(Math.min(L.build, 0.86 + rnd() * 0.2) * 100) / 100;
    L.hairStyle = pick(['straight', 'straight', 'long', 'big', 'curls', 'topknot', 'ponytail', 'bob', 'long', 'curly', 'straight']);
    if ([0x6b4630, 0x4f3322, 0x8a5a3a].includes(L.skin) && chance(0.4)) L.hairStyle = pick(['afro', 'curls', 'curly']);
    delete L.beard;
    if (chance(0.92)) delete L.glasses;
  } else {
    L.hairStyle = pick(['short', 'quiff', 'sidepart', 'short', 'buzz', 'curly', 'sidepart', 'quiff', 'short']);
    if ([0x6b4630, 0x4f3322].includes(L.skin) && chance(0.3)) L.hairStyle = pick(['afro', 'buzz']);
    if (chance(0.25)) L.beard = chance(0.8) ? 'stubble' : 'full'; else delete L.beard;
    if (chance(0.85)) delete L.glasses;
  }
  if (L.hair && [0x8a8a86, 0xb8b8b0, 0xd8d8d0, 0xeeeeea].includes(L.hair)) L.hair = 0x3b2616;   // students: no grey
  const C = {};
  const club = { range, state: 0, c: C };
  if (theme) club.theme = theme;
  const acc = [];
  const shoeW = (heelsOnly) => pick(heelsOnly ? ['platform', 'platform', 'stiletto', 'stiletto', 'wedge'] : ['platform', 'platform', 'stiletto', 'stiletto', 'wedge', 'ankle-boot', 'ankle-boot', 'flats']);
  const legsW = () => { const r = rnd(); return skimpy ? (r < 0.84 ? 'bare' : r < 0.95 ? 'sheer' : 'tights') : r < 0.66 ? 'bare' : r < 0.88 ? 'tights' : 'sheer'; };
  const womensAcc = () => {
    if (chance(0.6)) acc.push('clutch'); else if (chance(0.75)) acc.push('chain-bag');
    if (chance(0.32)) acc.push('hoops');
    if (chance(0.22)) acc.push('necklace');
    if (chance(0.4)) C.lip = pick(LIPS);
    C.bag = pick(BAGS); C.trim = chance(0.7) ? 0xd8b850 : 0xc8c8d0;
  };
  const mensAcc = () => { if (chance(0.45)) acc.push('watch'); if (chance(0.3)) acc.push('wristband'); C.trim = chance(0.6) ? 0xc8c8d0 : 0xd8b850; };

  if (theme === 'bop-toga') {
    club.dress = 'toga'; C.main = pick(SHEETS); if (chance(0.15)) { club.pattern = 'floral'; C.alt = pick([0x6a8ad0, 0xe07a90, 0x6aa06a]); }
    club.hem = W ? 0.2 + rnd() * 0.05 : 0.42 + rnd() * 0.08;
    if (chance(0.6)) acc.push('laurel');
    C.trim = 0xd8b850;
    club.shoes = W ? pick(['sandal', 'flats', 'sandal', 'platform']) : pick(['trainer', 'trainer', 'sandal', 'barefoot', 'boat']);
    club.legs = 'bare'; if (W) { if (chance(0.5)) acc.push('hoops'); if (chance(0.5)) C.lip = pick(LIPS); }
  } else if (theme === 'bop-neon') {
    acc.push('glowsticks'); if (chance(0.75)) acc.push('facepaint');
    C.main = pick(NEON); C.alt = pick(NEON); C.trim = pick(NEON);
    if (W) {
      const v = pick(['bralette', 'crop', 'bralette', 'vest']);
      club.top = v === 'vest' ? 'vest' : v; club.bottom = pick(['tutu', 'tutu', 'hotpants', 'mini']);
      C.bottom = club.bottom === 'tutu' ? pick(NEON) : club.bottom === 'hotpants' ? pick(DENIM) : BLACK;
      club.legs = chance(0.7) ? 'bare' : 'tights'; if (chance(0.4)) acc.push('legwarmers');
      club.shoes = pick(['trainer', 'hightop', 'trainer', 'platform']);
    } else {
      const v = rnd();
      club.top = v < 0.45 ? 'vest' : v < 0.75 ? 'bare' : 'tee';
      club.bottom = chance(0.6) ? 'shorts' : 'skinny'; C.bottom = club.bottom === 'shorts' ? pick([0x141414, 0x2a3e66, pick(NEON)]) : pick(SKINNY);
      club.shoes = pick(['trainer', 'hightop', 'trainer']);
    }
  } else if (theme === 'bop-school') {
    acc.push('tie'); C.alt = pick([0x7a1a2a, 0x1a2a5a, 0x1a4a2a, 0x5a1a5a]); C.trim = 0xc8a030;
    C.main = 0xf4f4f0;
    if (W) {
      club.top = 'shirt-tied'; club.bottom = 'pleated'; C.bottom = pick([0x2a2a2e, 0x3a3a44, 0x1a2a4a, 0x5a1a24]);
      club.legs = 'bare'; acc.push('socks'); club.shoes = pick(['flats', 'flats', 'platform']); L.hairStyle = 'pigtails';
      if (chance(0.5)) C.lip = pick(LIPS);
    } else {
      club.top = 'shirt'; club.tucked = false; club.sleeves = chance(0.5) ? 'rolled' : 'long';
      club.bottom = 'trousers'; C.bottom = pick([0x4a4a50, 0x2a2a2e, 0x3a3a44]); club.shoes = 'brogue'; C.shoes = 0x111111;
    }
  } else if (theme === 'bop-onesie') {
    club.dress = 'onesie'; club.animal = pick(CLUB_ANIMALS); [C.main, C.alt] = ONESIE[club.animal];
    club.shoes = pick(['trainer', 'trainer', 'hightop']);
  } else if (theme === 'bop-superhero') {
    acc.push('cape');
    club.hero = chance(0.6) ? 'super' : 'bat';
    C.trim = club.hero === 'super' ? 0xc01818 : 0x141414;           // cape
    if (W) {
      club.dress = club.hero === 'super' ? 'skater' : 'bodycon'; C.main = club.hero === 'super' ? 0x1f4fb0 : 0x2a2a30; acc.push('logo');
      club.legs = legsW(); club.shoes = club.hero === 'super' ? pick(['ankle-boot', 'platform']) : pick(['ankle-boot', 'stiletto']);
      C.shoes = club.hero === 'super' ? 0xc01818 : BLACK;
    } else {
      club.top = 'tee'; acc.push('logo'); C.main = club.hero === 'super' ? 0x1f4fb0 : 0x3a3a40;
      club.bottom = chance(0.6) ? 'skinny' : 'jeans'; C.bottom = pick(SKINNY); club.shoes = pick(['trainer', 'hightop']);
    }
  } else if (theme === 'bop-cowboy') {
    acc.push('cowboy'); C.hat = pick([0x8a5a32, 0x6a4024, 0xd8c8a0, 0x2a2a2a]);
    const ck = pick(CHECKS); C.main = ck[0]; C.alt = ck[1]; club.pattern = 'check';
    if (W) {
      club.top = 'shirt-tied'; club.bottom = 'hotpants'; C.bottom = pick(DENIM); club.legs = 'bare'; club.shoes = 'ankle-boot'; C.shoes = pick([0x6a4024, 0x3a2416, BLACK]);
    } else {
      club.top = 'shirt'; club.sleeves = 'rolled'; club.bottom = 'jeans'; C.bottom = pick(DENIM); club.shoes = 'desert'; C.shoes = pick(M_SHOE.desert);
    }
  } else if (theme === 'black-tie') {
    if (W) {
      const v = rnd();
      club.dress = v < 0.45 ? 'maxi' : v < 0.7 ? 'sequin' : 'bodycon'; C.main = club.dress === 'sequin' ? pick(SEQUIN) : pick([BLACK, BLACK, 0x5a1424, 0x1a2a6a, 0x0e5a40, 0xc0182a, 0xc8a850]);
      if (club.dress !== 'maxi') club.hem = 0.3; if (club.dress === 'bodycon') club.sleeves = 'none';
      club.legs = chance(0.7) ? 'bare' : 'sheer'; club.shoes = pick(['stiletto', 'stiletto', 'platform']); womensAcc(); acc.push('clutch');
    } else {
      club.top = 'dinner'; club.bottom = 'dinner'; acc.push('bowtie'); club.shoes = 'patent'; C.main = 0xf6f6f2; C.bottom = 0x111114; C.shoes = 0x0c0c0e;
    }
  } else if (theme === 'stash') {
    const hp = pick(HOOPS); C.main = hp[0]; C.alt = hp[1]; club.top = 'rugby'; club.pattern = 'hoops';
    if (W) { club.bottom = pick(['mini', 'leather', 'skinny', 'mini']); C.bottom = club.bottom === 'mini' ? pick(DENIM) : club.bottom === 'leather' ? BLACK : pick(SKINNY); club.legs = legsW(); club.shoes = pick(['ankle-boot', 'flats', 'platform']); womensAcc(); }
    else { club.bottom = pick(['chinos', 'jeans', 'chinos']); C.bottom = club.bottom === 'chinos' ? pick(CHINOS) : pick(DENIM); club.shoes = pick(['boat', 'boat', 'desert', 'trainer']); if (chance(0.5)) acc.push('tie-band'); C.tie = pick(HOOPS)[0]; mensAcc(); }
  } else if (W) {
    // ---- womenswear
    const v = skimpy
      ? pick(['bralette+hotpants', 'bralette+disco', 'bralette+skirt', 'bandeau+mini', 'cami', 'cami', 'backless', 'cutout', 'playsuit', 'crop+mini', 'bandage', 'bodycon-micro', 'crop+hotpants'])
      : pick(['bodycon', 'bodycon', 'colourblock', 'sequin', 'skater', 'skater', 'bandage-sleeved', 'peplum+mini', 'bodysuit+skirt', 'disco+crop', 'leather+crop', 'leather+bodysuit',
        'hotpants+tights', 'skater-skirt+crop']);
    const [a, b] = v.split('+');
    if (!b) {
      club.dress = { 'bodycon-micro': 'bodycon', 'bandage-sleeved': 'bandage' }[a] || a;
      C.main = club.dress === 'sequin' ? pick(SEQUIN) : pick(W_DRESS);
      if (club.dress === 'colourblock') C.alt = C.main === BLACK ? pick([0xeeeeea, 0xc0182a, 0x1d3fb0]) : chance(0.7) ? BLACK : 0xeeeeea;
      if (club.dress === 'bandage' && a === 'bandage-sleeved') { club.neck = 'scoop'; club.sleeves = 'cap'; club.hem = 0.25; }
      if (a === 'bodycon-micro') { club.hem = 0.15; club.sleeves = 'none'; club.neck = pick(['scoop', 'v', 'straight']); }
      if (club.dress === 'bodycon') { if (!club.sleeves) club.sleeves = pick(['none', 'short', 'long', 'cap']); if (!club.neck) club.neck = pick(['scoop', 'scoop', 'v', 'crew']); }
      if (club.dress === 'playsuit') { C.main = pick([BLACK, 0xeeeeea, 0xf07a6a, 0x1d3fb0, 0x8fdcc4, 0xc0182a]); if (chance(0.4)) { club.pattern = 'floral'; C.alt = pick([0xf0a0b0, 0xeeeeea, 0xe8c040]); } }
      if (club.dress === 'cami' && chance(0.3)) club.pattern = 'sequin';
    } else {
      let t = a, bt = b;
      if (a === 'disco' || a === 'leather' || a === 'hotpants' || a === 'skater-skirt') {
        bt = a === 'skater-skirt' ? 'skater' : a; t = b === 'tights' ? pick(['crop', 'bodysuit', 'cami']) : b;
      } else if (b === 'skirt') bt = pick(['mini', 'skater']);
      club.top = t; club.bottom = bt;
      C.main = club.top === 'bralette' || club.top === 'bandeau' ? pick([BLACK, BLACK, 0xeeeeea, 0xc0182a, 0xd81f78, 0xc8a850, 0x8fdcc4]) : pick(W_TOP);
      if (club.top === 'bralette' && chance(0.35)) club.pattern = 'sequin';
      if (club.top === 'peplum') C.main = pick([0xc0182a, 0x1d3fb0, 0xeeeeea, BLACK, 0xf07a6a, 0x0e6a4a]);
      if (club.top === 'bodysuit') { club.sleeves = pick(['long', 'none', 'long']); club.neck = pick(['scoop', 'crew', 'v']); }
      if (club.top === 'crop') club.sleeves = pick(['none', 'short', 'none', 'long']);
      C.bottom = club.bottom === 'disco' ? pick(DISCO) : club.bottom === 'leather' ? BLACK : club.bottom === 'hotpants' ? pick(DENIM)
        : club.bottom === 'skater' ? pick(SKIRT.concat([0xc0182a, 0x8fdcc4])) : pick(SKIRT);
      if (C.bottom === C.main) C.main = C.main === BLACK ? 0xeeeeea : BLACK;
      if (a === 'hotpants' && b === 'tights') club.legs = 'tights';
    }
    if (!club.legs) club.legs = club.bottom === 'disco' || club.bottom === 'leather' ? 'bare' : legsW();
    club.shoes = club.bottom === 'disco' || club.bottom === 'leather' ? pick(['ankle-boot', 'platform', 'stiletto']) : shoeW(skimpy);
    womensAcc();
  } else {
    // ---- menswear
    if (skimpy) {
      const v = pick(['open-shirt', 'open-shirt', 'deepv', 'vest', 'open-shirt']);
      if (v === 'open-shirt') { club.top = 'shirt'; club.open = 3; club.sleeves = 'rolled'; club.tucked = false; }
      else if (v === 'deepv') { club.top = 'vneck'; }
      else club.top = 'vest';
    } else club.top = pick(['shirt', 'shirt', 'shirt', 'shirt-check', 'shirt-floral', 'shirt-blue', 'shirt', 'polo', 'polo', 'vneck', 'scoop', 'tee']);
    if (club.top.startsWith('shirt')) {
      const t = club.top; club.top = 'shirt';
      if (t === 'shirt-check' || (t === 'shirt' && chance(0.25))) { const ck = pick(CHECKS); C.main = ck[0]; C.alt = ck[1]; club.pattern = 'check'; }
      else if (t === 'shirt-floral') { const fl = pick(FLORALS); C.main = fl[0]; C.alt = fl[1]; club.pattern = 'floral'; }
      else C.main = t === 'shirt-blue' ? 0xa8c8e8 : pick(M_SHIRT);
      if (!club.sleeves) club.sleeves = chance(0.72) ? 'rolled' : chance(0.6) ? 'long' : 'short';
      if (club.tucked === undefined) club.tucked = chance(0.35);
    } else C.main = club.top === 'polo' ? pick(POLO) : pick(TEE);
    const r = rnd();
    club.bottom = r < 0.46 ? 'chinos' : r < 0.86 ? 'skinny' : 'jeans';
    C.bottom = club.bottom === 'chinos' ? pick(CHINOS) : club.bottom === 'skinny' ? pick(SKINNY) : pick(DENIM);
    if (club.bottom === 'chinos' && chance(0.45)) club.rolled = true;
    const s = rnd();
    club.shoes = s < 0.24 ? 'boat' : s < 0.44 ? 'desert' : s < 0.64 ? 'brogue' : s < 0.84 ? 'hightop' : 'trainer';
    if (club.shoes === 'boat' && club.bottom === 'chinos') club.rolled = chance(0.7);
    mensAcc();
  }
  if (!club.shoes) club.shoes = W ? shoeW(false) : 'trainer';
  if (C.shoes === undefined) {
    const sl = M_SHOE[club.shoes];
    C.shoes = HEELS[club.shoes] !== undefined || club.shoes === 'sandal' ? pick(W_SHOES) : sl ? pick(sl) : BLACK;
  }
  if (acc.length) club.acc = acc;
  // state: explicit, from the hour, or a spread (ambient clubbers with no hour)
  const st = opts.state !== undefined ? clamp01(+opts.state || 0) : opts.hour !== undefined ? clubState(opts.hour, L.seed) : rnd() * 0.75;
  club.state = Math.round(st * 100) / 100;
  if (club.legs === undefined) club.legs = 'bare';
  L.club = club;
  return L;
}

// ------------------------------------------------------------------------------------------------ resolution
const DRESS_DEF = {
  bodycon: { neck: 'scoop', sleeves: 'none', hem: 0.2, flare: 0.05 },
  colourblock: { neck: 'scoop', sleeves: 'cap', hem: 0.22, flare: 0.05, pattern: 'block' },
  sequin: { neck: 'scoop', sleeves: 'long', hem: 0.2, flare: 0.08, pattern: 'sequin' },
  skater: { neck: 'crew', sleeves: 'short', hem: 0.25, flare: 1 },
  bandage: { neck: 'straight', sleeves: 'none', hem: 0.2, flare: 0.03, pattern: 'bandage' },
  backless: { neck: 'high', sleeves: 'none', hem: 0.18, flare: 0.05, back: 'open' },
  cutout: { neck: 'scoop', sleeves: 'none', hem: 0.19, flare: 0.05, cut: 'side' },
  cami: { neck: 'cami', sleeves: 'none', hem: 0.18, flare: 0.4, straps: 'thin' },
  playsuit: { neck: 'cami', sleeves: 'none', straps: 'thin' },
  maxi: { neck: 'v', sleeves: 'none', hem: 0.8, flare: 0.75, straps: 'wide' },
  toga: { neck: 'oneshoulder', sleeves: 'none', hem: 0.3, flare: 0.5 },
  onesie: { neck: 'crew', sleeves: 'onesie' },
};
const TOP_DEF = {
  crop: { neck: 'scoop', sleeves: 'none', topHem: 0.2 },
  bralette: { neck: 'cami', sleeves: 'none', topHem: 0.245, straps: 'thin' },
  bandeau: { neck: 'straight', sleeves: 'none', topHem: 0.225 },
  bodysuit: { neck: 'scoop', sleeves: 'long' },
  peplum: { neck: 'crew', sleeves: 'none', peplum: true },
  cami: { neck: 'cami', sleeves: 'none', straps: 'thin' },
  shirt: { neck: 'collar', sleeves: 'rolled', open: 1 },
  'shirt-tied': { neck: 'collar', sleeves: 'rolled', open: 2, topHem: 0.19, knot: true },
  polo: { neck: 'polo', sleeves: 'short', open: 1 },
  vneck: { neck: 'deepv', sleeves: 'short' },
  scoop: { neck: 'scoop-m', sleeves: 'short' },
  vest: { neck: 'vest', sleeves: 'none' },
  rugby: { neck: 'collar', sleeves: 'long', open: 1, pattern: 'hoops' },
  dinner: { neck: 'collar', sleeves: 'long', open: 2 },
  tee: { neck: 'crew', sleeves: 'short' },
  bare: { neck: 'none', sleeves: 'none' },
};
const BOTTOM_DEF = {   // waist: torso height (s units) the waistband reaches (0 = natural waist), thigh/shin cover
  mini: { skirt: 'bodycon', hem: 0.19, flare: 0.1, waist: 0.04 },
  skater: { skirt: 'skater', hem: 0.22, flare: 1, waist: 0.05 },
  pleated: { skirt: 'pleated', hem: 0.2, flare: 0.75, waist: 0.03 },
  tutu: { skirt: 'tutu', hem: 0.16, flare: 1.6, waist: 0.03 },
  disco: { thigh: 'full', shin: 'full', waist: 0.12, sheen: true },
  leather: { thigh: 'full', shin: 'full', waist: 0.05, sheen: true },
  hotpants: { thigh: 'hot', waist: 0.07 },
  chinos: { thigh: 'full', shin: 'full', belt: true, loose: 0.006 },
  skinny: { thigh: 'full', shin: 'full', belt: true, jean: true },
  jeans: { thigh: 'full', shin: 'full', belt: true, jean: true, loose: 0.008 },
  shorts: { thigh: 'shorts', belt: true },
  trousers: { thigh: 'full', shin: 'full', belt: true, loose: 0.006 },
  dinner: { thigh: 'full', shin: 'full', loose: 0.005, stripe: true },
};
const FOOD = ['kebab-box', 'chips', 'kebab-box', 'chips', 'kebab'];

/** look.club (+ seed) -> fully defaulted garment spec used by the geometry builders. Pure; never throws on junk. */
export function resolveClub(club, seed = 0, look = {}) {
  club = club && typeof club === 'object' ? club : {};
  const st = clamp01(+club.state || 0);
  const W = club.range !== 'mens' && (club.range === 'womens' || (!!club.dress && club.dress !== 'toga' && club.dress !== 'onesie') ||
    ['crop', 'bralette', 'bandeau', 'bodysuit', 'peplum', 'cami', 'shirt-tied'].includes(club.top));
  const c0 = club.c && typeof club.c === 'object' ? club.c : {};
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v >>> 0 & 0xffffff : d);
  const acc = new Set(Array.isArray(club.acc) ? club.acc.filter((a) => CLUB_ACC.includes(a)) : []);
  const dress = CLUB_DRESSES.includes(club.dress) ? club.dress : null;
  let top = dress ? null : CLUB_TOPS.includes(club.top) ? club.top : W ? 'crop' : 'shirt';
  const bottom = dress ? null : CLUB_BOTTOMS.includes(club.bottom) ? club.bottom : W ? 'mini' : 'skinny';
  const D = dress ? DRESS_DEF[dress] : TOP_DEF[top];
  const B = bottom ? BOTTOM_DEF[bottom] : null;
  const R = {
    range: W ? 'womens' : 'mens', state: st, theme: CLUB_THEMES.includes(club.theme) ? club.theme : null, dress, top, bottom,
    neck: typeof club.neck === 'string' ? club.neck : D.neck, sleeves: typeof club.sleeves === 'string' ? club.sleeves : D.sleeves,
    back: club.back || D.back || 'normal', cut: club.cut || D.cut || null, straps: club.straps || D.straps || null,
    pattern: typeof club.pattern === 'string' ? club.pattern : D.pattern || null, topHem: D.topHem || 0, peplum: !!D.peplum, knot: !!D.knot,
    animal: CLUB_ANIMALS.includes(club.animal) ? club.animal : 'tiger', hero: club.hero === 'bat' ? 'bat' : 'super',
    skirt: null, thigh: 'none', shin: 'none', waist: 0, belt: false, jean: false, sheen: false, loose: 0, stripe: false, rolled: !!club.rolled,
    open: 0, tucked: true, jacket: false, tie: null, bow: null, cape: acc.has('cape'), logo: acc.has('logo'),
    shoes: CLUB_SHOES.includes(club.shoes) ? club.shoes : W ? 'platform' : 'trainer', legs: ['bare', 'tights', 'sheer'].includes(club.legs) ? club.legs : 'bare',
    carryL: null, carryR: null, hat: null, hatColor: null, messy: false, smudge: false,
    bag: acc.has('clutch') ? 'clutch' : acc.has('chain-bag') ? 'chain-bag' : null, necklace: acc.has('necklace'), hoops: acc.has('hoops'),
    glow: acc.has('glowsticks'), paint: acc.has('facepaint'), watch: acc.has('watch'), wristband: acc.has('wristband'), socks: acc.has('socks'),
    legwarmers: acc.has('legwarmers'), heelH: 0, acc: [...acc],
  };
  const main = num(c0.main, dress === 'toga' ? 0xf4f4f0 : W ? 0x111113 : 0xa8c8e8);
  R.c = { main, alt: num(c0.alt, R.pattern === 'block' ? (main === 0x111113 ? 0xeeeeea : 0x111113) : 0x1c2a48), bottom: num(c0.bottom, W ? 0x111113 : 0x1e2a44),
    shoes: num(c0.shoes, 0x111111), trim: num(c0.trim, 0xd8b850), bag: num(c0.bag, 0x111113), lip: c0.lip === undefined ? null : num(c0.lip, 0xb01828),
    tights: num(c0.tights, 0x141414), hat: num(c0.hat, 0x8a5a32), tie: num(c0.tie, num(c0.alt, 0x7a1a2a)) };
  // skirts / legs
  if (dress && dress !== 'playsuit' && dress !== 'onesie') {
    const kind = dress === 'skater' ? 'skater' : dress === 'toga' ? 'toga' : dress === 'maxi' ? 'maxi' : dress === 'cami' ? 'cami' : 'bodycon';
    R.skirt = { kind, hem: +club.hem > 0.08 ? Math.min(0.85, +club.hem) : D.hem, flare: D.flare, col: main };
  } else if (dress === 'playsuit') { R.thigh = 'play'; }
  else if (dress === 'onesie') { R.thigh = 'full'; R.shin = 'full'; R.c.bottom = main; R.loose = 0.014; }
  if (B) {
    R.waist = B.waist || 0; R.belt = !!B.belt; R.jean = !!B.jean; R.sheen = !!B.sheen; R.loose = B.loose || 0; R.stripe = !!B.stripe;
    if (B.skirt) R.skirt = { kind: B.skirt, hem: +club.hem > 0.08 ? Math.min(0.85, +club.hem) : B.hem, flare: B.flare, col: R.c.bottom };
    else { R.thigh = B.thigh || 'none'; R.shin = B.shin || 'none'; }
  }
  if (R.thigh === 'full' && R.shin === 'full' && R.rolled) R.shin = 'rolled';
  // shirts: buttons, tails, sleeves, ties, jackets — loosening through the night
  const shirtLike = top === 'shirt' || top === 'dinner' || top === 'rugby' || top === 'polo';
  if (shirtLike) {
    let open = club.open !== undefined ? Math.max(0, Math.min(4, Math.round(+club.open) || 0)) : D.open || 0;
    if (club.open === undefined && top !== 'polo') { open += (st > 0.4 ? 1 : 0) + (st > 0.7 ? 1 : 0); if (st > 0.85 && h01(seed, 4) < 0.3 && top !== 'rugby') open = 4; }
    R.open = Math.min(top === 'polo' ? 2 : 4, open);
    R.tucked = club.tucked !== undefined ? !!club.tucked : top === 'dinner' ? st < 0.55 : top === 'shirt' ? h01(seed, 5) < 0.4 && st < 0.45 : false;
    if (R.sleeves === 'long' && st > 0.5 && top !== 'rugby' && h01(seed, 6) < 0.7) R.sleeves = 'rolled';
  } else if (top === 'shirt-tied') R.open = club.open !== undefined ? Math.max(0, Math.min(3, Math.round(+club.open) || 0)) : 2;
  else R.tucked = top !== 'tee' && top !== 'vneck' && top !== 'scoop' && top !== 'vest';
  if (top === 'dinner') {
    R.bow = 'undone';
    R.jacket = club.jacket !== undefined ? !!club.jacket : st < 0.5 && h01(seed, 8) < 0.75;
    if (R.jacket) R.sleeves = 'long';
  }
  if (acc.has('bowtie')) R.bow = 'undone';
  if (acc.has('tie')) R.tie = st > 0.72 && h01(seed, 9) < 0.7 ? 'head' : 'neck';
  if (acc.has('tie-band')) R.tie = 'head';
  // hats
  if (acc.has('cowboy')) { R.hat = 'cowboy'; R.hatColor = R.c.hat; }
  else if (acc.has('laurel')) { R.hat = 'laurel'; R.hatColor = 0xc8a840; }
  else if (acc.has('cone-hat')) { R.hat = 'cone'; R.hatColor = 0xf06a10; }
  else if (R.tie === 'head') { R.hat = 'tie-band'; R.hatColor = R.c.tie; }
  if (dress === 'onesie') { R.hat = 'hood'; R.hatColor = main; }
  // shoes & carrying
  R.heelH = HEELS[R.shoes] || 0;
  const carry = club.carry === undefined ? undefined : Array.isArray(club.carry) ? club.carry : [club.carry];
  if (carry) {
    for (const k of carry) { if (k === 'heels') R.carryL = 'heels'; else if (['kebab-box', 'chips', 'cone', 'kebab', 'bottle', 'phone', 'pint'].includes(k)) R.carryR = k; }
  } else {
    if ((R.shoes === 'platform' || R.shoes === 'stiletto' || R.shoes === 'wedge') && st >= 0.62 && h01(seed, 1) < 0.5 + (st - 0.62)) R.carryL = 'heels';
    if (st >= 0.55 && h01(seed, 2) < 0.22 + 0.45 * (st - 0.55)) R.carryR = FOOD[Math.floor(h01(seed, 3) * FOOD.length)];
    if (st >= 0.85 && h01(seed, 10) < 0.14 && !R.hat) { if (h01(seed, 11) < 0.5) { R.hat = 'cone'; R.hatColor = 0xf06a10; } else R.carryR = 'cone'; }
  }
  if (R.carryL === 'heels') { R.carriedShoes = R.shoes; R.shoes = club.shoesAfter === 'flats' || (club.shoesAfter === undefined && h01(seed, 12) < 0.3) ? 'flats' : 'barefoot'; R.heelH = 0; }
  R.messy = club.messy !== undefined ? !!club.messy : st > 0.7;
  R.smudge = club.smudge !== undefined ? !!club.smudge : W && st > 0.8 && h01(seed, 13) < 0.6;
  if (R.top === 'bare') { R.neck = 'none'; R.sleeves = 'none'; }
  return R;
}
