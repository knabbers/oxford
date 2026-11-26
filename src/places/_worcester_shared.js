// Coordinates shared by the Worcester College modules (metres; x east, z south; see docs/ARCHITECTURE.md).
// Derived from the OSM footprints; keep in sync if the architecture module moves anything.
export const WORC = {
  // Main block (east range: Chapel in the north wing, Hall in the south wing, Library over the loggia): OSM w69991341
  mainBlock: { id: 'w69991341', minX: -251.0, maxX: -220.4, minZ: -8.8, maxZ: 30.2 },
  lodgeGate: [-224.2, 8.6],          // street gate on Walton St / Beaumont St junction (front railings)
  lodgeDoor: [-236.3, 9.6],          // main entrance through the block (OSM entrance=main)
  loggiaWalk: [[-249.2, -0.6], [-248.1, 10.5], [-246.3, 30.1]],  // covered cloister walk on the quad side, runs N-S
  quadLawn: { minX: -300.3, maxX: -256.7, minZ: 1.2, maxZ: 31.4 }, // sunken lawn of Main Quad (path ring around it)
  // height of the terrace walks, the loggia floor and the gateway passage above the college's datum (WORC_LEVELS
  // below): the thickness of a paving stone. 2026-11-22 (the 2022 height survey; the owner: "the loggia is same level
  // as street and entrance to porters lodge and library"): street, forecourt, passage, loggia and the north terrace
  // walk are ONE level, and it is the quad that is sunk. It used to be 1.9 (the lawn was y = 0 and the loggia was
  // raised, with twelve steps inside the gateway passage that do not exist).
  terraceY: 0.05,
  terrace: ['w301621505', 'w301621506', 'w301621507', 'w301621508', 'w301621509', 'w301621510'], // Staircases 1-6, north side
  cottages: 'w93711479',             // medieval cottages, south side of the quad
  // The two garden passages (docs/research/worcester.md "Tunnel to the gardens"). EAST: through the Cottages and
  // Staircase 13 (OSM w1250775977 + w391914993), 2.2 m wide, 2.35 m to the crown of its vault.
  cottagesTunnel: [[-256.4, 31.2], [-255.4, 39.5], [-254.7, 46.0]],
  // WEST ("the tunnel" in the quad's south-west corner, OSM w130668914): under the Hanging Garden's mound at the far
  // end of the Cottages, 1.9 m wide, 2.3 m to the crown, about 11 m long; out by the Nuffield Lawn's garden path, the
  // way to the lake and the playing fields. Mouth (quad), middle, mouth (garden); at run time: game.worcester.tunnels.
  gardenTunnel: [[-298.0, 33.2], [-298.0, 38.9], [-297.9, 44.1]],
  hangingGarden: [[-300.6, 33.7], [-292.4, 33.6], [-292.3, 44.0], [-300.5, 44.1]],   // the mound's footprint
  // Pump Quad: small court south of the Hall, reached from the south end of the loggia walk
  pumpQuad: { minX: -246, maxX: -229, minZ: 30.2, maxZ: 40 },
  // Cellar Bar entrance: steps down beside the Hall's south wall, in Pump Quad. Door faces south.
  barDoor: { pos: [-238.0, 31.0], facing: 0 },
  // the pigeonhole room ("pidge room") door: on the Pump Quad front of Staircase 15 (OSM w301621503), west of the
  // staircase's own door, facing north into the quad. College LOCAL frame (u east, v south; see worcester.js): the
  // wall line there runs (13.28, 31.0) -> (19.26, 31.56); door centre u = 14.0. World position ≈ [-233.7, 39.9].
  pidgeDoor: { uv: [14.0, 31.067], along: [-0.9956, -0.0932] },
  // Worcester Place back gate ("gate 3"): vehicle gates + separate pedestrian door, facing east down Worcester Place
  backGate: { osmGate: [-364.1, -134.2], streetBend: [-358.6, -138.2] },
  pavilion: 'w154770764',            // cricket pavilion, centre about (-497, -31)
  earlBuilding: 'w69991346',         // centre about (-390, -164); croquet lawn is near/behind it
  lake: 'r1103089',
};

// ------------------------------------------------------------------------------------------------ levels
// THE COLLEGE'S LEVELS (2026-11-22; docs/research/worcester_survey.md section 2: Environment Agency LIDAR 2022).
// Inside the historic core the levels are BUILT (real geometry, real walking heights: places/worcester.js localGround):
// world y = 0 there is `datumOD`, the loggia floor. The drawn terrain (world/terrain.js) must be exactly constant at
// that level inside `flat`, so that nothing built there is lifted twice; every other Worcester module can turn a
// surveyed level into a height with yOf().
//   quad*: the Main Quad's floor (lawn and paths) is one plane falling west: quadE at local u = quadU0 (the lawn's
//          east edge), quadFall per metre of u.   pumpQuad: the court's gravel.   y values are metres above the datum.
// `flat` (world [x, z], clockwise from the north-west): the core's footprint with the forecourt, out to the gate
// screen and the street faces of the wings and of Pump Quad's ranges on the street side. On its WEST, SOUTH and NORTH sides the true ground outside is 1.5 to 2.9 m BELOW the
// datum (rose garden 58.1, Nuffield Lawn 58.7, Provost's Yard 58.25): until the terrain is in, the flat world stands
// too high there and worcester.js bridges it with temporary ramps in the two garden passages (`temporary` lists them).
// (2026-11-23: the terrain IS in — docs/research/worcester_survey.md D.11: the core is held rigid at this datum and the
//  gardens are brought to their levels at its walls by terrain precincts.)
const _C = Math.cos(0.0761), _S = Math.sin(0.0761), _l2w = (u, v) => [+(-250 + u * _C + v * _S).toFixed(2), +(10 - u * _S + v * _C).toFixed(2)];
export const WORC_LEVELS = {
  datumOD: 61.05,
  yOf: (mOD) => mOD - 61.05,
  quadE: -1.8, quadU0: -9.6, quadFall: 0.85 / 38.4,      // lawn: 59.25 mOD at its east edge, 58.40 at its west edge
  pumpQuad: -1.25,                                        // 59.8 mOD
  streetOD: { junction: 61.75, forecourt: 61.35, worcesterStAtPumpQuad: 61.1 },
  lowOD: { roseGarden: 58.1, pathSouthOfCottages: 58.7, provostsYard: 58.25, kitchenYard: 59.6 },
  flat: [[-53, -30], [29, -30], [29, 40], [14, 40], [14, 54], [-2.5, 54], [-2.5, 36.5], [-53, 36.5]].map(([u, v]) => _l2w(u, v)),      // (with Staircases 13 - 16, which stand on Pump Quad's court)
  // (2026-11-23: the drawn terrain is in. What is still a stand-in, and where it ends: places/_worcester_rim.js `rimDropped`)
  temporary: ['the two garden passages run level at their surveyed levels only where the drawn ground outside their mouths has dropped (the terrain\'s rim precincts); where it still stands at the datum they climb as before: _worcester_rim.js rimDropped', 'until those precincts are in, the rose garden stands on a bank behind the quad\'s west wall and the Cottages\' garden side is buried'],
};

// ------------------------------------------------------------------------------------------------ the main block's plan
// THE MAIN BLOCK AS IT IS (2026-11-22, second pass; docs/research/worcester_survey.md Appendix D.8). College LOCAL frame
// (u east, v south; places/worcester.js). Every Worcester module that stands in or against the block reads this table:
// the exterior (worcester.js), the Hall and Chapel (_worcint_hall_plan.js), the Lodge (_worcint_lodge_plan.js), the
// Library and its stair (_worcint_library_plan.js), the Cellar Bar under the Hall (_bar_plan.js).
// Sources: the 1939 RCHM plan, scaled so that the Hall is 17.9 m long (the college's venue plan: 17.9 x 9.0 m; "the
// Chapel has exactly the same dimensions"); the 2014 photograph of the quad front taken square on; LIDAR 2022 (roof
// edges: 26.7 - 27.2 m east-west x 37.0 m north-south from cornice to cornice); the satellite view. The mapped outline
// (27.9 x 37.2 m), which the block was built to before, is the cornice line and more: the walls are 26.0 x 35.8 m.
// The street faces stay where the map has them (u 28.0); the quad face is therefore 1.8 m east of where it was drawn
// (the 1939 plan: flush with the Terrace's east end, which the map has at u 2.3); the gate axis is at v 1.2 (the map's
// outline has 1.75, its own entrance node 0.64, LIDAR 0.6 - 1.2).
export const WORC_BLOCK = (() => {
  const r = (x) => +x.toFixed(4);
  const uW = 2.0, uE = 28.0, axis = 1.2;
  const PIER = 1.0, LOGGIA = 4.9, BACK = 1.0, ROOM_L = 17.9, ROOM_W = 9.0, WING = 11.05, COURT = 13.7;
  const uA = r(uW + PIER), uB = r(uA + LOGGIA), uR = r(uB + BACK), uRe = r(uR + ROOM_L);
  const vCs = r(axis - COURT / 2), vHn = r(axis + COURT / 2), vN = r(vCs - WING), vS = r(vHn + WING), ww = r((WING - ROOM_W) / 2);
  // the arcade: nine round arches in three groups of three; broad piers (3 m) between the groups, corner piers 1.83 m;
  // the middle group breaks forward a little under the pediment. Arch centres from the axis (1939 plan, pixel runs;
  // the 2014 photograph): 0, +-3.3, +-8.37, +-11.715, +-15.06; openings 2.06 m, springing 2.85 m, crown 3.88 m.
  const archV = [-15.06, -11.715, -8.37, -3.3, 0, 3.3, 8.37, 11.715, 15.06].map((d) => r(axis + d));
  return {
    uW, uE, vN, vS, axis, L: r(vS - vN),
    pier: PIER, uA, uB, uR, uRe,                    // arcade inner face, the loggia's back wall (west face), the rooms' west wall face, their east wall face
    loggia: LOGGIA, back: BACK, eastWall: r(uE - uRe), wingWall: ww,
    vCs, vHn,                                       // the forecourt's sides: the Chapel wing's south face, the Hall wing's north face
    uC: 14.2,                                       // the recessed centre's street face (forecourt 13.8 m deep: the 1939 plan has each wing's westmost window hard in the corner)
    court: COURT, wing: WING,
    room: { L: ROOM_L, W: ROOM_W },
    chapel: { v0: r(vN + ww), v1: r(vCs - ww), vc: r((vN + vCs) / 2) },      // the room's north and south wall faces, its centre line
    hall: { v0: r(vHn + ww), v1: r(vS - ww), vc: r((vHn + vS) / 2) },
    // the rooms' floors stand a little above the loggia's (the college: reached "via ramp or stairs"; timber-railed
    // ramps along the loggia's back wall in its photograph). The rise is a GUESS.
    roomRise: 0.3,
    // doors in the loggia's back wall: the Chapel's and the Hall's (1939 plan: each 0.6 m nearer the gate than its
    // room's centre line), round-headed
    doorV: { chapel: r(axis - 11.75), hall: r(axis + 11.75) }, door: { w: 1.5, spring: 2.2 },
    arcade: { v: archV, w: 2.06, spring: 2.85, breakV: [r(axis - 6.6), r(axis + 6.6)], breakOut: 0.15, cornerPier: 1.83 },
    // heights above the datum (the street = the loggia floor): the loggia's groin vault, the string course over the
    // arcade, the Library's windows (six square-headed, the middle three round-headed), the cornice (base, top), the
    // quad pediment's apex. From the 2014 photograph (25.1 px to the metre over the 35.8 m front); LIDAR: cornice 13.1.
    y: { vault: 4.6, string: [5.5, 5.8], libSill: 6.0, libHead: 9.3, libArch: { w: 2.2, spring: 10.2 }, libW: 1.5, hood: 9.85, cornice: 12.1, corniceTop: 12.9, apexW: 15.65 },
    // the gate hall (a vaulted room through the centre, doors at both ends): v axis +- 1.7, between the loggia's back
    // wall and the street front's wall (1 m)
    gate: { v0: r(axis - 1.7), v1: r(axis + 1.7), u0: uR, u1: 13.2, wDoor: { w: 2.0, spring: 2.6 }, eDoor: { w: 1.7, spring: 2.85 }, vault: 4.6 },
    // the street front's recessed centre: THREE bays (4.57 m), three storeys. Ground: the doorway between two
    // round-headed windows (north: the Lodge's; south: the Library stair's); a band at 5.9 m; first floor tall sashes;
    // second floor square sashes; the cornice level with the wings'. Heights from the two 2025 photographs.
    east: { bays: [r(axis - 4.57), axis, r(axis + 4.57)], gw: { w: 1.3, sill: 1.3, spring: 3.0 }, band: 5.9, f1: { w: 1.25, y0: 6.2, y1: 9.3 }, f2: { w: 1.25, y0: 10.2, y1: 11.35 } },
    // the wings' street ends: one Venetian window each, 4.0 m between the outer jambs inside (venue plan); the wings'
    // forecourt sides: three windows 1.7 m wide at 3.65 / 7.6 / 11.6 m from the rooms' east wall (venue plan), three
    // small square ones above them. Heights above the datum, from the 2025 photograph of the street front.
    venetian: { cw: 1.3, sideIn: 0.95, sideOut: 2.0, sill: 3.8, sideTop: 6.45, spring: 6.9 },
    side: { fromEast: [3.65, 7.6, 11.6], w: 1.7, y0: 3.8, y1: 7.4, attic: { w: 1.25, y0: 9.9, y1: 11.1 } },
    // the Library stair's drum, south of the gate hall (1939 plan: 4.6 m across, against the Hall wing's wall)
    drum: { u: 11.5, v: r(axis + 1.7 + 0.25 + 2.3), r: 2.3 },      // (u 11.5: its east side leaves 0.15 m of wall inside the street front's window glazing)
    // the loggia's south end: a round arch over Pump Quad, centred on the loggia's width (width a GUESS: the 1939 plan
    // draws 3.3 m, the photographs show an arch like the arcade's); the gate screen on the street (0.45 m behind the
    // wings' faces)
    southArch: { u: r((uA + uB) / 2), w: 2.4, spring: 1.9 }, screenU: r(uE - 0.45),
    // the Lodge: the room north of the gate hall (1939 plan: 4.3 x 4.5 m)
    lodge: { u0: uR, u1: 13.2, v0: r(vCs + 0.2), v1: r(axis - 1.7 - 0.45), doorU: 11.1 },
  };
})();

// ------------------------------------------------------------------------------------------------ the Terrace's plan
// THE TERRACE (the New North Range, Staircases 2 - 6) AS IT IS (2026-11-22, second pass; survey B03, Appendix D.10).
// College LOCAL frame. Read by the exterior (worcester.js / _worcester_terrace.js), Staircase 5 and "your room"
// (_worcint_lodge_plan.js STAIR), the yard behind it (worcester_yard.js: the veranda stands against vN).
// 19 bays (8 + 3 + 8) in 54.0 m (list description; the 2014 photograph); 9.5 m deep, not the map's 11.4 (1939 plan:
// 178 x 31 ft; LIDAR roof edges 10.5 - 11.0 m from cornice to cornice); its south face 2.4 m north of the main block's
// north face (1939 plan; LIDAR -18.9 .. -19.2): 1.2 m north of where the map has it. Heights above its walk (the datum):
// the 2014 photograph at 28.9 px to the metre, checked against LIDAR (eaves 12.1, ridge 15.0).
export const WORC_TERRACE = (() => {
  // DEPTH 10.2 m (2026-11-22, re-measured for the rebuild by two helpers independently: the 1939 plan gives 10.2 - 10.45 m
  // between the faces; LIDAR's eaves averaged over 104 stations are at v -18.3 and -29.68 = walls 10.2 - 10.3 m apart
  // with a cornice of about 0.55 m; the Lodgings' length puts the north face at -29.4). It was 9.5 here ("178 x 31 ft"
  // read as the walls': it is nearer the roof's). THE BAYS ARE NOT EQUAL and the heights below are 1.2 % high: the
  // true bay centres and heights are in places/_worcester_terrace_plan.js `TERR` (this table keeps the outline).
  const u0 = -51.7, u1 = 2.3, n = 19, vS = +(WORC_BLOCK.vN - 2.4).toFixed(4), depth = 10.2;
  return {
    u0, u1, vS, vN: +(vS - depth).toFixed(4), n, bay: (u1 - u0) / n, depth,
    centre: [8, 9, 10], breakOut: 0.25,                 // the three bays under the pediment (0-based from the west) stand forward
    // doorways: open round arches with a lantern beside each. Bays (0-based from the west) 2, 7, 13, 18 = Staircases
    // 6, 5, 4, 3 (1939 plan: stairs at bays 3, 8, 14, 19; the 2014 photograph shows the two either side of the centre);
    // Staircase 6's is the way through to Provost's Yard (the college's map: "access route north")
    doors: { 2: '6', 7: '5', 13: '4', 18: '3' }, through: 2,
    y: {
      arch: { w: 1.9, spring: 2.55, sill: 0.35 },       // the ground floor's rusticated arcade: round arches (crown 3.5) holding round-headed sashes
      gw: { w: 1.15, sill: 1.2, spring: 2.9 },
      band: [4.8, 5.05],                                // the band over the ground storey
      f1: { w: 1.07, y0: 5.15, y1: 7.25 },              // first floor (the centre three under cornices on consoles)
      f2: { w: 1.07, y0: 8.7, y1: 10.75 },              // second floor, each over an apron panel (8.0 .. 8.6)
      cornice: 11.6, corniceTop: 12.2, apex: 14.35, ridge: 15.0, dormer: [12.6, 13.7],
    },
  };
})();
