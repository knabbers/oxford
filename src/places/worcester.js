// Worcester College, Oxford — hand-modelled main site (east of x ≈ −320) and the Worcester Place back gate.
// Main Quad + loggia + Terrace + Cottages + Pump Quad (Cellar Bar steps) + entrance front on Walton St.
// See docs/research/worcester.md. Coordinates shared with the other Worcester modules live in _worcester_shared.js.
//
// The college buildings are built in a local frame (u east along the Terrace, v south along the loggia) that is the
// world rotated by PHI about C0, because the whole 18th-century layout is ~4.4° off the map grid.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORC, WORC_LEVELS, WORC_BLOCK } from './_worcester_shared.js';
import { buildMainBlock, blockGround } from './_worcester_block.js';
import { buildPumpQuad, pumpGround, pumpRoofAt, pumpDug, pumpCamOK, PUMP, HALL_SOUTH } from './_worcester_pump.js';
import { PUMPR_ON } from './_worcester_pumpranges_plan.js';      // Pump Quad's ranges are hand-built by places/worcester_pumpranges.js (`?wpumpr=0`: the generator's, as before)
import { OUT as BAR_OUT, LEVEL as BAR_LEVEL } from './_bar_out.js';
import { randomLook, createCharacter } from '../core/characters.js';
import { Batch, frame, rectPts, archPts, tudorPts, segPts, signAtlas, makePack, contactStrips, bayLit } from './_worcester_kit.js';
import { SAINSBURY, buildSainsbury } from './_worcester_ranges.js';
import { streetPreMap, buildStreetFront, LANE_GATE } from './_worcester_street.js';
import { buildTerrace, terraceGround, terraceCamera } from './_worcester_terrace.js';
import { TERR, TERR_CHECKED, S6 } from './_worcester_terrace_plan.js';
import { RIM, rimLevel, rimDropped, cutToField } from './_worcester_rim.js';
import { LODG } from './_worcester_yard_plan.js';
import { cardBeep } from '../systems/_object_audio.js';

const PHI = 0.0761, COS = Math.cos(PHI), SIN = Math.sin(PHI), C0 = [-250, 10];
const L2W = (u, v) => [C0[0] + u * COS + v * SIN, C0[1] - u * SIN + v * COS];
const W2L = (x, z) => { const dx = x - C0[0], dz = z - C0[1]; return [dx * COS - dz * SIN, dx * SIN + dz * COS]; };
const headingL = (du, dv) => Math.atan2(du * COS + dv * SIN, -du * SIN + dv * COS);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// LEVELS (2026-11-22: the 2022 height survey, docs/research/worcester_survey.md section 2; the owner: "the loggia is
// same level as street and entrance to porters lodge and library"). World y = 0 is the STREET, and with it the
// forecourt, the gateway passage, the loggia floor and the terrace walks (T: a paving stone above it). The quad is
// SUNK: its floor (lawn and paths) is one plane falling west, 1.8 m below the datum at the lawn's east edge and 2.65 m
// at its west edge; Pump Quad's court is 1.25 m below. It used to be the other way up: the lawn at y = 0, the loggia
// 1.9 m above it and twelve steps inside the gateway passage that do not exist. The main block itself did not move:
// its street front always stood on y = 0 and its heights are right measured from there (the quad front: 12.9 m from
// the loggia floor to the top of the cornice, arches 4.5 m to the crown, by the 2011 photograph).
// VT: the Terrace's quad face (its true plan: _worcester_terrace_plan.js TERR, built by _worcester_terrace.js).
const T = WORC.terraceY, VT = TERR.vS;
// THE MAIN BLOCK'S TRUE PLAN (2026-11-22, second pass; _worcester_shared.js WORC_BLOCK, built by _worcester_block.js):
// UW its quad face, VN / VS its north and south faces, HCM its cornice base
const BLK = WORC_BLOCK, UW = BLK.uW, VN = BLK.vN, VS = BLK.vS, HCM = BLK.y.cornice;
const QE = WORC_LEVELS.quadE, QS = WORC_LEVELS.quadFall, QU0 = WORC_LEVELS.quadU0, PQY = WORC_LEVELS.pumpQuad;
/** the Main Quad's floor (local u): a plane */
const quadY = (u) => QE + QS * (u - QU0);
// the gravel way from the quad's south-east corner through the gap into Pump Quad rises from the quad's floor to the
// court between u = GAP[0] and GAP[1]
const GAP = [UW, 5.5];
/** the floor of the sunk ground at local u: the quad's plane, the gap's gentle rise, Pump Quad's court */
const floorY = (u) => (u <= GAP[0] ? quadY(Math.max(u, -53)) : u >= GAP[1] ? PQY : quadY(GAP[0]) + (PQY - quadY(GAP[0])) * (u - GAP[0]) / (GAP[1] - GAP[0]));
// the broad flight from the Terrace walk down the bank to the lawn path (north side, centre): u NS0 .. NS1
// (centred on the Terrace's middle window, u -24.7: the 2014 photograph taken square on and the 1939 plan; it stood 1.05 m west)
const NS0 = TERR.uc - 2.55, NS1 = TERR.uc + 2.55;
// the Terrace walk runs from the range's front (v = VT) to WK, the grass bank falls from WK to BF (4 m in plan),
// the gravel path lies between BF and the lawn. East side: a gravel walk in front of the arcade (u EW .. 0.2), the
// bank from EW to EF, the path from EF to the lawn. (Second pass: the arcade's face is at u 2.0, not 0.2; the walk is
// 2.1 m wide and the bank 4.2 m in plan — LIDAR 2022, the 1939 plan: 2.2 and 3.9 — and the bank runs on south past the
// fan's west side to BE, where its end is rounded off.)
const WK = -13.5, BF = -9.5, EW = -0.1, EF = -4.3, BE = VS - 1.0;
// Cottages front line (local): from (-43.7, 19.0) to (2.7, 21.2). Its west end is the map's; its EAST gable stands at
// u 2.7, 1.4 m east of the map's (LIDAR 2022: the roof runs to u 2.75; the 1939 plan: 0.7 m east of the loggia's face),
// so the way into Pump Quad is a real passage: 2.1 m wide between the block's south face (v 19.1) and the Cottages'
// north face, 0.7 m long (survey G12: "an open gap about 2 m wide").
const COT = { e: [PUMP.cw, 21.2], w: [-43.7, 19.0], depth: 8.3 };
const cotFront = (u) => 19.0 + (u + 43.7) * (2.2 / 46.4);
// the wall across the quad's south-west corner (the west garden passage goes through it): A - B - C
const SWW = { A: [-52.7, 19.8], B: [-46.4, 20.2], C: [-43.7, 19.0] };
/** the south edge of the quad's open ground at local u: the Cottages' front, the south-west wall */
const quadSouth = (u) => (u >= SWW.C[0] ? cotFront(u) : u >= SWW.B[0] ? SWW.B[1] + (SWW.C[1] - SWW.B[1]) * (u - SWW.B[0]) / (SWW.C[0] - SWW.B[0]) : SWW.A[1] + (SWW.B[1] - SWW.A[1]) * (u - SWW.A[0]) / (SWW.B[0] - SWW.A[0]));
const TUN = { u0: -8.7, u1: -6.5, v1: 35.5, h: 2.65 };
// The two garden passages (2026-11): the Register of Parks and Gardens has "a passage through the east end of the south
// range ... mirrored by a second passage at the west end of the range", the west one passing "beneath a 'hanging
// garden' adjacent to the west front of the westernmost camera" (a lawn at first-floor level on a walled mound). The
// west one is the tunnel in the quad's south-west corner that the tour sheet sends visitors through to the gardens and
// the lake (OSM w130668914, 14 m of building_passage). Both are low stone tunnels under a four-centred barrel vault.
// `?swtunnel=0` (node: GTO_SWTUNNEL=0) builds the college as it was before: a flat-ceilinged east passage and a bare
// archway in a garden wall at the south-west corner.
const SWTUN = !((typeof location !== 'undefined' && location && /[?&]swtunnel=0(&|$)/.test(location.search || '')) || (typeof process !== 'undefined' && process.env && process.env.GTO_SWTUNNEL === '0'));
// [width, springing, rise] of a passage's arch: 2.35 m to the crown (east), 2.3 m (west)
const TUNP = SWTUN ? [2.2, 1.75, 0.6] : [2.2, 2.2, 0.45];
// the west tunnel in the frame of the quad's south-west wall (x along the wall from its west end, z south from its
// garden face): the mound x0..x1, z 0..len, top at h; the passage centred on cx, w wide, springing ys, rise above it
// (2026-11-23, the rim on the drawn ground: len and h from the 2022 height survey — _worcester_rim.js RIM — the
//  mound's south wall at v 28.3, 2.1 m north of where it was drawn; its lawn at 60.95 m)
const HANG = { x0: 0.4, x1: 8.6, len: RIM.hangLen, h: 2.75, cx: 3.0, w: 1.9, ys: 1.7, rise: 0.6 };
HANG.y0 = WORC_LEVELS.quadE + WORC_LEVELS.quadFall * (-52.7 - WORC_LEVELS.quadU0);      // the quad's floor at the wall it goes through (its lowest, west end)
HANG.h = +(WORC_LEVELS.yOf(RIM.hangTop) - HANG.y0).toFixed(3);                           // (2.65 m above the passage's floor)
const LAWN = { u0: -48.0, u1: -7.5, v0: BF + 3.6, v1: 16.5 };      // (east edge: a 3.2 m path at the bank's foot, as the 1939 plan)
// the lawn: a rectangle whose WEST corners are crisp (the owner's bird's-eye picture: mowing stripes run right into
// them) and whose EAST corners are rounded, the gravel path curving round them (the survey, 2026-11-22: the college's
// photograph from the loggia shows the north-east one, radius about 6 m; the satellite picture shows the south-east
// one cut off, a triangle of gravel at the foot of the fan of steps). RL: the corner radii.
const RL = { se: 3.5, sw: 0.7, nw: 0.7, ne: 6 };
const lawnPoly = (() => {
  const out = [];
  const arc = (cu, cv, r, a0) => { const n = r > 2 ? 10 : 6; for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * (Math.PI / 2); out.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]); } };
  arc(LAWN.u1 - RL.se, LAWN.v1 - RL.se, RL.se, 0); arc(LAWN.u0 + RL.sw, LAWN.v1 - RL.sw, RL.sw, Math.PI / 2); arc(LAWN.u0 + RL.nw, LAWN.v0 + RL.nw, RL.nw, Math.PI); arc(LAWN.u1 - RL.ne, LAWN.v0 + RL.ne, RL.ne, Math.PI * 1.5);
  return out;
})();
// the banks' rounded north-east corner: arcs about the lawn corner's own centre (foot radius CNF, 4 m of bank)
const CN = [LAWN.u1 - RL.ne, LAWN.v0 + RL.ne], CNF = RL.ne + (EF - LAWN.u1);
/** how much of the bank's height stands at (u, v): 1 on the walks, 0 at the foot */
function bankF(u, v) {
  if (u > CN[0] && v < CN[1]) return clamp01((Math.hypot(u - CN[0], v - CN[1]) - CNF) / (EW - EF));
  return v < CN[1] ? clamp01((BF - v) / (BF - WK)) : clamp01((u - EF) / (EW - EF));
}
// THE FAN (the owner: "from the loggia there are some curved steps ... rounded and quite wide, taking up most/all of
// the end of the loggia"; the 1939 plan; the 2008, 2011 and 2014 photographs; the satellite picture). Second pass, to
// the 1939 plan scaled and the 2014 photograph taken square on: the steps lie between the arcade's face and the bank
// (the walk's whole width), their nosings arcs about the north jamb of the LAST ARCH (c): a quarter-disc of landing
// r0 in front of that arch, then n risers going down south and south-west, the lowest reaching the block's corner
// exactly (R = 3.89 m: the arch 2.06 + the corner pier 1.83). The bank runs on along the fan's west side behind a
// stone cheek. GUESSES: r0 (1.4 m: the handrails start 2.5 m short of the corner in the 2014 photograph), the riser
// count.
const FAN = { c: [UW, VS - 3.89], r0: 1.4, n: 10, R: 3.89 };
FAN.tread = (FAN.R - FAN.r0) / (FAN.n - 1);
/** is (u, v) on the fan (r: its distance from the centre): the quadrant south-west of c, as wide as the walk */
const inFan = (u, v, r) => r <= FAN.R && v >= FAN.c[1] && u <= FAN.c[0] && u >= EW;
/** the quad's ground: walks, banks, the fan, the floor */
function quadGround(u, v) {
  const f = floorY(u), r = Math.hypot(u - FAN.c[0], v - FAN.c[1]);
  if (inFan(u, v, r)) return r <= FAN.r0 ? T : T - (T - f) * clamp01((r - FAN.r0 + FAN.tread / 2) / (FAN.R - FAN.r0 + FAN.tread / 2));
  if (u >= EW) return v <= FAN.c[1] ? T : f;      // the walk in front of the arcade; the gravel beyond the fan's foot
  if (v > BE) return f;                           // south of the bank's end
  return f + (T - f) * bankF(u, v) * clamp01((BE - v) / 1.2);      // (the bank's south end is rounded off over its last 1.2 m)
}
const inLawn = (u, v) => { let c = false; for (let i = 0, j = lawnPoly.length - 1; i < lawnPoly.length; j = i++) { const a = lawnPoly[i], b = lawnPoly[j]; if ((a[1] > v) !== (b[1] > v) && u < ((b[0] - a[0]) * (v - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
// [x0, x1, eaves] along the front from the east end. Stone pass (photographs: worc_cottages): the eaves were a storey
// too high (5.4-6.2 m); two low storeys under a steep stone-slate roof, the eaves at about 4.3-4.8 m
// (the easternmost unit is 1.4 m longer than it was drawn: the gable at u 2.7; its door stays where it was)
const COT_UNITS = [[0, 8.6, 4.4], [8.6, 16.0, 4.8], [16.0, 23.4, 4.3], [23.4, 31.0, 4.65], [31.0, 38.6, 4.45], [38.6, 46.45, 4.85]];
const cotDoorX = (i) => COT_UNITS[i][0] + 3.6 + (i === 1 ? 2.8 : 0) + (i === 0 ? 1.4 : 0);   // along the front from the east end

// What is KNOWN (K: seen in a named picture, measured, or said by the owner) and what is a GUESS (G) in the core's
// levels and Pump Quad, 2026-11-22: [element, K | G, source or what is guessed]. Pictures: reference/worcester/
// (local, never copied). docs/research/worcester_survey.md, packages A and B.
export const CHECKED = [
  ['street = forecourt = gateway passage = loggia floor = Lodge and Library doors: one level, no steps', 'K', 'the owner, 2026-11-22; LIDAR 2022 (61.75 / 61.35 / 61.05 mOD)'],
  ['the quad sunk: lawn 1.8 m (east edge) to 2.65 m (west edge) below the loggia', 'K', 'LIDAR 2022: 59.25 / 58.85 / 58.40 mOD'],
  ['north terrace walk at the loggia\'s level; bank 4 m in plan; central flight of 12 risers', 'K', 'LIDAR; 30 main quad/main quad from loggia… (worc.ox.ac.uk tour); riser count G'],
  ['east side: a gravel walk in front of the arcade, an unbroken turf bank, no flight in the middle', 'K', '30 main quad/main quad from SE corner… (Commons, Remi Mathis 2011)'],
  ['the fan: curved steps at the loggia\'s south-west corner, wide, down to the south-west and round the corner', 'K', 'the owner (twice); RCHM 1939 plan; 40 satellite (google maps)/…close up…; steel handrails: the 2008 and 2011 photographs'],
  ['the fan: between the arcade and the bank, arcs about the last arch\'s north jamb, 3.89 m to the block\'s corner', 'K', 'RCHM 1939 plan (scaled: quadrant 3.65 - 3.9 m, as wide as the walk); 01 main block/west front straight on… (Godot13 2014): the rails start 2.5 m short of the corner'],
  ['the fan: its landing (1.4 m), ten risers, where the handrails stand', 'G', 'the fall is 1.65 m (LIDAR); the count is not in any picture'],
  ['lawn: north-east corner rounded (6 m), south-east corner cut off (3.5 m), gravel triangle at the fan\'s foot', 'K', 'the tour photograph from the loggia; the satellite pictures; radii G'],
  ['lawn: west corners crisp', 'K', 'the owner\'s bird\'s-eye picture'],
  ['paths: buff gravel on all four sides of the lawn and on both terrace walks; flags only at the Cottages\' doors and in the loggia', 'K', 'the photographs in 30 main quad; survey G01'],
  // ---- second pass, 2026-11-22: the main block at its true plan (_worcester_shared.js WORC_BLOCK, _worcester_block.js; survey D.8)
  ['main block: walls 26.0 x 35.8 m (the mapped 27.9 x 37.2 m is the cornice line); quad face at u 2.0, gate axis v 1.2, one plane on the south', 'K', '01 main block/RCHM 1939 plan… scaled by the Hall\'s 17.9 m (venue plan); LIDAR roof edges 26.7 - 27.2 x 37.0 m; satellite'],
  ['main block roofs: dark slates at 29 degrees from the blocking course to a flat lead top, the quad range\'s at 15.95 m, the wings\' at 15.4 m', 'K', 'LIDAR 2022 profiles across the Hall wing (u 20.5) and along the quad range (u 8.5); 01 main block/east front straight on… (2025): the low flat-topped hips over each wing'],
  ['main block cornice: corona about 0.9 m out on scrolled brackets 0.62 m apart, bed mould under them; the same all round (seen on the street ends and forecourt only)', 'K (street side) / G (other sides, the bracket\'s size)', '01 main block/hall (south) wing east end… (2025)'],
  ['street front stone: the recessed centre browner and streaked, the wings\' base to the plat band dark and channelled with long-and-short quoins, clean cream ashlar above; attic windows in eared frames; roundel with keystone, festoons hung from bows with drops', 'K (that they are so) / G (the tints)', '01 main block/east front straight on… (2025)'],
  ['Cellar Bar pavement lights: four iron gratings in the ground, two in the forecourt at the foot of the Hall\'s north wall, two on Walton Street\'s pavement at the foot of its east end', 'K (their places and sizes) / G (the grating itself)', '09 buttery…/fire plan p2 (as re-measured for the bar\'s refit: _bar_plan.js)'],
  ['loggia arcade: three groups of three round arches 2.06 m wide (springing 2.85, crown 3.88), 3 m piers between the groups, corner piers 1.83 m, the middle group forward 0.15 m; cornice 12.1 - 12.9 m', 'K', '1939 plan (pixel runs along the front); 01 main block/west front straight on… (Godot13 2014) at 25.1 px/m'],
  ['loggia: 4.9 m deep inside, groin-vaulted, stone flags, bracket lanterns on the back wall', 'K', '1939 plan; the fire plan\'s wine cellar under it (4.9 m); 01 main block/loggia interior… (two photographs). Vault crown 4.6 m: G'],
  ['Hall: tables in long rows down its length; the high table across the far (east) end on a raised dais', 'K', 'CONFIRMED by the owner 2026-11-22. Built: three rows, a dais of 0.25 m (its height: G). The servery is on the right as you walk in: CONFIRMED by the owner 2026-11-25 (built so: the south wall, behind the screen) — places/_worcint_hall.js'],
  ['Gate 2 (Provost\'s Lane on Walton Street): SHUT — solid black boarded gates between ashlar piers, lettered "Gate 2"', 'K', 'the owner 2026-11-22; 38/boundary wall on walton street… (2026 photograph). Which leaf carries the lettering: G — places/_worcester_street.js'],
  ['Hall and Chapel floors 0.3 m above the loggia: a landing at each door, a timber-railed ramp along the back wall, a step', 'K / G', 'K that there are steps into both rooms: CONFIRMED by the owner 2026-11-25 ("steps into hall and chapel"); the ramp beside them is from the college\'s access page and the rails in the loggia photograph; the rise and the ramp\'s length are guessed'],
  ['Hall and Chapel: 17.9 x 9.0 m; doors 11.75 m from the axis; three side windows 1.7 m wide at 3.65 / 7.6 / 11.6 m from the east wall (the Chapel\'s on both sides); Venetian window 4 m wide in each street end', 'K', '01 main block/hall floor plan with dimensions…; tour sheet; 1939 plan'],
  ['wings\' windows: Venetian sill 3.8, crown 7.55; side windows 3.8 - 7.4; attic windows 9.9 - 11.1; roundel and swags; channelled base to 2.75', 'K', '01 main block/east front straight on… (2025) at 31.5 px/m'],
  ['gate hall: a vaulted room with a doorway at each end (fanlight and double doors to the street), the Lodge\'s lettered door north, the Library stair\'s door opposite', 'K', '1939 plan; 01 main block/porters lodge door… (taken inside the gate hall); the owner'],
  ['street front centre: three bays, three storeys, cornice level with the wings\', attic with panelled piers, swept sides and a small pediment, pale blue-grey clock, flagpole; the screen 0.45 m behind the wings\' faces', 'K', '01 main block/east front straight on…, …recessed centre upper storeys and clock… (2025)'],
  ['loggia\'s north end: blind', 'G', 'the 1939 plan draws an opening 3.2 m wide with steps beyond (towards Staircase 2): to be settled with the Terrace\'s east end'],
  ['the gap from the quad\'s south-east corner into Pump Quad, gravel, no steps', 'K', 'the owner; 06 pump quad/…from above… (both); RCHM 1939 plan; LIDAR'],
  ['the gap: 2.1 m between the block\'s corner (2.0, 19.1) and the Cottages\' corner (1.3, 21.1)', 'K', 'survey G12 (LIDAR: 2 m between v 19.5 and 21.4); the Cottages\' corner is the map\'s; the block\'s is its true plan (WORC_BLOCK)'],
  ['Pump Quad: buff gravel, 1.25 m below the loggia floor', 'K', 'the owner; his photograph; LIDAR 59.8 mOD'],
  // ---- second pass, stage B (places/_worcester_pump.js, _bar_out.js; survey D.9)
  ['Pump Quad: its true outline — the Cottages\' east gable at u 2.7, the east range\'s court face at u 21.3 (the map: 1.3 and 19.9)', 'K', 'LIDAR 2022; RCHM 1939 plan; the bar\'s fire plan (its wall line ends at 21.2)'],
  ['Pump Quad: the flat-roofed rendered annex along the Hall\'s wall, 2.4 m deep, 4.4 m high, u 6.9 - 18.15, a rooflight', 'K', 'LIDAR; 40 satellite (google maps)/…max zoom…; the fire plan (it holds the bar\'s lobby and store). Its doors to the court: G'],
  ['Pump Quad lanterns: one on a bracket beside the loggia\'s south arch (K); one on the annex\'s face at the head of the bar\'s flight (G: no picture shows that end of the court). No others, no fill light: the owner, 2026-11-22: "real lanterns where they really are; no general brightening"', 'K / G', 'the owner\'s photograph; 06 pump quad/…from above… (college)'],
  ['Pump Quad: the glazed canopy in front of the annex, 2.4 m deep, 3.4 m falling to 2.4 m, glazed back to the Hall\'s wall east of the annex; real glass (see-through), white bars, dark posts with brackets, a vine, flagged walk, stone kerb, drain channel', 'K', 'the owner\'s photograph; 06 pump quad/…from above… (college); satellite (about twelve bays; darker glass over the stair); LIDAR heights. Post spacing: G'],
  ['Pump Quad: stone-slated open lean-to on posts across the west end, out to u 6.3 and down to v 28, dark boarding behind', 'K', 'the owner\'s photograph; LIDAR (2.4 - 2.9 m high)'],
  ['Pump Quad: the Cottages\' east building: rubble gable with a tall ashlar stack up its face, red-brown clay tiles, a white dormer on its south slope', 'K', 'the owner\'s photograph; the tour photograph; satellite. The stack on the gable\'s middle: G (the photograph has it a little north of the ridge)'],
  ['Cellar Bar: under the Hall; the way down as the college\'s fire plan draws it — an outer flight in the court\'s north-east corner going down north under the glass, an area at its foot, left into a lobby in the annex, right through double doors in the Hall\'s wall, two or three steps down inside them, darts in the far-left alcove', 'K', 'CONFIRMED by the owner 2026-11-22 ("from the stair, left into the sunk yard, right through double doors, down 2-3 steps into the bar, darts in the far-left alcove"); 00 college maps/Cellar-Bar-GEEP-plan-p2.png (south up, 90 px/m); the owner, 2026-11-15 and 2026-11-22; satellite; LIDAR'],
  ['Cellar Bar: nine risers outside and three inside (2.04 m below the court); the outer flight\'s length', 'G', 'the fire plan stops at the area and marks "Up" at its south end; the college: "down two short flights of steps"'],
  ['Cellar Bar: a splayed window through the Hall\'s south wall in the court\'s corner, 1.7 m wide outside', 'K', 'fire plan. Its sill and head (just above the court): G'],
  ['southArch: the loggia\'s south arch has an iron balustrade and no flight; under it the Hall Wine Cellar\'s door, three steps down between rendered parapets', 'K', 'fire plan p2 (the stair and door exactly under the arch); the college\'s photograph from above (a rendered parapet below the arch). The arch\'s width (2.4 m): G'],
  ['platform lift at the quad\'s south-east corner (the college map\'s symbol; "a platform lift near here": access page)', 'G', 'NOT built: where it stands is in no picture or plan found (the fire plan draws none in the court)'],
  ['picnic tables on the gravel (three), tubs', 'K', 'the photographs; how many and where: G'],
  ['Staircases 13 - 16 round Pump Quad: hand-built (places/worcester_pumpranges.js; K / G in its own CHECKED, 20 rows): three-storey rubble ranges from LIDAR, the 1939 plan and the photographs, the canted angle with its hooded doorway, the street face 0.4 m proud of the Hall wing', 'K / G', 'see _worcester_pumpranges_plan.js; `?wpumpr=0` = the generator\'s boxes'],
  ['quad\'s west side: a high stone wall with an iron railing on top, creeper, a border, a shut boarded door', 'K', 'survey G01 (list description, two photographs); the creeper\'s extent, the door\'s size: G'],
  // ---- the rim on the drawn ground, 2026-11-23 (places/_worcester_rim.js; survey D.3)
  ['the gardens at their true levels up to the core\'s walls: the Nuffield strip a plane (58.3 - 59.2 m), the lawn west of Staircase 13 59.10, the rose garden 58.20, 58.40 under the Hanging Garden\'s east end', 'K', 'LIDAR 2022 ground model; held by four precincts of the drawn terrain (the rings: _worcester_rim.js RIM.rings), the fall taken at the walls'],
  ['east garden passage: level through the Cottages and Staircase 13, 59.29 m at the quad to 59.10 m at the garden (it climbed 1.9 m)', 'K', 'LIDAR 2022: the quad\'s path 59.29, the garden path at its mouth 59.11 - 59.13'],
  ['south-west passage: level under the Hanging Garden, 58.36 m at the quad to 58.51 m at the garden (it climbed 2.7 m); 8.3 m of mound over it, its south wall at v 28.3, its lawn at 60.95 m', 'K', 'LIDAR 2022 (ground 58.45 - 58.54 at the portal; the wall\'s top at v 28.0, ground at 28.5; surface 60.84 - 60.97 on the mound); 05/tunnel passage four-centred arch… (2022): the quad\'s path seen level through it'],
  ['south-west passage, garden mouth: an ashlar portal standing proud of the rubble wall and above it, a four-centred arch in a square label, a coping; two stone urns on pedestals where its spur meets the garden path', 'K', '05/tunnel passage four-centred arch… (2022); 05/cottages west end, hanging garden wall… (2011). The portal\'s height (3.3 m), the urns\' places and size: G; the quatrefoil spandrels are not carved'],
  ['quad\'s west wall: 2.2 m of stone above the path south of its door, the coping sweeping up beside the door to 3.1 m, a 1.2 m railing on both; its garden face down to the rose garden (58.20 m, 0.1 m below the quad\'s path)', 'K', '31/main quad west wall - door at the foot and iron railing on top (2017), scaled from the door; LIDAR: top 60.4 m. Heights to 0.2 m and the sweep\'s place: G'],
  ['quad\'s west wall north of the bank: carried to the Provost\'s Lodgings\' south face, a parapet 1.1 m above the terrace walk with the railing on it', 'G', 'no picture shows the walk\'s west end from the quad; the rose garden is 2.85 m below the walk there (LIDAR)'],
  ['Cottages, garden side: two storeys of rubble above the border, white sashes on both floors, gabled dormers', 'K', '05/cottages south side from nuffield lawn (2011), …with garden path and wisteria; 34/…view north from the casson building… (2024). How many sashes and where: G. The west end\'s cottage orne gables and the iron stair are NOT built'],
  ['Staircase 13\'s west wing, garden side: three storeys of rubble from the garden (eaves 8.15 m above it), a tall two-light window each side of the passage\'s mouth, sashes above; the west gable with the old kitchen\'s stepped chimney breast and ashlar stack', 'K', '05/cottages south side with garden path and wisteria (the traceried ground-floor window, the sash over it), …from nuffield lawn (2011: the gable and its breast); LIDAR ridge 70.4 m. Window places and sizes: G'],
  ['the Long Border at the Cottages\' foot: a soil bed 2.8 m deep with shrubs', 'K (that it is there, about that deep) / G (the planting)', '34/nuffield lawn - long border and gravel path below the cottages (Geograph 4148720); the gardens builder\'s painted border wants carrying along it'],
];

// ------------------------------------------------------------------------------------------------ ground (local)
// THE TWO GARDEN PASSAGES RUN AT THE TRUE LEVELS (2026-11-23; _worcester_rim.js): from the quad's floor at the north
// mouth to the garden's ground at the south mouth, floor, sides and vault together. The east one falls 0.19 m in its
// 15 m (59.29 -> 59.10 m), the south-west one rises 0.15 m in 8.9 m (58.36 -> 58.51 m): K, the 2022 height survey.
// GARD: the garden's ground at their south mouths, in the core's heights. Set in install() through THE SWITCH,
// `rimDropped`: where the drawn ground outside a mouth still stands at the core's datum (the terrain before the rim's
// precincts) it is 0 and that passage climbs to it as it did; when the switch goes, set the two true levels here.
const GARD = { e: 0, sw: 0 };
const MOUTH = { e: [-7.6, 36.1], sw: [-49.7, 28.9] };      // just outside each south mouth (local)
/** the floor of a garden passage at (u, v), or null outside both */
function passageY(u, v) {
  if (u > TUN.u0 - 0.05 && u < TUN.u1 + 0.05) {      // east: through the Cottages and Staircase 13
    const v0 = cotFront(-7.6) - 0.05, yN = quadY(-7.6);
    if (v >= v0 && v <= TUN.v1 + 0.3) return yN + (GARD.e - yN) * clamp01((v - v0) / (TUN.v1 - v0));
  }
  if (SWTUN && u < SWW.B[0] + 3) {                   // south-west: under the Hanging Garden
    const ax = SWW.B[0] - SWW.A[0], az = SWW.B[1] - SWW.A[1], L = Math.hypot(ax, az), du = u - SWW.A[0], dv = v - SWW.A[1];
    const x = (du * ax + dv * az) / L, z = (dv * ax - du * az) / L;
    if (x > HANG.cx - HANG.w / 2 - 0.1 && x < HANG.cx + HANG.w / 2 + 0.1 && z > -0.6 && z < HANG.len + 0.5) return HANG.y0 + (GARD.sw - HANG.y0) * clamp01((z + 0.55) / (HANG.len + 0.55));
  }
  return null;
}
function localGround(u, v) {
  // Pump Quad's own levels: the Cellar Bar's way down (flight, area, annex lobby, the doorway through the Hall's wall),
  // the wine cellar's steps (_worcester_pump.js)
  if (u > 3 && u < PUMP.ue && v > VS - 1.7 && v < 24.2) { const g = pumpGround(u, v); if (g !== null) return g; }
  // the main block: the gateway passage and the loggia are one level with the street; the Chapel and Hall doorways in
  // the loggia's back wall (walk-in rooms, _worcint_hall_plan.js) carry it on through the thickness of the wall
  { const g = blockGround(u, v, T); if (g !== null) return g; }      // (_worcester_block.js: the loggia, the ramps to the Chapel and Hall doors, the gate hall)
  // the Terrace: the steps and thresholds of its four doorways (Staircase 5's is the walk-in staircase's,
  // _worcint_lodge_plan.js STAIR), Staircase 6's way down through the range to the yard door, the slip behind the
  // screen's arch (_worcester_terrace.js; plain core heights)
  { const g = terraceGround(u, v, T); if (g !== null) return g; }
  const g = passageY(u, v); if (g !== null) return g;
  // Pump Quad's court and the gap into it from the quad
  if (u >= UW && u < PUMP.ue + 0.1 && v >= VS && v < PUMP.south(u) + 0.3 && (u > COT.e[0] || v < cotFront(u))) return floorY(u);
  // Main Quad: terrace walks north and east, grass banks, the fan, the sunk lawn and paths
  if (u > -52.4 && u < UW && v > VT - 0.05 && v < quadSouth(u)) return quadGround(u, v);
  return null;
}

// ------------------------------------------------------------------------------------------------ module
export default {
  id: 'worcester',

  preMap(game) {
    const ov = game.overrides;
    // rebuilt by hand
    for (const id of ['w69991341', 'w849457927', 'w849457928', 'w93711479', 'w301621501', 'w301625505',
      'w301621505', 'w301621506', 'w301621507', 'w301621508', 'w301621509', 'w301621510']) ov.skip.add(id);
    ov.skip.add(SAINSBURY.id);      // the Sainsbury Building: hand-built (_worcester_ranges.js)
    // quad ground + paths + barriers we redraw
    for (const id of ['w169617917', 'w169617918', 'w251686318', 'w154817154', 'w130668898', 'w154817152', 'w169617908',
      'w164759802', 'w130668909', 'w164759804', 'w391914997', 'w1250775976', 'w1250775977', 'w391914993', 'w169617919',
      'w849941982', 'w849941983', 'n1807845469', 'n1672541296', 'w721939490', 'w154763499', 'w164759807', 'w1415271448']) ov.skip.add(id);
    // restyled
    const stone = { wall: 'stone', roof: 'slate', color: '#e6d3ae' };
    // (Provost's Lodgings w169617900 and the yard ranges w93711480 are hand-built now: places/worcester_yard.js)
    for (const id of ['w301621502', 'w301621503', 'w301621504']) ov.style.set(id, stone); // Pump Quad staircases 14-16
    // 2026-11-22, roofs and modern blocks from the owner's bird's-eye picture (what a roof is made of and its colour seen
    // from above; the walls are GUESSES unless noted):
    //  - Pump Quad's north-east ranges (Staircases 15, 16) are under red-brown clay tiles, not blue slate
    for (const id of ['w301621503', 'w301621504']) ov.style.set(id, { ...stone, roof: 'tile' });
    //  - the Besse Building and the old stable ranges round Provost's Yard: brown stone slates
    //  - the Nash Building and the block east of it on Ruskin Lane (2000s): pale standing-seam metal roofs over buff
    //    brick (research: "pale brick with metal cladding and a pitched roof"); they were neo-Georgian stone under slate
    for (const id of ['w69991299', 'w999274421']) ov.style.set(id, { wall: 'brick', tint: [1.5, 2.45, 2.75], ivy: false, roof: 'lead', up: 'brickPair', ground: 'brickPair', door: 'brickDoor' });
    //  - the Casson Building (the slab across the foot of the Nuffield Lawn) and the curved Wolfson Building on the
    //    Worcester Street corner: flat roofs (they had slate gables and dormers)
    for (const id of ['w28043610', 'w28043633']) ov.style.set(id, { wall: 'stone', roof: 'flat', ivy: false });
    ov.style.set('w69991362', { wall: 'brick', roof: 'slate', color: '#c98f74' });      // Staircase 24: same Victorian red-brick frontage
    ov.style.set('w69991353', { wall: 'brick', roof: 'slate', color: '#9a6a55' }); // Gloucester House (behind the back gate)
    // the two great trees that frame the street front from Beaumont Street (photographs: beaumont_west), one in each
    // corner garden of the junction (positions a guess from the photograph; spots whose hash makes them planes).
    // Ordinary map trees: drawn, culled and given a trunk collider by the world like any other
    if (game.map && game.map.trees) game.map.trees.push([-206, -10.3, 24], [-202, 30.2, 23]);
    // the mapped flowerbed west of the Cottages runs under the Hanging Garden's mound and across the tunnel's floor:
    // its east edge is pulled back to the mound's west wall
    // the garden path that came through a gate in the quad's west wall: the wall is a high one with a shut boarded
    // door (WEST SIDE below), so the path now starts outside it (its first two points lay inside the sunk quad)
    if (game.map && game.map.roads) { const gp = game.map.roads.find((r) => r.id === 'w130668903'); if (gp && gp.pts.length >= 4 && gp.pts[0][0] > -301.5) gp.pts.splice(0, 2); }
    // 2026-11-22: the quad, the Cottages and Pump Quad are built BELOW y = 0 (LEVELS at the top): the world's base
    // ground is not drawn over them (world/ground.js: ov.groundHoles, convex world polygons)
    {
      const hole = (pts) => (ov.groundHoles || (ov.groundHoles = [])).push(pts.map(([u, v]) => L2W(u, v)));
      hole([[-52.3, WK], [UW, WK], [UW, VS], [-52.3, VS]]);                                                              // the quad
      hole([[COT.w[0], COT.w[1]], [COT.e[0], COT.e[1]], [COT.e[0], COT.e[1] + COT.depth - 0.15], [COT.w[0], COT.w[1] + COT.depth - 0.15]]);   // under the Cottages
      hole([[-41.5, VS], [UW, VS], [UW, cotFront(UW)]]);                                                                 // the path between the two
      hole([[UW, VS], [PUMP.ue, VS], [PUMP.ue, 31.9], [UW, 31.9]]);                                                      // the gap and Pump Quad
      hole([[S6.flight.u0, TERR.vN], [S6.flight.u1, TERR.vN], [S6.flight.u1, S6.flight.v1], [S6.flight.u0, S6.flight.v1]]);   // Staircase 6's flight down through the Terrace to the yard door (_worcester_terrace_plan.js S6)
      hole([[TUN.u0 - 0.05, 26.5], [TUN.u1 + 0.05, 26.5], [TUN.u1 + 0.05, TUN.v1 - 0.2], [TUN.u0 - 0.05, TUN.v1 - 0.2]]);   // the east garden passage (short of the mapped Nuffield Lawn's edge)
      // (the rim, 2026-11-23) the quad's south-west corner between the block's south line and the wall across it: the
      // strip of base ground left there stood at the datum in front of the wall, and came down the step as a green
      // band once the rose garden's level reached in under the corner
      // (each laps 5 cm over its neighbour: holes that only shared an edge left a hairline of grass along it)
      hole([[-52.3, VS - 0.05], [SWW.B[0] + 0.05, VS - 0.05], [SWW.B[0] + 0.05, SWW.B[1]], [-52.3, SWW.A[1] + (SWW.B[1] - SWW.A[1]) * 0.4 / (SWW.B[0] - SWW.A[0])]]);
      hole([[SWW.B[0], VS - 0.05], [SWW.B[0] + (SWW.C[0] - SWW.B[0]) * (SWW.B[1] - VS) / (SWW.B[1] - SWW.C[1]) + 0.15, VS - 0.05], [SWW.B[0], SWW.B[1]]]);
      // the Hanging Garden's mound with the south-west passage under it: nothing of the map's is drawn inside the mound
      // or on its top. The mapped Nuffield Lawn ran in under it to the wall across the corner: its outline is taken
      // round the mound's foot instead (a hole could only stop a hair short of the lawn's own edge, and that hair of
      // lawn came down the terrain's step across the passage's floor)
      if (SWTUN) {
        const ax = SWW.B[0] - SWW.A[0], az = SWW.B[1] - SWW.A[1], L = Math.hypot(ax, az), f = (x, z) => [SWW.A[0] + (ax * x - az * z) / L, SWW.A[1] + (az * x + ax * z) / L];
        hole([f(HANG.x0, -0.03), f(HANG.x1, -0.03), f(HANG.x1, HANG.len - 0.03), f(HANG.x0, HANG.len - 0.03)]);
        const lawn = game.map && game.map.areas && game.map.areas.find((a) => a.id === 'r4008715');
        if (lawn && lawn.poly && !lawn._worcRim) {
          const under = (p) => { const [u, v] = W2L(p[0], p[1]); return u > -52.5 && u < -43.5 && v < 21; };      // its vertices along the wall across the corner
          const i0 = lawn.poly.findIndex(under), n = lawn.poly.filter(under).length;
          if (i0 > 0 && n >= 2 && lawn.poly.slice(i0, i0 + n).every(under)) { const ring = [f(HANG.x0, 0), f(HANG.x0, HANG.len), f(HANG.x1, HANG.len)].map(([u, v]) => L2W(u, v)), a = W2L(...lawn.poly[i0 - 1]); lawn.poly.splice(i0, n, ...(a[0] < -50 ? ring : ring.reverse())); lawn._worcRim = true; }
        }
      }
    }
    // Nothing wild grows in the rebuilt ground: the quad's paths and banks, Pump Quad, the passages, the Hanging
    // Garden's mound (systems/_flora_plan.js leaves a skipped area alone; its tufts stood at y = 0, in the air over
    // the sunk floor and inside the passages). Listed FIRST, so the map view paints the mapped lawns over them.
    if (game.map && game.map.areas && !game.map.areas.some((a) => a.id === 'worc:site-quad')) {
      const site = (id, kind, pts) => { game.map.areas.unshift({ id, kind, poly: pts.map(([u, v]) => L2W(u, v)) }); ov.skip.add(id); };
      site('worc:site-quad', 'paved', [[-52.6, VT - 0.05], [UW, VT - 0.05], [UW, VS], [COT.e[0], COT.e[1]], [COT.w[0], COT.w[1]], [SWW.B[0], SWW.B[1]], [-52.6, SWW.A[1]]]);
      site('worc:site-pump', 'paved', [[UW, VS], [PUMP.ue, VS], [PUMP.ue, 31.9], [COT.e[0], 30.0], [COT.e[0], COT.e[1]]]);
      site('worc:site-passage-e', 'paved', [[TUN.u0 - 0.4, 28], [TUN.u1 + 0.4, 28], [TUN.u1 + 0.4, TUN.v1 + 0.4], [TUN.u0 - 0.4, TUN.v1 + 0.4]]);
      if (SWTUN) { const ax = SWW.B[0] - SWW.A[0], az = SWW.B[1] - SWW.A[1], L = Math.hypot(ax, az), f = (x, z) => [SWW.A[0] + (ax * x - az * z) / L, SWW.A[1] + (az * x + ax * z) / L]; site('worc:site-mound', 'garden', [f(HANG.x0 - 0.2, -0.6), f(HANG.x1 + 0.2, -0.6), f(HANG.x1 + 0.2, HANG.len + 0.4), f(HANG.x0 - 0.2, HANG.len + 0.4)]); }
    }
    // Pump Quad's ranges (Staircases 14, 15, 16) stand on its court, 1.25 m below the datum: the generator builds them
    // from that level (the Worcester Street side then shows 1.25 m less of them, as the real range does)
    if (!PUMPR_ON && game.map && game.map.buildings) for (const b of game.map.buildings) if (b.id === 'w301621502' || b.id === 'w301621503' || b.id === 'w301621504') b.minH = PQY;
    // (second pass: the Hall's south wall is at v 19.1 and the east range's court face at u 21.3 — the 1939 plan, LIDAR
    //  and the bar's fire plan agree; the map has 20.4 and 19.9. Until the ranges are built by hand the mapped outlines
    //  of Staircases 15 and 16 are drawn to those lines.)
    if (!PUMPR_ON && game.map && game.map.buildings) for (const id of ['w301621503', 'w301621504']) { const b = game.map.buildings.find((q) => q.id === id); if (b && !b._worcB) { b._worcB = true; for (const p of b.poly) { let [u, v] = W2L(p[0], p[1]); if (u > 18.5 && u < 21 && v < 33) { if (v < 21) v = VS + 0.02; else if (v > 30) v = PUMP.south(PUMP.ue); u = PUMP.ue; const w = L2W(u, v); p[0] = w[0]; p[1] = w[1]; } else if (v < 21 && u > 21) { const w = L2W(u, VS + 0.02); p[0] = w[0]; p[1] = w[1]; } } } }
    streetPreMap(game);      // the boundary walls and the ranges seen from the street (_worcester_street.js)
    if (SWTUN) ov.skip.add('w130668914');      // the mapped passage's gravel strip: the tunnel has its own flagged floor
    if (SWTUN && game.map && game.map.areas) { const fb = game.map.areas.find((a) => a.id === 'w849941984'); if (fb) for (const q of fb.poly) if (q[0] > -300.9 && q[1] < 46) q[0] = -301.3; }
  },

  install(game) {
    const world = game.world, mats = world.mats, Y = world.Y;
    const col = game.worldCollider;
    const atlas = signAtlas();
    const t0 = performance.now();

    // ---------------------------------------------------------------- materials (shared by both sites)
    // graphics pass 6: everything solid (walls, roofs, joinery, metalwork, windows, doors) is ONE atlas material painted in
    // _worcester_kit.js; ground in the city ground material; signs + wrought ironwork are alpha decals in one more.
    const M = {
      // signs stay readable after dark (as if caught by the wall lanterns); railings, gates and the overthrow share the
      // texture as alpha cut-outs (blended, so distant bars thin out to a veil instead of shimmering or vanishing)
      signs: (() => {
        const m = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.6, emissive: 0xfff0d8, emissiveMap: atlas.texture, emissiveIntensity: 0, transparent: true, alphaTest: 0.04, depthWrite: false, side: THREE.DoubleSide });
        world.registerNight(m, 0.3); return m;
      })(),
    };
    const pack = makePack(world, {
      ground: { paving: 'path', gravel: 'path', setts: 'path', asphalt: 'path', lawn: 'area2', grass: 'area2', flowerbed: 'marking', apron: 'area1', yard: 'area1' },
    });
    M._pack = pack;
    const groupC = new THREE.Group(); groupC.name = 'worcester-college';
    groupC.position.set(C0[0], 0, C0[1]); groupC.rotation.y = PHI;
    world.addStatic(groupC);

    const B = new Batch();          // college (local frame)

    // ================================================================= helpers (local frame)
    const lit = (a, b) => hash(a, b) > 0.42;
    /** wall outline with openings that start at the bottom edge cut in as notches. top: number or [[x,y]...] right->left */
    function outline(x0, x1, y0, top, notches = []) {
      const pts = [[x0, y0]];
      for (const n of notches.slice().sort((a, b) => a[0][0] - b[0][0])) { pts.push(n[0]); for (const p of n.slice(2).reverse()) pts.push(p); pts.push(n[1]); }
      pts.push([x1, y0]);
      if (typeof top === 'number') pts.push([x1, top], [x0, top]); else for (const p of top) pts.push(p);
      return pts;
    }
    // every painted window gets its own integer UV bay: the atlas shader hashes it to decide which rooms are lit at
    // night (ground floors more often). LIT = bays that are lit whenever any are (the Lodge, the Cellar Bar light-wells).
    let bayN = 0;
    const LIT = []; for (let i = 300; i < 900 && LIT.length < 24; i++) if (bayLit(i, 0) < 0.06) LIT.push(i);
    const DARK = []; for (let i = 300; i < 900 && DARK.length < 12; i++) if (bayLit(i, 1) > 0.95) DARK.push(i);      // bays that are never lit (lit: false — the Chapel's far-off glass: the room itself glows when it is lit)
    const nextBay = (y0, lit, dark) => (dark && DARK.length ? [DARK[bayN++ % DARK.length], 1] : lit && LIT.length ? [LIT[bayN++ % LIT.length], 0] : [1 + (bayN++ % 251), y0 < 4.2 ? 0 : 1 + (bayN % 5)]);
    /** window inside an opening (wall frame coords, z=0 face): ONE painted unit (sash / round-headed sash / leaded
     *  lights) instead of a box per glazing bar; stone mullions and the sill stay real geometry */
    function glaze(Bt, pts, d, o = {}) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, yt = -Infinity;
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); yt = Math.max(yt, p[1]); }
      const w = x1 - x0, z = -d + 0.02, bay = nextBay(y0, o.lit === true, o.lit === false);
      if (o.mullion) {          // leaded lights behind stone mullions (Tudor windows)
        Bt.unit('leaded', pts, z, bay);
        const n = o.mullion;
        for (let k = 1; k < n; k++) Bt.box(o.mullionKey || 'rubble', x0 + (w * k) / n, (y0 + yt) / 2, -d / 2, 0.1, yt - y0, d, 0, { top: false });
      } else if (o.spring !== undefined) Bt.archUnit('archSash', (x0 + x1) / 2, w, y0, o.spring, z, bay);
      else Bt.unit(o.rows <= 2 || yt - y0 < 1.7 ? 'sashAttic' : 'sash', pts, z, bay);
      if (o.sill !== false) Bt.box(o.sillKey || 'stoneDress', (x0 + x1) / 2, y0 - 0.07, 0.08, w + 0.18, 0.14, 0.16);      // (wholly in front of the wall: its top ran 4 cm into the reveal's own bottom, in one plane, at every window)
    }
    /** a wall face in frame F with openings: [{pts, d, kind:'win'|'void'|'door'|'recess', ...glaze opts}] */
    function wall(Bt, F, out, ops = [], key = 'stone') {
      Bt.push(F);
      const holes = ops.filter((o) => !o.notch).map((o) => o.pts);
      Bt.face(key, out, holes);
      for (const o of ops) {
        const d = o.d ?? 0.22;
        if (o.kind !== 'none') Bt.reveal(o.revealKey || key, o.pts, 0, -d, !!o.notch);
        if (o.kind === 'win') glaze(Bt, o.pts, d, o);
        if (o.kind === 'door') {
          let y0 = Infinity, yt = -Infinity, x0 = Infinity, x1 = -Infinity;
          for (const p of o.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); yt = Math.max(yt, p[1]); }
          const oak = o.doorKey === 'oak';
          if (o.spring !== undefined) Bt.archUnit(oak ? 'archDoorOak' : 'archDoor', (x0 + x1) / 2, x1 - x0, y0, o.spring, -d + 0.02, nextBay(y0));
          else if (o.plank) {          // boarded oak door with strap hinges (the Cottages)
            Bt.face('oak', o.pts, [], -d + 0.02);
            for (const fy of [0.22, 0.72]) Bt.box('iron', (x0 + x1) / 2 - 0.08, y0 + (yt - y0) * fy, -d + 0.035, (x1 - x0) * 0.7, 0.05, 0.02, 0, { top: false });
          } else Bt.unit(oak ? 'doorOak' : 'doorDark', o.pts, -d + 0.02);
          if (o.dark) Bt.box('dark', (x0 + x1) / 2, (y0 + yt) / 2, -d - 0.02, x1 - x0, yt - y0, 0.02);
        }
        if (o.kind === 'recess') {
          // blind arch recess with an inner opening at its back
          Bt.push(new THREE.Matrix4().makeTranslation(0, 0, -d));
          const inner = o.inner ? [o.inner.pts] : [];
          Bt.face(key, o.pts, inner);
          if (o.inner) {
            const di = o.inner.d ?? 0.25;
            Bt.reveal(key, o.inner.pts, 0, -di, !!o.inner.notch);
            if (o.inner.kind === 'win') glaze(Bt, o.inner.pts, di, o.inner);
            if (o.inner.kind === 'door') { Bt.pop(); Bt.pop(); wallDoorInRecess(Bt, F, d, o.inner); Bt.push(F); Bt.push(new THREE.Matrix4().makeTranslation(0, 0, -d)); }
          }
          Bt.pop();
        }
      }
      Bt.pop();
    }
    function wallDoorInRecess(Bt, F, d, inner) {
      Bt.push(F); Bt.push(new THREE.Matrix4().makeTranslation(0, 0, -d));
      const di = inner.d ?? 0.25;
      let y0 = Infinity, x0 = Infinity, x1 = -Infinity;
      for (const p of inner.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); }
      Bt.archUnit('archDoor', (x0 + x1) / 2, x1 - x0, y0, inner.spring, -di + 0.02, nextBay(y0));
      Bt.pop(); Bt.pop();
    }
    function hipRoof(Bt, key, x0, x1, z0, z1, y, pitch = 0.45, o = 0) {
      x0 -= o; x1 += o; z0 -= o; z1 += o;
      const w = x1 - x0, d = z1 - z0, tn = Math.tan(pitch);
      if (w >= d) {
        const r = (d / 2) * tn, zc = (z0 + z1) / 2, xa = x0 + d / 2, xb = x1 - d / 2;
        Bt.poly(key, [[x0, y, z1], [x1, y, z1], [xb, y + r, zc], [xa, y + r, zc]], [0, 1, 1]);
        Bt.poly(key, [[x1, y, z0], [x0, y, z0], [xa, y + r, zc], [xb, y + r, zc]], [0, 1, -1]);
        Bt.poly(key, [[x1, y, z1], [x1, y, z0], [xb, y + r, zc]], [1, 1, 0]);
        Bt.poly(key, [[x0, y, z0], [x0, y, z1], [xa, y + r, zc]], [-1, 1, 0]);
        return y + r;
      }
      const r = (w / 2) * tn, xc = (x0 + x1) / 2, za = z0 + w / 2, zb = z1 - w / 2;
      Bt.poly(key, [[x1, y, z0], [x1, y, z1], [xc, y + r, zb], [xc, y + r, za]], [1, 1, 0]);
      Bt.poly(key, [[x0, y, z1], [x0, y, z0], [xc, y + r, za], [xc, y + r, zb]], [-1, 1, 0]);
      Bt.poly(key, [[x0, y, z1], [x1, y, z1], [xc, y + r, zb]], [0, 1, 1]);
      Bt.poly(key, [[x1, y, z0], [x0, y, z0], [xc, y + r, za]], [0, 1, -1]);
      return y + r;
    }
    /** classical cornice + blocking course round a rectangle (sides: which edges get the parapet: n,s,e,w) */
    function cornice(Bt, x0, x1, z0, z1, y, sides = 'nsew') {
      Bt.boxXZ('stoneDress', x0 - 0.12, x1 + 0.12, y, y + 0.28, z0 - 0.12, z1 + 0.12, { bottom: true });
      Bt.boxXZ('stoneDress', x0 - 0.38, x1 + 0.38, y + 0.28, y + 0.62, z0 - 0.38, z1 + 0.38, { bottom: true });
      const t = 0.42, h0 = y + 0.62, h1 = y + 1.25;
      if (sides.includes('n')) Bt.boxXZ('stoneDress', x0 - 0.1, x1 + 0.1, h0, h1, z0 - 0.1, z0 - 0.1 + t);
      if (sides.includes('s')) Bt.boxXZ('stoneDress', x0 - 0.1, x1 + 0.1, h0, h1, z1 + 0.1 - t, z1 + 0.1);
      if (sides.includes('w')) Bt.boxXZ('stoneDress', x0 - 0.1, x0 - 0.1 + t, h0, h1, z0 - 0.1, z1 + 0.1);
      if (sides.includes('e')) Bt.boxXZ('stoneDress', x1 + 0.1 - t, x1 + 0.1, h0, h1, z0 - 0.1, z1 + 0.1);
    }
    /** pediment on a facade frame F between s=a..b with base at y (sits on the cornice) */
    function pediment(Bt, F, a, b, y, h, roofKey = 'slate') {
      Bt.push(F);
      const m = (a + b) / 2;
      Bt.poly('stoneDress', [[a, y, 0.12], [b, y, 0.12], [m, y + h, 0.12]], [0, 0, 1]);
      const L = Math.hypot(m - a, h), ang = Math.atan2(h, m - a);
      for (const sgn of [-1, 1]) {
        const x0 = sgn < 0 ? a - 0.35 : b + 0.35;
        // raking cornice as a sloping box
        const mtx = new THREE.Matrix4().makeTranslation((x0 + m) / 2, y + h / 2 + 0.2, 0.18).multiply(new THREE.Matrix4().makeRotationZ(sgn < 0 ? ang : -ang));
        Bt.push(mtx); Bt.box('stoneDress', 0, 0, 0, L + 0.45, 0.4, 0.55, 0, { bottom: true }); Bt.pop();
        Bt.poly(roofKey, [[x0, y + 0.42, 0.45], [m, y + h + 0.42, 0.45], [m, y + h + 0.42, -3.5], [x0, y + 0.42, -3.5]], [0, 1, 0]);
      }
      Bt.box('stoneDress', m, y + 0.14, 0.19, b - a + 0.6, 0.28, 0.48);      // (its front 2.5 cm behind the raking cornice's: they were 5 mm apart)
      Bt.pop();
    }
    function gableRoof(Bt, key, wallKey, x0, x1, z0, z1, y, rise, ov = 0.25, ends = true) {
      const zc = (z0 + z1) / 2;
      Bt.poly(key, [[x0 - ov, y - ov * 0.8, z1 + ov], [x1 + ov, y - ov * 0.8, z1 + ov], [x1 + ov, y + rise, zc], [x0 - ov, y + rise, zc]], [0, 1, 1]);
      Bt.poly(key, [[x1 + ov, y - ov * 0.8, z0 - ov], [x0 - ov, y - ov * 0.8, z0 - ov], [x0 - ov, y + rise, zc], [x1 + ov, y + rise, zc]], [0, 1, -1]);
      // undersides of the overhang
      Bt.poly(key, [[x0 - ov, y - ov * 0.8, z1 + ov], [x1 + ov, y - ov * 0.8, z1 + ov], [x1 + ov, y, z1], [x0 - ov, y, z1]], [0, -1, 0]);
      Bt.poly(key, [[x1 + ov, y - ov * 0.8, z0 - ov], [x0 - ov, y - ov * 0.8, z0 - ov], [x0 - ov, y, z0], [x1 + ov, y, z0]], [0, -1, 0]);
      if (ends) {
        Bt.poly(wallKey, [[x0, y, z0], [x0, y, z1], [x0, y + rise, zc]], [-1, 0, 0]);
        Bt.poly(wallKey, [[x1, y, z1], [x1, y, z0], [x1, y + rise, zc]], [1, 0, 0]);
      }
    }
    // collider helpers (local -> world)
    const seg = (u1, v1, u2, v2, tag = 'building') => { const a = L2W(u1, v1), b = L2W(u2, v2); return col.addSegment(a[0], a[1], b[0], b[1], { tag }); };
    const pl = (pts, tag) => { for (let i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], tag); };
    const boxC = (u0, u1, v0, v1, tag) => pl([[u0, v0], [u1, v0], [u1, v1], [u0, v1], [u0, v0]], tag);

    /** wrought-iron railing from local point a to b ([u, v]) between heights y0..y1: decal cards, one 6-bar panel each */
    function railRun(Bt, a, b, y0, y1) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 0.78)), uv = atlas.uv('rail');
      for (let i = 0; i < n; i++) {
        const p = [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n], q = [a[0] + ((b[0] - a[0]) * (i + 1)) / n, a[1] + ((b[1] - a[1]) * (i + 1)) / n];
        Bt.card('signs', [p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], uv);
      }
    }
    /** iron grating lying over a light-well (wall frame: s along the wall, t out from it) */
    const grille = (Bt, s, t0 = 0.05, t1 = 0.66) => Bt.card('signs', [s - 0.48, 0.035, t1], [s + 0.48, 0.035, t1], [s + 0.48, 0.035, t0], [s - 0.48, 0.035, t0], atlas.uv('grille'));

    /** a clump of border planting: a five-sided leafy mound with a couple of flower spikes (keys = tints of the plain cell) */
    function plant(Bt, u, v, y, r, h, leaf, flower, k = 0) {
      const ring = (rr, yy) => { const o = []; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + k; o.push([u + Math.cos(a) * rr, yy, v + Math.sin(a) * rr]); } return o; };
      const b = ring(r * 0.85, y), m = ring(r, y + h * 0.5), t = ring(r * 0.62, y + h * 0.9), top = [u, y + h, v];
      for (let i = 0; i < 5; i++) {
        const j = (i + 1) % 5, n = [Math.cos(((i + 0.5) / 5) * Math.PI * 2 + k), 0.2, Math.sin(((i + 0.5) / 5) * Math.PI * 2 + k)];
        Bt.poly(leaf, [b[i], b[j], m[j], m[i]], n); Bt.poly(leaf, [m[i], m[j], t[j], t[i]], [n[0], 0.7, n[2]]);
        Bt.poly(flower && (i + Math.round(k)) % 5 < 3 ? flower : leaf, [t[i], t[j], top], [n[0], 2.5, n[2]]);
      }
      if (flower && h > 0.7) {      // a tall spire or two at the back of the border
        const fx = u + Math.cos(k * 3) * r * 0.3, fz = v + Math.sin(k * 3) * r * 0.3, fy = y + h * 0.85, w = 0.045;
        Bt.poly(flower, [[fx - w, fy, fz], [fx + w, fy, fz], [fx, fy + 0.34, fz]], [0, 0.3, -1]); Bt.poly(flower, [[fx, fy, fz - w], [fx, fy, fz + w], [fx, fy + 0.34, fz]], [-1, 0.3, 0]);
        Bt.poly(flower, [[fx + w, fy, fz], [fx - w, fy, fz], [fx, fy + 0.34, fz]], [0, 0.3, 1]); Bt.poly(flower, [[fx, fy, fz + w], [fx, fy, fz - w], [fx, fy + 0.34, fz]], [1, 0.3, 0]);
      }
    }
    /**
     * A flight of n steps falling from T (at s = s0) to the ground (at s = s1) along the local axis 'u' or 'v', between
     * a0 and a1 across it: treads, risers and the stepped side profiles as separate faces (nested boxes would leave
     * coplanar side faces for the z-fight audit). The ground function ramps smoothly underneath.
     */
    function flight(a0, a1, s0, s1, n, along = 'v', yb = 0, yt = T) {
      const P = (a, y, sv) => (along === 'v' ? [a, y, sv] : [sv, y, a]), ds = (s1 - s0) / n, sg = Math.sign(ds);
      for (let k = 0; k < n; k++) {
        const sa = s0 + ds * k, sb = sa + ds, h = yb + (yt - yb) * (n - k) / n, hn = yb + (yt - yb) * (n - k - 1) / n;
        B.poly('pavingSolid', [P(a0, h, sa), P(a1, h, sa), P(a1, h, sb), P(a0, h, sb)], [0, 1, 0]);                     // tread
        const rn = along === 'v' ? [0, 0, sg] : [sg, 0, 0];
        B.poly('pavingSolid', [P(a0, hn, sb), P(a1, hn, sb), P(a1, h, sb), P(a0, h, sb)], rn);                          // riser
        for (const [a, d] of [[a0, -1], [a1, 1]]) B.poly('pavingSolid', [P(a, yb, sa), P(a, yb, sb), P(a, h, sb), P(a, h, sa)], along === 'v' ? [d, 0, 0] : [0, 0, d]);   // side
      }
    }
    /** a row of dentil blocks under a cornice, in the current wall frame (s along the wall from 0..L) */
    const dentils = (Bt, L, y, step = 0.62) => { const n = Math.max(1, Math.round(L / step)); for (let i = 0; i < n; i++) Bt.box('stoneDress', (L * (i + 0.5)) / n, y, 0.1, 0.24, 0.2, 0.2, 0, { top: false }); };
    /** terracotta tub with a clipped box ball */
    const tub = (Bt, u, v, y = 0) => { Bt.cyl('terracotta', u, y + 0.04, v, 0.27, 0.4, 7, false, 0.2); plant(Bt, u, v, y + 0.42, 0.27, 0.5, 'box', null, u); col.addCircle && col.addCircle(...L2W(u, v), 0.3, { tag: 'furniture' }); };
    const LEAVES = ['leafA', 'leafB', 'leafC'], FLOWERS = ['flP', 'flR', 'flY', 'flW', 'flB', 'flO', 'flM', null];
    /** iron wall lantern on a bracket: at local (u, v) on a wall whose outward normal is (nu, nv); the lamp itself glows at night */
    const lanterns = [];
    function lantern(Bt, u, y, v, nu, nv, out = 0.42) {
      const cu = u + nu * out, cv = v + nv * out;
      Bt.beam('iron', [u, y + 0.5, v], [cu, y + 0.5, cv], 0.035); Bt.beam('iron', [u, y + 0.15, v], [cu - nu * 0.1, y + 0.48, cv - nv * 0.1], 0.025);
      Bt.box('iron', cu, y + 0.44, cv, 0.26, 0.04, 0.26); Bt.box('lampGlass', cu, y + 0.26, cv, 0.2, 0.34, 0.2, 0, { top: false }); Bt.box('iron', cu, y + 0.07, cv, 0.22, 0.04, 0.22);
      lanterns.push([cu, y + 0.26, cv]);
    }
    /** teak garden bench with its back to (bu, bv) */
    function bench(Bt, u, v, bu, bv, len = 1.8, y = 0) {
      Bt.push(frame(u, y, v, -bv, bu));       // x along the bench, z out towards the sitter's front
      Bt.box('teak', 0, 0.43, 0.02, len, 0.05, 0.44); Bt.box('teak', 0, 0.68, -0.22, len, 0.09, 0.04); Bt.box('teak', 0, 0.86, -0.25, len, 0.1, 0.04);
      for (const x of [-len / 2 + 0.05, len / 2 - 0.05]) { Bt.box('teak', x, 0.3, 0.2, 0.06, 0.62, 0.06, 0, { top: false }); Bt.box('teak', x, 0.46, -0.24, 0.06, 0.92, 0.06); Bt.box('teak', x, 0.62, -0.02, 0.06, 0.05, 0.5); }
      Bt.pop();
      boxC(u - len / 2 * Math.abs(bv) - 0.25 * Math.abs(bu), u + len / 2 * Math.abs(bv) + 0.25 * Math.abs(bu), v - len / 2 * Math.abs(bu) - 0.25 * Math.abs(bv), v + len / 2 * Math.abs(bu) + 0.25 * Math.abs(bv), 'furniture');
    }

    // ================================================================= MAIN BLOCK, FORECOURT + SCREEN ON WALTON STREET
    // The block itself is built by places/_worcester_block.js to its true plan (WORC_BLOCK): the quad front and its
    // arcade, the loggia under its groin vault with the ramps to the Chapel and Hall doors, the gate hall, the
    // three-bay street front, the wings, roofs, colliders, the forecourt and its screen.
    // (the Cellar Bar's basement lights in the Hall's south wall: _bar_plan.js LIGHTS)
    const BLOCK = buildMainBlock({ B, atlas, wall, outline, pediment, dentils, railRun, grille, lantern, seg, pl, boxC, T, PQY, yFoot: -2.2, hallSouth: HALL_SOUTH });

    // ================================================================= MAIN QUAD GROUND
    // (2026-11-22, the survey: gravel on all four sides of the lawn and on both terrace walks; stone flags only as
    //  aprons at the Cottages' doors; ONE flight on the east side, the fan at the loggia's south-west corner)
    // QF: the quad's sunk floor as a frame (y = 0 is the floor, a plane falling west): lawn, paths, borders, the Cottages
    const QF = new THREE.Matrix4().set(1, 0, 0, 0, QS, 1, 0, QE - QS * QU0, 0, 0, 1, 0, 0, 0, 0, 1);
    {
      // the terrace walks: gravel at the street's level, round the bank's rounded north-east corner
      const walk = [[-52.3, VT - 0.05], [UW, VT - 0.05], [UW, FAN.c[1]], [EW, FAN.c[1]], [EW, CN[1]]];
      for (let k = 1; k <= 10; k++) { const a = (k / 10) * (Math.PI / 2), r = CNF + (EW - EF); walk.push([CN[0] + Math.cos(a) * r, CN[1] - Math.sin(a) * r]); }
      walk.push([-52.3, WK]);
      B.flat('gravel', walk, T);
      // grass banks: height-field of the ground function
      const du = 0.6, dv = 0.55;
      for (let u = -52.3; u < EW - 1e-6; u += du) for (let v = WK; v < BE - 1e-6; v += dv) {
        let ua = u, u1 = Math.min(u + du, EW); const v1 = Math.min(v + dv, BE);
        // (the north steps: the turf comes right up to their stone cheeks on both sides)
        if (v < BF) { if (ua >= NS0 - 1e-6 && u1 <= NS1 + 1e-6) continue; if (ua < NS0 && u1 > NS0) u1 = NS0; else if (ua < NS1 && u1 > NS1) ua = NS1; }
        const ef = (vv) => clamp01((BE - vv) / 1.2), f = [bankF(ua, v) * ef(v), bankF(u1, v) * ef(v), bankF(u1, v1) * ef(v1), bankF(ua, v1) * ef(v1)];
        if (f.every((x) => x <= 1e-4) || (f.every((x) => x >= 1 - 1e-4) && v1 <= FAN.c[1] + 1e-6)) continue;      // (beside the fan the bank's flat top is drawn too: no walk lies over it there)
        // (a corner on the walk itself lies just UNDER the walk's gravel, so the gravel's own curved edge is the bank's
        //  top: the cells are square and their edge was a saw's along the rounded corner)
        const h = [quadGround(ua, v), quadGround(u1, v), quadGround(u1, v1 - 1e-4), quadGround(ua, v1 - 1e-4)].map((y, i) => y + (f[i] >= 1 - 1e-4 ? -0.03 : 0.012));
        B.poly('grass', [[ua, h[3], v1], [u1, h[2], v1], [u1, h[1], v], [ua, h[0], v]], [0, 1, 0], [[ua, v1], [u1, v1], [u1, v], [ua, v]]);
      }
      B.push(QF);
      // (earth under it all: the world's base ground is not drawn here — ov.groundHoles — and no seam between two
      //  pieces of the floor may show the sky)
      B.flat('soil', [[-52.3, WK - 0.3], [UW, WK - 0.3], [UW, VS], [GAP[0], VS], [GAP[0], COT.e[1]], [COT.w[0], COT.w[1]], [SWW.B[0], SWW.B[1] + 0.2], [-52.3, SWW.A[1] + 0.2]], -0.07);
      // (under the Cottages: their doors stand in open recesses. 2026-11-23, the rim: not under the east passage, whose
      //  floor now falls 0.19 m to the garden and would lie under this earth at its south end)
      for (const [ua, ub] of [[COT.w[0], TUN.u0], [TUN.u1, COT.e[0]]]) B.flat('soil', [[ua, cotFront(ua) - 0.05], [ub, cotFront(ub) - 0.05], [ub, cotFront(ub) + COT.depth], [ua, cotFront(ua) + COT.depth]], -0.03);
      // lawn + gravel paths (the gravel runs on east through the gap, as far as Pump Quad's own)
      const lawn = lawnPoly;
      B.flat('lawn', lawn, 0.03);
      const BU = -4;      // the Long Border's east end (the path is at its widest at the fan's foot)
      const lower = [[-52.3, BF], [CN[0], BF]];
      for (let k = 1; k <= 10; k++) { const a = (1 - k / 10) * (Math.PI / 2); lower.push([CN[0] + Math.cos(a) * CNF, CN[1] - Math.sin(a) * CNF]); }
      lower.push([EF, FAN.c[1]], [UW, FAN.c[1]], [UW, VS], [GAP[0], VS], [GAP[0], cotFront(GAP[0])], [BU, cotFront(BU)]);
      for (let u = BU; u > -43.7; u -= 5) lower.push([u, cotFront(u) - 1.1]);
      lower.push([-43.7, cotFront(-43.7) - 1.1], [SWW.B[0], SWW.B[1]], [-52.3, SWW.A[1] + 0.03]);
      B.flat('gravel', lower, 0.045, [lawn]);
      // Long Border under the Cottages (gaps at the doors and the tunnel), a flagged apron at each door
      const doorsU = []; for (let i = 0; i < 6; i++) doorsU.push(COT.e[0] - cotDoorX(i));
      const gaps = [...doorsU.map((u) => [u - 0.8, u + 0.8]), [TUN.u0 - 0.2, TUN.u1 + 0.2]].sort((a, b) => a[0] - b[0]);
      let start = -43.7;
      for (const [a, b] of gaps) { if (a > BU) break; if (a > start) B.flat('flowerbed', [[start, cotFront(start) - 1.1], [a, cotFront(a) - 1.1], [a, cotFront(a)], [start, cotFront(start)]], 0.06); start = Math.max(start, b); }
      if (start < BU) B.flat('flowerbed', [[start, cotFront(start) - 1.1], [BU, cotFront(BU) - 1.1], [BU, cotFront(BU)], [start, cotFront(start)]], 0.06);
      for (const u of doorsU) B.flat('paving', [[u - 0.8, cotFront(u) - 1.25], [u + 0.8, cotFront(u) - 1.25], [u + 0.8, cotFront(u)], [u - 0.8, cotFront(u)]], 0.062);
      B.flat('gravel', [[TUN.u0 - 0.2, cotFront(TUN.u0) - 1.1], [TUN.u1 + 0.2, cotFront(TUN.u1) - 1.1], [TUN.u1 + 0.2, cotFront(TUN.u1)], [TUN.u0 - 0.2, cotFront(TUN.u0)]], 0.045);      // the way in to the east passage
      // ... and its planting: a back row of taller clumps against the wall, a front row of low mounds, drifts of colour
      {
        let i = 0;
        for (let u = -43.4; u < BU - 0.1; u += 0.62, i++) {
          if (gaps.some(([a, b]) => u > a - 0.25 && u < b + 0.25)) continue;
          const h1 = hash(i, 3), h2 = hash(i, 7), drift = Math.floor((u + 44) / 3.4);
          plant(B, u, cotFront(u) - 0.33, 0.05, 0.33 + h1 * 0.08, 0.45 + h2 * 0.5, LEAVES[i % 3], FLOWERS[(drift * 3 + (h1 > 0.7 ? 1 : 0)) % 8], i * 1.7);
          if (h2 > 0.25) plant(B, u + 0.3, cotFront(u) - 0.8, 0.05, 0.26 + h2 * 0.06, 0.2 + h1 * 0.18, LEAVES[(i + 1) % 3], FLOWERS[(drift * 5 + 2 + (h2 > 0.8 ? 3 : 0)) % 8], i * 2.3);
        }
      }
      // little sign at the lawn's edge (the college map says it)
      B.box('iron', -12.0, 0.35, 17.0, 0.04, 0.7, 0.04);
      B.push(new THREE.Matrix4().makeTranslation(-12.0, 0, 17.0).multiply(new THREE.Matrix4().makeRotationY(Math.PI))); B.sign('signs', -0.3, 0.55, 0.3, 0.85, 0.03, atlas.uv('grass')); B.pop();
      B.pop();
      // the north flight: down the middle of the north bank (the broad flight of a dozen steps in the photographs),
      // with stone cheeks
      {
        const yb = quadY((NS0 + NS1) / 2);
        flight(NS0 + 0.25, NS1 - 0.25, WK, BF, 12, 'v', yb, T);
        for (const u of [NS0, NS1]) {      // (solid cheeks: outer face, sloping top, and the strip of inner face that stands above the treads)
          const d = u < -25 ? 0.25 : -0.25, ui = u + d;
          B.poly('stone', [[u, T + 0.25, WK], [u, yb + 0.25, BF], [u, yb - 0.1, BF], [u, yb - 0.1, WK]], [-d, 0, 0]);
          B.poly('stone', [[u, T + 0.25, WK], [ui, T + 0.25, WK], [ui, yb + 0.25, BF], [u, yb + 0.25, BF]], [0, 1, 0.3]);
          B.poly('stone', [[ui + d * 0.04, T + 0.25, WK], [ui + d * 0.04, yb + 0.25, BF], [ui + d * 0.04, yb, BF], [ui + d * 0.04, T, WK]], [d, 0, 0]);
        }
        for (const u of [NS0, NS1]) { B.boxXZ('stone', Math.min(u, u + (u < -25 ? 0.25 : -0.25)), Math.max(u, u + (u < -25 ? 0.25 : -0.25)), yb - 0.1, yb + 0.3, BF - 0.3, BF); }
        for (const u of [NS0, NS1]) B.boxXZ('stone', Math.min(u, u + (u < -25 ? 0.25 : -0.25)), Math.max(u, u + (u < -25 ? 0.25 : -0.25)), T, T + 0.25, WK - 0.3, WK);   // the cheeks' caps at the top
      }
      // THE FAN (see FAN at the top): a quarter-disc of landing in front of the last arch, then ten risers as arcs
      // about that arch's north jamb, going down south and south-west between the arcade's face and the bank, the
      // lowest ending at the block's corner. Stone treads and risers; a stone cheek between it and the bank, a kerb
      // on its north side under the walk's edge; two steel handrails (CHECKED: fan).
      {
        const [cu, cv] = FAN.c, f0 = quadY(cu - 2), h = (T - f0) / FAN.n, NA = 10, Q = Math.PI / 2, W = cu - EW;
        const P = (r, a) => [cu - Math.cos(a) * r, cv + Math.sin(a) * r];      // a: 0 = west, PI / 2 = south
        const a0 = (r) => (r > W ? Math.acos(W / r) : 0);                       // where the ring of radius r meets the bank's cheek (u = EW)
        const ring = (r) => { const o = [], a = a0(r); for (let i = 0; i <= NA; i++) o.push(P(r, a + (i / NA) * (Q - a))); return o; };
        const y3 = (p, y) => [p[0], y, p[1]];
        { const top = [y3([cu, cv], T)]; for (const p of ring(FAN.r0)) top.push(y3(p, T)); B.poly('pavingSolid', top, [0, 1, 0]); }
        for (let k = 0; k < FAN.n; k++) {
          const ra = FAN.r0 + FAN.tread * k, rb = ra + FAN.tread, y = T - h * (k + 1), A = ring(ra), Bq = ring(rb);
          for (let i = 0; i < NA; i++) {      // the riser at ra: from this tread up to the one above
            const p = A[i], q = A[i + 1];
            B.poly('pavingSolid', [y3(p, y), y3(q, y), y3(q, y + h), y3(p, y + h)], [cu - (p[0] + q[0]) / 2 > 0 ? -(cu - (p[0] + q[0]) / 2) : 0, 0, (p[1] + q[1]) / 2 - cv]);
          }
          if (k === FAN.n - 1) break;         // (the lowest riser stands on the gravel)
          for (let i = 0; i < NA; i++) B.poly('pavingSolid', [y3(A[i], y), y3(Bq[i], y), y3(Bq[i + 1], y), y3(A[i + 1], y)], [0, 1, 0]);      // the tread: ra .. rb
        }
        // the stone cheek along the bank (u = EW, from the fan's north side to the bank's end) and the kerb on the
        // fan's north side (v = cv, under the walk's edge): both stand a hand above the walk and the bank
        {
          const th = 0.22, y0 = f0 - 0.15, N = 8, vEnd = BE + 0.1;
          const top = (v) => Math.max(quadGround(EW - 0.02, v), f0 + 0.2) + 0.12;
          for (let i = 0; i < N; i++) {
            const va = cv + ((vEnd - cv) * i) / N, vb = cv + ((vEnd - cv) * (i + 1)) / N, ya = top(va), yb = top(vb);
            B.poly('stone', [[EW, y0, va], [EW, y0, vb], [EW, yb, vb], [EW, ya, va]], [1, 0, 0]);
            B.poly('stone', [[EW - th, y0, va], [EW - th, y0, vb], [EW - th, yb, vb], [EW - th, ya, va]], [-1, 0, 0]);
            B.poly('stone', [[EW, ya, va], [EW, yb, vb], [EW - th, yb, vb], [EW - th, ya, va]], [0, 1, 0]);
          }
          B.poly('stone', [[EW, y0, vEnd], [EW - th, y0, vEnd], [EW - th, top(vEnd), vEnd], [EW, top(vEnd), vEnd]], [0, 0, 1]);
          const ue = cu - FAN.r0;
          B.boxXZ('stone', EW - th, ue, y0, T + 0.12, cv - th, cv);
        }
        // steel handrails down the flight, one each side: by the arcade's face and by the bank's cheek (the 2008, 2011
        // and 2014 photographs; the owner, 2026-11-22: the first pass's second rail ran "through the middle of the stairs")
        const rail = (pts) => { for (let i = 0; i < pts.length; i++) { const p = pts[i]; B.box('iron', p[0], p[1] + p[3] / 2, p[2], 0.04, p[3], 0.04, 0, { top: false }); if (i) { const q = pts[i - 1]; B.beam('iron', [q[0], q[1] + q[3], q[2]], [p[0], p[1] + p[3], p[2]], 0.045); B.beam('iron', [q[0], q[1] + q[3] * 0.55, q[2]], [p[0], p[1] + p[3] * 0.55, p[2]], 0.03); } } };
        for (const d of [0.12, W - 0.14]) {
          const u = cu - d, v0 = cv + Math.sqrt(Math.max(0, FAN.r0 * FAN.r0 - d * d)) - 0.05, v1 = cv + Math.sqrt(FAN.R * FAN.R - d * d) - 0.08, n = 4, pts = [];
          for (let i = 0; i <= n; i++) { const v = v0 + ((v1 - v0) * i) / n; pts.push([u, quadGround(u, v), v, 0.92]); }
          rail(pts);
        }
        seg(EW, cv, cu - FAN.r0, cv, 'wall'); seg(EW, cv, EW, BE, 'wall');
      }
    }

    // ================================================================= THE TERRACE (Staircases 2 - 6) AND THE SENIOR COMMON ROOM RANGE
    // Built by places/_worcester_terrace.js to their true plan (_worcester_terrace_plan.js TERR, SCR): the Terrace's 19
    // unequal bays under its modillion cornice and mansard roof, the north face with its basement storey to Provost's
    // Yard, Staircase 6's way down through the range, the screen wall and roofed slip at the quad's north-east corner,
    // the old range as far as its gable on Walton Street. (2026-11-22: the first pass drew 17 equal bays 2 m too low and
    // 1.2 m too far south, a level passage through bay 1, and the old range as two more pieces of the Terrace.)
    const TERRACE = buildTerrace({ B, atlas, pack, wall, outline, pediment, lantern, plant, nextBay, seg, pl, T });

    // ================================================================= WEST SIDE: the high wall to the rose garden
    // (2026-11-22, the survey G01: "a high stone wall topped by a wrought-iron fence", 1.5 - 2.5 m of stone with a
    //  plain railing of about 1.2 m, smothered in wisteria so that from the lawn it reads as a 3 m green wall, a deep
    //  border and the gravel path at its foot, a low boarded door in a segmental arch at its north end. It was a low
    //  railed wall with stone piers and an open gate. The door is SHUT: it leads to the Provost's Garden, which is
    //  closed to visitors. Its creeper, the border's planting and the door's size are guesses.)
    // THE RIM ON THE DRAWN GROUND (2026-11-23; _worcester_rim.js): the rose garden behind the wall is drawn at its true
    // 58.20 m, 0.1 m below the quad's path, so the wall is an ordinary high garden wall with two faces: 2.2 m of stone
    // above the path south of its door, the coping sweeping up beside the door to 3.1 m, the railing on both; carried
    // north along the bank's end and the terrace walk's (a parapet there) to the Provost's Lodgings' south face.
    // GARD: the garden's ground at the two passages' south mouths, through THE SWITCH (see GARD at the top).
    GARD.e = rimDropped(world, MOUTH.e[0], MOUTH.e[1]) ? WORC_LEVELS.yOf(rimLevel(MOUTH.e[0], MOUTH.e[1])) : 0;
    GARD.sw = rimDropped(world, MOUTH.sw[0], MOUTH.sw[1]) ? WORC_LEVELS.yOf(rimLevel(MOUTH.sw[0], MOUTH.sw[1])) : 0;
    // BG: what stands ON the gardens' drawn ground, at its height above it (the border at the Cottages' foot, the urns
    // and the spur at the south-west passage's mouth): the main batch is held rigid at the core's datum, this one is not
    const BG = new Batch();
    {
      const U = -52.3, RW = RIM.wall, hv = BF + 1.2, vA = 19.8, vL = LODG.v1, yq = quadY(U);
      const hN = +(T + RW.parapet - yq).toFixed(3);                           // the parapet at the terrace walk's west end, above the quad's floor
      const yg = +(WORC_LEVELS.yOf(RIM.rose) - yq - 0.7).toFixed(3);          // the garden face's foot: 0.7 m into the rose garden's ground
      // the top's profile from the south end northwards: [v, height above the quad's floor]
      const top = [[vA, RW.low], [RW.sweep[0], RW.low], [RW.sweep[1], RW.high], [RW.rake, RW.high], [WK, hN], [vL, hN]];
      B.push(QF);
      // the quad face (s north from the south end) and the garden face (s south from the Lodgings), both under creeper
      B.push(frame(U + 0.3, 0, vA, 0, -1)); B.face('stoneIvyT', [[0, -0.1], [vA - vL, -0.1], ...top.slice().reverse().map(([v, h]) => [vA - v, h])], []); B.pop();
      B.push(frame(U - 0.3, 0, vL, 0, 1)); B.face('stoneIvyT', [[0, yg], [vA - vL, yg], ...top.map(([v, h]) => [v - vL, h])], []); B.pop();
      B.poly('rubble', [[U - 0.3, yg, vA], [U + 0.3, yg, vA], [U + 0.3, RW.low, vA], [U - 0.3, RW.low, vA]], [0, 0, 1]);      // its south end
      // its top: a coping and the railing on the level lengths; the bare coping on the sweep, the railing stepped up the rake
      for (let i = 0; i < top.length - 1; i++) {
        const [va, ha] = top[i], [vb, hb] = top[i + 1];
        if (ha === hb) { B.boxXZ('stoneDress', U - 0.36, U + 0.36, ha, ha + 0.12, vb, va); railRun(B, [U, va], [U, vb], ha + 0.12, ha + 0.12 + RW.rail); continue; }
        B.poly('stoneDress', [[U - 0.36, ha + 0.12, va], [U + 0.36, ha + 0.12, va], [U + 0.36, hb + 0.12, vb], [U - 0.36, hb + 0.12, vb]], [0, 1, 0.3]);
        for (const sx of [-1, 1]) B.poly('stoneDress', [[U + sx * 0.36, ha, va], [U + sx * 0.36, hb, vb], [U + sx * 0.36, hb + 0.12, vb], [U + sx * 0.36, ha + 0.12, va]], [sx, 0, 0]);
        if (va - vb > 1.5) for (let k = 0; k < 3; k++) { const a = va + ((vb - va) * k) / 3, b = va + ((vb - va) * (k + 1)) / 3, h = ha + ((hb - ha) * (k + 1)) / 3; railRun(B, [U, a], [U, b], h + 0.12, h + 0.12 + RW.rail); }
      }
      // the boarded door in its segmental arch, a stone surround standing a little proud
      {
        const door = segPts(0.75, 1.3, 0, 1.75, 0.22);
        B.push(frame(U + 0.3, 0, hv + 1.5, 0, -1));      // s north along the wall, z out into the quad
        B.face('stoneDress', outline(-0.12, 1.62, 0, 2.2, [door]), [], 0.05);
        B.face('oak', door, [], 0.03);
        for (const fy of [0.35, 1.25]) B.box('iron', 0.75, fy, 0.045, 1.1, 0.06, 0.02, 0, { top: false });
        B.pop();
      }
      // the border at the wall's foot
      B.flat('flowerbed', [[U + 0.3, BF + 0.3], [U + 1.7, BF + 0.3], [U + 1.7, hv - 0.2], [U + 0.3, hv - 0.2]], 0.06);
      B.flat('flowerbed', [[U + 0.3, hv + 1.7], [U + 1.7, hv + 1.7], [U + 1.7, 17.4], [U + 0.3, 17.4]], 0.06);
      { let i = 0; for (let v = BF + 0.7; v < 17.2; v += 0.75, i++) { if (v > hv - 0.5 && v < hv + 2.0) continue; const h1 = hash(i, 11), h2 = hash(i, 13); plant(B, U + 0.75, v, 0.05, 0.36 + h1 * 0.1, 0.55 + h2 * 0.6, LEAVES[i % 3], FLOWERS[(Math.floor(i / 4) * 3 + (h1 > 0.6 ? 2 : 0)) % 8], i * 1.3); if (h2 > 0.4) plant(B, U + 1.35, v + 0.3, 0.05, 0.26, 0.22 + h1 * 0.15, LEAVES[(i + 2) % 3], FLOWERS[(Math.floor(i / 3) * 5 + 1) % 8], i * 2.1); } }
      B.pop();
      seg(U, vL, U, vA, 'wall');
      // SW: wall with an archway (the west passage to the gardens), replaces OSM w849941983
      const A = SWW.A, Bp = SWW.B, Cp = SWW.C;
      const ax = Bp[0] - A[0], az = Bp[1] - A[1], LA = Math.hypot(ax, az);
      // The wall, the passage through it and the Hanging Garden's mound stand on the passage's floor, which runs from
      // the quad's floor (HANG.y0, 58.36 m) at its north mouth to the garden's ground at its south mouth (GARD.sw:
      // 58.51 m, a rise of 0.15 m in 8.9 m; the old 2.7 m climb only while THE SWITCH says the drawn ground has not
      // dropped). SH: that slope as a shear in the wall's frame (z south from the wall's garden face).
      const kS = (GARD.sw - HANG.y0) / (HANG.len + 0.55), SH = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, kS, HANG.y0 + kS * 0.55, 0, 0, 1, 0, 0, 0, 0, 1);
      for (const [F, Lw, hole] of [[frame(A[0], 0, A[1], ax, az), LA, true], [frame(Bp[0], 0, Bp[1], Cp[0] - Bp[0], Cp[1] - Bp[1]), Math.hypot(Cp[0] - Bp[0], Cp[1] - Bp[1]), false]]) {
        const ops = hole ? [{ pts: SWTUN ? tudorPts(HANG.cx, HANG.w, 0, HANG.ys, HANG.rise) : tudorPts(3.0, 1.7, 0, 1.9, 0.4), kind: 'void', d: 0.55, notch: true }] : [];
        const FS = F.clone().multiply(SH);
        wall(B, FS, outline(0, Lw, 0, 2.7, ops.map((o) => o.pts)), ops, 'rubble');
        B.push(FS); B.push(new THREE.Matrix4().makeTranslation(0, 0, -0.55)); B.face('rubble', outline(0, Lw, 0, 2.7, ops.map((o) => o.pts)), [], 0, true); B.pop();
        B.box('rubble', Lw / 2, 2.78, -0.27, Lw + 0.1, 0.16, 0.7); B.pop();
      }
      const hwA = SWTUN ? HANG.w / 2 : 0.85, a1 = (3.0 - hwA) / LA, a2 = (3.0 + hwA) / LA;
      pl([[A[0], A[1]], [A[0] + ax * a1, A[1] + az * a1]], 'wall'); pl([[A[0] + ax * a2, A[1] + az * a2], Bp, Cp], 'wall');
      // ---- the Hanging Garden and the tunnel under it (see SWTUN at the top). The mound stands against the wall's
      // garden face and the Cottages' west gable: rubble retaining walls, a lawn on top behind a low parapet; the
      // passage runs straight through from the archway: rubble sides and a four-centred rubble vault 2.3 m to the
      // crown, flags underfoot, a dressed-stone arch at each end, a lantern by the quad mouth.
      // GUESSES: the mound's width (the gap between the mapped Cottages and the mapped garden wall), the vault's
      // section, the dressings. Its length and height are the height survey's (RIM). The steps up to the lawn are the
      // gardens builder's, at the west end of the long walk.
      if (SWTUN) {
        const H = HANG, F = frame(A[0], 0, A[1], ax, az).multiply(SH), ex = ax / LA, ez = az / LA;
        const f2l = (x, z) => [A[0] + ex * x - ez * z, A[1] + ez * x + ex * z];
        const arch = tudorPts(H.cx, H.w, 0, H.ys, H.rise);
        B.push(F);
        B.reveal('rubble', arch, 0, H.len, true);                                                  // sides + vault
        B.poly('pavingSolid', [[H.cx - H.w / 2, 0.05, -0.6], [H.cx + H.w / 2, 0.05, -0.6], [H.cx + H.w / 2, 0.05, H.len + 0.5], [H.cx - H.w / 2, 0.05, H.len + 0.5]], [0, 1, 0]);
        B.push(new THREE.Matrix4().makeTranslation(0, 0, H.len)); B.face('rubble', outline(H.x0, H.x1, 0, H.h, [arch]), []); B.pop();   // south (garden) face
        for (const [xa, xb] of [[H.x0, H.cx - H.w / 2], [H.cx + H.w / 2, H.x1]]) B.poly('rubble', [[xa, -0.5, H.len], [xb, -0.5, H.len], [xb, 0, H.len], [xa, 0, H.len]], [0, 0, 1]);      // (its foot, 0.5 m into the border's ground)
        // THE PORTAL (05/tunnel passage four-centred arch to gardens, 2022): an ashlar block standing 0.22 m proud of
        // the rubble and higher than the wall, the arch through it under a square label, a coping. G: its height and
        // width; the quatrefoils of its spandrels are not carved.
        {
          const PW = 0.75, PH = 3.3, PD = 0.22, xa = H.cx - H.w / 2 - PW, xb = H.cx + H.w / 2 + PW, ly = H.ys + H.rise + 0.22;
          B.push(new THREE.Matrix4().makeTranslation(0, 0, H.len)); B.face('stone', outline(xa, xb, 0, PH, [arch]), [], PD); B.pop();
          B.reveal('stone', arch, H.len, H.len + PD, true);
          for (const [x, sx] of [[xa, -1], [xb, 1]]) { B.poly('stone', [[x, -0.5, H.len], [x, -0.5, H.len + PD], [x, PH, H.len + PD], [x, PH, H.len]], [sx, 0, 0]); B.poly('stone', [[x, -0.5, H.len + PD], [x - sx * PW, -0.5, H.len + PD], [x - sx * PW, 0, H.len + PD], [x, 0, H.len + PD]], [0, 0, 1]); }
          B.boxXZ('stoneDress', xa - 0.08, xb + 0.08, PH, PH + 0.16, H.len - 0.3, H.len + PD + 0.08);
          B.boxXZ('stoneDress', H.cx - H.w / 2 - 0.32, H.cx + H.w / 2 + 0.32, ly, ly + 0.1, H.len + PD, H.len + PD + 0.06);
          for (const sx of [-1, 1]) B.boxXZ('stoneDress', H.cx + sx * (H.w / 2 + 0.27) - 0.05, H.cx + sx * (H.w / 2 + 0.27) + 0.05, H.ys - 0.3, ly, H.len + PD, H.len + PD + 0.06);
        }
        B.poly('rubble', [[H.x0, 0, 0], [H.x0, 0, H.len], [H.x0, H.h, H.len], [H.x0, H.h, 0]], [-1, 0, 0]);                              // west face
        B.poly('grass', [[H.x0, H.h, 0], [H.x1, H.h, 0], [H.x1, H.h, H.len], [H.x0, H.h, H.len]], [0, 1, 0]);                            // the lawn on top
        B.boxXZ('rubble', H.x0 - 0.05, H.x1, H.h, H.h + 0.45, H.len - 0.32, H.len + 0.05); B.boxXZ('rubble', H.x0 - 0.05, H.x0 + 0.32, H.h, H.h + 0.45, 0, H.len - 0.32);   // parapet
        B.boxXZ('stoneDress', H.x0 - 0.1, H.x1, H.h + 0.45, H.h + 0.53, H.len - 0.37, H.len + 0.1); B.boxXZ('stoneDress', H.x0 - 0.1, H.x0 + 0.37, H.h + 0.45, H.h + 0.53, 0, H.len - 0.37);
        // dressed-stone surrounds: jambs and a chamfered arch ring standing proud of the rubble, both mouths
        const ring = tudorPts(H.cx, H.w + 0.3, 0, H.ys, H.rise + 0.15);
        for (const [zf, sg] of [[H.len + 0.22, 1], [-0.55, -1]]) {      // (the garden one on the portal's face)
          const z = zf + sg * 0.045;
          for (let i = 2; i < ring.length - 1; i++) { const p = ring[i], q = ring[i + 1]; B.beam('stoneDress', [p[0], p[1], z], [q[0], q[1], z], 0.17, 0.09); }
          for (const sx of [-1, 1]) B.box('stoneDress', H.cx + sx * (H.w / 2 + 0.15), H.ys / 2, z, 0.17, H.ys, 0.09, 0, { top: false });
        }
        B.pop();
        { const q = f2l(H.cx + 1.55, -0.55); lantern(B, q[0], H.y0 + 1.95, q[1], ez, -ex, 0.34); }
        // on the garden's ground (BG): the gravel spur from the portal to the garden path, and the two stone urns on
        // pedestals at its foot (05/cottages west end, hanging garden wall, terrace beyond, 2011; where exactly: G)
        BG.flat('gravel', [f2l(H.cx - 1.0, H.len + 0.22), f2l(H.cx + 1.0, H.len + 0.22), f2l(H.cx + 1.1, H.len + 2.45), f2l(H.cx - 1.1, H.len + 2.45)], 0.062);      // (1.7 cm over the mapped path where they meet: 5 mm flickered at a distance)
        for (const sx of [-1, 1]) {
          const [uu, vv] = f2l(H.cx + sx * 1.55, H.len + 2.1);
          BG.box('stone', uu, 0.36, vv, 0.46, 0.72, 0.46, 0, { top: false }); BG.box('stoneDress', uu, 0.75, vv, 0.56, 0.06, 0.56);
          BG.cyl('stone', uu, 0.78, vv, 0.1, 0.14, 8, false); BG.cyl('stone', uu, 0.92, vv, 0.3, 0.34, 8, false, 0.13); BG.cyl('stone', uu, 1.26, vv, 0.32, 0.05, 8, true);
          col.addCircle && col.addCircle(...L2W(uu, vv), 0.36, { tag: 'furniture' });
        }
        // ... and the Long Border at the mound's foot, either side of the portal (the gardens builder's runs on west from here)
        for (const [xa, xb] of [[H.x0 + 0.1, H.cx - H.w / 2 - 0.8], [H.cx + H.w / 2 + 0.8, H.x1]]) {
          BG.flat('flowerbed', [f2l(xa, H.len + 0.02), f2l(xb, H.len + 0.02), f2l(xb, H.len + 2.3), f2l(xa, H.len + 2.3)], 0.05);
          for (let x = xa + 0.8, k = 0; x < xb - 0.4; x += 2.4, k++) { const q = f2l(x, H.len + 0.85); plant(BG, q[0], q[1], 0.04, 0.6, 1.2 + hash(k, x) * 0.8, LEAVES[k % 3], FLOWERS[(k * 3 + 2) % 8], x); }
        }
        pl([f2l(H.x0, 0), f2l(H.x0, H.len), f2l(H.cx - H.w / 2, H.len), f2l(H.cx - H.w / 2, -0.55)]);
        pl([f2l(H.cx + H.w / 2, -0.55), f2l(H.cx + H.w / 2, H.len), f2l(H.x1, H.len), f2l(H.x1, 0)]);
        HANG.poly = [f2l(H.x0, 0), f2l(H.x1, 0), f2l(H.x1, H.len), f2l(H.x0, H.len)].map(([u, v]) => L2W(u, v));
        HANG.mouthN = L2W(...f2l(H.cx, -1.6)); HANG.mouthS = L2W(...f2l(H.cx, H.len + 1.2)); HANG.mid = L2W(...f2l(H.cx, H.len / 2));
        HANG.faceN = L2W(...f2l(H.cx, -0.55)); HANG.faceS = L2W(...f2l(H.cx, H.len));
        // nothing planted in the mouth: the garden shows from inside ("your first glimpse of the gardens")
        HANG.clear = [f2l(H.cx - 3.2, H.len), f2l(H.cx + 3.2, H.len), f2l(H.cx + 3.2, H.len + 4.5), f2l(H.cx - 3.2, H.len + 4.5)].map(([u, v]) => L2W(u, v));
      }
    }

    // ================================================================= THE COTTAGES (15th-c. camerae, south side)
    {
      const ux = (COT.w[0] - COT.e[0]), vz = (COT.w[1] - COT.e[1]), Lc = Math.hypot(ux, vz);
      const CF = frame(COT.e[0], 0, COT.e[1], ux, vz);      // x: east->west along the front, z: + north (outward)
      const D = COT.depth, sT = (COT.e[0] - (TUN.u0 + TUN.u1) / 2) / (ux / -Lc) * -1;
      const tunS = [(COT.e[0] - TUN.u1), (COT.e[0] - TUN.u0)];       // x range of the tunnel in CF (approx, small angle)
      void sT;
      const units = COT_UNITS;
      const pitch = 0.82, rise = (D / 2) * Math.tan(pitch);
      B.push(QF);      // (the range stands on the quad's floor and falls west with it: 2026-11-22)
      B.push(CF);
      units.forEach(([x0, x1, e], i) => {
        const doorX = cotDoorX(i);
        // front (north) face
        const ops = [];
        const dpts = tudorPts(doorX, 0.95, 0, 1.75, 0.35);
        ops.push({ pts: dpts, kind: 'door', d: 0.32, doorKey: 'oak', plank: true, notch: true });
        if (i === 1) ops.push({ pts: tudorPts((tunS[0] + tunS[1]) / 2, TUNP[0], 0, TUNP[1], TUNP[2]), kind: 'none', notch: true });
        const wins = i === 1 ? [x0 + 5.4] : [x0 + 1.4, x0 + 5.8];
        for (const wx of wins) if (Math.abs(wx - doorX) > 1.2 && (wx < tunS[0] - 1 || wx > tunS[1] + 1)) ops.push({ pts: rectPts(wx - 0.55, 1.0, wx + 0.55, 2.0), kind: 'win', mullion: 2, d: 0.25, seed: i * 10 + wx, sill: false });
        for (const wx of [x0 + 1.9, x1 - 1.9]) if (Math.abs(wx - doorX) > 1.4) ops.push({ pts: rectPts(wx - 0.75, 2.75, wx + 0.75, 3.65), kind: 'win', mullion: 3, d: 0.25, seed: i * 20 + wx, sill: false });
        const opsL = ops.map((o) => ({ ...o, pts: o.pts.map(([x, y]) => [x - x0, y]) }));
        const notches = opsL.filter((o) => o.notch).map((o) => o.pts);
        wall(B, frame(x0, 0, 0, 1, 0), outline(0, x1 - x0, 0, e, notches), opsL, 'rubbleN');
        // label moulds over door + windows, shield above the door
        B.box('rubble', doorX, 2.25, 0.08, 1.35, 0.12, 0.16); B.box('rubble', doorX - 0.62, 2.05, 0.08, 0.12, 0.4, 0.16); B.box('rubble', doorX + 0.62, 2.05, 0.08, 0.12, 0.4, 0.16);
        B.sign('signs', doorX - 0.25, 2.4, doorX + 0.25, 2.95, 0.03, atlas.uv('shield' + (i % 6)));
        for (const o of ops) if (o.kind === 'win') { const xs = o.pts.map((p) => p[0]); const ys = o.pts.map((p) => p[1]); B.box('rubble', (Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...ys) + 0.12, 0.07, Math.max(...xs) - Math.min(...xs) + 0.3, 0.12, 0.14); }
        // back (south, garden) face where it is not covered by Staircase 13. 2026-11-23: the garden at its foot is
        // drawn at its true level (58.7 - 59.2 m, within 0.15 m of the quad's floor on the other side: the range's
        // base was right all along, it was the ground that stood 2.3 m up it), so both storeys show: white sashes on
        // the ground and first floors (the photographs from the Nuffield Lawn; how many and where: G); the wall's
        // foot goes 0.6 m into the ground
        if (i === 1) wall(B, frame(x1, 0, -D, -1, 0), outline(0, x1 - 15.0, -0.6, e), [], 'rubble');      // (the metre of unit 1's back that Staircase 13's wing leaves bare)
        if (x0 >= 15.0) {
          const bops = [];
          for (const wx of [x0 + 2.0, x1 - 2.0]) { bops.push({ pts: rectPts(wx - 0.5, 0.75, wx + 0.5, 2.45), kind: 'win', seed: i * 31 + wx }, { pts: rectPts(wx - 0.5, 2.9, wx + 0.5, 3.95), kind: 'win', rows: 2, seed: i * 37 + wx }); }
          wall(B, frame(x1, 0, -D, -1, 0), outline(0, x1 - x0, -0.6, e), bops.map((o) => ({ ...o, pts: o.pts.map(([x, y]) => [x1 - x, y]) })), 'rubble');
          // gabled dormer on the south slope (BHO: "S front has gabled dormers")
          const dx = (x0 + x1) / 2, dz = -D + 1.2, dy = e + 0.2;
          B.boxXZ('rubble', dx - 0.8, dx + 0.8, dy - 0.4, dy + 1.3, dz - 1.6, dz);
          B.push(frame(dx + 0.8, 0, dz - 1.6, -1, 0)); B.unit('leaded', rectPts(0.35, dy, 1.25, dy + 0.95), 0.012, nextBay(dy)); B.pop();
          B.poly('stoneSlate', [[dx - 1.0, dy + 1.25, dz - 1.75], [dx, dy + 2.0, dz - 1.75], [dx, dy + 2.0, dz + 0.2], [dx - 1.0, dy + 1.25, dz + 0.2]], [-1, 1, 0]);
          B.poly('stoneSlate', [[dx + 1.0, dy + 1.25, dz - 1.75], [dx + 1.0, dy + 1.25, dz + 0.2], [dx, dy + 2.0, dz + 0.2], [dx, dy + 2.0, dz - 1.75]], [1, 1, 0]);
          B.poly('rubble', [[dx + 0.8, dy + 1.3, dz - 1.6], [dx - 0.8, dy + 1.3, dz - 1.6], [dx, dy + 1.95, dz - 1.6]], [0, 0, -1]);
        }
        // roof + gable ends (end walls drawn full so height steps between units close up)
        gableRoof(B, i === 0 ? 'clayTile' : 'stoneSlate', 'rubble', x0, x1, -D, 0, e, rise, 0.22, true);      // (the east building, to Pump Quad: red-brown clay tiles — the owner's photograph, the satellite view)
        if (i === 0) {      // ... and its white dormer on the south slope, by the gable
          const dx = 1.9, dy = e + 0.35, dz = -D + 1.5;
          B.boxXZ('white', dx - 0.75, dx + 0.75, dy - 0.3, dy + 1.25, dz - 1.5, dz);
          B.push(frame(dx + 0.75, 0, dz - 1.5, -1, 0)); B.unit('sashAttic', rectPts(0.2, dy, 1.3, dy + 1.0), 0.012, nextBay(dy)); B.pop();
          B.poly('clayTile', [[dx - 0.95, dy + 1.2, dz - 1.65], [dx, dy + 1.85, dz - 1.65], [dx, dy + 1.85, dz + 0.3], [dx - 0.95, dy + 1.2, dz + 0.3]], [-1, 1, 0]);
          B.poly('clayTile', [[dx + 0.95, dy + 1.2, dz - 1.65], [dx + 0.95, dy + 1.2, dz + 0.3], [dx, dy + 1.85, dz + 0.3], [dx, dy + 1.85, dz - 1.65]], [1, 1, 0]);
          B.poly('white', [[dx + 0.75, dy + 1.25, dz - 1.5], [dx - 0.75, dy + 1.25, dz - 1.5], [dx, dy + 1.8, dz - 1.5]], [0, 0, -1]);
        }
        wall(B, frame(x0, 0, -D, 0, 1), outline(0, D, 0, e), [], 'rubble');        // party/east wall (faces east)
        wall(B, frame(x1, 0, 0, 0, -1), outline(0, D, 0, e), [], 'rubble');        // west wall (faces west)
        // chimney stack at the party wall
        // chimney stack at the party wall (stone pass: slimmer and lower, they were far too big and regular)
        if (i > 0) { const h = Math.max(e, units[i - 1][2]) + rise + 0.75 + 0.25 * (i % 2); B.boxXZ('rubble', x0 - 0.36, x0 + 0.36, e, h, -D / 2 - 0.5, -D / 2 + 0.5); B.boxXZ('rubble', x0 - 0.44, x0 + 0.44, h, h + 0.12, -D / 2 - 0.58, -D / 2 + 0.58); for (const z of [-0.22, 0.22]) B.cyl('terracotta', x0, h + 0.12, -D / 2 + z, 0.11, 0.38, 6, true); }
        // three small gabled dormers on the quad slope of the middle units (photographs: worc_cottages)
        if (i >= 2 && i <= 4) {
          const dx = (x0 + x1) / 2 + (i === 3 ? 1.2 : 0), dy = e + 0.15, dz = 1.2;
          B.boxXZ('rubble', dx - 0.65, dx + 0.65, dy - 0.4, dy + 1.1, -1.4, dz - 1.2 + 0.25);
          B.push(frame(dx - 0.65, 0, 0.25, 1, 0)); B.unit('leaded', rectPts(0.3, dy, 1.0, dy + 0.8), 0.012, nextBay(dy)); B.pop();
          B.poly('stoneSlate', [[dx - 0.85, dy + 1.05, 0.4], [dx, dy + 1.7, 0.4], [dx, dy + 1.7, -1.55], [dx - 0.85, dy + 1.05, -1.55]], [-1, 1, 0]);
          B.poly('stoneSlate', [[dx + 0.85, dy + 1.05, 0.4], [dx + 0.85, dy + 1.05, -1.55], [dx, dy + 1.7, -1.55], [dx, dy + 1.7, 0.4]], [1, 1, 0]);
          B.poly('rubble', [[dx - 0.65, dy + 1.1, 0.25], [dx + 0.65, dy + 1.1, 0.25], [dx, dy + 1.65, 0.25]], [0, 0, 1]);
        }
      });
      // east end (buttery) projecting stack, west end: the old kitchen's great chimney (BHO)
      B.boxXZ('rubble', Lc - 1.1, Lc + 0.3, 0, units[5][2] + rise + 1.1, -D / 2 - 0.9, -D / 2 + 0.9);
      B.boxXZ('rubble', Lc - 1.2, Lc + 0.4, units[5][2] + rise + 1.1, units[5][2] + rise + 1.25, -D / 2 - 1.0, -D / 2 + 1.0);
      // lead downpipes
      for (const x of [7.2, 22.0, 37.2]) B.box('iron', x + 0.15, 2.2, 0.08, 0.1, 4.4, 0.1);
      // the east gable to Pump Quad: a tall ASHLAR stack up its face (the owner's photograph; the college's from above)
      { const e0 = units[0][2], ht = e0 + rise + 2.3; B.boxXZ('stone', -0.42, 0.02, 0, ht, -D / 2 - 0.6, -D / 2 + 0.6); B.boxXZ('stoneDress', -0.5, 0.1, ht, ht + 0.14, -D / 2 - 0.68, -D / 2 + 0.68); for (const z of [-0.24, 0.24]) B.cyl('terracotta', -0.2, ht + 0.14, -D / 2 + z, 0.12, 0.5, 6, true); B.boxXZ('stone', -0.55, 0, 0, 2.6, -D / 2 - 0.75, -D / 2 + 0.75); }
      B.pop(); B.pop();
      for (const i of [0, 1, 2, 3, 4, 5]) { const u = COT.e[0] - cotDoorX(i) + 0.95; lantern(B, u, quadY(u) + 2.2, cotFront(u), 0, -1, 0.36); }      // (a lantern beside every Cottage door: survey G01; each lights its stretch of the path after dark)
      // the Long Border at the range's garden foot (BG: on the garden's drawn ground; 34/nuffield lawn - long border and
      // gravel path below the cottages): a soil bed 2.8 m deep from the mound to Staircase 13's wing, shrubs head-high
      // at the back, low mounds at the front. G: the planting (the gardens builder's painted border wants carrying
      // along here; these are the quad border's plain clumps)
      {
        const vw = (u) => cotFront(u) + D, ua = -43.5, ub = -12.6;
        BG.flat('flowerbed', [[ua, vw(ua) + 0.02], [ub, vw(ub) + 0.02], [ub, vw(ub) + 2.8], [ua, vw(ua) + 2.8]], 0.05);
        let i = 0;
        for (let u = ua + 0.9; u < ub - 0.5; u += 2.9, i++) {
          const h1 = hash(i, 21), h2 = hash(i, 23);
          plant(BG, u, vw(u) + 0.75 + h1 * 0.5, 0.04, 0.62 + h1 * 0.2, 1.3 + h2 * 0.9, LEAVES[i % 3], FLOWERS[(i * 3 + 1) % 8], i * 1.9);
          if (i % 2) plant(BG, u + 1.4, vw(u + 1.4) + 2.0, 0.04, 0.42 + h2 * 0.12, 0.4 + h1 * 0.3, LEAVES[(i + 1) % 3], FLOWERS[(i * 5 + 2) % 8], i * 2.7);
        }
      }
      // tunnel through the Cottages and Staircase 13 to the Nuffield Lawn
      const v0 = cotFront(-7.6) - 0.05;
      // The passage runs from the quad's floor at its north mouth (59.29 m) to the garden's ground at its south mouth
      // (GARD.e: 59.10 m, a fall of 0.19 m in 15 m; the old 1.9 m climb only while THE SWITCH says the drawn ground
      // has not dropped); floor, sides and vault are sheared together (TS)
      const yT = quadY(-7.6), LT = TUN.v1 - v0, TS = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, (GARD.e - yT) / LT, yT, 0, 0, 1, 0, 0, 0, 0, 1);
      if (SWTUN) {      // rubble sides and a four-centred rubble vault, 2.35 m to the crown (it was a flat plaster ceiling at 2.65 m)
        B.push(frame(TUN.u0, 0, v0, 1, 0).multiply(TS)); B.reveal('rubble', tudorPts((TUN.u1 - TUN.u0) / 2, TUNP[0], 0, TUNP[1], TUNP[2]), 0, LT, true); B.pop();
      } else {
        wall(B, frame(TUN.u0, 0, TUN.v1, 0, -1), outline(0, TUN.v1 - v0, yT, TUN.h), [], 'rubbleLit');
        wall(B, frame(TUN.u1, 0, v0, 0, 1), outline(0, TUN.v1 - v0, yT, TUN.h), [], 'rubbleLit');
        B.flat('plasterLit', [[TUN.u0, v0], [TUN.u1, v0], [TUN.u1, TUN.v1], [TUN.u0, TUN.v1]], TUN.h, [], true);
      }
      B.poly('pavingSolid', [[TUN.u0, yT + 0.05, v0 - 0.1], [TUN.u1, yT + 0.05, v0 - 0.1], [TUN.u1, GARD.e + 0.05, TUN.v1], [TUN.u0, GARD.e + 0.05, TUN.v1]], [0, 1, 0]);
      B.poly('pavingSolid', [[TUN.u0, GARD.e + 0.05, TUN.v1], [TUN.u1, GARD.e + 0.05, TUN.v1], [TUN.u1, GARD.e + 0.05, TUN.v1 + 0.3], [TUN.u0, GARD.e + 0.05, TUN.v1 + 0.3]], [0, 1, 0]);
      // Staircase 13's west wing (rubble) with the passage's garden mouth. 2026-11-23: it stands on the garden, 1.95 m
      // below the core's datum, so it shows THREE storeys to the south and west (eaves 8.15 m above the garden; the
      // roof was right, measured from the datum: LIDAR ridge 70.4 m). South: a tall two-light window either side of
      // the mouth (the traceried one of the college's photograph along the path), sashes on the two floors above.
      // West: the gable with the old kitchen's stepped chimney breast up its middle and an ashlar stack (the 2011
      // photograph from the lawn), a sash or two beside it. G: every window's place and size.
      {
        const u0 = -12.3, u1 = -1.3, vN = 28.75, vS = 35.5, e = 6.2;
        const gW = WORC_LEVELS.yOf(RIM.notch), eg = e - gW, dM = GARD.e - gW;      // the garden at its foot; the eaves above it; the mouth's floor above it (0 unless the passage still climbs)
        const mouth = tudorPts(TUN.u0 - u0 + 1.1, TUNP[0], 0, dM + TUNP[1], TUNP[2]), sx = TUN.u0 - u0 + 1.1;
        wall(B, frame(u0, gW, vS, 1, 0), outline(0, u1 - u0, 0, eg, [mouth]), [
          { pts: mouth, kind: 'none', notch: true },
          { pts: rectPts(0.9, 0.9, 2.4, 2.9), kind: 'win', mullion: 2, sill: false }, { pts: rectPts(7.5, 0.9, 9.0, 2.9), kind: 'win', mullion: 2, sill: false },
          ...[1.65, ...(dM < 1 ? [sx] : []) /* (the one over the mouth only when the passage is level: the climbing passage's arch reaches up into its place) */, 8.25].map((s) => ({ pts: rectPts(s - 0.55, 4.0, s + 0.55, 5.7), kind: 'win' })), ...[1.65, 8.25].map((s) => ({ pts: rectPts(s - 0.5, 6.55, s + 0.5, 7.6), kind: 'win', rows: 2 }))], 'rubble');
        B.poly('rubble', [[u0, gW - 0.5, vS], [u1, gW - 0.5, vS], [u1, gW, vS], [u0, gW, vS]], [0, 0, 1]);      // (its foot, 0.5 m into the ground)
        wall(B, frame(u0, gW, vN, 0, 1), outline(0, vS - vN, -0.5, eg), [
          { pts: rectPts(0.7, 4.0, 1.8, 5.5), kind: 'win' }, { pts: rectPts(0.75, 6.5, 1.75, 7.5), kind: 'win', rows: 2 },
          { pts: rectPts(5.0, 6.5, 6.0, 7.5), kind: 'win', rows: 2 }, { pts: rectPts(5.0, 1.0, 5.9, 2.0), kind: 'win', rows: 2 }], 'rubble');
        { const vm = (vN + vS) / 2;      // the chimney breast: two stages of rubble, the ashlar stack above the ridge
          B.boxXZ('rubble', u0 - 0.45, u0, gW - 0.5, gW + 5.2, vm - 0.95, vm + 0.95); B.boxXZ('rubble', u0 - 0.28, u0, gW + 5.2, e + 2.5, vm - 0.65, vm + 0.65);
          B.boxXZ('stone', u0 - 0.28, u0 + 0.62, e + 2.5, e + 4.3, vm - 0.5, vm + 0.5); B.boxXZ('stoneDress', u0 - 0.36, u0 + 0.7, e + 4.3, e + 4.44, vm - 0.58, vm + 0.58); }
        gableRoof(B, 'stoneSlate', 'rubble', u0, u1, vN, vS, e, 2.8, 0.22, true);
        pl([[TUN.u0, TUN.v1], [u0, vS], [u0, vN]]); pl([[TUN.u1, TUN.v1], [u1, 36.2]]);
        // main part of Staircase 13 (Pump Quad side) in the city style
        // (it stands on Pump Quad's court, 1.25 m below the datum: minH)
        if (!PUMPR_ON) world.makeBuilding({ poly: [[-1.3, 29.6], [1.4, 29.9], [6.4, 30.4], [5.6, 46.0], [-2.1, 45.2], [-1.3, 36.2]].map(([u, v]) => L2W(u, v)), h: 10.9 + PQY, minH: PQY, style: { wall: 'stone', roof: 'slate', color: '#e6d3ae' }, roof: 'hipped', id: 'worc-st13' });
        const st13 = [[-1.3, 29.6], [1.4, 29.9], [6.4, 30.4], [5.6, 46.0], [-2.1, 45.2], [-1.3, 36.2]];
        if (!PUMPR_ON) pl([...st13, st13[0]]);      // (hand-built: worcester_pumpranges.js has its own ring)
      }
      // cottages colliders (front with tunnel gap + door recesses are shallow, so solid)
      pl([[COT.w[0], COT.w[1]], [TUN.u0, cotFront(TUN.u0)], [TUN.u0, TUN.v1]]);
      pl([[TUN.u1, TUN.v1], [TUN.u1, cotFront(TUN.u1)], [COT.e[0], COT.e[1]], [COT.e[0], 29.6]]);
      pl([[COT.w[0], COT.w[1]], [-44.1, 28.7], [-12.3, 28.8]]);
    }

    // ================================================================= PUMP QUAD
    // (THE OWNER, 2026-11-22: "you should ensure the pump quad is accessible directly from the path in the main quad.
    //  also the floor on the pump quad is gravel not tile"; "please change the staircase into the bar, it should start
    //  from near the corner of the pump quad (closest to the main street) and it should have a canopy atop it".)
    // The court itself — gravel, the annex along the Hall, the glazed canopy, the Cellar Bar's way down as the college's
    // fire plan has it, the slated lean-to, the wine cellar's stair under the loggia's south arch — is built by
    // places/_worcester_pump.js. Below the court everything is real dug geometry: no depth sheet, no render order.
    const PUMPQ = buildPumpQuad({ B, atlas, wall, outline, railRun, seg, pl, boxC, plant, lantern, tub: (Bt, u, v, y) => tub(Bt, u, v, y), col, L2W, floorY, GAP, cotFront, cotSouth: COT.e[1] + COT.depth });
    {
      const PQT = new THREE.Matrix4().makeTranslation(0, PQY, 0);      // y = 0 is the court
      B.push(PQT);
      // staircase numbers + doorways on the Pump Quad buildings (13-16)
      const numDoor = (u, v, dir, num) => {
        const F = frame(u, 0, v, dir[0], dir[1]);
        B.push(F);
        B.unit('doorDark', rectPts(-0.55, 0, 0.55, 2.3), 0.04);
        B.boxXZ('stone', -0.75, 0.75, 2.3, 2.5, -0.02, 0.1); B.boxXZ('stone', -0.75, -0.55, 0, 2.3, -0.02, 0.08); B.boxXZ('stone', 0.55, 0.75, 0, 2.3, -0.02, 0.08);
        B.sign('signs', 0.85, 1.6, 1.25, 2.0, 0.03, atlas.uv('num' + num));
        B.pop();
      };
      if (!PUMPR_ON) { numDoor(4.6, 30.2, [-0.995, -0.1], '13'); numDoor(10.0, 30.69, [-0.996, -0.087], '14'); numDoor(16.2, 31.27, [-0.995, -0.1], '15'); numDoor(PUMP.ue - 0.04, 26.4, [0, 1], '16'); }      // (hand-built ranges: real doorways where the 1939 plan has them, each with its plate — _worcester_pumpranges_plan.js STAIR_DOORS)
      // the pigeonhole room door (WORC.pidgeDoor; interior in _worcint_pidge.js): Staircase 15's front, west of its
      // staircase door (the staircase number sign sits between them), painted door in a plain stone surround, a step,
      // a "Pigeonholes" plate over the lintel
      if (!PUMPR_ON) {      // (hand-built ranges: the doorway, its step and its plate are cut in the front itself)
        const [pu, pv] = WORC.pidgeDoor.uv, [pa, pb] = WORC.pidgeDoor.along;
        B.push(frame(pu, 0, pv, pa, pb));
        // the door takes the place of one of the range's ground-floor sash windows: an ashlar panel blocks the window up
        // (drawn proud of the wall face so the generated sash, sill and head are covered), the doorway is set in it
        // (walk-in second pass: the bay's painted sash is blanked in the generic facade itself — world/walkin_bays.js —
        //  so the 15 cm ashlar slab that used to cover it is gone: the door-case stands on the range's own wall)
        B.unit('doorDark', rectPts(-0.5, 0, 0.5, 2.2), 0.02);
        B.boxXZ('stone', -0.66, 0.66, 2.2, 2.4, 0, 0.12); B.boxXZ('stone', -0.66, -0.5, 0, 2.2, 0, 0.1); B.boxXZ('stone', 0.5, 0.66, 0, 2.2, 0, 0.1);
        B.boxXZ('stoneDress', -0.72, 0.72, 2.4, 2.46, 0, 0.15);
        B.boxXZ('stoneDress', -0.62, 0.62, 0, 0.09, 0, 0.35);   // doorstep
        // (the painted door is what is seen from across the quad; near to, the room is drawn in place and its real door —
        //  with its handle — shows through the doorway: core/interiors.js)
        // the room's window (4 m east of the door, beyond Staircase 15's own door): an ashlar panel over the bay, a sill;
        // the opening and its sash are the room's
        // (second pass: the room's window IS the range's own painted sash east of Staircase 15's door — same glass
        //  rectangle, _worcint_pidge.js PR.win — so nothing is drawn over that bay here any more)
        B.sign('signs', -0.46, 2.62, 0.46, 3.0, 0.025, atlas.uv('pidgeSign'));
        B.pop();
      }
      B.pop();      // (PQT)
    }

    // ================================================================= THE BLOCKED GATEWAY IN THE WALTON STREET WALL
    // (photographs: worc_walton_arch, "gateway on Walton Street (15th cent.)"): a pointed arch of several chamfered
    // orders under a hood mould, the opening walled up round a small pointed door (painted grey), three shields above,
    // all in a high wall of weathered grey rubble. Where along the wall, its height and the arch's size are guesses from
    // the one photograph; the shields are left plain (no arms). A taller section of the wall (the mapped 2.6 m wall
    // w999276231 runs inside it), on the street face just north of Staircase 1.
    {
      // (its street face 0.5 m proud of the mapped wall's, so the recessed orders stay in front of that wall)
      const F = frame(27.55, 0, -27.0, 0, -1), L = 8.6, H = 4.9, cx = L / 2, D = 1.2;   // x north along the wall, z out to the street
      const outer = tudorPts(cx, 3.3, 0, 2.35, 1.05), o2 = tudorPts(cx, 2.7, 0, 2.2, 0.9), o3 = tudorPts(cx, 2.15, 0, 2.05, 0.75), door = tudorPts(cx, 1.2, 0, 1.75, 0.42);
      // a ring between two pointed openings that stand on the ground: the outer one's outline with the inner notched
      const ring = (a, b) => outline(a[0][0], a[1][0], 0, a.slice(2), [b]);
      wall(B, F, outline(0, L, 0, H, [outer]), [{ pts: outer, kind: 'none', notch: true }], 'rubbleDk');
      B.push(F);
      // the chamfered orders stepping in (dressed stone), then the walling-up with the small door
      B.reveal('greyStone', outer, 0, -0.14, true); B.face('greyStone', ring(outer, o2), [], -0.14);
      B.reveal('greyStone', o2, -0.14, -0.26, true); B.face('greyStone', ring(o2, o3), [], -0.26);
      B.reveal('greyStone', o3, -0.26, -0.36, true); B.face('rubbleDk', ring(o3, door), [], -0.36);
      B.reveal('greyStone', door, -0.36, -0.42, true); B.face('doorGrey', door, [], -0.42);
      // hood mould over the arch, with label stops
      const hood = tudorPts(cx, 3.75, 0, 2.35, 1.2).filter((p) => p[1] > 2.3);
      for (let i = 0; i < hood.length - 1; i++) B.beam('greyStone', [hood[i][0], hood[i][1], 0.07], [hood[i + 1][0], hood[i + 1][1], 0.07], 0.085);
      for (const sx of [cx - 1.875, cx + 1.875]) B.box('greyStone', sx, 2.25, 0.07, 0.24, 0.24, 0.16);
      // three plain shields, the middle one larger (left blank: no arms)
      for (const [sx, sy, sw] of [[cx - 2.6, 4.05, 0.5], [cx, 4.15, 0.62], [cx + 2.6, 4.05, 0.5]]) {
        const sh = [[sx - sw / 2, sy + sw * 0.55], [sx - sw / 2, sy - sw * 0.05], [sx - sw * 0.3, sy - sw * 0.4], [sx, sy - sw * 0.6], [sx + sw * 0.3, sy - sw * 0.4], [sx + sw / 2, sy - sw * 0.05], [sx + sw / 2, sy + sw * 0.55]];
        B.face('greyStone', sh, [], 0.04);
      }
      // top, back and ends of the taller section
      B.box('rubbleDk', L / 2, H + 0.07, -D / 2, L + 0.06, 0.14, D + 0.06);
      B.face('rubbleDk', outline(0, L, 0, H), [], -D, true);
      B.poly('rubbleDk', [[0, 0, -D], [0, 0, 0], [0, H, 0], [0, H, -D]], [-1, 0, 0]);
      B.poly('rubbleDk', [[L, 0, 0], [L, 0, -D], [L, H, -D], [L, H, 0]], [1, 0, 0]);
      B.pop();
      pl([[27.55, -27.0], [27.55, -27.0 - L], [27.55 - D, -27.0 - L], [27.55 - D, -27.0], [27.55, -27.0]], 'wall');
    }

    // "Gate 2" on the shut gate at Provost's Lane (the gate itself: _worcester_street.js), on its north leaf, to the street
    { const G = LANE_GATE, gx = G.piers[0][0] + 0.07, zm = (G.piers[0][1] + G.piers[1][1]) / 2, q = (z, y) => { const l = W2L(gx, z); return [l[0], y, l[1]]; };
      B.card('signs', q(zm - 0.57, 1.55), q(zm - 1.47, 1.55), q(zm - 1.47, 1.95), q(zm - 0.57, 1.95), atlas.uv('gate2')); }      // (read from the street: left to right is south to north)
    // ================================================================= build college meshes
    // (the rim, 2026-11-23: the walls that face the gardens are shaded from the gardens' ground — `baseGround`)
    const gardenSide = (u, v) => u < -52.3 || (v > 35.4 && u < -1.2) || (u < -12.3 && v > cotFront(Math.max(u, -43.7)) + COT.depth - 0.1) || (u < -43.7 && v > 28.2);
    const baseGround = (u, v) => { const g = localGround(u, v); return g !== null ? g : u > -62 && u < -1.2 && v > -17 && v < 48 && gardenSide(u, v) ? WORC_LEVELS.yOf(rimLevel(u, v)) : null; };
    const meshes = B.build(M, groupC, { pack, noCast: new Set(['signs']), chunk: (u, v) => (u < -26 ? 0 : 1) + (v < 2 ? 0 : 2), base: baseGround });      // (base: walls of the sunk quad and courts are shaded from their own ground, not from y = 0)
    // THE CORE STANDS RIGID AT ITS DATUM ON THE DRAWN GROUND (world/terrain.js lifts every vertex by the field under
    // it). Inside `WORC_LEVELS.flat` the field is the datum, 61.05 mOD, EXCEPT where a later precinct overrides it: the
    // yard north of the Terrace is level at 58.25 right up to the Terrace's north face "and for 2.8 m in under it" (the
    // terrain's own words), so the north few metres of the range would be drawn 2.8 m low and the range sheared. Every
    // vertex of the core inside the polygon is therefore built higher by what the field under it falls short of the
    // datum (nothing, almost everywhere), and walking heights likewise (`coreLift` below). Geometry so corrected is
    // marked draped: the world's draping pass must not cut its floors along its lattice and hang them on the field.
    const TERR0 = 58.0, coreIn = (u, v) => u > -53 && u < 29 && v > -30 && (v < 36.5 || (u > -2.5 && (v < 40 || (u < 14 && v < 54))));      // (WORC_LEVELS.flat, in local u, v)
    const coreLift = (x, z, uv) => { if (typeof world.terrainHeight !== 'function') return 0; const q = uv || W2L(x, z); if (!coreIn(q[0], q[1])) return 0; const h = world.terrainHeight(x, z); if (!Number.isFinite(h)) return 0; const d = h - (WORC_LEVELS.datumOD - TERR0); return Math.abs(d) < 1e-3 ? 0 : d; };      // (under a millimetre is the field's float residue on the datum, not a step: exactly 0, so the core's walking heights are the plan's own numbers)
    // (the rim, 2026-11-23: where the field steps under the core's edge — a garden precinct reaches 2.8 m in — a wall,
    //  roof or floor across the step is first cut along the field's own lattice, _worcester_rim.js cutToField: the
    //  correction below is exact at vertices only, and a passage's floor would be drawn as a bank between two of them)
    // (not when the terrain can hold a whole object at one height — world.terrainLevelObject: then nothing is corrected
    //  vertex by vertex and nothing needs cutting)
    let rimCut = 0; if (typeof world.terrainLevelObject !== 'function') for (const m of meshes) { try { rimCut += cutToField(m.geometry, world, coreIn, { tol: 0.01, minEdge: 0.5 }); } catch (e) { console.warn('[worcester] rim cut', e); } }
    // what stands on the gardens' drawn ground: its own meshes, not corrected (heights above that ground)
    const gardenMeshes = BG.build(M, groupC, { pack, noCast: new Set(['signs']) }); for (const m of gardenMeshes) m.name += ':garden';
    // ONE HEIGHT FOR THE WHOLE OBJECT, when the terrain offers it (world.terrainLevelObject(object, level, foot): a
    // one-time exact bake — to every vertex it adds the level less what the shader will lift that vertex by, so each
    // triangle is drawn exactly as built whatever the field does under it: no cut, no extra triangle). Every mesh of
    // the batch but the ground mesh takes it: that one also carries the forecourt's apron out on the street, which
    // must go on following the pavement's own surface, so it keeps the vertex-by-vertex correction inside the polygon
    // (its faces do not straddle a step). The wall-shading ground (aBase) is moved by the same amount.
    const LEVEL_OBJECT = typeof world.terrainLevelObject === 'function', DATUM_LIFT = WORC_LEVELS.datumOD - TERR0;
    if (LEVEL_OBJECT && typeof world.terrainHeight === 'function') {
      groupC.updateMatrixWorld(true);
      for (const m of meshes) {
        if (m.name === 'worcester:ground') continue;
        const AB = m.geometry.attributes.aBase, P = m.geometry.attributes.position;
        if (AB) { for (let i = 0; i < P.count; i++) { const w = L2W(P.getX(i), P.getZ(i)), h = world.terrainHeight(w[0], w[1]); if (Number.isFinite(h)) AB.setX(i, AB.getX(i) - (h - DATUM_LIFT)); } AB.needsUpdate = true; }
        try { world.terrainLevelObject(m, DATUM_LIFT, 0); } catch (e) { console.warn('[worcester] terrainLevelObject', e); }
      }
    }
    if (typeof world.terrainHeight === 'function') for (const m of meshes) {
      if (LEVEL_OBJECT && m.name !== 'worcester:ground') continue;
      const P = m.geometry.attributes.position, AB = m.geometry.attributes.aBase; let moved = 0;      // (aBase: the wall's own ground for the shading, in the same heights: it moves with the vertex)
      for (let i = 0; i < P.count; i++) { const u = P.getX(i), v = P.getZ(i); if (!coreIn(u, v)) continue; const w = L2W(u, v), d = coreLift(w[0], w[1], [u, v]); if (Math.abs(d) > 1e-3) { P.setY(i, P.getY(i) - d); if (AB) AB.setX(i, AB.getX(i) - d); moved++; } }
      if (moved) { P.needsUpdate = true; if (AB) AB.needsUpdate = true; m.geometry.computeBoundingSphere(); m.geometry.computeBoundingBox(); m.geometry.userData.terrainDraped = true; }
    }
    const pitMeshes = [];      // (the Cellar Bar's stairwell was a batch of its own, drawn before a depth sheet over its mouth: it is ordinary dug geometry now)
    // graphics pass 2: contact shading on the ground at the foot of every wall, pier and plinth (darker in inside corners
    // and under the loggia/cloister), with the city's multiply-blended aoStrip material; follows the quality tier
    let aoMesh = null;
    {
      const gs = meshes.filter((m) => m.name === 'worcester:atlas').map((m) => contactStrips(m.geometry, { maxY: 0.3, ground: (u, v) => { const g = localGround(u, v); if (g === null) return g; const w = L2W(u, v); return g - coreLift(w[0], w[1], [u, v]); } })).filter(Boolean);      // (the feet of walls on the sunk quad and court too, and nothing hanging from their window sills)
      const g = gs.length > 1 ? mergeGeometries(gs, false) : gs[0];
      if (g && world.cityMats.aoStrip) {
        aoMesh = new THREE.Mesh(g, world.cityMats.aoStrip); aoMesh.name = 'worcester:contact'; aoMesh.renderOrder = 1;
        g.userData.terrainDraped = true;      // (its strips are made from wall feet that already carry the core's height correction: the draping pass must not cut them and hang the pieces on the field)
        aoMesh.castShadow = false; aoMesh.receiveShadow = false; aoMesh.matrixAutoUpdate = false; aoMesh.updateMatrix();
        groupC.add(aoMesh);
      }
    }
    groupC.updateMatrixWorld(true);
    for (const [u, v, y] of [...BLOCK.lamps, ...PUMPQ.lamps, ...TERRACE.lamps, [-7.6, cotFront(-7.6) - 0.4, quadY(-7.6) + 3.0], ...lanterns.map(([u, y, v]) => [u, v, y])]) { const [x, z] = L2W(u, v); world.addLampGlow(x, y - coreLift(x, z), z); }

    // ================================================================= ground height (raised walks, banks, stairwell)
    const prevGround = world.groundHeight.bind(world);
    world.groundHeight = (x, z) => {
      if (x > -320 && x < -215 && z > -45 && z < 50) { const q = W2L(x, z); const h = localGround(q[0], q[1]); if (h !== null) return h - coreLift(x, z, q); }      // (coreLift: 0 wherever the drawn ground under the core is its datum)
      return prevGround(x, z);
    };

    // ================================================================= the view in the two tunnels
    // The follow camera knows walls but not ceilings: walking straight through a passage it would ride 3 m up, above
    // the vault, looking down through the mound. While the player is in or at a tunnel this hook (game.cameraHook,
    // chained in front of whatever is there) lets the follow camera do its work and then holds the camera under the
    // vault: below the crown where it is inside, and low enough to see in under the arch where it is outside a mouth.
    // First-person views (the G toggle, the automatic tight-space one) are left alone.
    const TUNNELS = []; let tunnelCeil = null;
    {
      const eN = L2W(-7.6, cotFront(-7.6) - 0.05), eS = L2W(-7.6, TUN.v1);
      if (SWTUN) TUNNELS.push({ a: eN, b: eS, w: TUNP[0], ys: TUNP[1], rise: TUNP[2] });
      if (SWTUN && HANG.faceN) TUNNELS.push({ a: HANG.faceN, b: HANG.faceS, w: HANG.w, ys: HANG.ys, rise: HANG.rise });
      for (const t of TUNNELS) { t.len = Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1]); t.ex = (t.b[0] - t.a[0]) / t.len; t.ez = (t.b[1] - t.a[1]) / t.len; }
      /** the passage's floor at distance s along tunnel t (the core's heights: passageY) */
      const fl0 = (t, s) => { const q = Math.max(0.05, Math.min(t.len - 0.05, s)), [u, v] = W2L(t.a[0] + t.ex * q, t.a[1] + t.ez * q), g = passageY(u, v); return g === null ? 0 : g; };
      // (the rim, 2026-11-23: the camera is not lifted by the drawn ground, the vault is, and everything is drawn
      //  relative to the ground under the PLAYER (world/terrain.js refFor): with the player out on the garden's low
      //  ground and the camera still under the vault, the vault stands that much higher in the camera's own heights)
      const drop = (px, pz) => { if (typeof world.terrainHeight !== 'function' || (world.terrain && world.terrain.on === false)) return 0; const h = world.terrainHeight(px, pz); return Number.isFinite(h) ? WORC_LEVELS.datumOD - 58 - h : 0; };
      /** the highest the camera may be at (x, z) with the player's head at (px, pz): Infinity when no tunnel is in play */
      const camCeil = (x, z, px, pz, head) => {
        let lim = Infinity; const dp = drop(px, pz), fl = (t, s) => fl0(t, s) + dp;
        for (const t of TUNNELS) {
          const pa = (px - t.a[0]) * t.ex + (pz - t.a[1]) * t.ez, pl = Math.abs((px - t.a[0]) * -t.ez + (pz - t.a[1]) * t.ex);
          if (pa < -7 || pa > t.len + 7 || pl > 3) continue;
          const ca = (x - t.a[0]) * t.ex + (z - t.a[1]) * t.ez, cl = Math.abs((x - t.a[0]) * -t.ez + (z - t.a[1]) * t.ex), hw = t.w / 2;
          const crown = t.ys + t.rise - 0.3;
          if (ca > -0.4 && ca < t.len + 0.4) { if (cl < hw + 0.3) lim = Math.min(lim, fl(t, ca) + Math.max(1.25, t.ys - 0.25 + (t.rise) * Math.max(0, 1 - (cl / hw) ** 2))); }      // under the vault
          else if (pa > -0.2 && pa < t.len + 0.2) lim = Math.min(lim, fl(t, ca) + crown);                                             // outside a mouth, the player inside: level with the arch, looking through it
          else if ((ca < 0) !== (pa < 0) || (ca > t.len) !== (pa > t.len)) lim = Math.min(lim, fl(t, ca) + crown);                    // the tunnel between the two
        }
        return lim;
      };
      // (2026-11-22) ... and the same under Pump Quad's two lean-to roofs: with the player under one, a camera under it
      // too stays below the glass or the slates, and one still out in the court comes down to the eaves and looks in
      // under them (it used to ride up over the roof and show the top of it).
      const roofCeil = (x, z, px, pz) => {
        if (px < C0[0] - 4 || px > C0[0] + 28 || pz < C0[1] + 15 || pz > C0[1] + 36) return Infinity;
        const rp = pumpRoofAt(...W2L(px, pz)); if (!rp) return Infinity;
        const rc = pumpRoofAt(...W2L(x, z));
        return rc ? rc[0] - 0.2 : rp[1] - 0.15;
      };
      const prevHook = game.cameraHook;
      if (typeof game._followCamera === 'function') game.cameraHook = (dt, cam) => {
        if (prevHook && prevHook(dt, cam)) return true;
        const p = game.player;
        if (!p || p.place !== 'world' || p.vehicle || game.activity || game.firstPerson) return false;
        const head = p.pos.y + 1.5;
        const inRoof = roofCeil(p.pos.x, p.pos.z, p.pos.x, p.pos.z) !== Infinity;
        const pl = W2L(p.pos.x, p.pos.z), inDug = p.pos.y < PQY - 0.25 && pumpDug(pl[0], pl[1]);      // down the bar's flight, in its area, lobby or doorway
        if (!inRoof && !inDug && camCeil(p.pos.x, p.pos.z, p.pos.x, p.pos.z, head) === Infinity && !TUNNELS.some((t) => { const pa = (p.pos.x - t.a[0]) * t.ex + (p.pos.z - t.a[1]) * t.ez, pl = Math.abs((p.pos.x - t.a[0]) * -t.ez + (p.pos.z - t.a[1]) * t.ex); return pa > -7 && pa < t.len + 7 && pl < 3; })) return false;
        game._followCamera(dt);
        if (game._fp) return true;
        const lim = Math.min(camCeil(cam.position.x, cam.position.z, p.pos.x, p.pos.z, head), inRoof ? Math.max(roofCeil(cam.position.x, cam.position.z, p.pos.x, p.pos.z), p.pos.y + 1.55) : Infinity);
        if (cam.position.y > lim) { cam.position.y = lim; cam.lookAt(p.pos.x, p.pos.y + 1.4, p.pos.z); }
        if (inDug) {      // the camera comes in along its own line until it stands in the open part of the dug places
          const hx = p.pos.x, hy = p.pos.y + 1.5, hz = p.pos.z, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
          let t = 1; for (; t > 0.1; t -= 0.07) { const q = W2L(hx + (cx - hx) * t, hz + (cz - hz) * t); if (pumpCamOK(q[0], hy + (cy - hy) * t, q[1])) break; }
          if (t < 1) { t = Math.max(t, 0.1); cam.position.set(hx + (cx - hx) * t, hy + (cy - hy) * t, hz + (cz - hz) * t); cam.lookAt(p.pos.x, p.pos.y + 1.4, p.pos.z); }
        }
        return true;
      };
      tunnelCeil = camCeil;
    }
    terraceCamera(game, W2L);      // … and inside Staircase 6 and under the slip's roof (_worcester_terrace.js TERR_COVERS)

    // ================================================================= tidy: trees, furniture, passages inside the rebuilt area
    const quadPoly = [[-52.3, VT], [UW, VT], [UW, VS], [COT.e[0], COT.e[1]], [-52.3, 20.4]].map(([u, v]) => L2W(u, v));
    world.clearArea(quadPoly);
    world.clearArea([[BLK.uC, BLK.vCs], [BLK.screenU + 0.3, BLK.vCs], [BLK.screenU + 0.3, BLK.vHn], [BLK.uC, BLK.vHn]].map(([u, v]) => L2W(u, v)));
    world.clearArea([[UW, VS], [PUMP.ue, VS], [PUMP.ue, PUMP.south(PUMP.ue)], [COT.e[0], PUMP.south(COT.e[0])], [COT.e[0], COT.e[1]], [UW, cotFront(UW)]].map(([u, v]) => L2W(u, v)));
    if (SWTUN && HANG.poly) { world.clearArea(HANG.poly); world.clearArea(HANG.clear); }
    const inRebuilt = (x, z) => { const [u, v] = W2L(x, z); return u > -53 && u < 29 && v > -30 && v < 36 && !(u > PUMP.ue - 0.5 && v > 20); };
    for (const p of col.passages) {
      const mx = (p.x1 + p.x2) / 2, mz = (p.z1 + p.z2) / 2;
      if (inRebuilt(p.x1, p.z1) || inRebuilt(p.x2, p.z2) || inRebuilt(mx, mz)) p.on = false;
    }

    // ================================================================= the Worcester Place back gate
    const gate = buildBackGate(game, M, atlas, col);
    // ================================================================= the Sainsbury Building; the roofs round Provost's Yard
    let rangesTris = 0;
    for (const [what, fn] of [['Sainsbury Building', buildSainsbury], ['street front', buildStreetFront]]) { try { rangesTris += fn(game, M).tris; } catch (e) { console.warn('[worcester] ' + what, e); } }

    // ================================================================= people
    const peds = game.pedestrians;
    const spawn = (u, v, look, opts) => { if (!peds) return null; const [x, z] = L2W(u, v); try { return peds.spawnAt(x, z, look, opts); } catch (e) { console.warn('[worcester] spawn', e); return null; } };
    const LOOK = (seed, o) => { const { outfit, prop, ...rest } = o; return { ...randomLook(seed, { outfit, prop }), ...rest }; };
    const porterUV = [12.3, BLK.axis - 0.85];      // in the gate hall, by the Lodge's door
    const porter = spawn(porterUV[0], porterUV[1], LOOK(8101, { outfit: 'porter', hairStyle: 'short', hair: 0x5a5048 }), { heading: headingL(0, 1), label: 'Porter', role: 'porter', knockable: false, lines: ['Morning.', 'Visitors sign in at the Lodge, please.', 'Off the grass, if you please.'] });
    spawn(-20.5, -16.6, LOOK(8102, { outfit: 'casual', backpack: 0x223355 }), { heading: headingL(0, 1), pose: 'talk', lines: ['Collections are in noughth week. Noughth!', "Bar quiz tonight?"] });
    spawn(-21.6, -16.9, LOOK(8103, { outfit: 'casual', scarf: [0xd4467a, 0x111111] }), { heading: headingL(1, 0.3), pose: 'phone' });
    spawn(5.2, 6.0, LOOK(8104, { outfit: 'gown', prop: 'book' }), { heading: headingL(-1, 0), pose: 'stand', lines: ['Has anyone seen the Library key?'] });
    spawn(-21.5, BF - 1.4, LOOK(8105, { outfit: 'casual' }), { heading: headingL(0, 1), pose: 'sitground' });
    spawn(16.0, 27.45, LOOK(8106, { outfit: 'casual', prop: 'pint' }), { heading: headingL(0, 1), pose: 'sit', lines: ['Bar opens at eight, right?', 'Darts later?'] });
    spawn(6.9, 29.85, LOOK(8107, { outfit: 'casual', prop: 'pint' }), { heading: headingL(0, -1), pose: 'sit' });
    spawn(-36, 17.7, LOOK(8108, { outfit: 'tweed', glasses: true }), { heading: headingL(1, 0), pose: 'stand', role: 'don', lines: ['Fifteenth century, you know. The Cottages.'] });      // (on the path: the Cottages' front line moved, and the border with it)

    // ---- someone using the south-west tunnel: a student with a book who walks from the quad through the tunnel and
    // along the lawn path towards the lake, sits out a pause at each end and comes back. Where they are is a function
    // of the shared clock (the same for every player; nothing is sent); drawn and animated only within 110 m.
    let stroller = null;
    if (SWTUN && HANG.mouthN) {
      const pts = [L2W(-30, 17.3), L2W(-47.3, 17.5), HANG.mouthN, HANG.mouthS, [-297.1, 45.4], [-311.8, 44.8], [-335.0, 43.9]];
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const LEN = cum[cum.length - 1], V = 1.25, PAUSE = 14, HALF = LEN / V + PAUSE, PERIOD = HALF * 2;
      /** -> {x, z, h, moving} at shared-clock second t */
      const at = (t, out = {}) => {
        const q = ((t % PERIOD) + PERIOD) % PERIOD, back = q >= HALF, w = back ? q - HALF : q, d = Math.min(LEN, w * V), s = back ? LEN - d : d;
        let i = 1; while (i < pts.length - 1 && cum[i] < s) i++;
        const a = pts[i - 1], b = pts[i], f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        out.x = a[0] + (b[0] - a[0]) * f; out.z = a[1] + (b[1] - a[1]) * f; out.moving = w * V < LEN;
        out.h = Math.atan2((b[0] - a[0]) * (back ? -1 : 1), (b[1] - a[1]) * (back ? -1 : 1));
        return out;
      };
      stroller = { pts, at, period: PERIOD, len: LEN, ch: null, st: {}, h: 0, shown: false };
    }

    // ================================================================= interactions
    const ui = game.ui;
    const porterLines = [
      ["Afternoon. Welcome to Worcester.", "The Cloisters are straight through. Chapel on your right, Hall on your left as you face the quad.", "And please — keep off the grass in the Main Quad."],
      ["Pidges are in Pump Quad — the pigeonhole room by Staircase 15. Through the Cloisters, past the Hall.", "And the Cellar Bar's down the steps in Pump Quad too, under the Hall."],
      ["Lost your Bod card again?", "Gate 3 on Worcester Place takes it. Main gate's wicket after hours, mind the step."],
      ["The lake? Through the tunnel by the Cottages, across the Nuffield Lawn, and keep going.", "Don't feed the geese. They've got opinions."],
    ];
    // The lake page now that the tunnel is where it is (the quad's south-west corner, under the Hanging Garden). Set
    // here and not in the literal above: tools/voices/extract.mjs reads that literal and every line in it must have a
    // rendered clip (tools/smoke_voice.mjs); these two new lines have none yet (shown as text; to be voiced, then moved up).
    if (SWTUN) porterLines[3] = ["The lake? Bottom corner of the quad, the tunnel at the far end of the Cottages. Mind your head.", "It goes under the Hanging Garden and out by the Nuffield Lawn. Then keep going.", "Don't feed the geese. They've got opinions."];
    let porterIdx = 0;
    if (porter) game.interact.add({ pos: () => porter.character.group.position, radius: 2.4, label: 'Talk to the porter', onUse: () => { ui.dialog('Porter', porterLines[porterIdx++ % porterLines.length]); game.voice?.followDialog('porter'); } });
    // Keep off the grass
    let lastFine = -1e9, fines = 0, wasOnGrass = false;
    const onGrass = (u, v) => {
      if (inLawn(u, v)) return true;
      if (u > NS0 + 0.1 && u < NS1 - 0.1 && v < BF) return false;      // the north flight
      if (u > -52 && u < EW - 0.25 && v > WK && v < BE) { const f = bankF(u, v) * clamp01((BE - v) / 1.2); return f > 0.03 && (f < 0.97 || v > FAN.c[1]); }      // the banks (and the bank's top beside the fan)
      return false;
    };

    // ================================================================= update
    const pl0 = game.player;
    let tGate = 0;
    const tris = Math.round(meshes.concat(pitMeshes).reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0) + gate.tris + rangesTris);
    console.log(`[worcester] built in ${Math.round(performance.now() - t0)} ms: ${meshes.length + pitMeshes.length + 1 + gate.meshes} meshes, ${(tris / 1000).toFixed(1)}k triangles`);
    game.worcester = { L2W, W2L, localGround, T, bar: { out: BAR_OUT, level: BAR_LEVEL }, pump: PUMP, gate, stroller, tunnelCeil, levels: { quadY, floorY, pumpQuad: PQY, fan: FAN, gap: GAP, bankF, bank: { EW, EF, BE, WK, BF }, northFlight: [NS0, NS1] }, block: BLK, terrace: TERR, checked: CHECKED.concat(TERR_CHECKED), tunnels: { on: SWTUN, east: { n: L2W(-7.6, cotFront(-7.6) - 1.6), s: L2W(-7.6, TUN.v1 + 1.5), w: TUN.u1 - TUN.u0, crown: TUNP[1] + TUNP[2] }, west: SWTUN ? { n: HANG.mouthN, s: HANG.mouthS, mid: HANG.mid, w: HANG.w, crown: HANG.ys + HANG.rise, len: HANG.len + 0.55 } : null }, stats: { meshes: meshes.length + pitMeshes.length + 1 + gate.meshes, tris } };

    // the rim on the drawn ground (_worcester_rim.js): its levels, the switch's state, what stands on the gardens' ground
    { const gt = Math.round(gardenMeshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0)), W = game.worcester;
      Object.assign(W, { baseGround, rim: { levels: RIM, level: rimLevel, garden: GARD, mouths: MOUTH, dropped: { e: GARD.e !== 0, sw: GARD.sw !== 0 }, cut: rimCut, wall: { u: -52.3, v0: LODG.v1, v1: 19.8 }, meshes: gardenMeshes, tris: gt } });
      W.stats.meshes += gardenMeshes.length; W.stats.tris += gt;
      console.log(`[worcester] rim: ${gardenMeshes.length} meshes and ${gt} triangles on the gardens' ground; ${rimCut} triangles cut to the terrain's lattice; passages ${W.rim.dropped.e && W.rim.dropped.sw ? 'level to the gardens' : 'climbing (the drawn ground has not dropped yet)'}`); }
    return {
      update(dt) {
        if (aoMesh) { const q = game.quality; aoMesh.visible = !q || !q.tier || q.tier.aoStrips !== false; }
        if (pl0.place !== 'world') return;
        const p = pl0.pos;
        gate.update(dt, p);
        const dx = p.x - (-235), dz = p.z - 10;
        if (dx * dx + dz * dz > 250 * 250) return;
        if (stroller) {
          const S = stroller, st = S.at((game.time && game.time.now ? game.time.now() : Date.now()) / 1000, S.st), near = (st.x - p.x) ** 2 + (st.z - p.z) ** 2 < 110 * 110;
          if (near && !S.ch) { try { S.ch = createCharacter(LOOK(8110, { outfit: 'casual', prop: 'book' })); S.ch.group.visible = false; game.worldScene.add(S.ch.group); S.h = st.h; } catch (e) { console.warn('[worcester] stroller', e); stroller = null; } }
          if (S.ch) {
            if (near !== S.shown) { S.shown = near; S.ch.group.visible = near; }
            if (near) {
              let dh = st.h - S.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); S.h += dh * Math.min(1, dt * 5);      // turns round over a few steps
              const g = S.ch.group; g.position.set(st.x, world.groundHeight(st.x, st.z), st.z); g.rotation.y = S.h;
              S.ch.update(dt, st.moving ? 1.25 : 0);
            }
          }
        }
        const [u, v] = W2L(p.x, p.z);
        // keep off the grass
        tGate += dt;
        const g = onGrass(u, v);
        if (g && !wasOnGrass) {
          const now = performance.now();
          if (now - lastFine > 12000) {
            lastFine = now;
            const fine = fines < 5 && game.state.money >= 1;
            if (fine) { fines++; game.pay(-1); }
            const shout = ['OI! Off the grass!', 'Off the lawn, please!', 'Grass! GRASS!', "That's college grass, that is!"][fines % 4];
            if (porter && porter.character) { porter.character.say(shout, 3); game.voice?.say('porter', shout, { pos: porter.character.group.position, interrupt: true }); }
            ui.toast(fine ? `Porter: "${shout}" Half a crown fine (1785 byelaw) — £1 in new money.` : `Porter: "${shout}"`, 4);
          }
        }
        wasOnGrass = g;
      },
    };
  },
};


// ================================================================================================ BACK GATE
// Worcester Place "Gate 3": buff stock-brick gatehouse closing the west end of the east-west leg of Worcester Place.
// Local gate frame: s along the face (positive = north, i.e. right as seen from the street), y up, t outward (east).
function buildBackGate(game, M, atlas, col) {
  const world = game.world;
  const G = [-364.6, -136.0], R = [-0.1145, -0.9935], N = [0.9935, -0.1145];
  const g2w = (s, t) => [G[0] + R[0] * s + N[0] * t, G[1] + R[1] * s + N[1] * t];
  const GF = frame(G[0], 0, G[1], R[0], R[1]);
  const B = new Batch();
  const grp = new THREE.Group(); grp.name = 'worcester-backgate';
  world.addStatic(grp);
  B.push(GF);
  // --- left (south) section with the pedestrian door: s -4.1..-2.0, 0.45 thick, top slopes 4.6 -> 3.8
  const LW = [-4.1, -2.0], DOOR = [-3.5, -2.6], DH = 2.25, TH = 0.45;
  const leftOut = [[LW[0], 0], [DOOR[0], 0], [DOOR[0], DH], [DOOR[1], DH], [DOOR[1], 0], [LW[1], 0], [LW[1], 4.6], [LW[0], 3.8]];
  B.face('buff', leftOut, []);
  B.push(new THREE.Matrix4().makeTranslation(0, 0, -TH)); B.face('buff', leftOut, [], 0, true); B.pop();
  B.poly('buff', [[LW[0], 3.8, 0], [LW[1], 4.6, 0], [LW[1], 4.6, -TH], [LW[0], 3.8, -TH]], [0, 1, 0]);
  B.poly('buff', [[LW[0], 0, -TH], [LW[0], 0, 0], [LW[0], 3.8, 0], [LW[0], 3.8, -TH]], [-1, 0, 0]);
  B.reveal('buff', [[DOOR[0], 0], [DOOR[1], 0], [DOOR[1], DH], [DOOR[0], DH]], 0, -TH, true);
  B.box('greyStone', (DOOR[0] + DOOR[1]) / 2, DH + 0.1, 0.0, DOOR[1] - DOOR[0] + 0.3, 0.2, 0.06);   // stone lintel
  B.box('greyStone', -3.88, 1.45, 0.04, 0.16, 0.24, 0.08);                                              // intercom / card reader
  B.sign('signs', -3.95, 1.36, -3.81, 1.56, 0.081, atlas.uv('reader'));
  B.push(new THREE.Matrix4().makeTranslation(0, 0, -TH).multiply(new THREE.Matrix4().makeRotationY(Math.PI)));
  B.box('greyStone', 2.35, 1.49, 0.04, 0.16, 0.24, 0.08); B.sign('signs', 2.28, 1.40, 2.42, 1.60, 0.081, atlas.uv('reader'));   // exit reader (inside)
  B.pop();
  // grey rendered strip between the Victorian building and the gate wall
  B.boxXZ('greyStone', -4.95, LW[0], 0, 3.0, -0.35, 0.0);
  B.box('redBrick', -4.95, 1.6, 0.06, 0.1, 3.2, 0.1);  // pinkish downpipe
  // --- central passage + upper block
  const GW = 2.0, GH = 3.35, PH = 3.9, DEP = 3.6;
  B.boxXZ('buff', -GW - 0.25, -GW, 0, PH, -DEP, -TH);                    // passage wall (left)
  B.flat('dark', [[-GW, 0], [GW, 0], [GW, -DEP], [-GW, -DEP]].map(([s, t]) => [s, t]), PH, [], true);
  B.box('dark', 0, (GH + PH) / 2, -0.5, GW * 2, PH - GH, 0.05);           // the dark slot above the gates
  // right pier: s 2.0..3.95, solid, top slopes 4.75 -> 4.2
  const RP = [GW, 3.95];
  B.poly('buff', [[RP[0], 0, 0], [RP[1], 0, 0], [RP[1], 4.2, 0], [RP[0], 4.75, 0]], [0, 0, 1]);
  B.poly('buff', [[RP[1], 0, -DEP], [RP[0], 0, -DEP], [RP[0], 4.75, -DEP], [RP[1], 4.2, -DEP]], [0, 0, -1]);
  B.poly('buff', [[RP[1], 0, 0], [RP[1], 0, -DEP], [RP[1], 4.2, -DEP], [RP[1], 4.2, 0]], [1, 0, 0]);
  B.poly('buff', [[RP[0], 4.75, 0], [RP[1], 4.2, 0], [RP[1], 4.2, -DEP], [RP[0], 4.75, -DEP]], [0, 1, 0]);
  B.poly('buff', [[RP[0], 0, -DEP], [RP[0], 0, 0], [RP[0], PH, 0], [RP[0], PH, -DEP]], [-1, 0, 0]);
  // upper block with gable-with-notch silhouette
  const top = [[GW, 6.45], [0.28, 7.35], [0, 6.95], [-0.28, 7.35], [-GW, 6.45]];
  const upOut = [[-GW, PH], [GW, PH], ...top];
  B.face('buff', upOut, []);
  B.push(new THREE.Matrix4().makeTranslation(0, 0, -DEP)); B.face('buff', upOut, [[[-0.5, 4.6], [0.5, 4.6], [0.5, 5.9], [-0.5, 5.9]]], 0, true); B.pop();
  B.push(new THREE.Matrix4().makeTranslation(0, 0, -DEP)); B.face('orielGlass', [[-0.5, 4.6], [0.5, 4.6], [0.5, 5.9], [-0.5, 5.9]], [], 0.1, true); B.pop();
  B.poly('buff', [[-GW, PH, -DEP], [-GW, PH, 0], [-GW, 6.45, 0], [-GW, 6.45, -DEP]], [-1, 0, 0]);
  B.poly('buff', [[GW, 4.75, 0], [GW, 4.75, -DEP], [GW, 6.45, -DEP], [GW, 6.45, 0]], [1, 0, 0]);
  // roof planes (dark slate), down to the oriels' outer edges, plus the V notch
  const ext = 2.68, yo = 6.45 - (ext - GW) * (0.9 / 1.72);
  for (const sg of [-1, 1]) {
    B.poly('slate', [[sg * 0.28, 7.35, 0.62], [sg * ext, yo, 0.62], [sg * ext, yo, -DEP - 0.1], [sg * 0.28, 7.35, -DEP - 0.1]], [sg, 1, 0]);
    B.poly('slate', [[0, 6.95, 0.62], [sg * 0.28, 7.35, 0.62], [sg * 0.28, 7.35, -DEP - 0.1], [0, 6.95, -DEP - 0.1]], [-sg, 1, 0]);
    B.poly('dark', [[sg * 0.28, 7.35, 0.62], [sg * ext, yo, 0.62], [sg * ext, yo - 0.12, 0.62], [sg * 0.28, 7.23, 0.62]], [0, 0, 1]);   // dark fascia
  }
  // oriels: angular glazed boxes under the roof at the two corners
  for (const sg of [-1, 1]) {
    const a = sg * 0.62, b = sg * ext, s0 = Math.min(a, b), s1 = Math.max(a, b), yb = 4.75, tF = 0.5;
    const yt = (s) => 7.35 - (Math.abs(s) - 0.28) * (0.9 / 1.72) - 0.12;
    B.boxXZ('dark', s0, s1, yb - 0.18, yb, -0.6, tF);                                     // dark base band
    B.poly('orielGlass', [[s0, yb, tF], [s1, yb, tF], [s1, yt(s1), tF], [s0, yt(s0), tF]], [0, 0, 1]);
    const so = sg < 0 ? s0 : s1;
    B.poly('orielGlass', [[so, yb, -0.6], [so, yb, tF], [so, yt(so), tF], [so, yt(so), -0.6]], [sg, 0, 0]);
    for (const s of [s0, s1, (s0 + s1) / 2]) B.box('dark', s, (yb + yt(s)) / 2, tF + 0.02, 0.07, yt(s) - yb, 0.06);
    const si = sg < 0 ? s1 : s0;
    B.poly('dark', [[si, yb, tF], [si, yb, -0.6], [si, yt(si), -0.6], [si, yt(si), tF]], [-sg, 0, 0]);
    B.poly('dark', [[s1, yb, -0.6], [s0, yb, -0.6], [s0, yt(s0), -0.6], [s1, yt(s1), -0.6]], [0, 0, -1]);
    B.poly('dark', [[s0, yt(s0), tF], [s1, yt(s1), tF], [s1, yt(s1) + 0.14, tF], [s0, yt(s0) + 0.14, tF]], [0, 0, 1]);
  }
  // --- gates: grey vertical boards, notices, "3" plate, handles; round stone bollards; sett apron
  for (const sg of [-1, 1]) {
    B.boxXZ('boards', sg < 0 ? -GW : 0.01, sg < 0 ? -0.01 : GW, 0.03, GH, -0.24, -0.15);
    B.box('dark', sg * 0.35, 1.25, -0.13, 0.04, 0.35, 0.04);
  }
  B.sign('signs', -1.62, 2.55, -1.2, 2.95, -0.145, atlas.uv('keepClear'));
  B.sign('signs', 1.35, 2.55, 1.77, 2.95, -0.145, atlas.uv('keepClear'));
  B.sign('signs', -1.92, 3.03, -1.76, 3.24, -0.145, atlas.uv('plate3'));
  for (const s of [-2.3, 2.3]) B.cyl('greyStone', s, 0, 0.28, 0.22, 0.62, 8, true, 0.24);
  B.flat('setts', [[-4.1, 0], [4.3, 0], [4.3, 2.2], [-4.1, 2.2]].map(([s, t]) => [s, t]), 0.05);
  // --- right: red-brick pier with stone cap, then the ~1.8 m wall with brick coping
  B.boxXZ('redBrick', 3.95, 4.55, 0, 2.0, -0.4, 0.12); B.boxXZ('greyStone', 3.9, 4.6, 2.0, 2.12, -0.45, 0.17);
  B.boxXZ('redBrick', 4.55, 8.6, 0, 1.8, -0.38, 0); B.boxXZ('redBrick', 4.55, 8.6, 1.8, 1.9, -0.42, 0.04);
  B.pop();

  // --- the Victorian red-brick building on the south side (OSM "MCR"; former timber-yard office) rebuilt
  {
    const A = [-352.8, -132.05], Bq = [-363.7, -131.1];
    const ax = Bq[0] - A[0], az = Bq[1] - A[1], L = Math.hypot(ax, az);
    const MF = frame(A[0], 0, A[1], ax, az), D = 8.5, e = 5.6, rise = 2.9;
    B.push(MF);
    const ops = [
      { pts: segPts(8.4, 0.95, 0, 2.15, 0.18), notch: true },
      { pts: segPts(3.0, 1.6, 1.0, 2.3, 0.2) },
      { pts: segPts(2.6, 1.0, 4.0, 5.1, 0.15) },
    ];
    const circ = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; circ.push([8.4 + Math.cos(a) * 0.42, 4.95 + Math.sin(a) * 0.42]); }
    B.face('redBrick', [[0, 0], [ops[0].pts[0][0], 0], ...ops[0].pts.slice(2).reverse(), [ops[0].pts[1][0], 0], [L, 0], [L, e], [0, e]], [ops[1].pts, ops[2].pts, circ]);
    B.reveal('redBrick', ops[0].pts, 0, -0.25, true); B.reveal('redBrick', ops[1].pts, 0, -0.25); B.reveal('redBrick', ops[2].pts, 0, -0.25); B.reveal('redBrick', circ, 0, -0.2);
    B.face('oak', ops[0].pts, [], -0.22);
    for (const k of [1, 2]) B.face('dark', ops[k].pts, [], -0.2);
    B.face('dark', circ, [], -0.18);
    B.box('greyStone', 3.0, 1.65, -0.17, 1.6, 0.06, 0.04); B.box('greyStone', 2.6, 4.55, -0.17, 1.0, 0.06, 0.04);
    // blue-brick arch heads, oculus surround
    for (const [x, w, y] of [[8.4, 0.95, 2.15], [3.0, 1.6, 2.3], [2.6, 1.0, 5.1]]) for (let k = 0; k < 7; k++) { const a = Math.PI * (k + 0.5) / 7; B.box('dark', x - Math.cos(a) * (w / 2 + 0.1), y + Math.sin(a) * 0.25 + 0.06, 0.02, 0.2, 0.18, 0.05); }
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; B.box('dark', 8.4 + Math.cos(a) * 0.55, 4.95 + Math.sin(a) * 0.55, 0.02, 0.2, 0.2, 0.05, -a); }
    B.box('greyStone', 3.0, 0.92, 0.05, 1.9, 0.12, 0.14); B.box('greyStone', 2.6, 3.92, 0.05, 1.3, 0.12, 0.14);
    B.box('greyStone', L / 2, 3.35, 0.04, L, 0.16, 0.1);                       // string course
    B.box('dark', L / 2, 3.6, 0.025, L, 0.12, 0.06);                            // blue-brick band
    for (const x of [5.4, 9.9]) { B.push(new THREE.Matrix4().makeTranslation(x, 3.55, 0.08).multiply(new THREE.Matrix4().makeRotationZ(0.75))); B.box('dark', 0, 0, 0, 0.06, 0.85, 0.04); B.pop(); B.push(new THREE.Matrix4().makeTranslation(x, 3.55, 0.08).multiply(new THREE.Matrix4().makeRotationZ(-0.75))); B.box('dark', 0, 0, 0, 0.06, 0.85, 0.04); B.pop(); }
    B.box('dark', 6.4, e / 2, 0.09, 0.1, e, 0.1);                               // black downpipe
    B.box('dark', L / 2, e - 0.08, 0.15, L + 0.4, 0.14, 0.18);                  // gutter
    // other walls + roof
    // the quad (south) side, from ADP's survey drawing of 2006 (reference/worcester/13 mcr and gate 3: WCO2-E13), set out
    // in thirds as drawn and scaled to this 10.9 m wall (the real one is 14.5 m): west bay a segmental-arched window with
    // one square window over it, middle bay wide double boarded doors under a segmental fanlight, east bay a smaller
    // arched window; two shallow brick pilasters; three rooflights. x runs from the east end as on the street side
    B.push(new THREE.Matrix4().makeTranslation(0, 0, -D));
    { const qd = { pts: segPts(L - 4.69, 1.6, 0, 2.2, 0.5) }, qf = segPts(L - 4.69, 1.6, 2.2, 2.2, 0.5).slice(2);      // the doors; the fanlight over them
      const qw = [segPts(L - 2.11, 1.3, 1.45, 2.5, 0.22), segPts(L - 8.73, 1.1, 0.95, 2.05, 0.2)], qu = rectPts(L - 2.61, 3.85, L - 1.61, 4.8);
      B.face('redBrick', [[0, 0], [qd.pts[0][0], 0], ...qd.pts.slice(2).reverse(), [qd.pts[1][0], 0], [L, 0], [L, e], [0, e]], [...qw, qu], 0, true);
      B.reveal('redBrick', qd.pts, 0, 0.22, true); for (const q of [...qw, qu]) B.reveal('redBrick', q, 0, 0.2);
      B.face('oak', rectPts(L - 5.49, 0, L - 3.89, 2.2), [], 0.2, true); B.face('dark', qf, [], 0.2, true);
      B.box('dark', L - 4.69, 1.1, 0.19, 0.04, 2.2, 0.03); B.box('greyStone', L - 4.69, 2.23, 0.17, 1.6, 0.07, 0.06);                      // the meeting stiles, the transom
      for (const q of [...qw, qu]) B.face('dark', q, [], 0.18, true);
      for (const [x, w, y, r] of [[L - 4.69, 1.6, 2.2, 0.5], [L - 2.11, 1.3, 2.5, 0.22], [L - 8.73, 1.1, 2.05, 0.2]]) for (let k = 0; k < 7; k++) { const a = Math.PI * (k + 0.5) / 7; B.box('dark', x - Math.cos(a) * (w / 2 + 0.06), y + Math.sin(a) * r + 0.1, -0.02, 0.2, 0.18, 0.05); }      // blue-brick arch heads
      B.box('greyStone', L - 2.11, 1.39, -0.05, 1.5, 0.12, 0.14); B.box('greyStone', L - 8.73, 0.89, -0.05, 1.3, 0.12, 0.14); B.box('greyStone', L - 2.11, 3.79, -0.05, 1.2, 0.12, 0.14);      // sills
      for (const x of [L - 3.64, L - 7.15]) B.boxXZ('redBrick', x - 0.17, x + 0.17, 0, e - 0.25, -0.09, 0, { top: true }); }
    B.pop();
    for (const x of [L - 2.12, L - 6.76, L - 8.71]) { const yz = (z) => [e - 0.1 + ((z + D + 0.25) * (rise + 0.1)) / (D / 2 - 0.25) + 0.05, z]; const [y0, z0] = yz(-D + 1.3), [y1, z1] = yz(-D + 2.2); B.poly('glassDark', [[x - 0.4, y0, z0], [x + 0.4, y0, z0], [x + 0.4, y1, z1], [x - 0.4, y1, z1]], [0, 1, -1]); }      // the three rooflights
    B.poly('redBrick', [[0, 0, -D], [0, 0, 0], [0, e, 0], [0, e + rise, -D / 2], [0, e, -D]], [-1, 0, 0]);
    B.poly('redBrick', [[L, 0, 0], [L, 0, -D], [L, e, -D], [L, e + rise, -D / 2], [L, e, 0]], [1, 0, 0]);
    B.poly('slate', [[-0.2, e - 0.1, 0.25], [L + 0.2, e - 0.1, 0.25], [L + 0.2, e + rise, -D / 2], [-0.2, e + rise, -D / 2]], [0, 1, 1]);
    B.poly('slate', [[L + 0.2, e - 0.1, -D - 0.25], [-0.2, e - 0.1, -D - 0.25], [-0.2, e + rise, -D / 2], [L + 0.2, e + rise, -D / 2]], [0, 1, -1]);
    B.pop();
    const p0 = A, p1 = Bq;
    const nx = -az / L, nz = ax / L;   // outward (north)
    const q1 = [p1[0] - nx * D, p1[1] - nz * D], q0 = [p0[0] - nx * D, p0[1] - nz * D];
    col.addPolygon([p0, p1, q1, q0], { tag: 'building' });
  }

  // --- court inside: setts with a tarmac drive, stone copings round the two diamond ponds, the flat timber bridge
  // (places/worcester_snsc.js builds the real court, pools and bridge and says so in its preMap: then not this one)
  if (!(game.worcesterSnsc && game.worcesterSnsc.court)) {
    B.flat('setts', [[-363.4, -127.8], [-378.5, -126.9], [-395.0, -127.2], [-395.5, -138.2], [-379.0, -138.0], [-368.3, -138.4]].map(([x, z]) => [x, z]), 0.046);
    B.flat('asphalt', [[-368.3, -134.0], [-381, -133.6], [-381, -137.3], [-368.3, -137.9]], 0.05);
    const ring = [[-399.1, -120.3], [-395.3, -126.3], [-400.7, -131.1]], ring2 = [[-401.0, -134.5], [-396.5, -140.4], [-403.2, -145.8], [-409.3, -138.9], [-404.6, -134.2]], ring3 = [[-404.4, -130.9], [-408.2, -126.0], [-401.4, -119.7]];
    for (const r of [ring, ring2, ring3]) for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      B.push(frame(a[0], 0, a[1], b[0] - a[0], b[1] - a[1])); B.boxXZ('greyStone', -0.15, L + 0.15, 0, 0.16, -0.2, 0.2); B.pop();
    }
    // bridge deck (boards across) with low timber edges
    const b0 = [-399.6, -132.85], b1 = [-405.6, -132.55], bl = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
    B.push(frame(b0[0], 0, b0[1], b1[0] - b0[0], b1[1] - b0[1]));
    for (let x = 0; x < bl; x += 0.16) B.boxXZ('oak', x + 0.01, x + 0.15, 0.06, 0.16, -1.35, 1.35);
    for (const z of [-1.35, 1.35]) B.boxXZ('oak', 0, bl, -0.25, 0.08, z - 0.12, z + 0.12);
    B.pop();
  }

  // colliders for the gatehouse (gate frame -> world)
  const segG = (s1, t1, s2, t2, tag = 'building') => { const a = g2w(s1, t1), b = g2w(s2, t2); return col.addSegment(a[0], a[1], b[0], b[1], { tag }); };
  segG(-4.95, 0, DOOR[0], 0); segG(DOOR[1], 0, -GW, 0);              // street face either side of the door
  segG(-4.95, -0.35, -4.95, 0); segG(-4.95, -0.35, LW[0], -0.35); segG(LW[0], -TH, DOOR[0], -TH); segG(DOOR[1], -TH, -GW - 0.25, -TH);
  segG(DOOR[0], 0, DOOR[0], -TH); segG(DOOR[1], 0, DOOR[1], -TH);
  segG(-GW - 0.25, -TH, -GW - 0.25, -DEP); segG(-GW, -TH, -GW, -DEP); segG(-GW - 0.25, -DEP, -GW, -DEP);
  segG(-GW, -0.15, GW, -0.15, 'gate');                               // vehicle gates (always shut)
  segG(GW, 0, 3.95, 0); segG(3.95, 0, 3.95, -DEP); segG(GW, -DEP, 3.95, -DEP); segG(GW, 0, GW, -DEP);
  segG(3.95, 0.12, 4.55, 0.12); segG(4.55, 0, 8.6, 0, 'wall'); segG(4.55, -0.38, 8.6, -0.38, 'wall');
  const doorSeg = segG(DOOR[0], -0.2, DOOR[1], -0.2, 'door');
  // the OSM gate node would otherwise leave a walk-through capsule in the vehicle gates
  for (const p of col.passages) if (Math.hypot(p.x1 - -364.1, p.z1 - -134.2) < 0.5) p.on = false;
  void segG;
  world.clearArea([g2w(-5.2, 3), g2w(9, 3), g2w(9, -32), g2w(-5.2, -32)], { lamps: false });

  const meshes = B.build(M, grp, { pack: M._pack, noCast: new Set(['signs']) });
  let tris = meshes.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);

  // --- the pedestrian door (animated): canvas texture with vertical slots + "Worcester College" notices
  const dtex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 320; const g = c.getContext('2d');
    g.fillStyle = '#9ba1a7'; g.fillRect(0, 0, 128, 320);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,45,50,0.55)'; g.fillRect(i * 21.3, 0, 2, 320); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(i * 21.3 + 3, 0, 3, 320); }
    g.fillStyle = '#16181a'; for (const x of [24, 50, 76, 102]) g.fillRect(x - 3, 190, 6, 95);
    g.fillStyle = '#0d0d0d'; g.fillRect(36, 52, 56, 30); g.fillRect(30, 90, 68, 34);
    g.fillStyle = '#eee'; g.font = '9px Arial'; g.textAlign = 'center'; g.fillText('Worcester', 64, 64); g.fillText('College', 64, 76); g.fillText('Worcester College', 64, 104); g.fillText('Private', 64, 116);
    g.fillStyle = 'rgba(30,30,20,0.35)'; g.fillRect(0, 290, 128, 30);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const dmat = new THREE.MeshStandardMaterial({ map: dtex, roughness: 0.7 });
  const dw = DOOR[1] - DOOR[0], dgeo = new THREE.BoxGeometry(dw, DH - 0.02, 0.05);
  // map the texture only on the faces (both sides), edges grey
  dgeo.translate(dw / 2, (DH - 0.02) / 2, 0);
  const door = new THREE.Mesh(dgeo, dmat); door.castShadow = true; door.receiveShadow = true;
  const hinge = new THREE.Group();
  const hp = g2w(DOOR[0], -0.18);
  hinge.position.set(hp[0], 0.01, hp[1]); hinge.rotation.y = Math.atan2(R[0], R[1]) - Math.PI / 2;
  hinge.add(door); grp.add(hinge);
  tris += 12;
  let open = 0, target = 0, closeAt = 0;
  const openDoor = () => {
    target = 1; doorSeg.on = false; closeAt = performance.now() + 5000;
    const a = game.audio; if (a && a.ctx) { const m = g2w((DOOR[0] + DOOR[1]) / 2, -0.2), y = (game.groundHeight ? game.groundHeight(m[0], m[1]) : 0) + 1.2; cardBeep(a, { pos: { x: m[0], y, z: m[1], place: 'world' }, gain: 2.5 }); a.noise(0.12, { gain: 0.15, freq: 300, when: 0.3 }); }      // (one reader's beep and the strike: it was a rising two-note bing, 2026-11-23)
    game.ui.toast('Beep. The card reader flashes green.', 2);
  };
  const outside = g2w((DOOR[0] + DOOR[1]) / 2, 0.8), inside = g2w((DOOR[0] + DOOR[1]) / 2, -1.2);
  game.interact.add({ pos: [outside[0], outside[1]], radius: 1.6, label: 'Swipe Bod card', enabled: () => target === 0, onUse: openDoor });
  game.interact.add({ pos: [inside[0], inside[1]], radius: 1.6, label: 'Swipe Bod card (exit)', enabled: () => target === 0, onUse: openDoor });
  const dmid = g2w((DOOR[0] + DOOR[1]) / 2, -0.2);
  return {
    meshes: meshes.length + 1, tris, door: doorSeg, openDoor,
    update(dt, p) {
      if (target === 0 && open === 0) return;
      if (target === 1 && performance.now() > closeAt) {
        const d = Math.hypot(p.x - dmid[0], p.z - dmid[1]);
        if (d > 1.3) { target = 0; }
        else closeAt = performance.now() + 800;
      }
      const prev = open;
      open += Math.sign(target - open) * Math.min(Math.abs(target - open), dt * 1.6);
      if (prev !== open) { door.rotation.y = open * 1.6; door.updateMatrix(); }
      if (target === 0 && open === 0) { doorSeg.on = true; const a = game.audio; if (a && a.ctx) a.noise(0.15, { gain: 0.25, freq: 200 }); }
    },
  };
}
