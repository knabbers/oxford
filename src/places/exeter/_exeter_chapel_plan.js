// Exeter College, STANDALONE model: THE CHAPEL (George Gilbert Scott, 1856-9) with its fleche: THE PLAN (pure data, no
// three.js). Read by exeter_chapel.js / _exeter_chapel_build.js. LOCAL frame (u east, v south, y up from the datum 64.40 m:
// _exeter_shared.js). Survey: docs/research/exeter_survey.md B03; brief docs/handoff/exeter/briefs/chapel.txt.
//
// HOW IT WAS MEASURED (2026-11-23; nothing copied, nothing used as a texture)
//   * LIDAR 2022 (tools/exeter_lidar.py lbox / lgbox / u / v profiles, docs/handoff/exeter/tools/xsec.py "nave"):
//       - the nave's cross-section: parapet edges at v -19.5 (16.10) and v -31.5 (15.92); outside them the buttresses
//         (v -18.5 median 11.8, v -32.5 median 9.2): the wall faces are put at v -19.0 and -31.9 (+-0.5), centre -25.45;
//       - the roof slopes: south 1.77 m a metre (v -21.5 .. -23.5), north 1.69; the two fitted planes meet at v -25.2,
//         y 24.9; the 1 m cells' median at the ridge reads 24.3 and the highest returns along it 24.0 - 25.0: ridge 24.8;
//       - the west end: at v -25.5 the surface is 24.7 at u -15, 20.1 at u -16, 17.0 at u -17 and 13.0 (the west range's
//         eaves) at u -17.5: the west gable's face is at u -16.6 (+-0.6), against the west range (map: its quad face here
//         is u -17.16);
//       - the apse: the straight side walls run to u 9.3 (profiles at v -19.5 and -31.5 drop at u 10); the east face is
//         at u 13.1 between v -23.5 and -27 (flat); the corners between at about (11.8, -21.0) / (11.8, -29.9). That is
//         five facets on a circle through the three: centre (6.1, -25.45), radius 7.2, each facet 3.17 m and 25.45 deg
//         (two oblique, two more oblique, one square to the axis), so a five-sided apse with five windows (the interior
//         photographs count five);
//       - the apse roof: the ridge stays at 24 - 25 to u 8 - 9 then falls 1.5 - 1.7 m a metre to 16.8 at u 12.5: the
//         faceted half-cone's apex is put at u 7.8;
//       - the stair turret: 19.0 - 19.7 over u -16.7 .. -13.8, v -21.3 .. -18.7: an octagon about 2.9 m across centred at
//         (-15.4, -19.9) (the map's 2.6 m circle at (-13.5, -19.5) lies 2 m east of what the LIDAR sees);
//       - the porch: 4 - 8 m returns at v -18 over u -13 .. -10.5: projecting about 1 m, centred under the rose;
//       - buttress pinnacles along v -18: u -10.0, -5.2 (two cells), -0.75, 4.25, 7.5 - 8.5: bays of 4.8 m from u -10.0;
//       - the fleche: the highest return of the whole roof, 28.7, at (-11 .. -10, -25): its centre u -10.8 on the ridge;
//       - the ground: the Front Quad's path along the south side 64.35 - 64.55 (y 0.0 .. +0.15), Margary Quad along the
//         north side 63.9 - 64.1 (y -0.5 .. -0.3); the Thomas Wood Building stands against the north wall west of u -12.8.
//   * Photographs (reference/exeter/04 chapel/): "south face straight on" (exeter.ox.ac.uk 2016) solved as a camera
//     (two solutions: f 1310 px at 39.5 m, 1.6 m up, tilted 19 deg; f 1020 px at 33.5 m, 8 m up, tilted 13 deg; both put
//     the ground, the parapet (16.2) and the ridge (24.8, 6.4 m further back) within 5 - 15 px) and every level of the
//     south face read off it (figures below, the mean of the two); "upper part, west turret, fleche" (Acediscovery 2010)
//     for the tracery, the statues and the fleche's stages; "west gable and fleche from St Michael Northgate tower"
//     (S Craven 2014: camera about level with the ridge, 170 m off, 18.6 px a metre) for the west gable and the fleche;
//     "south face from south-west" (N Smith 2010) for the bay count and the apse; "fleche close" (The wub 2025).
//   * Satellite view by hand 2026-11-23 (reference/exeter/13 aerial and rooftop views/satellite margary quad and whole site
//     51.75410,-1.25612 (google maps, by hand 2026-11-23, side panel cropped).jpg): the roof plan (one long slate roof,
//     the apse's faceted half-cone with its hips meeting at the east end of the ridge), the fleche near the west end, six
//     buttress heads along the south side.
//
// THE FLECHE'S HEIGHT (G; working): LIDAR's 1 m cells cannot see a spire (its 28.7 is the open stage). From the south
// photograph's camera (fleche at the ridge's depth): lozenge base to 26.4, open stage to 29.1, gablets 31.3, pinnacles
// 32.0, spire tip 42.0 (both camera solutions agree within 0.2). From St Michael's tower (no foreshortening, 18.6 px a
// metre): the open stage's top 28.3, gablets 30.6, the tip 16.7 m above the ridge = 41.5. The college's bird's-eye map
// (the survey's "1.6 x the roof's own height above the ridge") gives 39.8. Taken: the spire's tip 41.0, the cross /
// vane to 42.0 above the datum = 106.4 m above sea level, 17.2 m above the ridge; the stages as below.

// THE WIDTH (touch-up pass 2026-11-23; survey section 13, contradiction 7). The first pass put the wall faces at v -19.0 /
// -31.9 (12.9 m) from LIDAR's parapet edges. Re-measured:
//   * the 1:500 topographic survey (Tim Moya Associates 2021, p20 of the Library's tree report, planning 21/00354/FUL; the
//     400 dpi render turned 17.165 deg so the quad is square): its scale CHECKED on the Front Quad lawn's kerb, 816 px x
//     886 px = 26.0 x 28.1 m at 31.4 px a metre (the survey's own 26.0 x 28.0). The Chapel's outline there: wall line to
//     wall line between the buttresses 355 px = 11.3 m; buttress face to buttress face 490 px = 15.6 m (buttresses
//     about 2.0 m deep on the south, 2.3 on the north). It is a ground-level outline (the plinth: the wall above it is
//     at most 0.1 - 0.15 m less each side).
//   * the BGS 2018 block plan (18/00694/FUL, 1:200, read at 300 dpi; its scale bar 59.6 px a metre, its Chapel 29.2 m
//     long against this model's 29.7): side walls 72 px = 1.22 m thick, inside 9.09 m, OVER THE WALLS 11.5 m (the figure
//     DIMENSIONS.md rounds to 11.6), over the buttresses 15.2 - 15.5 m (buttresses 1.8 m deep). It is a cut plan: the
//     wall itself, not the plinth or the parapet.
//   * LIDAR re-run (v profiles at u -12.6, -7.6, -5.2, -2.8, 2.1, 4.5, 6.9): the parapet's height (15.7 - 16.9) holds in
//     the cells to v -19.5 / -19.0 on the south and -31.0 / -31.5 on the north; the next cells out read the buttresses (11
//     - 15 between them is the window bays' mixed cells, 6 - 10). With the cornice and the pierced parapet standing 0.25 m
//     proud of the wall, that fits wall faces anywhere from -19.4 / -31.5 (12.1 m) to -19.9 / -31.0 (11.1 m): LIDAR cannot
//     settle it; its roof slopes (1.77 and 1.69 a metre from a 24.8 ridge to a 15.6 foot) want a half-span of 5.3 m, which
//     a 12.9 m vessel only gives with the slates' foot 1.15 m inside the wall, an 11.4 m one with it just behind the
//     parapet. Both drawings agree and outrank LIDAR here: the walls are 11.4 m apart (the mean), on the same axis
//     (-25.45, the ridge): faces -19.75 and -31.15; the buttresses deepened to 2.0 m at the foot so that their faces stay
//     where LIDAR and both drawings put them (-17.75 / -33.15: 15.4 m over the buttresses; DIMENSIONS 15.3); the apse redrawn
//     on the new walls with its east face kept at 13.1; the porch's front kept at -18.0 (now 1.75 m deep, flush with the
//     buttresses); the turret kept (LIDAR's crown). The strips the old walls covered are paved here (the Front Quad's plane
//     on the south, Margary Quad's on the north) and the north-west corner, between the Chapel's north wall and the Thomas
//     Wood Building, is the solid corner mass the BGS plan draws (u -16.6 .. -13.5).

// FRONT QUAD REGISTRATION (2026-11-23, second pass; the fit itself is written up in exeter_grounds.js): the 1:500
// topographic survey (Tim Moya Associates 210239-P-10, 2021) measured by line fits to its dark pixels and fitted rigidly to
// 31 wall lines of the model (18 agree to 0.21 m rms; survey -> LOCAL u + 1.287, v + 0.822). For the Chapel it gives:
//   * the walls: south face -19.87 (u -10) .. -19.70 (u 4), north face -31.10 .. -31.01: the model's -19.75 / -31.15
//     stand within 0.15 (kept);
//   * the BUTTRESSES, south: sides at -10.65 / -9.58, -6.08 / -5.00, -1.80 / -0.73, 2.48 / 3.55, 6.75 / 7.80 (1.07 wide,
//     fronts at -18.0); north within 0.2 of the same: centres -10.1, -5.54, -1.26, 3.01 and 7.28 (the last at the
//     apse's start): bays of 4.28 m, NOT LIDAR's pinnacle reading of 4.8 (-10.0, -5.2, -0.35, 4.5, 9.3: up to 2 m out at
//     the east end);
//   * the APSE: five facets at 18, 54, 90, 126, 162 deg (fitted 17.6, 53, 89 - 91, 125, 161): HALF A DECAGON on the
//     walls' own half-width, its centre on the axis at u 7.53 (the junction), radius 5.70, facets 3.52 m, east face 12.95
//     (LIDAR 13.1); the apse's roof apex then sits at the centre (LIDAR read the ridge falling from u 7.8);
//   * the south-west corner: the west range's quad face (-16.15 on the survey) runs north to v -18.17, the TURRET's plinth
//     face stands there from the range face to u -15.10, then the PORCH's west splay runs from (-15.10, -18.80) in to the
//     steps; the steps (four lines, the threshold "FFL 65.02" at v -20.6) fill u -13.55 .. -11.50 from v -19.45 to -20.6
//     (the door is set in the wall's thickness); the east splay runs out to the first buttress (-10.65 .. -9.58, front
//     -18.17); a RAMP ("RAMP") is drawn as two lines at u -13.40 / -12.62 from the threshold out to v -17.6.
// So the turret is moved to (-15.65, -19.65) (its plinth's south face on the survey's -18.17 .. -18.2; LIDAR's crown
// (-15.25, -20.0) within 0.4) and the porch is re-planned on the survey: its gable 3.9 m wide (the photograph) centred on
// the steps (u -12.55), the doorway at the back of a deep splayed recess of three orders, four risers up to the door.
export const Y_SOUTH = 0.0;          // Front Quad path along the south side (LIDAR bare ground 64.35 - 64.55)
export const Y_NORTH = -0.45;        // Margary Quad along the north side (LIDAR 63.9 - 64.1)
export const FOOT = -0.9;            // every wall is carried down to here (below both grounds)

// ------------------------------------------------------------------------------------------------ plan
export const WALL_S = -19.75;        // south face (touch-up: THE WIDTH below; was -19.0)
export const WALL_N = -31.15;        // north face (touch-up: THE WIDTH below; was -31.9)
export const VC = -25.45;            // the axis, the ridge (LIDAR roof planes; kept)
export const HALF = 5.7;             // half the outside width over the walls (11.4 m: topographic survey 11.3, BGS 2018 11.5)
export const WEST = -16.6;           // west gable face
export const THICK = 1.0;            // the west gable's coping depth (G)
export const THICK_IN = 1.15;        // (interior pass) the walls to the room's inner face. K: BGS 2018 1:200 (1.22 thick, 9.09 inside)
export const GLASS_D = 0.45;         // (interior pass) the outer reveal of every window, now open (kind 'void')
export const GLASS_Z = 0.4;          // the stained glass's plane inside the face (behind the tracery's 0.12 .. 0.34)
// the apse: the same five facets at the same angles on a circle through the new wall lines (R sin 63.6 = HALF) whose east
// face stays at LIDAR's u 13.1 (cu + R cos 12.7): facets 2.80 m (were 3.17)
// (registration pass) half a decagon on the walls' half-width: centre (7.53, VC), radius 5.70, facets 3.52 m, east face
// 12.95. K: topographic survey (facets fitted at 17.6 / 53 / 90 / 125 / 161 deg; east face 12.95; LIDAR 13.1)
export const APSE = { cu: 7.53, cv: VC, R: HALF, angs: [90, 54, 18, -18, -54, -90] };   // degrees, from +u towards +v (south)
export const JUNCTION = 7.53;        // where the straight walls end and the apse begins (= cu; was 9.72)
export const apsePt = (deg, R = APSE.R) => { const a = (deg * Math.PI) / 180; return [APSE.cu + R * Math.cos(a), APSE.cv + R * Math.sin(a)]; };
/** the chapel's outer wall ring (no buttresses), clockwise from the south-west corner */
export const OUTLINE = [[WEST, WALL_S], [JUNCTION, WALL_S], ...APSE.angs.slice(1, 5).map((d) => apsePt(d)), [JUNCTION, WALL_N], [WEST, WALL_N]];
/** (interior pass) the room's inner outline: the walls THICK_IN in, the apse's inner corners on a circle of HALF - THICK_IN */
export const INNER_RING = [[WEST + THICK_IN, WALL_S - THICK_IN], [JUNCTION, WALL_S - THICK_IN], ...APSE.angs.slice(1, 5).map((d) => apsePt(d, HALF - THICK_IN)), [JUNCTION, WALL_N + THICK_IN], [WEST + THICK_IN, WALL_N + THICK_IN]];

// bays (u): buttress centres and window centres
export const BUTTRESS_U = [-10.1, -5.54, -1.26, 3.01];              // the four on each side west of the junction. K: topographic survey (south; north within 0.2)
export const WINDOW_U = [-7.82, -3.4, 0.875, 5.27];                  // the four three-light windows each side, midway between the buttresses (the last between 3.01 and the junction)
export const ROSE_U = -12.55;                                        // the west bay's rose, over the porch's doorway (survey: the steps' middle)

// ------------------------------------------------------------------------------------------------ levels (photo solve, mean of two cameras)
export const PLINTH = 1.2;           // base course top (photo 1.36 / 1.14)
export const SILL_STRING = 4.8;      // string under the windows (4.81 / 4.77)
export const WIN = { w: 2.75, sill: 5.0, spring: 10.1, apex: 13.8, d: 0.45 };   // 3-light nave windows (glass 2.7 m wide on the photo; spring 10.0 / 10.18; apex 13.68 / 13.97)
export const APSE_WIN = { w: 1.85, sill: 5.0, spring: 10.4, apex: 13.6, d: 0.4 };   // 2-light apse windows (G: width from a 3.17 m facet)
export const FRIEZE = [14.9, 15.5];  // carved frieze band (photo 14.91 / 15.23 its foot)
export const CORNICE = 15.8;         // cornice / corbel table top (15.92 / 16.27 - 0.3)
export const PARAPET = 16.4;         // pierced quatrefoil parapet top (LIDAR 16.1 - 16.4; photo 16.37 / 16.73)
export const ROOF_FOOT = 15.6;       // the slates' foot behind the parapet (G)
export const ROOF_INSET = 0.4;       // inside the wall face (just behind the parapet): gives slopes of 1.74 a metre against LIDAR's 1.77 / 1.69. K fit
export const RIDGE = 24.8;           // K: LIDAR plane fit 24.9, highest returns 24.0 - 25.0
export const APSE_APEX_U = 7.53;     // the apse's centre (survey); LIDAR's ridge starts falling at u 8 - 9
export const ROSE = { cy: 11.2, r: 1.38, w: 3.15, spring: 10.1, apex: 13.8, low: 8.4, transom: 9.8 };   // rose bay (photo centre 11.1 / 11.3, radius 1.35 - 1.4; lancets' foot 8.32 / 8.44)
// the porch (registration pass): gable 3.9 m wide (photo 130 px) centred on the survey's steps (u -12.55), from the first
// buttress's west side (-10.6) west to -14.5; its front on the survey's -18.15; the doorway at the back of a splayed recess
// of three pointed orders (the survey's splay: 4.5 m at the front to 2.05 m at the steps; the photographs: shafted orders)
// with the door in the wall's thickness at v -20.6 and its sill at FFL 65.02 (0.62); a filler between the turret and the
// porch's west side (the survey's outline: -15.10 at -18.17 .. -18.80). Levels: apex 9.08 / 9.23, arch apex 5.81, door
// top 3.82 / 3.73 (photo solve). K: plan (survey), form (photos); G: the orders' sizes.
export const PORCH = {
  u0: -14.5, u1: -10.6, front: -18.15, shoulder: 5.9, apex: 9.15,
  door: [0.62, 3.8, 1.95], doorV: -20.6,
  arch: { w: 2.6, spring: 3.8, apex: 5.8 },
  orders: [{ w: 3.3, apex: 6.1, to: 0.6 }, { w: 2.7, apex: 5.85, to: 1.2 }, { w: 2.05, apex: 5.55, to: 2.45 }],   // to: depth of each order's back from the front
  filler: { u0: -15.1, v1: -18.17 },
};
// the steps INSIDE the recess: four risers from the paving to the threshold (the survey's four lines from v -19.45 to the
// threshold at -20.6); the landing one going deep at the door. K count and place (survey), G going
export const STEP = { rise: 0.157, going: 0.27, n: 3, landing: 0.27 };
// the metal RAMP laid over the steps from the threshold out to v -17.6 on the west half of the doorway. K: survey ("RAMP",
// its lines at u -13.40 / -12.62); 02 NW corner photo sphere Jul 2016 (a chequer-plate ramp on the porch steps). G width 0.9
export const RAMP = { u: -13.005, w: 0.78, vFoot: -17.6, t: 0.06 };   // (interior pass) width = the survey's two lines (-13.40 / -12.62): the walk up the steps beside it is clear
export const NW_MASS = { u0: -16.6, u1: -13.5, v0: -31.9 };   // the solid north-west corner (BGS 2018: walling u -16.6 .. -14.5 to the Thomas Wood Building; carried to its quad face). K form, G figures
export const BUTTRESS = { w: 1.1, stages: [[PLINTH, 1.75], [SILL_STRING, 1.55], [7.9, 1.3], [11.4, 0.95]], apseStages: [[PLINTH, 1.3], [SILL_STRING, 1.15], [7.9, 1.0], [11.4, 0.75]], pier: 0.45, statue: [11.6, 13.7], canopy: [13.85, 14.9], pin: [14.9, 16.9, 18.4], pinW: 0.72 };   // width and foot projection K (survey: 1.07 wide, fronts at -18.0 / -32.9); the set-offs G   // set-off 7.87 / 7.97, statue corbel 11.57 / 11.81, pinnacle tip 18.11 / 18.5
export const TURRET = { u: -15.65, v: -19.65, R: 1.45, strings: [8.2, CORNICE], corbel: [18.3, 18.8], crownR: 1.65, crown: 20.3, cap: 21.1 };   // string 8.17 / 8.28, crown 18.64 / 19.04 .. 20.08 / 20.5; LIDAR top 19.0 - 19.7
export const WEST_GABLE = { coping: 0.45, win: { w: 2.0, sill: 16.5, spring: 20.0, apex: 21.6 }, oculus: [23.0, 0.4], roundels: [[-2.35, 19.0, 0.45], [2.35, 19.0, 0.45]], rose: { cy: 13.3, r: 1.6 }, cross: 1.3 };   // St Michael photo, 18.6 px a metre from the gable apex
// (interior pass) the stages re-proportioned on PHOTO_NOTES second pass (Acediscovery 2010, nearly square-on): of the
// height above the ridge to the vane's top (17.2: tip and vane kept where the photo solves put them), the lead base 0.12,
// the open stage 0.17, the gablets 0.19, the spire 0.45, the ball and vane the rest (0.07). The same note's "height about
// 3.7 x the base's width" would make it 10 m (or the base 4.6 m wide): it is not taken (a view from below shortens heights;
// the two camera solves agree on 16.2 - 17.2 to the tip, and the base's 2.6 - 2.8 m on the solved scale).
export const FLECHE = {
  u: -10.8, v: VC,
  base: { R: 1.4, y0: 21.0, y1: 26.86 },         // octagonal, lead in a lozenge lattice; above the ridge 2.06 = 0.12 (was 26.2)
  stage: { R: 1.3, y0: 26.86, y1: 29.58 },       // the open octagonal traceried stage; with its cornice 2.92 = 0.17 (was 26.2 - 28.9)
  cornice: 0.2,
  gablet: 3.27,                                  // gablets 29.78 - 33.05 = 0.19 (were 2.4)
  pinnacle: [29.78, 31.6, 33.4],                 // corner pinnacles, their tips just over the gablets'
  spire: { R: 0.92, y0: 29.78, tip: 40.8 },      // the spire: visible from the gablets' tips 33.05 to 40.8 = 7.75 = 0.45; base about 0.7 of the stage's width
  lucarne: 33.3,                                 // the lucarnes just above the gablets
  vane: 42.0,
};

// (interior pass) THE NORTH PROJECTION and the NORTH DOOR. The topographic survey (registered, LOCAL: lib.py rectL /
// cols / rows over u 1.5 .. 9.5, v -34.5 .. -30.5) draws a rectangle against the north wall from u 2.67 to 8.01 out to v
// -33.38 (the 2007 site plan's 4.7 x 2.0; Margary Quad's builder: u 2.75 .. 7.8, -33.45); LIDAR over it 69.1 - 71.0 (+4.7 ..
// +6.6, mixed with the wall's cells): a single-storey vestry, flat lead roof under the window sills (4.8). The steps of
// the 2016 paving plan climb west to a landing at 65.05 (u 2.75 .. 4.2: part 'margary'): the door in its north face over
// the landing. Inside, the moulded archway at the apse's start (part 'chapelint') leads into it (I).
export const NPROJ = { u0: 2.7, u1: 8.0, v: -33.4, roof: 4.4, parapet: 4.75, t: 0.35 };   // K outline (survey), G heights / form
export const NDOOR = { u: 3.5, w: 1.0, sill: 0.65, spring: 2.2, apex: 2.85, d: 0.3 };       // K: sill 65.05 (survey landing); G: centre (on the landing), size, the pointed head and hood
// THE BEDS between the south buttresses (04 "south face straight on" 2016; satellite by hand 2026-11-23): from the west,
// bay 1 a fan-trained bare-stemmed climber (rose) and a big-leaved shrub; bay 2 a green creeper to the sill string and a
// shrub; bay 3 a fan-trained plant and a laurel; bay 4 a creeper and shrubs. K: what grows where; G: kinds, sizes
export const BEDS = {
  faceV: -19.6, depth: 0.85, top: 4.5,
  bays: [[-9.55, -6.09], [-4.99, -1.81], [-0.71, 2.46], [3.56, 7.0]],
  wall: ['rose', 'creeper', 'rose', 'creeper'],
  plants: [['hosta'], ['box', 'laurel'], ['laurel'], ['laurel', 'box']],
};

export const CHECKED = [
  ['wall faces v -19.75 / -31.15, axis -25.45 (11.4 m over the walls; was 12.9)', 'K', 'topographic survey 1:500 (2021, 21/00354/FUL p20; scale checked on the lawn kerb 26.0 x 28.0): 11.3; BGS 2018 block plan 1:200 (18/00694/FUL; scale bar, length 29.2): 11.5; LIDAR fits 11.1 - 12.1 (working in the plan file)'],
  ['buttresses 1.1 wide, 1.75 m deep at the foot (fronts -18.0 / -32.9)', 'K', 'topographic survey 210239-P-10 fitted (1.07 wide; fronts -17.89 .. -18.01 south, -32.86 .. -32.93 north); BGS 15.2 - 15.5 over them; the set-offs\' projections above G'],
  ['buttresses at u -10.1, -5.54, -1.26, 3.01 and the apse\'s start 7.53 (bays 4.28 m; were -10.0, -5.2, -0.35, 4.5, 9.3)', 'K', 'topographic survey fitted (south sides measured; north within 0.2); LIDAR\'s pinnacle cells had read 4.8 m bays'],
  ['the survey registration: rigid fit to 31 wall lines, 18 within 0.21 m rms', 'K', 'working in exeter_grounds.js and this file\'s header'],
  ['north-west corner a solid mass between the north wall and the Thomas Wood Building (u -16.6 .. -13.5); no diagonal buttress', 'K', 'BGS 2018 block plan (walling u -16.6 .. -14.5); carried to the tower\'s quad face G'],
  ['paving strips where the old walls stood (Front Quad plane south, Margary Quad plane north, the apse slivers)', 'G', 'follows from moving the walls'],
  ['west gable face u -16.6, against the west range', 'K', 'LIDAR u profile at v -25.5 (+-0.6 m)'],
  ['apse: half a decagon, centre (7.53, -25.45), radius 5.70, facets 3.52 m, east face 12.95; straight walls to u 7.53 (was a five-facet apse on a 6.36 circle from 9.72)', 'K', 'topographic survey fitted (facets at 18 / 54 / 90 / 126 / 162 deg, east face 12.95); LIDAR east face 13.1; 5 apse windows: 04 chapel/interior photographs'],
  ['apse buttresses kept 1.3 m deep (the path round the apse to Palmer\'s Tower)', 'G', 'topographic survey shows them; depth not measured'],
  ['parapet 16.4, cornice 15.8, frieze 14.9 - 15.5', 'K', 'LIDAR parapet 16.1 - 16.4; south face straight on (exeter.ox.ac.uk 2016) solved as a camera'],
  ['ridge 24.8, roof foot 15.6 at 0.4 m inside the walls (60 deg, 1.74 a metre)', 'K', 'LIDAR roof-plane fit (24.9; slopes 1.77 / 1.69) and ridge returns; foot inset fitted'],
  ['apse roof: faceted half-cone, apex on the ridge at u 7.53 (the apse\'s centre)', 'K', 'survey plan; LIDAR ridge fall u 8 - 13; satellite by hand 2026-11-23 (hips meet at the ridge end)'],
  ['grey-green slate (a tint of the slate cell)', 'K', 'photographs; survey section 5'],
  ['1 west (rose) bay + 4 bays of 3-light windows each side, the windows midway between the buttresses', 'K', 'south face straight on; topographic survey (bays 4.28 m)'],
  ['window levels: sill 5.0, springing 10.1, apex 13.8, glass 2.75 m wide', 'K', 'south face straight on (camera solve): figures G within +-0.3'],
  ['window heads: three foiled circles (one large over two small) over three lights', 'K', 'upper part photograph (Acediscovery 2010); bar sizes G'],
  ['rose (6-petal wheel) over two short lancets in the west bay, centre 11.2, radius 1.38', 'K', 'upper part photograph; levels from the camera solve'],
  ['south porch: gabled, 3.9 m wide (u -14.5 .. -10.6), centred on the doorway at u -12.55, front at v -18.15, apex 9.15; a filler to the turret (u -15.1)', 'K', 'topographic survey fitted (steps -13.55 .. -11.50, front -18.15 .. -18.17, west outline -15.10); width: south face straight on (130 px); south porch doorway detail (M Knell 2005)'],
  ['porch doorway: three splayed pointed orders (3.3 / 2.7 / 2.05 m) back to the door in the wall\'s thickness at v -20.6; door 1.95 wide, sill 0.62 (FFL 65.02), top 3.8', 'K', 'topographic survey (the splay 4.5 -> 2.05 m, the threshold and FFL 65.02 at v -20.6); photographs (shafted orders); the orders\' sizes G'],
  ['four risers of 0.157 inside the recess (v -19.52 .. -20.33) and a landing at the door', 'K', 'topographic survey (four step lines from -19.45 to the threshold); goings 0.27 G'],
  ['metal ramp over the steps from the threshold out to v -17.6, 0.78 wide (u -13.39 .. -12.62)', 'K', 'topographic survey ("RAMP", two lines at u -13.40 / -12.62); 02 NW corner photo sphere Jul 2016; width and finish G'],
  ['porch statues (two) and the tympanum relief as plain blocks; IHS roundel as a blank disc', 'G', 'no likeness, no lettering'],
  ['stepped buttresses: set-offs at 1.2, 4.8, 7.9, 11.4; width 1.35, projection 2.0 / 1.75 / 1.45 / 1.05', 'G', 'proportions from the straight-on photograph; projection from LIDAR v -18'],
  ['a statue on a corbel under a canopy on every buttress at 11.6 - 13.7', 'K', 'upper part photograph (south side); plain draped figures (no likeness)'],
  ['crocketed gabled pinnacles from 14.9 to 18.4 on every buttress', 'K', 'photographs; tip 18.1 / 18.5 from the camera solve'],
  ['pierced quatrefoil parapet as a band of round piercings 0.6 m apart', 'K', 'photographs (the piercing\'s shape simplified: G)'],
  ['SW stair turret: octagon 2.9 m across centred (-15.65, -19.65) (was (-15.4, -19.9)), its west half in the west range\'s wall, strings 8.2 / 15.8, corbelled pierced crown 18.8 - 20.3', 'K', 'topographic survey (the plinth\'s south face -18.17 from the range face to u -15.10); LIDAR crown (-15.25, -20.0) +-0.5; camera solve; photographs'],
  ['turret: the lead cap inside the crown to 21.1 and the slit windows\' heights', 'G', 'not seen'],
  ['west gable: coped, cross; 2-light window 16.5 - 21.6 with a foiled circle; roundel at 23.0; two roundels at 19.0; west rose centre 13.3', 'K', 'west gable from St Michael Northgate tower (S Craven 2014); sizes G within +-0.3'],
  ['a plain lead ridge roll (no cresting: none shows on the photographs), an iron cross finial at the east end', 'K', 'south face straight on; upper part photograph; the finial\'s form G'],
  ['NORTH side as the south without the porch, the rose bay plain (behind the Thomas Wood Building)', 'G', 'no photograph (survey section 10, question 1); buttress rhythm read K off LIDAR v -32.9'],
  ['the apse from outside: buttresses with statues and pinnacles at every angle, 2-light windows', 'G', 'no photograph from the east; the south-west views show the first two angles'],
  ['fleche on the ridge at u -10.8', 'K', 'LIDAR highest return 28.7 at (-11 .. -10, -25); photographs'],
  ['fleche: octagonal lozenge-latticed lead base to 26.2, open traceried octagonal stage 26.2 - 28.9, gablets and corner pinnacles, lead spire with rolls, lucarnes, ball and vane', 'K', 'fleche close (The wub 2025); upper part photograph'],
  ['fleche stages re-proportioned: base to 26.86, open stage to 29.78, gablets to 33.05, spire to 40.8 (shares 0.12 / 0.17 / 0.19 / 0.45 of the height above the ridge)', 'K', 'PHOTO_NOTES second pass (Acediscovery 2010 square-on); the figures follow from the kept height (G); its "3.7 x the base\'s width" not taken (conflicts with two camera solves)'],
  ['fleche height: spire tip 40.8, vane 42.0 above the datum (17.2 m above the ridge)', 'G', 'two photographs solved (42.0 and 41.5) and the college map (39.8); working in the plan file'],
  ['fleche widths: base 2.6 m, spire base 1.7 m', 'G', 'photo widths at the solved scale'],
  ['windows open (real stained glass 0.4 inside the face, abstract blue and red panes); the interior is part chapelint', 'K', 'photographs (deep blue and red figurative glass); the pattern G by intent'],
  ['south door: two oak leaves (1.95 wide, sill +0.62, to +3.8) opening inwards into the antechapel', 'K', 'survey (threshold, FFL 65.02); 04 south face straight on (oak leaves); hinging G'],
  ['north projection u 2.7 .. 8.0 out to v -33.4, flat lead roof 4.4, parapet 4.75', 'K', 'topographic survey (fitted: 2.67 .. 8.01, -33.38); 2007 site plan; LIDAR 69.1 - 71.0; height and form G'],
  ['north door in the projection\'s north face: centre u 3.5, 1.0 wide, sill +0.65, pointed head to +2.85 under a hood, shut', 'G', 'sill K (survey landing 65.05); the steps K (part margary); place, size and form G'],
  ['planted beds between the south buttresses: roses / fan-trained climbers in bays 1 and 3, creeper in bays 2 and 4, shrubs', 'K', '04 south face straight on (2016); satellite by hand 2026-11-23; kinds G'],
];
