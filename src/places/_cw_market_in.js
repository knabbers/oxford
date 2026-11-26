// The Covered Market — the interior (owned by places/covered_market.js), built the first time someone walks in. Same
// coordinates as the street (the avenues are where they are on the map), so every door leads where it should.
// Everything static is six draws: the shared atlas (stalls, roofs, crates, joints, cakes), the lettering (fascias), the
// painted goods (_cw_goods.js: heaps of produce, shelf stock, flowers, wall tiles), worn-floor decals, the warm pools
// under the lanterns and the bulbs. Each unit has its own paint (pilasters, fascia, cornice). Trades as in the real market
// c. 2013; real stall names by default, invented under ?invented=1 (see _cw_kit.js STALLS / GENERIC).
import * as THREE from 'three';
import { RB, frame, rectPts, geoOf, cwSigns, STALLS, GENERIC, TAU, hash, Batch } from './_cw_kit.js';
import { AVENUES, CROSS, H, stallSlots, body, southDoor, GOLDEN } from './_cw_market.js';
import { cwGoods, mound, card } from './_cw_goods.js';

/** pure: which trade each slot gets — the named stalls spread over the four avenues, the rest generic or shuttered */
export function assignTrades(slots) {
  const out = slots.map(() => null), n = slots.length, used = new Set();
  // named stalls: walk the slots with a stride so they land on every avenue, both sides
  const order = slots.map((s, i) => i).sort((a, b) => hash(a, 3.1) - hash(b, 3.1));
  const want = STALLS.map((s) => s.id);
  // the butcher and the game dealer side by side on Avenue 1 (the old butchers' row), the café on a corner
  const firstOn = (av, side, k = 0) => slots.findIndex((s, i) => s.avenue === av && s.side === side && !used.has(i) && k-- <= 0);
  const fix = { butcher: firstOn(1, 1, 2), game: -1, cafe: firstOn(3, -1, 0), cakes: firstOn(2, 1, 1), cookies: firstOn(2, -1, 3) };
  if (fix.butcher >= 0) { used.add(fix.butcher); const nb = fix.butcher + 1; if (slots[nb] && slots[nb].avenue === 1) fix.game = nb; }
  for (const [id, i] of Object.entries(fix)) if (i >= 0 && slots[i]) { out[i] = { kind: 'named', id, k: want.indexOf(id) }; used.add(i); }
  for (const id of want) {
    if (out.some((o) => o && o.id === id)) continue;
    const i = order.find((j) => !used.has(j) && !out[j]);
    if (i === undefined) break;
    out[i] = { kind: 'named', id, k: want.indexOf(id) }; used.add(i);
  }
  for (let i = 0; i < n; i++) if (!out[i]) out[i] = hash(i, 7.7) < 0.12 ? { kind: 'shut' } : { kind: 'generic', k: Math.floor(hash(i, 5.3) * GENERIC.length) };
  return out;
}

/** what you can buy at each named stall (energy as the supermarkets' PRODUCTS: restored when eaten; 0 = not food) */
export const WARES = {
  butcher: { id: 'cw_sausages', name: 'Oxford sausages (6)', price: 3.2, energy: 0, say: 'Proper Oxford sausages. Fry them, mind — not raw!' },
  game: { id: 'cw_pheasant', name: 'A brace of pheasants', price: 12, energy: 0, say: 'Hang them a few days, roast them on Sunday.' },
  grocer: { id: 'cw_apple', name: 'Cox apple', price: 0.4, energy: 8, say: 'Forty pence. English, these.' },
  cakes: { id: 'cw_cake', name: 'Slice of celebration cake', price: 2.8, energy: 25, say: 'From the display. Somebody\'s wedding had leftovers.' },
  cookies: { id: 'cw_cookie', name: 'Warm cookie', price: 1.2, energy: 15, say: 'Still warm. Triple chocolate.' },
  pies: { id: 'cw_pie', name: 'Steak & ale pie', price: 3.5, energy: 45, say: 'Mind, the gravy\'s like lava.' },
  florist: { id: 'cw_flowers', name: 'Bunch of tulips', price: 5, energy: 0, say: 'For someone special? Or your tutor?' },
  cobbler: { id: 'cw_key', name: 'Spare key (to what?)', price: 4, energy: 0, say: 'There you go. Don\'t ask me what it opens.' },
  cafe: { id: 'cw_fryup', name: 'Full English breakfast', price: 6.5, energy: 60, say: 'Sit anywhere, love. Tea\'s on the house.' },
  cheese: { id: 'cw_cheese', name: 'Wedge of Oxford Blue', price: 3.8, energy: 30, say: 'Try a bit first. Go on.' },
  fish: { id: 'cw_smokedfish', name: 'Smoked mackerel', price: 2.9, energy: 28, say: 'Smoked this morning.' },
  hats: { id: 'cw_hat', name: 'Novelty top hat', price: 9, energy: 0, say: 'Very Oxford. Very you.' },
};
export const STALL_LINES = {
  butcher: ['Lovely sausages today!', 'Who\'s next, please?', 'Pork pies, fresh this morning.'], game: ['Pheasant, partridge, venison!', 'Game season, my friend.'],
  grocer: ['Two for a pound on the clementines!', 'Lovely strawberries!'], cakes: ['That one in the window is for a fortieth.', 'We can do any shape you like.'],
  cookies: ['Fresh batch out in two minutes!', 'Hot cookies!'], pies: ['Pies! Hot pies!', 'Chicken and mushroom, steak and ale, cheese and onion.'],
  florist: ['Tulips, a fiver a bunch.', 'Mind the buckets, love.'], cobbler: ['Keys while you wait.', 'Heels done in ten minutes.'],
  cafe: ['Two teas and a bacon roll!', 'Table for one?'], cheese: ['Have a taste of this.', 'Nothing beats a good Stilton.'],
  fish: ['Fresh in from the coast!', 'Lovely kippers.'], hats: ['Try it on, no charge for trying.', 'Bowlers! Boaters!'],
};


const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const norm = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
/** a paint colour as an atlas key (the 'plain' cell, tinted) */
function paintKey(P, hex, k = 1) { const key = 'cwP_' + hex + '_' + k; if (!P.cells.has(key)) { const t = lin(hex).map((v) => Math.min(0.85, v * k)); P.cells.set(key, { ...P.cells.get('cwGreen'), tint: t }); } return key; }

// the interior's own few materials: decals (worn floor, normal blending), warm light pools (additive), bulbs (unlit)
const MATS = new WeakMap();
function inMats(W) {
  let m = MATS.get(W); if (m) return m;
  const G = cwGoods(W);
  const decal = new THREE.MeshBasicMaterial({ map: G.texture, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, name: 'cw-market-decal' });
  const pool = new THREE.MeshBasicMaterial({ map: G.texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.75, 0.6, 0.42), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6, name: 'cw-market-pool' });
  const bulb = new THREE.MeshBasicMaterial({ color: 0xffe2a8, name: 'cw-market-bulb' });
  m = { G, decal, pool, bulb }; MATS.set(W, m); return m;
}
// which ball colour goes with which painted heap (round things only)
const BALL = { apple: 'cwG_apple', orange: 'cwG_orange', lemon: 'cwG_lemon', green: 'cwG_leaf', potato: 'cwG_potato', tomato: 'cwG_apple', onion: 'cwG_potato', pepper: 'cwG_orange', plum: 'cwG_aubergine', cabbage: 'cwG_leaf' };
const PRODUCE = ['apple', 'orange', 'lemon', 'green', 'potato', 'carrot', 'tomato', 'aubergine', 'cabbage', 'banana', 'strawberry', 'grape', 'mushroom', 'onion', 'pepper', 'plum'];
const BUNT = ['cwRed', 'cwWhite', 'cwNavy', 'cwYellow', 'cwGreenLt', 'cwWhite'];

/** build the interior into ctx.scene; returns {doors: inside points per door id, counters: [{pos, id, slot}], stats} */
// Walk-in (core/interiors.js "seamless"; plan: covered_market.js): the market is built in WORLD coordinates, so its
// frame is the identity and each of the nine real entrances is a portal. In that mode the High Street passages are
// NOT built here (they are the outdoor passages you have just walked up), no doorway carries a "daylight" quad (the
// live street shows through it), and each avenue's back is a wall in the collider that its portal opens.
// (a generator: core/interiors.js builds a room a piece a frame, left at each `yield`)
export function* buildInterior(ctx, W, P, map) {
  const SL = !!ctx.seamless;
  const B = new RB(), Bs = new Batch(), Bg = new Batch(), Bd = new Batch(), Bp = new Batch(), Bb = new Batch(), S = cwSigns(W), col = ctx.collider;
  const IM = inMats(W), G = IM.G;
  const bodyP = body(map), slots = stallSlots(map), trades = assignTrades(slots);
  if (!P.cells.has('cwSky')) P.cells.set('cwSky', { ...P.cells.get('white'), tint: [1.6, 1.7, 1.8] });
  if (!P.cells.has('cwDaylight')) P.cells.set('cwDaylight', { ...P.cells.get('white'), tint: [2.2, 2.15, 2.0] });
  if (!P.cells.has('cwYellow')) P.cells.set('cwYellow', { ...P.cells.get('cwGreen'), tint: [0.8, 0.6, 0.04] });
  if (!P.cells.has('cwQuarry')) P.cells.set('cwQuarry', { ...P.cells.get('flags'), rx: 1 / 0.9, ry: 1 / 0.9, tint: [0.78, 0.42, 0.3] });
  if (!P.cells.has('cwFloorIn')) P.cells.set('cwFloorIn', { ...P.cells.get('flags'), rx: 1 / 2.2, ry: 1 / 2.2, tint: [0.86, 0.82, 0.76] });
  const X = { B, Bg, Bb, Bs, S, G, P };
  yield;
  // floors: the body, the High Street passages, Golden Cross's mouth (stone flags, a darker worn line down every way)
  B.flat('cwFloorIn', bodyP, 0.0);
  const passages = AVENUES.map((av) => [av.back[0], av.back[1], av.infill[1], av.infill[0]]);
  if (!SL) for (const p of passages) { B.flat('cwFloorIn', p, 0.0); B.flat('cwStucco', p, 3.45, [], true); }
  const wear = (a, b, wd) => {
    const d = norm(sub(b, a)), L = len(sub(b, a)), n = [-d[1], d[0]], k = Math.max(1, Math.round(L / 3.2)), uv = G.uv('wear');
    for (let i = 0; i < k; i++) {
      const p0 = [a[0] + d[0] * L * (i / k), a[1] + d[1] * L * (i / k)], p1 = [a[0] + d[0] * L * ((i + 1) / k), a[1] + d[1] * L * ((i + 1) / k)];
      Bd.card('decal', [p0[0] - n[0] * wd, 0.004, p0[1] - n[1] * wd], [p0[0] + n[0] * wd, 0.004, p0[1] + n[1] * wd], [p1[0] + n[0] * wd, 0.004, p1[1] + n[1] * wd], [p1[0] - n[0] * wd, 0.004, p1[1] - n[1] * wd], uv);
    }
  };
  for (const av of AVENUES) wear(av.s, av.e, 1.1);
  for (const c of CROSS) wear(c.a, c.b, 1.0);
  yield;
  // the walls (inward), the doors as bright daylight
  const area = (pts) => { let A = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += p[0] * q[1] - q[0] * p[1]; } return A; };
  const ring = (pts, h, key, skip) => {
    const A = area(pts);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], L = len(sub(b, a)); if (L < 0.05 || (skip && skip(a, b))) continue;
      const d = norm(sub(b, a)), nIn = A > 0 ? [-d[1], d[0]] : [d[1], -d[0]];
      // (walk-in: a doorway cut in this wall where an entrance is — ctx.seamless portals on this edge; the collider stays whole)
      const gaps = [];
      if (SL) for (const pt of ctx.seamless.portals) { const u = (pt.at[0] - a[0]) * d[0] + (pt.at[1] - a[1]) * d[1], off = Math.abs((pt.at[0] - a[0]) * d[1] - (pt.at[1] - a[1]) * d[0]); if (off < 0.12 && u > 0.2 && u < L - 0.2) gaps.push([Math.max(0, u - pt.w / 2), Math.min(L, u + pt.w / 2), pt.h]); }
      gaps.sort((p, q) => p[0] - q[0]);
      const piece = (u0, u1, y0, y1) => { if (u1 - u0 < 0.01) return; const p0 = [a[0] + d[0] * u0, a[1] + d[1] * u0], p1 = [a[0] + d[0] * u1, a[1] + d[1] * u1]; B.poly(key, [[p0[0], y0, p0[1]], [p1[0], y0, p1[1]], [p1[0], y1, p1[1]], [p0[0], y1, p0[1]]], [nIn[0], 0, nIn[1]], [[u0, y0], [u1, y0], [u1, y1], [u0, y1]]); };
      let u0 = 0; for (const [g0, g1, top] of gaps) { piece(u0, g0, 0, h); piece(g0, g1, top, h); u0 = g1; }
      piece(u0, L, 0, h);
      col.addSegment(a[0], a[1], b[0], b[1]);
    }
  };
  const isBack = (a, b) => len(sub(b, a)) > 30 && a[1] > 290 && b[1] > 290;
  ring(bodyP, H.wall, 'cwStucco', isBack);
  const REAR = [[210.1, 296.4], [210.5, 298.5], [213.6, 298.5], [226.6, 296.0], [228.8, 295.7], [241.8, 293.2], [243.8, 292.8], [254.1, 290.7], [256.3, 291.5]];
  B.flat('cwFloorIn', REAR, 0.0); B.flat('cwTimberDk', REAR, H.wall - 0.02, [], true);
  for (const [i, j] of [[0, 1], [2, 3], [4, 5], [6, 7]]) { const a = REAR[i], b = REAR[j]; B.poly('cwStucco', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], H.wall, b[1]], [a[0], H.wall, a[1]]], [0, 0, -1]); col.addSegment(a[0], a[1], b[0], b[1]); }
  for (const av of AVENUES) { const [a, b] = av.back; B.poly('cwStucco', [[a[0], 3.45, a[1]], [b[0], 3.45, b[1]], [b[0], H.wall, b[1]], [a[0], H.wall, a[1]]], [0, 0, -1]); }
  if (SL) for (const [k, av] of AVENUES.entries()) {
    const [a, b] = av.back, top = ctx.seamless.portals[k] ? ctx.seamless.portals[k].h : 2.6;
    col.addSegment(a[0], a[1], b[0], b[1]);
    B.poly('cwStucco', [[a[0], top, a[1]], [b[0], top, b[1]], [b[0], 3.45, b[1]], [a[0], 3.45, a[1]]], [0, 0, -1]);      // the head of the doorway, inside
  }
  if (!SL) for (const av of AVENUES) {
    const [bl, br] = av.back, [il, ir] = av.infill;
    for (const [a, b] of [[bl, il], [br, ir]]) { B.poly('cwStucco', [[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], 3.45, b[1]], [a[0], 3.45, a[1]]], null); B.poly('cwStucco', [[b[0], 0, b[1]], [a[0], 0, a[1]], [a[0], 3.45, a[1]], [b[0], 3.45, b[1]]], null); col.addSegment(a[0], a[1], b[0], b[1]); }
    const d = norm(sub(ir, il)), n = [d[1], -d[0]], s = n[1] > 0 ? 1 : -1;
    B.poly('cwDaylight', [[il[0], 0, il[1]], [ir[0], 0, ir[1]], [ir[0], 3.4, ir[1]], [il[0], 3.4, il[1]]], [-n[0] * s, 0, -n[1] * s]);
    col.addSegment(il[0], il[1], ir[0], ir[1]);
  }
  if (!SL) for (const av of AVENUES) {
    const dd = norm(sub(av.e, av.s)), px = [-dd[1], dd[0]];
    B.poly('cwDaylight', [[av.e[0] - px[0] * 1.5, 0, av.e[1] - px[1] * 1.5], [av.e[0] + px[0] * 1.5, 0, av.e[1] + px[1] * 1.5], [av.e[0] + px[0] * 1.5, 3.1, av.e[1] + px[1] * 1.5], [av.e[0] - px[0] * 1.5, 3.1, av.e[1] - px[1] * 1.5]].map(([x, y, z]) => [x - dd[0] * 0.05, y, z - dd[1] * 0.05]), [-dd[0], 0, -dd[1]]);
  }
  if (!SL) { const g = GOLDEN, d = norm(sub(g.inside, g.door)), px = [-d[1], d[0]], c = [g.inside[0] - d[0] * 2.1, g.inside[1] - d[1] * 2.1];
    B.poly('cwDaylight', [[c[0] - px[0] * 1.3, 0, c[1] - px[1] * 1.3], [c[0] + px[0] * 1.3, 0, c[1] + px[1] * 1.3], [c[0] + px[0] * 1.3, 3.0, c[1] + px[1] * 1.3], [c[0] - px[0] * 1.3, 3.0, c[1] - px[1] * 1.3]], [d[0], 0, d[1]]); }
  yield;
  // the roof: a dark boarded underside at the wall head, and over every avenue and cross way a king-post timber roof
  // with a glazed ridge, a lantern hanging from every other tie beam (a warm pool of light on the flags under it) and,
  // down the avenues, strings of bunting from fascia to fascia
  B.flat('cwTimberDk', bodyP, H.wall - 0.02, [], true);
  const lamps = [];
  const roofOver = (a, b, cut0, cut1, bunting) => {
    const d = norm(sub(b, a)), L = len(sub(b, a)) - cut0 - cut1, m = [a[0] + d[0] * (cut0 + L / 2), a[1] + d[1] * (cut0 + L / 2)];
    const F = frame(m[0], 0, m[1], d[0], d[1]);
    B.push(F); Bb.push(F); Bp.push(F);
    const ew = 2.35, rw = 0.7, y0 = H.eave, y1 = 6.35;
    for (const sx of [-1, 1]) {
      B.poly('cwTimber', [[-L / 2, y0, sx * ew], [L / 2, y0, sx * ew], [L / 2, y1, sx * rw], [-L / 2, y1, sx * rw]], [0, -1, -sx * 0.8]);
      B.poly('cwCream', [[-L / 2, H.ceil, sx * ew], [L / 2, H.ceil, sx * ew], [L / 2, y0, sx * ew], [-L / 2, y0, sx * ew]], [0, 0, -sx]);
      // the clerestory: a row of small panes over the stalls, lit from the roof
      B.poly('cwGlassLit', [[-L / 2, 4.05, sx * (ew - 0.01)], [L / 2, 4.05, sx * (ew - 0.01)], [L / 2, 4.25, sx * (ew - 0.01)], [-L / 2, 4.25, sx * (ew - 0.01)]], [0, 0, -sx]);
      B.box('cwTimberDk', 0, y0, sx * (ew - 0.05), L, 0.12, 0.12);         // wall plate
    }
    B.poly('cwSky', [[-L / 2, y1 + 0.02, -rw], [L / 2, y1 + 0.02, -rw], [L / 2, y1 + 0.02, rw], [-L / 2, y1 + 0.02, rw]], [0, -1, 0]);
    const n = Math.max(1, Math.round(L / 4));
    for (let k = 0; k <= n; k++) {
      const x = -L / 2 + (k / n) * L;
      B.box('cwTimberDk', x, y0, 0, 0.14, 0.2, ew * 2, 0, { bottom: true });
      B.box('cwTimberDk', x, (y0 + y1) / 2, 0, 0.12, y1 - y0, 0.12);
      for (const sx of [-1, 1]) { B.beam('cwTimberDk', [x, y0, sx * ew], [x, y1, sx * rw], 0.12); B.beam('cwTimberDk', [x, y0 + 0.9, 0], [x, y0 + 0.2, sx * (ew - 0.3)], 0.08); }
      if (k % 2 === 1) {
        B.box('iron', x, y0 - 0.45, 0, 0.02, 0.9, 0.02);
        B.lathe('cwGreen', x, 0, [[0.05, y0 - 0.9], [0.1, y0 - 1.0], [0.34, y0 - 1.22], [0.36, y0 - 1.26], [0.0, y0 - 1.26]], { seg: 10 });
        Bb.cyl('bulb', x, y0 - 1.36, 0, 0.09, 0.12, 8, true, 0.06);
        const pr = 2.3;
        Bp.card('pool', [x - pr, 0.012, pr], [x + pr, 0.012, pr], [x + pr, 0.012, -pr], [x - pr, 0.012, -pr], G.uv('pool'));
        lamps.push([m[0] + d[0] * x, m[1] + d[1] * x]);
      }
    }
    if (bunting) for (let k = 0; k < n * 2; k++) {
      const x = -L / 2 + ((k + 0.5) / (n * 2)) * L, nf = 9;
      for (let f = 0; f < nf; f++) {
        const z0 = -1.55 + (f / nf) * 3.1, z1 = z0 + 3.1 / nf * 0.86, sag = (z) => 4.02 - 0.32 * (1 - (z / 1.55) ** 2), key = BUNT[(f + k) % BUNT.length];
        const A = [x, sag(z0), z0], Bq = [x, sag(z1), z1], Cq = [x, sag((z0 + z1) / 2) - 0.24, (z0 + z1) / 2];
        B.tri(key, A, Bq, Cq, [0, 0], [0.3, 0], [0.15, 0.24]); B.tri(key, A, Cq, Bq, [0, 0], [0.15, 0.24], [0.3, 0]);
      }
      B.beam('iron', [x, sag0(-1.55), -1.55], [x, sag0(0), 0], 0.01); B.beam('iron', [x, sag0(0), 0], [x, sag0(1.55), 1.55], 0.01);
    }
    B.pop(); Bb.pop(); Bp.pop();
    return { m, d, L };
  };
  const ways = [];
  for (const av of AVENUES) { ways.push(roofOver(av.s, av.e, 0.5, 0.5, true)); yield; }
  for (const c of CROSS) { ways.push(roofOver(c.a, c.b, 2.2, 2.2, false)); yield; }
  yield;
  // the stalls
  const counters = [];
  for (let i = 0; i < slots.length; i++) { const s = slots[i], tr = trades[i]; const c = stall(X, s, tr, i); if (c) counters.push(c);
    // solid from the back wall to the line of the pilasters (it used to stop 0.45 m short of the front: counters, the
    // pilasters and whatever is piled at the front were walked through); a greengrocer's tiers of crates and sacks
    // stand out into the avenue, and are solid as far as they go
    col.addBox(s.x - s.nx * ((s.d - 0.07) / 2), s.z - s.nz * ((s.d - 0.07) / 2), s.d + 0.17, s.w + 0.1, Math.atan2(s.ax, s.az));
    { const sid = !tr ? null : tr.kind === 'named' ? STALLS[tr.k] && STALLS[tr.k].id : tr.kind === 'generic' ? GENERIC[tr.k] && GENERIC[tr.k].id : null; if (sid === 'grocer' || sid === 'veg') { col.addBox(s.x + s.nx * 0.35, s.z + s.nz * 0.35, 0.46, s.w - 0.2, Math.atan2(s.ax, s.az)); for (const e of [-1, 1]) col.addCircle(s.x + s.nx * 0.72 + s.ax * e * (s.w / 2 - 0.45), s.z + s.nz * 0.72 + s.az * e * (s.w / 2 - 0.45), 0.25); } }      // (the front tier of crates, 0.56 m out; the two sacks beyond it)
    if (i % 4 === 3) yield; }
  yield;
  // the café's tables out on the cross way
  { const c = counters.find((q) => q.id === 'cafe'); if (c) { const s = c.slot; for (let k = 0; k < 2; k++) { const x = s.x + s.nx * 0.9 + s.ax * (k ? 1.1 : -1.1), z = s.z + s.nz * 0.9 + s.az * (k ? 1.1 : -1.1); table(B, x, z); col.addCircle(x, z, 0.3); } } }      // (the café's two tables, out in the avenue: solid — kept just inside the table top, 0.33 m clear of the avenue's centre line, which must stay walkable; their chairs are not solid)
  const tmp = new THREE.Group(), meshes = [];
  const add = (list, name) => { for (const m of list) { m.name = name; m.castShadow = false; ctx.scene.add(m); meshes.push(m); } };
  add(B.build({}, tmp, { pack: P, noShadow: true }), 'cw:market-in');
  yield;
  add(Bs.build({ signs: S.material }, tmp, { noShadow: true }), 'cw:market-in-signs');
  yield;
  add(Bg.build({ goods: G.material }, tmp, { noShadow: true }), 'cw:market-in-goods');
  yield;
  add(Bd.build({ decal: IM.decal }, tmp, { noShadow: true }), 'cw:market-in-decal');
  add(Bp.build({ pool: IM.pool }, tmp, { noShadow: true }), 'cw:market-in-pools');
  add(Bb.build({ bulb: IM.bulb }, tmp, { noShadow: true }), 'cw:market-in-bulbs');
  for (const m of meshes) if (/decal|pools/.test(m.name)) m.renderOrder = 1;
  yield;
  // light: warm, from the lanterns (a point light at the middle of every way) and a soft fill from the glazed ridges
  ctx.scene.add(new THREE.HemisphereLight(0xfff0dc, 0x6e5a44, 0.72));
  for (const r of ways) { const L = new THREE.PointLight(0xffcf8a, 14, 40, 1.2); L.position.set(r.m[0], 3.4, r.m[1]); ctx.scene.add(L); }
  let tris = 0; for (const m of meshes) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
  return { counters, slots, trades, lamps, ways, stats: { tris: Math.round(tris), draws: meshes.length, stalls: slots.length } };
}
const sag0 = (z) => 4.02 - 0.32 * (1 - (z / 1.55) ** 2);

function table(B, x, z) { B.cyl('cwWhite', x, 0.72, z, 0.38, 0.04, 10); B.cyl('iron', x, 0, z, 0.04, 0.72, 5, false); for (const a of [0, Math.PI]) { B.box('cwGreen', x + Math.sin(a) * 0.6, 0.23, z + Math.cos(a) * 0.6, 0.38, 0.45, 0.38); B.box('cwGreen', x + Math.sin(a) * 0.78, 0.7, z + Math.cos(a) * 0.78, 0.38, 0.5, 0.05, a); } }

const ball = (B, key, x, y, z, r) => B.lathe(key, x, z, [[0, y], [r * 0.85, y + r * 0.3], [r, y + r], [r * 0.85, y + r * 1.7], [0, y + r * 2]], { seg: 6, crease: 1.2 });
function crossCard(Bg, uv, x, y, z, w, h) {
  Bg.card('goods', [x - w / 2, y, z], [x + w / 2, y, z], [x + w / 2, y + h, z], [x - w / 2, y + h, z], uv);
  Bg.card('goods', [x, y, z - w / 2], [x, y, z + w / 2], [x, y + h, z + w / 2], [x, y + h, z - w / 2], uv);
}

/** one stall unit at slot s (front centre on the avenue edge, facing the avenue): local +z = the avenue */
function stall(X, s, tr, i) {
  const { B, Bg, Bb, Bs, S, G, P } = X;
  const F = frame(s.x, 0, s.z, s.nz, -s.nx), w = s.w, d = s.d, hw = w / 2;
  B.push(F); Bg.push(F); Bb.push(F);
  const named = tr && tr.kind === 'named' ? STALLS[tr.k] : null, gen = tr && tr.kind === 'generic' ? GENERIC[tr.k] : null;
  const shut = !tr || tr.kind === 'shut';
  // each unit is painted in its own colours: pilasters, fascia and cornice (the fascia board itself is the lettering)
  const bg = named ? named.bg : gen ? gen.bg : ['#1f3d2a', '#3a2418', '#1a2a44', '#4a1a22'][Math.floor(hash(i, 2.2) * 4)];
  const lum = (() => { const c = lin(bg); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; })();
  const paint = paintKey(P, lum > 0.5 ? '#2a4a34' : bg), trim = paintKey(P, lum > 0.5 ? bg : '#e8dcc0', lum > 0.5 ? 0.9 : 1);
  // carcass: back wall (panelled dado, cream above), partitions, ceiling, quarry-tiled floor
  B.poly('cwCream', [[-hw, 1.0, -d], [hw, 1.0, -d], [hw, H.ceil, -d], [-hw, H.ceil, -d]], [0, 0, 1]);
  B.poly('cwTimberDk', [[-hw, 0, -d], [hw, 0, -d], [hw, 1.0, -d], [-hw, 1.0, -d]], [0, 0, 1]);
  for (const sx of [-1, 1]) { B.box('cwCream', sx * (hw + 0.03), H.ceil / 2, -d / 2, 0.06, H.ceil, d, 0); B.box('cwTimberDk', sx * (hw - 0.005), 0.5, -d / 2 - 0.1, 0.02, 1.0, d - 0.3, 0, { top: true }); }
  B.poly('cwTimber', [[-hw, H.ceil, 0], [hw, H.ceil, 0], [hw, H.ceil, -d], [-hw, H.ceil, -d]], [0, -1, 0]);
  B.poly('cwQuarry', [[-hw, 0.006, 0], [hw, 0.006, 0], [hw, 0.006, -d], [-hw, 0.006, -d]], [0, 1, 0]);
  // front: pilasters with caps and bases, the fascia under a moulded cornice
  B.box(paint, 0, (H.ceil + H.fascia) / 2, 0.04, w + 0.1, H.fascia - H.ceil, 0.08);
  B.box(trim, 0, H.fascia + 0.05, 0.08, w + 0.22, 0.1, 0.18, 0, { bottom: true });
  B.box(trim, 0, H.ceil - 0.03, 0.06, w + 0.1, 0.06, 0.1, 0, { bottom: true });
  for (const sx of [-1, 1]) { B.box(paint, sx * hw, H.ceil / 2, 0.05, 0.2, H.ceil, 0.14); B.box(trim, sx * hw, H.ceil - 0.12, 0.06, 0.26, 0.16, 0.18); B.box(trim, sx * hw, 0.12, 0.06, 0.26, 0.24, 0.18); }
  const fascia = named ? S.uv('stall' + tr.k) : gen ? S.uv('gen' + tr.k) : null;
  if (fascia) { Bs.push(F); Bs.card('signs', [-hw + 0.1, H.ceil + 0.07, 0.09], [hw - 0.1, H.ceil + 0.07, 0.09], [hw - 0.1, H.fascia - 0.07, 0.09], [-hw + 0.1, H.fascia - 0.07, 0.09], fascia); Bs.pop(); }
  if (shut) {
    B.poly('cwGreenLt', [[-hw + 0.1, 0, -0.1], [hw - 0.1, 0, -0.1], [hw - 0.1, H.ceil, -0.1], [-hw + 0.1, H.ceil, -0.1]], [0, 0, 1]);
    for (let k = 1; k < 14; k++) B.box('cwGreen', 0, k * 0.24, -0.08, w - 0.2, 0.025, 0.02);
    B.pop(); Bg.pop(); Bb.pop(); return null;
  }
  // a bare bulb under the fascia lights the goods
  Bb.cyl('bulb', 0, H.ceil - 0.28, -0.35, 0.05, 0.08, 6, true, 0.04); B.box('iron', 0, H.ceil - 0.1, -0.35, 0.015, 0.2, 0.015);
  const id = named ? named.id : gen.id, R = (k) => hash(i, k);
  const counter = (key = 'cwTimber', top = 'cwTimberDk', h = 0.92, z = -0.7) => { B.box(key, 0, h / 2, z, w - 0.5, h, 0.6, 0, { top: false }); B.box(top, 0, h + 0.02, z, w - 0.4, 0.04, 0.7); B.box(trim, 0, 0.06, z + 0.31, w - 0.5, 0.12, 0.02); return h; };
  // shelves on the back wall: real boards, the stock a painted strip (two rows a strip)
  const shelves = (names, rows = 2, y0 = 1.0) => {
    const sw = w - 0.3, n = Math.max(1, Math.round(sw / 1.8)), cw = sw / n;
    for (let r = 0; r < rows; r++) {
      const yb = y0 + r * 0.95;
      for (const yy of [yb, yb + 0.47]) B.box('cwTimberDk', 0, yy, -d + 0.2, sw, 0.04, 0.36, 0, { bottom: true });
      for (let k = 0; k < n; k++) card(Bg, G.uv(names[(k + r + i) % names.length]), -sw / 2 + (k + 0.5) * cw, yb + 0.02, -d + 0.06, cw - 0.02, 0.9);
    }
    for (const sx of [-1, 1]) B.box('cwTimberDk', sx * (sw / 2 - 0.02), y0 + rows * 0.47, -d + 0.2, 0.04, rows * 0.95, 0.36);
  };
  const crate = (x, y, z, cw, cd, prod, balls = 3) => {
    B.box('cwTimber', x, y + 0.09, z, cw, 0.18, cd, 0, { top: false });
    for (const sx of [-1, 1]) B.box('cwTimberDk', x + sx * (cw / 2 - 0.02), y + 0.1, z + cd / 2 + 0.01, 0.04, 0.2, 0.02);
    mound(Bg, G.uv(prod), x, y + 0.15, z, cw - 0.03, cd - 0.03, 0.12);
    const bk = BALL[prod];
    if (bk) for (let a = 0; a < balls; a++) { const r = prod === 'cabbage' ? 0.09 : 0.045; ball(B, bk, x + (a - (balls - 1) / 2) * cw * 0.28 + (R(a + 9) - 0.5) * 0.05, y + 0.2 + (a % 2) * 0.03, z + cd * 0.12 + (R(a + 4) - 0.5) * 0.1, r); }
    if (R(x * 7 + z) < 0.6) card(Bg, G.uv('tags'), x + cw * 0.28, y + 0.17, z + cd / 2 + 0.02, 0.13, 0.09);
  };
  const stand = (x, z, hgt) => { B.box('cwTimberDk', x, hgt / 2, z, 0.04, hgt, 0.04); };
  const produce = (k0) => {
    // three stepped tiers of crates spilling out to the avenue edge, sacks on the floor, a rail of bananas and greens
    const tiers = [[0.42, 0.25], [0.78, -0.4], [1.14, -1.05]], per = Math.max(3, Math.floor((w - 0.4) / 0.62)), cw = (w - 0.4) / per;
    tiers.forEach(([y, z], r) => {
      B.box(paint, 0, y / 2, z, w - 0.3, y, 0.62, 0, { top: true });
      for (let k = 0; k < per; k++) crate(-hw + 0.2 + (k + 0.5) * cw, y, z, cw - 0.04, 0.56, PRODUCE[(k * 3 + r * 5 + k0) % PRODUCE.length], r === 2 ? 2 : 3);
    });
    for (let k = 0; k < 2; k++) { const x = (k ? 1 : -1) * (hw - 0.45); B.lathe('cwG_potato', x, 0.72, [[0.2, 0], [0.24, 0.2], [0.2, 0.42], [0.08, 0.5], [0, 0.52]], { seg: 7 }); mound(Bg, G.uv(k ? 'onion' : 'potato'), x, 0.42, 0.72, 0.36, 0.36, 0.08); }
    B.box('cwSteel', 0, 2.85, -0.2, w - 0.2, 0.04, 0.04);
    for (let k = 0; k < 5; k++) { const x = -hw + 0.5 + k * ((w - 1) / 4); B.box('iron', x, 2.72, -0.2, 0.015, 0.22, 0.015); crossCard(Bg, G.uv('banana'), x, 2.2, -0.2, 0.4, 0.5); }
    shelves(['boxes', 'jars'], 1, 1.55);
  };
  switch (id) {
    case 'butcher': {
      card(Bg, G.uv('tiles'), 0, 1.0, -d + 0.02, w - 0.1, 2.3);
      const h = counter('cwWhite', 'cwSteelLt', 0.95, -0.55);
      B.box('cwGlass', 0, h + 0.28, -0.3, w - 0.5, 0.5, 0.03);
      for (let k = 0; k < 5; k++) { const x = -hw + 0.55 + k * ((w - 1.1) / 4); B.box('cwSteelLt', x, h + 0.04, -0.6, 0.66, 0.04, 0.46); mound(Bg, G.uv(k % 2 ? 'sausage' : 'meat'), x, h + 0.065, -0.6, 0.6, 0.4, 0.03); }
      // hams and joints on hooks along a rail; sausages in links behind
      for (let k = 0; k < 10; k++) B.cyl('cwG_ham', -hw + 0.4 + k * 0.33, 1.25 + 0.1 * Math.sin(k), -d + 0.35, 0.04, 0.32, 5, true);
      for (const zr of [-0.45, -d + 0.6]) { B.box('cwSteel', 0, 2.75, zr, w - 0.4, 0.05, 0.05); for (let k = 0; k < 6; k++) { const x = -hw + 0.55 + k * ((w - 1.1) / 5); B.box('iron', x, 2.55, zr, 0.02, 0.4, 0.02); const big = (k + i) % 3 === 0; B.lathe(big ? 'cwG_ham' : 'cwG_pink', x, zr, big ? [[0, 1.75], [0.17, 1.9], [0.14, 2.2], [0.04, 2.33], [0, 2.35]] : [[0, 1.95], [0.1, 2.05], [0.11, 2.25], [0.03, 2.35], [0, 2.36]], { seg: 7 }); } }
      break;
    }
    case 'game': {
      card(Bg, G.uv('tiles'), 0, 1.0, -d + 0.02, w - 0.1, 2.3);
      const h = counter('cwTimber', 'cwWhite');
      for (let k = 0; k < 4; k++) mound(Bg, G.uv('meat'), -hw + 0.6 + k * ((w - 1.2) / 3), h + 0.04, -0.7, 0.55, 0.42, 0.02);
      // pheasants and mallard hung by the neck from two rails: feathers, bloodless
      for (const zr of [0.15, -0.9]) {
        B.box('cwSteel', 0, 2.95, zr, w, 0.05, 0.05);
        for (let k = 0; k < 10; k++) {
          const x = -hw + 0.25 + k * ((w - 0.5) / 9), duck = (k + (zr > 0 ? 0 : 1)) % 3 === 2, body = duck ? 'cwG_choc' : 'cwG_feather';
          B.box('iron', x, 2.82, zr, 0.02, 0.25, 0.02);
          B.cyl(duck ? 'cwG_leaf' : 'cwRed', x, 2.56, zr, 0.035, 0.14, 5, true);
          B.lathe(body, x, zr, [[0.0, 1.98], [0.11, 2.1], [0.13, 2.3], [0.07, 2.48], [0.0, 2.56]], { seg: 6 });
          if (!duck) B.box('cwG_feather', x, 1.7, zr, 0.05, 0.55, 0.02);
        }
      }
      break;
    }
    case 'grocer': case 'veg': produce(Math.floor(R(1) * 16)); break;
    case 'cakes': {
      // the window: a glazed case at the front with celebration cakes on stands, the shelves of smaller cakes behind
      B.box('cwWhite', 0, 0.45, -0.45, w - 0.3, 0.9, 0.8, 0, { top: true });
      B.box('cwGlass', 0, 1.6, -0.04, w - 0.3, 1.4, 0.03);
      for (const sx of [-1, 1]) B.box(trim, sx * (hw - 0.15), 1.6, -0.45, 0.04, 1.4, 0.8);
      B.box(trim, 0, 2.32, -0.45, w - 0.3, 0.04, 0.82);
      const cols = ['cwG_pink', 'cwG_cream', 'cwG_choc', 'cwWhite', 'cwG_lemon'];
      for (let k = 0; k < 5; k++) {
        const x = -hw + 0.5 + k * ((w - 1.0) / 4), c1 = cols[(k + i) % cols.length], c2 = cols[(k + i + 2) % cols.length], zz = -0.4 - (k % 2) * 0.12;
        B.cyl('cwSteelLt', x, 0.9, zz, 0.04, 0.12, 6, false); B.cyl('cwWhite', x, 1.02, zz, 0.22, 0.02, 12);
        let y = 1.04; const tiers = 1 + ((k + i) % 3);
        for (let t = 0; t < tiers; t++) { const r = 0.19 - t * 0.05, hh = 0.14; B.cyl(t % 2 ? c2 : c1, x, y, zz, r, hh, 12); B.cyl('cwWhite', x, y + hh, zz, r + 0.012, 0.02, 12); for (let q = 0; q < 6; q++) { const a = q * 1.047; B.box('cwG_pink', x + Math.sin(a) * r, y + hh * 0.6, zz + Math.cos(a) * r, 0.03, 0.03, 0.03); } y += hh + 0.02; }
        B.lathe('cwRed', x, zz, [[0, y], [0.05, y + 0.04], [0, y + 0.11]], { seg: 6 });
      }
      shelves(['cakes', 'cakes', 'boxes'], 2, 1.0);
      break;
    }
    case 'cookies': {
      const h = counter('cwG_choc', 'cwWhite');
      for (let k = 0; k < 4; k++) { const x = -hw + 0.6 + k * ((w - 1.2) / 3); B.box('cwSteelLt', x, h + 0.04, -0.7, 0.55, 0.03, 0.4); for (let a = 0; a < 6; a++) B.cyl(a % 2 ? 'cwG_pastry' : 'cwG_choc', x - 0.18 + (a % 3) * 0.18, h + 0.06 + (a > 2 ? 0.02 : 0), -0.78 + (a > 2 ? 0.16 : 0), 0.075, 0.025, 8); }
      B.box('cwSteel', hw - 0.9, 1.3, -d + 0.4, 1.2, 1.2, 0.6); B.box('cwBlack', hw - 0.9, 1.3, -d + 0.71, 0.9, 0.7, 0.02);
      shelves(['jars', 'boxes'], 1, 2.0);
      break;
    }
    case 'pies': {
      const h = counter('cwNavy', 'cwSteelLt');
      B.box('cwGlass', 0, h + 0.3, -0.7, w - 0.6, 0.5, 0.5, 0, { bottom: false });
      for (let k = 0; k < 8; k++) { const x = -hw + 0.5 + (k % 4) * ((w - 1) / 3), z = -0.82 + (k > 3 ? 0.24 : 0); B.cyl('cwG_pastry', x, h + 0.06 + (k > 3 ? 0 : 0.2), z, 0.1, 0.06, 8); }
      shelves(['pies', 'loaves'], 2);
      break;
    }
    case 'florist': {
      // buckets of flowers on tiered stands spilling out over the avenue edge, more on the shelves behind
      const fl = ['flowersR', 'flowersY', 'flowersW', 'flowersP'];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
        const x = -hw + 0.35 + k * ((w - 0.7) / 5), y = r * 0.35, z = 0.35 - r * 0.5;
        if (r) B.box('cwTimber', x, y - 0.02, z, 0.62, 0.04, 0.44);
        B.cyl('cwG_bucket', x, y, z, 0.14, 0.32, 8, false, 0.11);
        crossCard(Bg, G.uv(fl[(k + r * 2 + i) % fl.length]), x, y + 0.2, z, 0.5, 0.62);
      }
      shelves(['flowersW', 'flowersR', 'flowersY', 'flowersP'], 1, 1.6);
      break;
    }
    case 'cobbler': {
      counter('cwTimberDk', 'cwSteel');
      B.box('cwTimberDk', 0, 1.6, -d + 0.05, w - 0.4, 1.6, 0.05);
      for (let k = 0; k < 40; k++) B.box('cwGilt', -hw + 0.4 + (k % 10) * ((w - 0.8) / 9), 1.0 + Math.floor(k / 10) * 0.3, -d + 0.12, 0.03, 0.08, 0.01);
      card(Bg, G.uv('shoes'), 0, 2.45, -d + 0.15, w - 0.6, 0.6);
      B.box('cwSteel', hw - 0.7, 1.08, -0.75, 0.4, 0.3, 0.3);
      break;
    }
    case 'cafe': {
      counter('cwMaroon', 'cwTimber');
      B.box('cwSteelLt', -hw + 0.8, 1.15, -0.75, 0.6, 0.45, 0.4);
      B.cyl('cwSteelLt', hw - 0.8, 0.94, -0.75, 0.15, 0.4, 8);
      B.box('cwGlass', 0, 1.15, -0.62, 1.2, 0.4, 0.02); card(Bg, G.uv('cakes'), 0, 0.96, -0.72, 1.1, 0.4);
      shelves(['mugs', 'teas'], 2);
      break;
    }
    case 'cheese': {
      counter('cwG_cream', 'cwTimber');
      shelves(['cheeses'], 2);
      for (let a = 0; a < 5; a++) { const x = -hw + 0.6 + a * ((w - 1.2) / 4); B.cyl('cwG_lemon', x, 0.96, -0.7, 0.15, 0.12, 12); B.cyl(a % 2 ? 'cwG_cream' : 'cwG_lemon', x, 1.08, -0.7, 0.13, 0.1, 12); }
      for (let k = 0; k < 3; k++) B.cyl('cwG_lemon', -hw + 0.4 + k * 0.4, 0, 0.35, 0.18, 0.14 * (3 - k), 12);   // a stack of wheels by the door
      break;
    }
    case 'fish': {
      B.box('cwWhite', 0, 0.45, -0.6, w - 0.4, 0.9, 0.9, 0, { top: false });
      B.poly('cwWhite', [[-hw + 0.2, 0.9, -0.15], [hw - 0.2, 0.9, -0.15], [hw - 0.2, 1.15, -1.05], [-hw + 0.2, 1.15, -1.05]], [0, 1, 0.3]);
      const n = 3, fw = (w - 0.5) / n;
      for (let k = 0; k < n; k++) Bg.card('goods', [-hw + 0.25 + k * fw, 0.915, -0.15], [-hw + 0.25 + (k + 1) * fw, 0.915, -0.15], [-hw + 0.25 + (k + 1) * fw, 1.165, -1.05], [-hw + 0.25 + k * fw, 1.165, -1.05], G.uv('fish'));
      card(Bg, G.uv('tiles'), 0, 1.0, -d + 0.02, w - 0.1, 2.3);
      break;
    }
    case 'hats': {
      shelves(['hatboxes'], 2);
      for (let k = 0; k < 4; k++) {
        const x = -hw + 0.5 + k * ((w - 1) / 3), zz = -0.3 - (k % 2) * 0.5, ht = 1.3 + (k % 2) * 0.3, key = ['cwBlack', 'cwG_cream', 'cwNavy', 'cwMaroon'][(k + i) % 4];
        B.cyl('cwSteel', x, 0, zz, 0.02, ht, 4, false); B.cyl('cwSteel', x, 0, zz, 0.18, 0.03, 8);
        B.cyl(key, x, ht, zz, 0.17, 0.02, 10); B.cyl(key, x, ht + 0.02, zz, 0.1, (k + i) % 2 ? 0.2 : 0.11, 10); B.cyl('cwRed', x, ht + 0.03, zz, 0.105, 0.03, 10);
      }
      break;
    }
    default: {
      // generic trades: a counter, shelves of stock to suit
      const SH = { tea: ['teas', 'jars'], jewel: ['jewels', 'boxes'], leather: ['bags', 'shoes'], cards: ['cards'], deli: ['jars', 'bottles', 'cheeses'], bakery: ['loaves', 'cakes'], gifts: ['mugs', 'boxes', 'teas'] }[id] || ['boxes'];
      const key = { tea: 'cwG_choc', jewel: 'cwNavy', leather: 'cwG_choc', cards: 'cwWhite', deli: 'cwG_pastry', bakery: 'cwG_pastry', gifts: 'cwNavy' }[id] || 'cwTimber';
      const h = counter(key === 'cwWhite' ? 'cwTimber' : paint, 'cwTimberDk');
      if (id === 'jewel') { B.box('cwGlass', 0, h + 0.15, -0.7, w - 0.6, 0.02, 0.6); mound(Bg, G.uv('jewels'), 0, h + 0.04, -0.7, w - 0.7, 0.5, 0.0); }
      else if (id === 'bakery') { for (let k = 0; k < 2; k++) card(Bg, G.uv('loaves'), (k - 0.5) * (w - 0.8) / 2, h + 0.02, -0.75, (w - 0.9) / 2, 0.45); }
      else if (id === 'deli') { for (let k = 0; k < 6; k++) { const x = -hw + 0.5 + k * ((w - 1) / 5); B.box('iron', x, 2.75, -0.45, 0.015, 0.3, 0.015); B.cyl('cwMaroon', x, 2.15, -0.45, 0.05, 0.45, 6, true, 0.045); } }
      else if (id === 'cards') { B.cyl('cwSteel', hw - 0.6, 0, 0.1, 0.02, 1.7, 4, false); for (let a = 0; a < 3; a++) { const ang = a * 2.094; Bg.push(new THREE.Matrix4().makeRotationY(ang).setPosition(hw - 0.6, 0, 0.1)); card(Bg, G.uv('cards'), 0, 0.5, 0.06, 0.4, 1.1); Bg.pop(); } }
      else if (id === 'leather') { for (let k = 0; k < 5; k++) { const x = -hw + 0.5 + k * ((w - 1) / 4); B.box('iron', x, 2.8, -0.3, 0.015, 0.25, 0.015); B.box(['cwG_choc', 'cwBlack', 'cwMaroon'][k % 3], x, 2.45, -0.3, 0.32, 0.3, 0.1); } }
      shelves(SH, 2);
      void R;
    }
  }
  B.pop(); Bg.pop(); Bb.pop();
  const cpos = [s.x + s.nx * 0.55, s.z + s.nz * 0.55];
  return named ? { id, pos: cpos, slot: s, keeper: [s.x - s.nx * 1.35, s.z - s.nz * 1.35], heading: Math.atan2(s.nx, s.nz) } : null;
}
void rectPts; void geoOf; void TAU; void southDoor;
