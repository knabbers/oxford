// Exeter College, STANDALONE model, part 'west' (B01): THE PLAN of the west range, the Turl Street front, the gate tower
// and the Porters' Lodge passage (staircases 7, 8, 1, 2). Pure data: every dimension a named constant with its source;
// the build functions are in _exeter_west_build.js. LOCAL frame (u east, v south, y above the datum 64.40 m:
// _exeter_shared.js). Research: docs/research/exeter_survey.md B01, sections 2, 3, 11; reference/exeter/PHOTO_NOTES.md.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * LIDAR 2022 (tools/exeter_lidar.py lbox / lgbox / u profiles at 0.25 m; reference/exeter/00 .../roof_sections.txt):
//     the street face stands at u -24.3 all along (the wall foot reads at -24.2 .. -24.6 at v -30, -25, -12, -8, 15,
//     19; the parapet's cells lean one cell east, as the brief warns); the quad face at -15.3 (-15.2 .. -15.0 where
//     the ground starts); the range's ridge 13.6 - 13.7 on its middle line, the gutters at 11.9 - 12.0 just inside the
//     parapets; four clustered stacks read as 15.8 - 16.7 spikes on the ridge; the tower's roof a flat at 19.1 between
//     v -1.0 and 6.6 (rows -1 and 6 half filled), its corners 20.5 - 20.8; a turret 17 - 18 at the tower's south side
//     3 - 4 m in from the quad face; a gable on the street side at v -22 .. -18 (78.0 - 78.2 at the street edge, half
//     a metre over the parapet's run); the Chapel's roof (79 - 89) fills u -16 .. -12 from v -19 to -33, so the range's
//     quad face north of v -18.5 is a party wall with the Chapel's west end; the Thomas Wood Building (17.6) begins at
//     v -33.3.
//   * the ground (lgbox): Turl Street's pavement 63.99 (v -34) .. 64.29 (gate) .. 64.50 (v 20); the quad's west path
//     64.6 (v -18), 64.45 (v -10), 64.5 (gate), 64.6 (v 8), 64.85 (v 20).
//   * photographs (folders 01, 02; the lead's look "by hand 2026-11-23"): counts of bays, lights, storeys, oriels,
//     dormers, stages; heights between the LIDAR's ground and parapet scaled by eye from the straight-on quad picture
//     (Godot13 2014) and the gate picture (wuppertaler 2019): figures G, counts K.
//
// FRONT QUAD REGISTRATION (2026-11-23, second pass; the working is in exeter_grounds.js): the 1:500 topographic survey
// (Tim Moya Associates 210239-P-10, Feb 2021: planning 21/00354/FUL, tree report p20) measured by line fits to its dark
// pixels and fitted rigidly to 31 of the model's wall lines (18 agree to 0.21 m rms) puts:
//   * the QUAD FACE at u -16.02 (v -17) .. -16.14 (v -3) north of the tower and -16.24 (v 7) .. -16.30 (v 17) south of
//     it: -16.15 here (was LIDAR's -15.3: 0.75 - 0.96 m too far east; LIDAR's 1 m cells at the parapet read -15.0 .. -15.5
//     with a cell of lean, and the satellite view by hand 2026-11-23 gives 3.9 - 4.5 m of paving between the lawn and the
//     wall foot, the survey 4.3 - 4.5);
//   * the gate TOWER's quad face at -15.72 (0.43 m forward of the range) between v -0.73 and 6.13, its street face at
//     -24.03 (from v -0.6 to 6.0, the gate's splayed jambs between); the passage's side walls at v 0.54 and 4.74; the
//     pavement's kerb at u -25.4. The range's STREET face is not drawn on the survey: LIDAR's mixed cells at u -24.0 ..
//     -23.5 all along (full height from -23.0) put it at about -23.6 .. -23.8 (the first pass read -24.3 off the bare-ground
//     model): -23.7 here, so the tower breaks forward 0.33 m (the lead's look: "about a buttress's depth");
//   * the DOOR OPENINGS north of the tower: the covered way at v -17.40 (its case -18.19 .. -16.62) and staircase 8 at
//     -8.88 (NOT -12.55); south of it staircase 2 at 13.76 (not 13.0) and NO door at 18.2 (the door there is the
//     servery lobby's, in the lobby's north front). Godot13 2014 is NOT straight-on, and it looks WEST, so its LEFT half
//     is the SOUTH side (the first pass read it the other way round: its "north" bays were the south's): the tower's two
//     flanks and doors 2 (left) and 8 (right) fix its perspective (four points, three unknowns, 0.8 px); the bays between
//     were re-read through it (below); its far-left arched door falls at v 20.75, past the range's end (the lobby's);
//   * the PLANTED BEDS: an edge 1.2 m out from the wall north of the tower, from the covered way's step (v -15.2) to
//     staircase 8 (-10.05) and from staircase 8 (-7.8) along the tower's face to v 0.0 (the gate passage); none drawn south
//     of the tower (Godot13 and the satellite show a narrow strip of flowers there: G).

export const DATUM = 64.40;

// ------------------------------------------------------------------------------------------------ the range in plan
export const RANGE = {
  uSt: -23.7,        // street (west) face. G: LIDAR mixed cells -24.0 .. -23.5 (was -24.3); the tower's surveyed face -24.03 less its break
  uQd: -16.15,       // quad (east) face. K: topographic survey fitted, -16.02 .. -16.30 along it (was LIDAR -15.3)
  vN: -33.3,         // north end: party wall with the Thomas Wood Building's south block. K: LIDAR (17.6 m roofs from v -33.5)
  vS: 20.0,          // south end: party wall with the south range (B02's builder). K: brief / survey
  vChapel: -18.5,    // north of this the Chapel's west end stands against the quad face. K: LIDAR (Chapel roof u -16..-12, v -19..-33)
};
export const ROOF = {
  parapet: 12.4,     // top of the parapet coping, both faces. K: LIDAR edges 12.0 - 12.9 (Godot13: plain parapet over a string)
  cornice: 11.6,     // the eaves string / cornice at the parapet's foot, where the grotesques sit. G: photo proportion
  gutter: 11.9,      // the slates' foot inside the parapets. K: LIDAR 11.6 - 12.1 one cell in
  ridge: 13.7,       // K: LIDAR 13.56 - 13.68 median, 13.7 max along the ridge
  ridgeU: -19.95,    // the middle line between the faces (the ridge reads at cells -20.5 / -19.5). K
  parapetT: 0.35,    // G
};

// ------------------------------------------------------------------------------------------------ levels
/** Turl Street's pavement at the foot of the street face, metres above the datum, by v. K: lgbox u -26 */
export const STREET_GROUND = [[-34, -0.40], [-20, -0.29], [-8, -0.18], [2, -0.11], [10, -0.02], [20, 0.10]];
/** the quad's west path at the foot of the quad face, by v. K: lgbox u -14 (survey: 64.54 at the gate) */
export const QUAD_GROUND = [[-34, -0.30], [-18, 0.20], [-10, 0.05], [0, 0.10], [3, 0.14], [8, 0.20], [14, 0.30], [20, 0.45]];
export const FOOT = 0.4;      // walls go this far below the lower ground at their feet. K: brief

// ------------------------------------------------------------------------------------------------ storeys (y above the datum)
// Turl Street front (1833-4 refacing): plinth, three storeys with a string at each floor, cornice, parapet. G figures
// (scaled from the photographs between the LIDAR's ground and parapet); K: three storeys + attic, strings at each floor.
export const ST = {
  plinth: 0.9, plinthProj: 0.12,
  g: [1.5, 3.5], s1: 4.4, f: [4.9, 7.3], s2: 8.1, t: [8.6, 10.6],
  lightW: 0.52, mullion: 0.16, singleW: 0.62, headRise: 0.42,      // cusped-headed lights (drawn as pointed heads)
  reveal: 0.24,
};
// Front Quad side (1671 / 1682 / 1701-3): three storeys, round-headed lights (south of the gate) and four-centred
// (north: RCHM) under labels. G figures; K counts (Godot13 2014).
export const QD = {
  plinth: 0.55, plinthProj: 0.08,
  g: [1.7, 3.3], s1: 4.3, f: [5.1, 6.8], s2: 8.0, t: [8.9, 10.5], cornice: 11.4,
  lightW: 0.54, mullion: 0.15, reveal: 0.22,
  door: { w: 1.15, h: 2.45, spring: 2.05, rise: 0.4 },        // four-centred doorways in square heads (RCHM). G size
};

// ------------------------------------------------------------------------------------------------ the bays
// kinds: 'one' a single light; 'two' / 'three' lights; 'oriel' (street, gabled bay); 'door<n>' a staircase door on the
// ground floor (with the kind above it in `up`). v = the bay's middle. Pipes = lead downpipes between bays.
// STREET, north of the tower. K: the counts and rhythm (by-hand oblique from the north: five 2-light bays north of the
// tower; Halling 2022 and Ship St 2014: single | 3-light | single opposite Ship Street (v -28.9 on the map); Ozeye 2009 /
// Hilton 2017: one gabled oriel bay with singles each side and a 3-light under and over it). G: each v to +-0.5 m.
export const STREET_N = [
  { v: -31.8, k: 'one' }, { v: -29.8, k: 'three' }, { v: -27.8, k: 'one' },
  { v: -25.3, k: 'two' },
  { v: -22.6, k: 'one' }, { v: -20.0, k: 'oriel' }, { v: -17.4, k: 'one' },
  { v: -14.6, k: 'two' }, { v: -11.9, k: 'two' }, { v: -9.2, k: 'two' }, { v: -6.5, k: 'two' }, { v: -3.7, k: 'two' },
];
export const STREET_N_PIPES = [-28.75, -23.9, -16.1, -7.85, -1.7];      // (-28.75: between the 3-light and the south single opposite Ship St: Ship St 2014)
// STREET, south of the tower: singles and 2-lights (Stevens 2004, Chadwick 2017 from the Brasenose Lane corner: no
// oriel south of the gate). G: positions.
export const STREET_S = [
  { v: 7.8, k: 'one' }, { v: 9.8, k: 'two' }, { v: 11.8, k: 'one' },
  { v: 14.0, k: 'one' }, { v: 16.0, k: 'two' }, { v: 18.0, k: 'one' },
];
export const STREET_S_PIPES = [12.9, 19.1];
/** 13 grotesques south of the tower spell MARILYN BUTLER (fact sheet): drawn as plain blocks. K count */
export const GROTESQUES_S = 13, GROTESQUE_PITCH_N = 1.7;

// QUAD, north of the tower (touch-up 2026-11-23). Godot13 2014 is a straight-on (rectified) picture: the tower's quad
// face (7.6 m) spans 270 px = 35.5 px a metre, and the same scale puts the south side's bays where the first builder had
// them (2-light 7.2, 3-light 9.8, pipe 11.7, door 13.2, 3-light 16.0, door 18.0). Scaled the same way the NORTH side is
// 2-light -2.4, 3-light -6.5, pipe -9.45, door -12.55 (with a 2-light over it on both floors), and nothing more before the
// picture's edge (v -14). The Front Quad north-west corner photo sphere (Jul 2016, by hand) then shows, going south from the
// Chapel's turret: the open lit doorway of the covered way (a 2-light over it on each floor, set lower than the 3-lights:
// stair landings), a pipe, ONE 3-light bay (a fan-trained rose over it), and a four-centred staircase door at the left:
// the door at -12.55. So there are TWO doors north of the tower, not three. Numbers (decided, see CHECKED): 8 at -12.55,
// 7 at the corner (the covered way, which is staircase 7's entrance hall: BGS 2018 block plan draws staircase 7's winder
// opening off it); staircase 1 is entered from the gate passage (three planning site plans and 96/00528, below).
// REGISTRATION PASS: the doors from the topographic survey (8 at -8.88, the way at -17.40); the bays to door 8 read off
// the RIGHT half of Godot13 through its perspective: 2-light -1.89, 3-light -5.01, pipe -6.95; beyond the picture (the
// photo sphere: going south from the way a pipe, ONE 3-light bay with the rose, the staircase door): 3-light -13.2 and
// pipe -16.3 (G places).
export const QUAD_N = [
  { v: -1.89, k: 'two' }, { v: -5.01, k: 'three' },
  { v: -8.88, k: 'door', up: 'two', stair: 8 },
  { v: -13.2, k: 'three' },
  { v: -17.4, k: 'way', stair: 7 },
];
export const QUAD_N_PIPES = [-6.95, -16.3];
// QUAD, south of the tower (Godot13: 2-light, 3-light, pipe, Staircase 2's door with a 2-light over it, 3-light, a
// second door at the far left of the picture with a 2-light over it: not numbered on the college's map, G)
// REGISTRATION PASS: staircase 2's door at 13.76 (survey); the LEFT half of Godot13 through its perspective: 2-light
// 6.8, 3-light 9.57, pipe 11.87, the door (a 2-light over it), 3-light 17.67, pipe 19.16 at the corner. The survey has no
// door at 18.2.
export const QUAD_S = [
  { v: 6.8, k: 'two' }, { v: 9.57, k: 'three' },
  { v: 13.76, k: 'door', up: 'two', stair: 2 },
  { v: 17.67, k: 'three' },
];
export const QUAD_S_PIPES = [11.87, 19.16];

// dormers (flat-topped, slate cheeks, white sashes: Godot13, Halling 2022). K: about 5 north and 4 south on the quad
// side; G: the street side's count and every position.
export const DORMER = { sill: 12.05, w: 1.45, h: 1.15, lights: 3 };
export const DORMERS_ST = [-31.0, -27.6, -24.4, -13.3, -9.2, -5.1, 9.8, 13.9, 17.4];
// quad side (registration pass), Godot13 through its perspective (dormers stand back from the face: +-0.5): north -2.8,
// -5.3, -9.1 (under the stack), then beyond the picture -12.6, -15.6 (G); south 7.0 (pushed clear of the tower), 9.25,
// 12.3, 14.6, 16.7 (one more at 20.1 is the south range's)
export const DORMERS_QD = [-2.8, -5.3, -9.1, -12.6, -15.6, 7.0, 9.25, 12.3, 14.6, 16.7];

// clustered stacks (round flues on a square base: Godot13, Stevens). K: LIDAR spikes (position +-1 m, height);
// G: flue count and base size.
export const STACKS = [
  { u: -20.0, v: -24.5, top: 15.8, nu: 2, nv: 2 },
  { u: -20.3, v: -16.6, top: 16.3, nu: 2, nv: 2 },
  { u: -20.6, v: -9.6, top: 16.4, nu: 2, nv: 3 },
  { u: -21.0, v: 13.2, top: 16.7, nu: 2, nv: 2 },
];
export const STACK = { base: 14.5, flueR: 0.22, pitch: 0.55 };

// ------------------------------------------------------------------------------------------------ the gabled oriel (street, north)
// Ozeye 2009: canted, 4 lights on the front (two pairs) and one on each side, quatrefoil panels under it and as its
// parapet with head-stops, three stepped corbel courses; a 3-light window below it and above it; a coped stone gable
// over the bay with a 2-light window; grotesques at the eaves. K: form. G: sizes.
export const ORIEL_N = {
  v: -20.0, front: 2.3, proj: 0.75,
  corbel: [3.75, 4.75], panel: [4.75, 5.2], lights: [5.2, 7.45], parapet: [7.45, 8.1],
  gable: { w: 4.7, apex: 14.4, win: [12.55, 13.65], roofTo: -21.0 },       // K: LIDAR 13.8 - 14.0 at the street edge (cells average); apex G
};

// ------------------------------------------------------------------------------------------------ the gate tower
// Plan (registration pass): K the topographic survey (quad face -15.72 between v -0.73 and 6.13, 0.43 m forward of the
// range; street face -24.03); LIDAR's flat 19.1 reads over v -1.0 .. 6.6 (rows half filled at both ends). The gate centred
// on the passage (survey: walls at 0.54 / 4.74, the street opening 0.83 .. 4.0).
export const TOWER = {
  v0: -0.7, v1: 6.1, vc: 2.645,      // (vc: the passage's axis, survey)
  uSt: -24.03, uQd: -15.72,
  roof: 19.1,                 // K: LIDAR flat
  cornice: 18.7,              // top of the cornice under the battlements. G (Godot13: 1.5 x the range's parapet)
  parapetH: 1.05,             // to the embrasures' sills. G
  merlon: { merlon: 0.85, gap: 0.55, h: 0.7 },   // K: battlements (photos); G sizes
  turretR: 0.42, turretTop: 20.95, turretCap: 0.5,   // octagonal corner turrets above the battlements: K lead's look; G sizes (LIDAR corners 20.5 - 20.8)
  stair: { u: -18.8, v: 7.0, r: 0.95, top: 17.6 },    // octagonal stair turret on the south side with a moulded cap. K: Stevens 2004 + LIDAR 17 - 18 at (-19 .. -17, 6); G size
  flag: { u: -22.9, v: 0.1, top: 25.6 },             // K: Godot13 / Stevens (north-west part of the roof); G height
  // street face (four storeys against the range's three: the lead's look)
  st: {
    strings: [4.4, 8.1, 11.7, 15.0], top: 18.5,
    upper2: { y: [12.1, 14.3], lights: 2 },          // the 2-light window over the oriel. K: wuppertaler 2019
    upper1: { y: [15.6, 17.7], s: [-1.2, 1.2] },     // two single lights in the top stage (relative to the middle). G (Stevens: singles in the upper stages)
  },
  // quad face: four stages (Godot13 2014): the arch; a 3-light; a 2-light; two single lights. K counts; G heights
  qd: {
    strings: [6.6, 10.7, 14.2], top: 18.5,
    w3: [7.1, 8.9], w2: [10.95, 12.8], w1: [14.7, 17.2], w1s: [-1.1, 1.1],
    shield: 5.9, lamp: { s: -1.15, y: 5.0, arm: 0.55 },          // a painted shield over the arch and a lantern on its left (Godot13). K; arm G
  },
  sides: { w1: [14.7, 17.2], w2: [12.6, 14.2] },     // side faces above the range: singles (Godot13 north face). G
};
// THE GATE (street): pointed moulded arch, angel corbel, studded oak doors with carved square panels (2 x 7 a leaf), pier
// buttresses with weathered set-offs, setts before it (wuppertaler 2019, Mike Peel 2024). K: form. G: sizes.
export const GATE = {
  w: 3.1, spring: 2.45, rise: 1.75,         // apex 4.2
  depth: 0.75,                              // the street wall's thickness at the gate
  pier: { w: 0.8, stages: [[2.9, 0.5], [3.9, 0.3]] },
  angel: { y: 4.25, w: 0.9, h: 0.6 },
  doors: 'open',                            // shown OPEN, folded back against the passage walls (the passage is a way through)
  setts: { u0: -25.4, v0: 1.05, v1: 4.15 }, // the apron from the door to the kerb. K: the survey's kerb at u -25.4
};
// THE ORIEL OVER THE GATE: two storeys (the lead's look; Hilton 2017), canted: 2 lights on the front and 1 on each side in
// each tier, a panel between the tiers, quatrefoil panels below and as the parapet with head-stops, three stepped corbel
// courses and a band of paterae over the angel (Mike Peel 2024). K form; G sizes.
export const ORIEL_G = {
  front: 1.95, proj: 0.7,
  corbel: [4.6, 5.55], panel: [5.55, 6.05], lights: [6.05, 8.3], mid: [8.3, 8.9], lights2: [8.9, 10.75], parapet: [10.75, 11.45],
};
// THE PASSAGE (joins pass 2026-11-23, rebuilt from the measured drawings: 21/02150/LBC Jessop & Cook 2021 plan, reflected
// ceiling plan and sections 3-3 / 7-7 at 1:50 with 5 m bars; 07/01699/LBC Montgomery 2005 / 2006; 21/02254/FUL sections
// A-A / B-B; figures in reference/exeter/20 planning drawings/DIMENSIONS.md "Second pass (2026-11-23)"; RCHM 1939 plate 4,
// P Halling 2025 and Street View March 2026 in 01 .../). Plan of the sheets: Turl Street at the bottom, north to the left.
// Every height is above the passage's own floor (F0: the floor at the passage's middle).
//   two bays, each a SAIL VAULT read as pendentives (one sphere through the four springing corners at the capitals' level)
//   cut by a ring, a shallow SAUCER DOME inside the ring with interlaced ribs and a central pendant (RCHM: "a saucer dome on
//   flattened pendentives ... intersecting ribs and central pendants"); the four sides of each bay are semicircular arches:
//   the cross arch and the two end arches across the passage (span 4.0, crown 5.0 against the drawings' 5.05) and the wall
//   arches along each side (span = the bay, crown 4.41 against 4.3: a sphere through the corners cannot give both).
export const PASSAGE = {
  vc: 2.645,                // the passage's axis. K: topographic survey (walls 0.54 / 4.74)
  vN: 0.4825, vS: 4.8075,   // clear width 4.325 between the wall faces. K: figured string 4325 (07/01699 1:50); the survey's 4.2 is at ground, 0.06 m each side
  uW: -23.17, uE: -16.87,   // vaulted length 6.3 between the end walls' inner faces. K: 21/02150 ceiling plan (+-0.1); quad wall 1.15 thick K (scaled); street wall 0.86 the remainder (G)
  spring: 3.0,              // the pilasters' capitals = the springing of every arch. K: sections 3-3 / 7-7 (+-0.05)
  pil: { w: 0.42, wEnd: 0.24, proj: 0.2125, capH: 0.3, capProj: 0.09, baseH: 0.32 },   // 3.9 between the pilaster faces K (scaled); widths, capital and base G
  band: 0.35,               // the cross arch's soffit width (flat, panelled). K: ceiling plan 0.35; G: the panel
  endBand: 0.16,            // the end arches' soffits against the end walls. G (the ceiling plan's double lines)
  archR: 2.0,               // the cross and end arches' intrados radius: crown 5.0 (drawing 5.05, span 4.1). K +-0.05
  dome: { r: 0.9, rise: 0.24, ring: 0.2, ribs: 6, pendant: 0.75 },   // ring 1.8 across (ceiling plan, K); saucer rise, ring width, rib count, pendant G (plate 4: a net of interlaced ribs, a carved pendant)
  qArch: { w: 2.85, spring: 3.2, rise: 0.85 },   // the quad opening: four-centred, chamfered, 2.85 clear. K width (1:50 plans); heights G (Halling 2025 looking east: apex about 4.05)
  chamfer: 0.09,            // the quad arch's chamfer. K form (Halling 2025, PHOTO_NOTES); size G
  leafW: 1.3, leafSpring: 2.45, leafRise: 1.55,   // the street doors: two studded oak leaves of 1.3 opening inward (K: 21/02150 plan, scaled); their arch G
  wicket: { w: 0.72, h: 1.75 },                    // the wicket in the north leaf. K: 21/02150 D&A ("smaller door for everyday access"); size G
  rebate: 0.6,              // the street gate's outer reveal depth; the 2.6 m leaf opening behind it. G (the drawings: 3.6 m splaying to 2.6 m)
  // the lodge's 2021 opening in the STREET-end bay of the south wall: a glazed sliding door 1.8 wide in a 2.1 m stone
  // surround, its sill at the lodge's floor (+0.55), the platform lift in the flags in front of it. K: 21/02150 section 7-7,
  // 21/02254 A-A; G: the surround's height and the lift's size (1.4 x 1.1)
  lodge: { w: 1.8, sur: 0.15, sill: 0.55, h: 2.1 },
  lift: { l: 1.4, d: 1.1 },
  // STAIRCASE 1: the square-headed stone doorway in the QUAD-end bay of the south wall (moulded surround, head 2.7), three
  // steps up (0.200 / 0.375 / 0.550, figured) through the 1.0 m wall into a small lobby (the stair's foot; the lodge's
  // inner door). K: 07/01699 and 21/02150 plans and section 7-7; Halling 2025 looking east (the doorway, the steps);
  // G: the opening's width 1.4 (1.2 - 1.5), the lobby's size and the stair drawn as four winders
  sc1: { w: 1.4, head: 2.5, surTop: 2.7, sur: 0.16, steps: [0.2, 0.375, 0.55], going: 0.3, wallT: 1.0, lobbyU: [-19.2, -17.5], lobbyV1: 7.55, ceil: 2.65 },
  // the 2021 low steel access gates across the passage at the cross arch: fixed side panels and a pair of leaves of 1.0 in
  // the middle (shown OPEN, folded towards the quad), 1.2 high, vertical bars with pointed loops under the top rail. K:
  // 21/02254 section B-B and design statement; Halling 2025 and Street View 2026 (a low black iron barrier); G: the panels'
  // split and the height
  gate: { h: 1.2, leaf: 1.0, open: true },
};
export const LAMPS = [
  { face: 'st', v: -2.3, y: 5.3, arm: 0.9 },      // iron bracket lantern north of the gate (Hilton 2017; by-hand oblique). K
  { face: 'st', v: -32.5, y: 4.7, arm: 0.7 },     // wall lantern at the north end (Halling 2022). K (position G)
];

// ------------------------------------------------------------------------------------------------ THE COVERED WAY (staircase 7)
// The Front Quad -> Margary Quad way (survey section 12, settled by a look: 02 .../Front Quad north-west corner ... (google
// photo sphere Jul 2016, by hand 2026-11-23).jpg): an open, lit, SQUARE-HEADED doorway up one step, a black bracket
// lantern over it and a small shield plate beside the lantern.
// WHERE THE DOOR IS (decided): in the west range's QUAD FACE (u -15.3), immediately SOUTH of the Chapel's stair turret,
// not in a return. (1) the picture: the doorway's wall runs on in one plane with the 3-light bay to its left (the same
// strings and labels, the pipe between them), and the turret's flank, with its slit window, stands forward of it on the
// right; (2) the plan: the turret (an octagon 2.9 m across at (-15.4, -19.9): _exeter_chapel_plan.js) is centred on the
// range's quad face, so no return faces south between them, and the Chapel's west gable (u -16.6) stands 1.3 m BEHIND the
// quad face: the door cannot be in the Chapel's line; (3) BGS 2018 block plan (planning 18/00694/FUL, 1:200, read at 300
// dpi): the opening is in the quad face immediately south of the turret's mass, 1.2 m wide over its frame.
// THE PASSAGE (BGS 2018): a corridor about 1.2 m wide runs north inside the west range along the Chapel's west wall from
// that door to the north party wall; staircase 7's winder stair opens off its west side about half way. Its north end on
// that plan meets solid walling (the Thomas Wood Building's 2025 plan hatches the strip north of the Chapel as its own
// ground floor): the way OUT into Margary Quad is built where the Thomas Wood Building's builder opened his side
// (_exeter_margary_plan.js SW.passage: u -15.3, v -31.95 .. -33.0, floor -0.25, 2.45 clear): G, for a look on site.
export const WAY = {
  v: -17.4, w: 1.0, h: 2.25,       // the doorway: centre, clear width, clear height. K: centre the topographic survey (its case -18.19 .. -16.62); form (photo); G size (photo proportion 1 : 2.2)
  step: 0.17,                      // one step up from the paving (photo: one step). K count, G rise
  wallT: 0.75,                     // the quad wall's thickness here (BGS 0.85). G
  caseW: 0.18,                     // the plain stone door-case round it, under a label. K form, G size
  uW: -18.45, uE: -17.3,           // the corridor's walls: 1.15 m clear (BGS about 1.2) west of the Chapel turret's plinth (-17.2) and the gable (-16.6). G figures
  vS: -16.6, vL: -18.4,            // the lobby behind the door, south and north walls. G
  vNs: -31.95, vN: -33.0,          // the north leg: the Thomas Wood Building's opening (margary SW.passage v1 / v0). K (agreed; fix-up pass: -33.15 -> -33.0 with margary, so the way meets the lobby's inside with room)
  uOut: -15.3, yOut: -0.25,        // the opening in the quad wall at the north end and its floor (margary SW.passage uIn / yIn). K (agreed)
  ramp: [-20.0, -30.6],            // the corridor's floor falls from the door's level to yOut between these v (1 : 24). G
  clear: 2.45,                     // floor to ceiling (2.2 at the north end = the head of the Thomas Wood Building's opening). G
  upF: [4.75, 6.35], upT: [8.5, 10.1],   // the 2-lights over the door: lower than the 3-lights (landing windows: photo). K; G heights
  lantern: { dv: 0.32, y: 3.0 },   // over the door's south jamb (photo). K; G height
  shield: { dv: -0.3, y: 3.05 },   // the shield plate on the north side of it (painted arms in life: a blank shield). K
  stair: { v0: -24.65, v1: -23.45, n: 4, rise: 0.18, going: 0.27 },   // the foot of staircase 7 off the corridor's west side (BGS: winder at v -25.7 .. -22.5). G
  lights: [-18.0, -24.0, -30.0, -32.55],   // ceiling lights (the doorway is lit inside: photo). G
};
// the planted bed and the climbing rose north of staircase 8 (the same photo): a bed of big-leaved plants along the wall
// foot from staircase 8's step to the covered way's step, and a rose trained on a fan of wires spreading from the bed over
// the 3-light bay up to the first floor. K: what and where; G: sizes and the fan's shape.
// REGISTRATION PASS: the beds as the topographic survey draws them (edge 1.2 - 1.25 m out from the wall; the edge comes
// in to the wall either side of staircase 8's door), and a narrow strip south of the tower (G: Godot13, satellite).
// { s: south end v, n: north end v, w: depth from the wall, uWall (default the range's quad face), plants }
export const BEDS = [
  { s: -10.05, n: -15.2, w: 1.25, plants: 7 },          // K: survey (edge u -14.85 .. -14.88)
  { s: -0.7, n: -7.8, w: 1.2, plants: 9 },              // K: survey (edge -14.92 .. -14.96)
  { s: 0.0, n: -0.7, w: 0.76, uWall: -15.72, plants: 1 },   // K: along the tower's face to the passage
  { s: 8.7, n: 6.2, w: 0.5, plants: 3, flowers: true }, // G
  { s: 12.9, n: 10.0, w: 0.5, plants: 4, flowers: true },   // G
  { s: 18.8, n: 14.6, w: 0.5, plants: 5, flowers: true },   // G
];
// (the fan rises from the bed in the pier between staircase 8's door-case and the 3-light, a wire runs along over the
// ground-floor window's label; the leaves keep off the glass)
// (registration pass: moved with the 3-light, +1.75 m south)
export const ROSE = { v: -11.9, y0: 0.35, wires: [[-11.61, 3.6], [-11.55, 5.2], [-11.67, 6.9], [-12.15, 7.25]], cross: [[-11.8, 3.92], [-14.65, 3.98]] };
// CLOSERS: none now. The three stopgap returns of the registration pass went when part 'hall' moved the south range's
// faces onto this range's (quad -16.15, Turl Street -23.7 at v 20: _exeter_hall_plan.js SWR) and part 'margary' stood
// the Thomas Wood Building's tower at -24.0 (its south face returns the 0.3 m to this range's street face -23.7).
export const CLOSERS = [];

// ------------------------------------------------------------------------------------------------ K / G
export const CHECKED = [
  ['street face at u -23.7, straight from v -33.3 to 20 (was -24.3)', 'G', 'LIDAR 2022 u profiles: the 1 m cell at -24.0 .. -23.5 mixed (0.4 - 8 m) all along, full height from -23.0; the tower\'s surveyed street face -24.03 less its break forward'],
  ['quad face at u -16.15 (was -15.3)', 'K', 'topographic survey 210239-P-10 fitted to 18 walls (rms 0.21 m): -16.02 .. -16.30 along the face; satellite by hand 2026-11-23 (paving 3.9 - 4.5 m to the lawn)'],
  ['north end v -33.3 (Thomas Wood Building beyond), south end v 20 (south range)', 'K', 'LIDAR roofs; brief'],
  ['quad face north of v -18.5 stands inside the Chapel\'s west end (plain); opened at v -31.95 .. -33.0 for the covered way', 'K', 'LIDAR: Chapel roof u -16..-12, v -19..-33; Chapel plan west gable u -16.6'],
  ['range ridge 13.7 on u -19.8, gutters 11.9, low-pitched slate roof', 'K', 'LIDAR roof_sections.txt + xsec'],
  ['parapet top 12.4 both faces', 'K', 'LIDAR eaves cells 12.0 - 12.9'],
  ['ground: Turl St 63.99 .. 64.50, quad path 64.45 .. 64.85; wall feet 0.4 below', 'K', 'LIDAR lgbox'],
  ['three storeys + attic dormers, strings at each floor, plinth, parapet', 'K', '01 Stevens 2004, Halling 2022; 02 Godot13 2014'],
  ['storey heights (sills, heads, strings 4.4 / 8.1, cornice 11.6)', 'G', 'scaled by eye from Godot13 / Stevens between LIDAR ground and parapet'],
  ['street windows: cusped-headed lights (drawn pointed) under square labels, white sashes', 'K', '01 wuppertaler 2019, Halling 2022'],
  ['street bay rhythm north of tower: single|3|single opposite Ship St, a 2-light, the gabled oriel bay with singles, five 2-light bays', 'K', '01 Halling 2022, Ship St 2014, Ozeye 2009, by-hand oblique 2026-11-23'],
  ['street bays: exact v of each', 'G', 'spaced by eye from the photographs'],
  ['street south of tower: singles and 2-lights, no oriel', 'K', '01 Stevens 2004, Chadwick 2017 (Brasenose Lane corner)'],
  ['gabled oriel at v -20: canted, 4 lights front + 1 each side, quatrefoil base and parapet, 3 corbel courses, 3-light below and above, coped gable with 2-light', 'K', '01 Ozeye 2009; Hilton 2017; LIDAR gable at v -22..-18'],
  ['gabled oriel sizes, gable apex 14.4', 'G', 'photo proportion; LIDAR 13.8 - 14.0 averaged'],
  ['13 grotesques south of the tower, plain blocks at the cornice; others every 1.7 m north', 'K', 'fact sheet (MARILYN BUTLER); Ozeye 2009 (spacing G)'],
  ['lead downpipes between bays with hopper heads', 'K', '01 wuppertaler, Halling 2022, Stevens (positions G)'],
  ['quad side: 3-light and 2-light windows of round-headed lights south, four-centred north, under labels', 'K', '02 Godot13 2014; RCHM'],
  ['quad bay rhythm next to the tower (2, 3, pipe, door with 2 over)', 'K', '02 Godot13 2014'],
  ['quad doors: staircase 8 at v -8.88 (was -12.55), the covered way at -17.40 (was -17.75), staircase 2 at 13.76 (was 13.0)', 'K', 'topographic survey 210239-P-10 (door openings drawn with their steps), fitted; with the tower\'s flanks they fix 02 Godot13 2014\'s perspective (0.8 px)'],
  ['Godot13 2014 looks west: its LEFT half is the SOUTH side (the first pass had them swapped)', 'K', 'geometry (the face looks east); the sun from the south-east (the Hall\'s shadow on its left part); the corner stack (-19.5, 22) at its far left'],
  ['quad bays: north 2-light -1.89, 3-light -5.01, pipe -6.95; south 2-light 6.8, 3-light 9.57, pipe 11.87, 3-light 17.67, pipe 19.16', 'K', '02 Godot13 2014 read through that perspective (+-0.3)'],
  ['quad north between door 8 and the way: one 3-light at -13.2, a pipe at -16.3', 'G', '02 NW corner photo sphere Jul 2016 (the order: way, pipe, 3-light with the rose, door); places by eye'],
  ['NO door at v 18.2 in the face (the door in that corner is the servery lobby\'s)', 'K', 'topographic survey (no opening in the face; a threshold in the lobby\'s north front); Godot13\'s far-left door falls at v 20.75'],
  ['staircase numbers: 8 at -8.88, 7 = the covered way at the NW corner, 2 at 13.76; staircase 1 entered from the gate passage (no quad door)', 'K', 'planning site plans Montgomery 2005 + 2007 (7 at the corner, 1 not on the quad), Jessop 2025 (I in the gate passage; it swaps VII / VIII), 96/00528 (lodge with the bottom flight of staircase 1); the bird\'s-eye map\'s 1 sits on the tower and its 7 at the corner, 8 between: no door plate is readable in any photograph (DIMENSIONS.md staircase table)'],
  ['dormers: quad, flat-topped, slate cheeks, sashes; north -2.8, -5.3, -9.1 and south 7.0, 9.25, 12.3, 14.6, 16.7', 'K', '02 Godot13 read through the surveyed perspective; positions +-0.5'],
  ['dormers north beyond the picture: -12.6, -15.6', 'G', 'spaced as those seen'],
  ['covered way: open square-headed doorway 1.0 x 2.25 up one step in the quad face at v -17.4, just south of the Chapel\'s turret, stone case and label, bracket lantern on its south side, blank shield plate on its north side, 2-lights over it set low', 'K', '02 Front Quad north-west corner (google photo sphere Jul 2016, by hand 2026-11-23); topographic survey (place); BGS 2018 block plan (18/00694/FUL); sizes G'],
  ['covered way inside: lobby, a 1.15 m corridor north along the Chapel\'s west gable, a ramp falling 0.44 m, staircase 7\'s foot off its west side, plastered and lit', 'K', 'BGS 2018 block plan (corridor, the stair off it); finishes, ramp and widths G'],
  ['covered way north end: turns east at v -31.95 .. -33.0 and opens in the quad wall at u -15.3 into the Thomas Wood Building\'s vestibule (floor -0.25, head 2.2)', 'G', 'agreed with _exeter_margary_plan.js SW.passage; the BGS 2018 plan draws solid walling there and the 2025 plan hatches it: a look on site settles it'],
  ['planted beds 1.2 m deep along the quad face: v -15.2 .. -10.05 and -7.8 .. 0.0 (round the tower\'s face); big-leaved plants; a climbing rose on a fan of wires over the 3-light at -13.2', 'K', 'topographic survey (the beds\' edges); 02 NW corner photo sphere Jul 2016; plants and the fan G'],
  ['narrow flower strips (0.5 m) south of the tower', 'G', '02 Godot13 2014 (flowers at the wall foot), satellite by hand 2026-11-23 (green at the wall); not on the survey'],
  ['dormers on the street side: count and positions', 'G', 'Halling 2022 (three in one slice), spaced by eye'],
  ['four clustered stacks of round flues at LIDAR spikes 15.8 - 16.7', 'K', 'LIDAR lbox; Godot13, Stevens'],
  ['stack flue counts and base sizes', 'G', 'by eye'],
  ['gate tower v -0.7 .. 6.1, quad face -15.72, street face -24.03 (was -1.0 .. 6.6, -15.0, -24.75); flat roof 19.1', 'K', 'topographic survey fitted (flanks -0.73 / 6.13, faces); LIDAR lbox for the roof'],
  ['tower breaks forward of the street face (0.33 m)', 'K', 'the lead\'s look by hand 2026-11-23 (01 ... by hand 2026-11-23.jpg); depth G (the range\'s face is not on the survey)'],
  ['tower four storeys on the street against the range\'s three', 'K', '01 ... by hand 2026-11-23'],
  ['tower quad face 0.43 m forward of the range', 'K', 'topographic survey (-15.72 against -16.15)'],
  ['battlements, cornice 18.7, merlon tops 20.45', 'G', 'Godot13 proportion; LIDAR flat 19.1 behind'],
  ['octagonal corner turrets above the battlements', 'K', '01 ... by hand 2026-11-23; Godot13; LIDAR corners 20.5 - 20.8 (top 21.45 G)'],
  ['octagonal stair turret on the south side, moulded cap, top 17.6', 'K', '01 Stevens 2004; LIDAR 17 - 18 at (-19..-17, 6); size G'],
  ['flagpole on the tower roof', 'K', '02 Godot13, 01 Stevens (height G)'],
  ['gate: pointed moulded arch on shafted jambs, angel corbel, pier buttresses with set-offs, setts apron', 'K', '01 wuppertaler 2019, Mike Peel 2024'],
  ['gate sizes (3.1 wide, apex 4.2)', 'G', 'photo proportion'],
  ['gate doors shown OPEN (folded back), carved square panels 2 x 7 per leaf as raised rails', 'K', 'Mike Peel 2024 (panels); open: the brief\'s choice'],
  ['two-storey canted oriel over the gate, 2 + 1 + 1 lights per tier, quatrefoil base and parapet, corbelling; 2-light window over it', 'K', 'the lead\'s look 2026-11-23; wuppertaler 2019; Hilton 2017'],
  ['tower quad face: four-centred arch; 3-light; 2-light; two singles; shield; lantern', 'K', '02 Godot13 2014 (the 2-light in stage 3 is counted on the picture; PHOTO_NOTES says 3)'],
  ['tower stage heights', 'G', 'Godot13 scaled from the range\'s parapet'],
  ['passage 4.325 clear (3.9 between pilasters), 6.3 long inside in two bays, axis v 2.645', 'K', '07/01699 1:50 (figured 4325); 21/02150 ceiling plan (scaled +-0.1); topographic survey'],
  ['pilaster capitals (springing) 3.0 above the floor; cross arch semicircular, flat panelled soffit 0.35, crown 5.0; wall arches semicircular along the sides', 'K', '21/02150 sections 3-3 and 7-7 (1:50 with bar); RCHM via 07/01699 D&A'],
  ['each bay: pendentives (one sphere through the corners), a wreath ring 1.8 across, a saucer dome with interlaced ribs and a central pendant; blank oval cartouches in the spandrels and at the cross arch\'s crown (NO arms)', 'K', 'RCHM 1939 plate 4; 21/02150 ceiling plan (rings, bosses); Halling 2025 looking east'],
  ['the vault\'s sphere: wall arches\' crowns 4.41 (drawings 4.3), the dome\'s rise 0.24, ring width, rib pattern simplified, pendant size', 'G', 'a sphere through the four corners cannot give both crowns; the rest by eye from plate 4'],
  ['quad opening 2.85 clear under a four-centred chamfered arch (apex about 4.05), quad wall 1.15 thick; a semicircular end arch over it inside', 'K', '1:50 plans (width, wall); Halling 2025 both pictures (form, the end arch); apex G'],
  ['street doors: two studded oak leaves of 1.3 (2.6 at the leaves), a wicket in the north leaf; shown standing OPEN into the passage', 'K', '21/02150 plan (leaf swings), D&A; Street View Mar 2026 (open, by hand); arch of the leaves and wicket size G'],
  ['street wall 0.86 thick with the reveal splaying from the face\'s arch to the 2.6 m leaf opening at 0.6 m in', 'G', 'the drawings (3.6 m at the face to 2.6 m at the leaves); the depth is the remainder of the tower\'s surveyed depth'],
  ['floor of York flags, sloping 0.2 m up from the street to the quad', 'K', '07/01699 SK3A ("York stone paving"); photographs; slope from LIDAR / survey ends'],
  ['staircase 1: a square-headed stone doorway in the quad-end bay of the south wall, three steps 0.200 / 0.375 / 0.550 up through the 1.0 m wall into a lobby with the stair\'s foot and the lodge\'s inner door', 'K', '07/01699 + 21/02150 plans (figured levels), section 7-7 (surround head 2.7); Halling 2025'],
  ['staircase 1: opening width 1.4, lobby 1.7 x 1.7 at +0.55 with a 2.65 ceiling, the stair as four winders, the lodge door shut', 'G', 'the plans scaled roughly; the lodge\'s ceiling height used for the lobby'],
  ['the lodge\'s 2021 glazed sliding door (1.8 in a 2.1 surround, sill +0.55) in the street-end bay, the platform lift in the flags in front of it (lowered)', 'K', '21/02150 section 7-7; 21/02254 A-A (lift, guard edge, flagstone finish); sizes G'],
  ['the 2021 low black steel access gates across the passage at the cross arch, 1.2 high, pointed loops under the top rail; fixed side panels and two 1.0 m leaves shown OPEN', 'K', '21/02254 B-B and D&A; Halling 2025 (the gate, its pattern); Street View Mar 2026; panel split, height and open leaves G'],
  ['the 2007 security gate near the quad end and the old lodge door (u -21.6, 1.1 x 2.35) removed', 'K', 'replaced by the 2021 works (21/02150, 21/02254)'],
  ['lanterns: bracket north of the gate, one at the north end, one over the quad arch', 'K', '01 Hilton 2017, Halling 2022; 02 Godot13'],
];
