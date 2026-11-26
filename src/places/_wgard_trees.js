// Worcester College gardens: the trees (places/worcester_gardens.js; work package I of docs/research/worcester_survey.md).
// Pure: the list of what is planted where, as MAP TREES ([x, z, height, species]) for the city's own tree system, so
// that each is a 3D tree near the camera and one card beyond (the grounds module's own belt round the lake was full
// geometry at any distance).
//
// TOPS: every tree top the 2022 height survey (Environment Agency LIDAR, 1 m, OGL v3; tools/worc_plan.py) finds on the
// college's ground west of Walton Street: [x, z, height above the ground]. Position and height are MEASURED (K); the
// kind of each tree is from the photographs, the college's garden pages and the Register of Parks and Gardens where
// they say (KINDS below), and otherwise a GUESS from where it stands and how tall it is.
export const TOPS = [[-647.5,-204.5,18.1],[-637.5,-204.5,22.7],[-652.5,-196.5,22.1],[-636.5,-196.5,21.3],[-678.5,-194.5,15.6],[-581.5,-191.5,23.6],[-620.5,-190.5,15.9],[-530.5,-189.5,18.3],[-489.5,-188.5,12.8],[-607.5,-185.5,24.4],[-663.5,-184.5,22.3],[-400.5,-184.5,15.3],[-594.5,-183.5,27.0],[-655.5,-182.5,20.2],[-548.5,-182.5,22.1],[-513.5,-182.5,26.4],[-447.5,-182.5,20.2],[-430.5,-182.5,19.9],[-370.5,-182.5,9.7],[-641.5,-181.5,19.4],[-562.5,-178.5,18.8],[-659.5,-175.5,19.5],[-452.5,-174.5,20.7],[-369.5,-167.5,10.5],[-647.5,-164.5,18.7],[-639.5,-150.5,18.3],[-630.5,-150.5,20.8],[-617.5,-139.5,18.6],[-633.5,-138.5,21.4],[-625.5,-137.5,14.9],[-366.5,-127.5,11.9],[-622.5,-120.5,24.7],[-262.5,-117.5,20.2],[-597.5,-116.5,17.2],[-587.5,-105.5,22.1],[-401.5,-102.5,12.7],[-244.5,-102.5,13.9],[-332.5,-99.5,9.8],[-345.5,-94.5,9.6],[-571.5,-91.5,21.0],[-584.5,-90.5,21.6],[-383.5,-83.5,20.4],[-356.5,-83.5,10.8],[-239.5,-82.5,13.0],[-562.5,-80.5,16.7],[-367.5,-76.5,17.0],[-554.5,-70.5,17.5],[-332.5,-69.5,13.1],[-350.5,-65.5,13.8],[-364.5,-63.5,17.4],[-233.5,-63.5,14.2],[-541.5,-59.5,11.2],[-389.5,-54.5,18.9],[-417.5,-53.5,13.0],[-316.5,-52.5,11.4],[-309.5,-52.5,12.1],[-378.5,-51.5,16.6],[-545.5,-50.5,17.7],[-436.5,-49.5,21.6],[-268.5,-46.5,17.6],[-255.5,-46.5,8.9],[-529.5,-44.5,17.8],[-343.5,-44.5,14.7],[-399.5,-43.5,17.4],[-233.5,-42.5,18.5],[-520.5,-41.5,18.0],[-406.5,-41.5,17.4],[-392.5,-41.5,17.3],[-376.5,-38.5,11.5],[-455.5,-34.5,16.1],[-400.5,-34.5,18.3],[-342.5,-34.5,16.0],[-392.5,-33.5,17.6],[-523.5,-28.5,20.1],[-461.5,-26.5,15.6],[-415.5,-25.5,19.3],[-329.5,-23.5,12.1],[-403.5,-22.5,21.5],[-482.5,-19.5,19.7],[-302.5,-18.5,14.8],[-501.5,-11.5,26.3],[-412.5,-1.5,28.8],[-480.5,-0.5,21.2],[-375.5,4.5,18.2],[-403.5,6.5,28.1],[-235.5,6.5,16.3],[-410.5,9.5,27.7],[-234.5,14.5,16.2],[-458.5,19.5,13.1],[-322.5,19.5,11.5],[-372.5,27.5,21.1],[-358.5,36.5,25.2],[-447.5,37.5,18.2],[-394.5,39.5,11.8],[-422.5,41.5,10.5],[-430.5,50.5,14.6],[-397.5,52.5,25.3],[-387.5,55.5,21.5],[-233.5,55.5,10.3],[-266.5,56.5,16.7],[-414.5,64.5,29.9],[-356.5,65.5,25.6],[-247.5,66.5,20.9],[-377.5,69.5,11.8],[-337.5,70.5,30.3],[-324.5,70.5,18.7],[-403.5,71.5,29.9],[-271.5,71.5,18.2],[-306.5,72.5,20.2],[-387.5,79.5,17.8],[-366.5,82.5,14.2],[-326.5,84.5,21.7],[-312.5,88.5,21.0],[-361.5,90.5,18.5],[-294.5,97.5,11.3],[-267.5,99.5,15.2],[-260.5,105.5,15.2],[-322.5,106.5,16.9],[-333.5,107.5,19.6],[-325.5,117.5,13.3],[-312.5,121.5,17.4],[-299.5,123.5,19.3],[-291.5,124.5,20.0],[-272.5,124.5,13.0],[-323.5,126.5,13.2],[-250.5,128.5,8.6],[-335.5,131.5,21.6],[-253.5,134.5,8.7],[-271.5,136.5,12.9],[-277.5,147.5,13.0],[-323.5,148.5,14.3],[-290.5,148.5,11.7]];

/** trees whose kind is known or reasoned: [x, z (of the survey's top), species, K | G, what it rests on] */
export const KINDS = [
  [-337.5, 70.5, 'plane', 'K', 'the tallest tree in the college, 30 m: one of the Nuffield Lawn\'s London planes (34 nuffield lawn trees/…under the great plane…, …plane canopy and bench)'],
  [-356.5, 65.5, 'plane', 'G', 'a 26 m tree on the lawn of "majestic plane trees" (college gardens page)'],
  [-397.5, 52.5, 'plane', 'K', 'old London plane in the lakeside border (gardeners\' blog 2013, its trunk)'],
  [-414.5, 64.5, 'plane', 'G', '30 m, in the belt by the canal: "planes, limes and sycamores leaning over the canal"'],
  [-403.5, 71.5, 'plane', 'G', 'the same belt, 30 m'],
  [-412.5, -1.5, 'plane', 'G', '29 m on the lake\'s east bank (the Provost\'s wood)'], [-403.5, 6.5, 'plane', 'G', '28 m, the same group'], [-410.5, 9.5, 'plane', 'G', '28 m, the same group, its top out over the water'],
  [-358.5, 36.5, 'beech', 'K', 'the copper beech by the path where it meets the lake: rust-brown in the December 2023 aerial picture, purple on the college map and in the 2014 aerial; which of the tops it is: G'],
  [-247.5, 66.5, 'catalpa', 'K', 'the champion Catalpa speciosa at the east end of the lawn beside the medieval range (34 nuffield lawn trees/catalpa…): the 21 m top there'],
  [-383.5, -83.5, 'willow', 'G', 'the island\'s tree, 20 m ("duck island", gardeners\' blog)'],
  [-422.5, 41.5, 'chestnut', 'K', 'the horse chestnut leaning over the old gateway, its trunk by the wall\'s south end (38/16c gateway… 2011, the tour picture)', [-420.2, 52.5]],
  [-430.5, 50.5, 'chestnut', 'K', 'horse chestnuts over the path west of the gateway (35/lake west tip… 2011)'],
  [-458.5, 19.5, 'chestnut', 'K', 'the same'], [-480.5, -0.5, 'chestnut', 'K', 'the leaning horse chestnut by the stone seat (35/stone bench… 2018)'], [-482.5, -19.5, 'chestnut', 'G', 'by the pavilion'],
  [-332.5, -99.5, 'holm', 'K', 'the line of ilex planted by Provost Lys c. 1913 along the north boundary (Register of Parks and Gardens)'], [-345.5, -94.5, 'holm', 'K', 'the same line'], [-356.5, -83.5, 'holm', 'G', 'the same line, by the old wall'],
  [-594.5, -183.5, 'sequoia', 'K', 'the wellingtonia by the tennis courts\' north corner: "Existing Sequoiadendron" on the 2014 planning site plan (36/PLAN tennis courts and gardeners machinery shed…), 23 m east of the corner; the 27 m top there'],
  [-607.5, -185.5, 'lime', 'K', '"Existing Lime Tree" on the same plan, 12 m east of the tennis fence\'s north corner (its pendulous branches lifted for the path): the 24 m top there'],
  [-376.5, -38.5, 'conifer', 'G', 'a dark yew in the Provost\'s Garden (31/provosts garden far end… 2016 shows one)'], [-329.5, -23.5, 'conifer', 'G', 'the dark conifer north-west of the Lodgings in the 2014 aerial picture'],
];
/** species the city's tree system draws for each kind (it has no beech, chestnut, holm oak or catalpa of its own) */
const DRAWN = { plane: 'plane', beech: 'broad', catalpa: 'broad', holm: 'broad', chestnut: 'broad', lime: 'broad', willow: 'willow', conifer: 'conifer', sequoia: 'conifer', broad: 'broad' };

const dSeg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L)) : 0; return [Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz), a[0] + t * dx, a[1] + t * dz]; };
const pip = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const xi = p[i][0], zi = p[i][1], xj = p[j][0], zj = p[j][1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };

/**
 * What to plant. env: { water: rings, buildings: rings, paths: [{pts, w}], mapped: [[x, z, h]] (trees the map already
 * has), keep(x, z) -> true where nothing may stand, own(x, z) -> this package's ground }.
 * -> { trees: [[x, z, h, species]], drop: indices of `mapped` that a measured tree replaces, special: [{x, z, h, kind}]
 *      (the copper beech: its colour is not one the city's trees have), records: [[x, z, h, kind, K | G, why]], skipped }
 */
export function plantTops(env) {
  const out = { trees: [], drop: [], special: [], records: [], skipped: [] };
  const inRing = (x, z, rings) => rings.some((r) => pip(x, z, r));
  const pathClear = (x, z) => { let best = null; for (const p of env.paths) for (let i = 0; i < p.pts.length - 1; i++) { const q = dSeg(x, z, p.pts[i], p.pts[i + 1]), need = p.w / 2 + 1.1; if (q[0] < need && (!best || need - q[0] > best[0])) best = [need - q[0], q[1], q[2]]; } return best; };
  const ringNear = (x, z, rings) => { let best = [1e9, x, z]; for (const r of rings) for (let i = 0; i < r.length; i++) { const q = dSeg(x, z, r[i], r[(i + 1) % r.length]); if (q[0] < best[0]) best = q; } return best; };
  const used = new Set();
  for (const [tx, tz, th] of TOPS) {
    if (!env.own(tx, tz)) continue;
    let x = tx, z = tz, why = '';
    const kd = KINDS.find((k) => k[0] === tx && k[1] === tz);
    if (kd && kd[5]) {      // a trunk seen in a picture: it stands there, whatever is near
      out.records.push([kd[5][0], kd[5][1], th, kd[2], kd[3], kd[4] + '; trunk placed from the picture']); out.trees.push([kd[5][0], kd[5][1], th, DRAWN[kd[2]] || 'broad']); continue;
    }
    if (inRing(x, z, env.buildings)) { out.skipped.push([tx, tz, th, 'on a roof: a building, not a tree']); continue; }
    // a tree the map already has within 9 m is the same tree: its mapped trunk, the measured height
    let mi = -1, md = 9;
    env.mapped.forEach((m, i) => { if (used.has(i)) return; const d = Math.hypot(m[0] - tx, m[1] - tz); if (d < md) { md = d; mi = i; } });
    if (mi >= 0) { used.add(mi); out.drop.push(mi); x = env.mapped[mi][0]; z = env.mapped[mi][1]; why = 'at the mapped trunk ' + md.toFixed(1) + ' m from the top'; }
    // the top of a leaning or spreading tree can lie over the water or over a path: its trunk stands on the bank / beside it
    if (inRing(x, z, env.water)) { const q = ringNear(x, z, env.water), l = Math.hypot(q[1] - x, q[2] - z) || 1; x = q[1] + ((q[1] - x) / l) * 1.6; z = q[2] + ((q[2] - z) / l) * 1.6; why = 'top over the water: trunk on the bank'; }
    else { const q = ringNear(x, z, env.water); if (q[0] < 1.2) { const l = q[0] || 1; x += ((x - q[1]) / l) * (1.2 - q[0]); z += ((z - q[2]) / l) * (1.2 - q[0]); } }
    for (let k = 0; k < 3; k++) { const c = pathClear(x, z); if (!c) break; const l = Math.hypot(x - c[1], z - c[2]) || 1; x += ((x - c[1]) / l) * (c[0] + 0.05); z += ((z - c[2]) / l) * (c[0] + 0.05); why = why || 'moved off the path'; }
    if (inRing(x, z, env.water) || (env.wet && env.wet(x, z)) || inRing(x, z, env.buildings) || pathClear(x, z) || env.keep(x, z)) { out.skipped.push([tx, tz, th, 'no clear ground for its trunk']); continue; }
    // kind: named, or by where it stands and how tall it is
    const wd = ringNear(x, z, env.water)[0];
    const kind = kd ? kd[2] : wd < 7 && th <= 16.5 ? 'willow' : th >= 21.5 ? 'plane' : 'broad';
    const rec = [+x.toFixed(1), +z.toFixed(1), th, kind, kd ? kd[3] : 'G', (kd ? kd[4] : kind === 'willow' ? 'a tree of willow height on the bank: weeping willows stand round the lake (35/lake edge - swan under a weeping willow…)' : kind === 'plane' ? 'over 21 m: planes are the tall trees here' : 'kind not known') + (why ? '; ' + why : '')];
    out.records.push(rec);
    if (kind === 'beech') out.special.push({ x: rec[0], z: rec[1], h: th, kind });
    else out.trees.push([rec[0], rec[1], th, DRAWN[kind] || 'broad']);
  }
  return out;
}

/** the Orchard's rows (K: rows of old apples and pears about 6.5 m apart on mown grass, 33/orchard lower section… 2018;
 *  G: where each tree stands). ok(x, z) -> may a tree stand here */
export function orchardRows(poly, ok) {
  const out = [];
  for (let x = -366; x < -300; x += 6.5) for (let z = -100; z < -34; z += 6.5) {
    const jx = x + Math.sin(z * 1.7) * 0.6, jz = z + Math.cos(x * 1.3) * 0.6;
    if (pip(jx, jz, poly) && ok(jx, jz)) out.push([+jx.toFixed(1), +jz.toFixed(1), 5 + (Math.abs(jx * 13 + jz * 7) % 1.6), 'broad']);
  }
  return out;
}
