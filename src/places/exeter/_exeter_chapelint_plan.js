// Exeter College, STANDALONE model, part 'chapelint': THE PLAN of the CHAPEL'S INTERIOR (George Gilbert Scott 1856-9; the
// stalls Bodley 1884; the screen and organ gallery across the west bay). Pure data: every figure a named constant with its
// source; the build functions are in _exeter_chapelint_build.js. LOCAL frame (u east, v south, y above the datum 64.40 m).
// The shell (outer walls, glass, the porch door's leaves, the north projection) is part 'chapel' (_exeter_chapel_plan.js).
//
// SOURCES (looked at 2026-11-23; nothing copied, nothing used as a texture): reference/exeter/04 chapel/interior/
//   Diliff 2014 x3 (looking east from the west, from mid-choir; looking west to the organ), Diliff 2006 (the apse straight
//   on), M Hoser 2015, J Nyca 2012 (the apse from the north-west, the north archway), gilbertscott.org c2020 (from the
//   screen's gallery), R Sones 2012 (the organ, the rose), Lawrence OP c2007 (the altar steps, the sedilia), the photo
//   sphere of Jul 2016 (the screen's arch); reference/exeter/PHOTO_NOTES.md "Second pass (2026-11-23)"; survey 14.1 - 14.5;
//   the 1:500 topographic survey (FFL 65.02 at the south door) and the BGS 2018 block plan (walls 1.22 thick, 9.09 inside).
import { WALL_S, WALL_N, VC, WEST, JUNCTION, APSE, BUTTRESS_U, WINDOW_U, ROSE_U, WIN, APSE_WIN, ROSE, WEST_GABLE, PORCH } from './_exeter_chapel_plan.js';

const D2R = Math.PI / 180;
// ------------------------------------------------------------------------------------------------ the room
export const F = 0.62;                       // the floor: the survey's FFL 65.02 at the south door. K
export const T = 1.15;                       // wall thickness to the inner face. K: BGS 2018 1:200 (1.22; inside 9.09) G +-0.1
export const VS = WALL_S - T;                // -20.9: the south wall's inner face
export const VN = WALL_N + T;                // -30.0: the north wall's inner face (9.1 m inside: BGS 9.09). K
export const HW = (VS - VN) / 2;             // 4.55: half the inside width
export const UW = WEST + T;                  // -15.45: the west wall's inner face. G (the west wall taken as thick as the sides)
export const C = [APSE.cu, VC];              // the apse's centre (7.53, -25.45). K (survey)
export const RI = HW;                        // the apse's inner half-decagon: its corners on a 4.55 m circle (meets the side walls)
export const APO = RI * Math.cos(18 * D2R);  // 4.33: its facets' distance from the centre (walls 1.09 thick there)
export const TA = APSE.R * Math.cos(18 * D2R) - APO;      // 1.09: the apse wall's thickness
export const apseIn = (deg) => [C[0] + RI * Math.cos(deg * D2R), C[1] + RI * Math.sin(deg * D2R)];
export const ANGS = APSE.angs;               // 90, 54, 18, -18, -54, -90 (south round by the east to the north)
/** the room's inner outline (clockwise from the south-west corner), no doors */
export const INNER = [[UW, VS], [JUNCTION, VS], ...ANGS.slice(1, 5).map(apseIn), [JUNCTION, VN], [UW, VN]];

// ------------------------------------------------------------------------------------------------ the vault
// a stone RIB VAULT (ridge rib, tiercerons, bosses, webs banded cream and buff) "fifty feet high" (gilbertscott.org: 15.2 m)
// on clustered wall shafts with foliage capitals. Drawn as a pointed tunnel across the vessel with a pointed LUNETTE over
// every window bay (the webs = the higher of the two at each point: the groins are where they meet), the apse the same
// about its centre. K: form (every interior photograph); crown K (15.2 m from the floor); the springing and the lunettes' crowns
// G (judged from the windows: capitals at about the windows' springing, Diliff 2014 / Hoser 2015)
export const SPRING = 10.2;                  // the vault's springing (capitals). G (the windows spring at 10.1 outside)
export const CROWN = F + 15.2;               // 15.82: the crown. K ("fifty feet")
export const LUN = { nave: 14.6, west: 14.8, apse: 14.4 };   // the lunettes' crowns over the windows. G
/** the bay divisions (transverse ribs, wall shafts): the west wall, the buttresses (K survey), the apse's start */
export const DIV = [UW, ...BUTTRESS_U, JUNCTION];
export const RIB = { w: 0.17, d: 0.2, seg: 9 };              // the ribs' section. G
export const BOSS = 0.42;                                     // the bosses' size. G (photographs: about two ribs wide)
export const BAND = { cream: 0xeee2c4, buff: 0xe6d5b2 };      // the webs' bands: Bath stone and Temple Guiting stone, only slightly apart (Hoser 2015). K: gilbertscott.org; colours by eye G (the build's vaultA / vaultB)

// ------------------------------------------------------------------------------------------------ windows inside (rear arches)
// the outside's glass (part 'chapel') stands 0.4 inside the outer face; from it a splay to a wider, taller rear arch in the
// room's face, the sill sloping down into the room. K: photographs (deep splays, the glass set well back); G figures
export const REAR = { w: 3.4, sill: 4.75, spring: SPRING, apex: 14.25 };     // nave (glass: WIN 2.75, 5.0 / 10.1 / 13.8)
export const REAR_APSE = { w: 2.3, sill: 4.55, spring: 10.4, apex: 13.95 };   // apse (glass: APSE_WIN 1.85)
export const REAR_ROSE = { w: 3.7, sill: 8.1, spring: SPRING, apex: 14.35 };  // the west bay's south window (rose over two lancets)
export const REAR_WROSE = 1.95;              // the west wall's rose: its glass r 1.6 (WEST_GABLE.rose) splayed to this. G
export const GLASS_Z = 0.45;                 // the outer reveal's depth (the glass at 0.4: part 'chapel'). K (chapel plan WIN.d)
export { WINDOW_U, ROSE_U, WIN, APSE_WIN, ROSE, WEST_GABLE, PORCH, WEST, WALL_S, WALL_N, JUNCTION, VC };

// ------------------------------------------------------------------------------------------------ shafts
// clustered wall shafts at every bay division: a dark ringed marble shaft between two pale ones, foliage capitals at the
// springing; in the choir they stand on pale carved corbels just over the stalls' canopies (Diliff 2014 looking west: the
// white brackets), in the antechapel and the apse they come down to the floor / the arcade. K form; G sizes
export const SHAFT = { r: 0.12, r2: 0.075, off: 0.2, corbel: F + 4.25, rings: [F + 6.4, F + 8.2], cap: 0.55 };

// ------------------------------------------------------------------------------------------------ floors and the sanctuary
// one step up to the sanctuary's encaustic tiles, then two marble steps to a tiled landing, two more to the footpace and
// the altar (brief / Lawrence OP c2007 / gilbertscott.org: "steps of Devonshire marble", Alden 1903). K: count and order;
// G: the places and the rise (0.15)
export const SANCT = { step1: 3.3, tilesTo: 6.6, landing: [7.3, 8.6], footpace: 9.3, rise: 0.15, going: 0.35 };
export const AISLE = { half: 1.2, grille: 0.35, loz: 1.2 };  // the lozenge aisle 2.4 wide, iron grilles either side, lozenges 1.2. K form (Diliff 2014); G figures
export const ALTAR = { u0: 10.55, u1: 11.45, w: 2.3, h: 1.0 }; // the altar on the footpace, a plain frontal, two candlesticks. G sizes

// ------------------------------------------------------------------------------------------------ the stalls (Bodley 1884)
// each side: a back row of canopied stalls on a step under tall pierced pinnacled canopies (a plain painted shield on each
// back), then two rows of benches with desk fronts stepping down to the aisle. K: Diliff 2014 x2, the photo sphere; G sizes
export const STALLS = {
  u0: -9.75, u1: 2.95,       // from the screen's east face to the sanctuary step (the tapestry / the archway beyond). K order; G ends
  back: { d: 1.1, y: 0.25, seatH: 0.45, panel: 2.45, pitch: 0.79 },     // the back row: platform depth, its rise, the panelled back's top
  rows: [{ d: 0.85, y: 0.12 }, { d: 0.85, y: 0.0 }],                     // row 2 then row 1 (towards the aisle)
  desk: 0.95,                // desk top above its row's floor
  canopy: { y0: 2.45, hood: 3.15, top: F + 4.2 - F, proj: 0.55 },       // canopy from the back's top: the hood's front, the gables' tips (above F)
};

// ------------------------------------------------------------------------------------------------ the screen, gallery and organ
// a stone SCREEN across the vessel at the first bay division: a great moulded pointed arch with carved foliage on clustered
// dark red marble shafts, iron gates (standing open), painted tabernacles either side, a gallery on top with a pierced
// quatrefoil parapet and a big stone cross; the ORGAN on the gallery under three pointed arches (painted facade pipes
// behind an iron grille, a dark timber case); the west rose above. K: Diliff 2014 looking west, R Sones 2012, the photo
// sphere 2016; G: every figure
export const SCREEN = { u0: -10.75, u1: -10.05, top: F + 4.4, arch: { w: 2.3, spring: F + 2.75, apex: F + 3.95 }, parapet: F + 5.2, cross: F + 6.6, tab: { off: 2.45, w: 1.15, y0: F + 1.0, spring: F + 3.2, apex: F + 4.15 } };
export const GALLERY = { floor: F + 4.4, under: F + 4.1 };                         // the gallery over the antechapel: its floor, its underside
export const ORGAN = { u0: UW, u1: -13.55, impost: F + 5.5, pipesTop: F + 8.6, arches: { spring: F + 8.9, apex: F + 10.45 } };

// ------------------------------------------------------------------------------------------------ the apse
// under the windows a blind arcade of three trefoiled arches a facet: gold mosaic panels in the middle three facets (plain
// gold-ochre with a darker muted shape: no likeness), dark blue hangings in the two outer ones (the south one the sedilia,
// three seats on red marble shafts). K: Diliff 2006, Nyca 2012, Lawrence OP x2 (the sedilia's side is not stated: G south)
export const ARCADE = { base: F + 0.75, spring: F + 2.35, apex: F + 3.0, band: F + 3.75, sill: F + 3.9 };
// the moulded archway in the north wall at the apse's start (Nyca 2012, Diliff 2006) into the north projection (part
// 'chapel'): a deep pointed arch of three orders with a shut oak door. K: the archway; G: its size and where it leads
export const N_ARCH = { u: 6.0, w: 1.7, spring: F + 2.4, apex: F + 3.5, orders: 3 };   // (outer order 2.3 wide to +3.8: under the window's rear arch)
// the tapestry: south wall, the east end of the stalls, just west of the apse; a wooden frame with a carved cornice, its
// foot at desk height and its top at the canopies. A plain dark woven-looking hanging, NOT the real design. K place; G size
export const TAPESTRY = { u: 5.27, w: 3.0, y0: F + 1.0, y1: F + 3.95 };
// the ANTECHAPEL's floor and walls (2026-11-23, second pass): the choir aisle's cream lozenges in dark strips carried across
// its floor in a dark border; a blind arcade of pointed arches on dark shafts over a stone bench on the north and west
// walls, a plain marble tablet in each arch (blank: no names), tablets on the south wall's piers. K: a patterned floor and
// memorials in the antechapel (Diliff 2014 looking west, the photo sphere 2016); G: the arcade, the bench, every figure
export const ANTE = { border: 0.3, loz: 1.2, bench: 0.45, benchD: 0.4, spring: F + 1.95, apex: F + 2.6, tablet: [0.85, 1.6], north: 4, west: 8,
  southTablets: [[-13.82, 0.26, 1.4, 2.15], [-11.13, 0.45, 1.3, 2.3]] };
// the turret stair's door (G): a small pointed door in the antechapel's south-west corner
export const TURRET_DOOR = { u: -14.55, w: 0.8, h: 2.1 };

// ------------------------------------------------------------------------------------------------ lights
// brass candle chandeliers on long cords (about two a bay each side, over the benches) and brass branches on brackets in
// the sanctuary. K: Diliff 2014, Nyca 2012; G places
export const CHANDELIERS = { u: [-8.6, -6.5, -4.3, -2.3, -0.1, 2.0], off: 2.55, y: F + 3.5, arms: 6, r: 0.38 };
export const BRACKETS = [36, 0, -36].map((d) => d);         // on the apse's shafts (between facets), degrees. G
export const LECTERN = { u: -2.0 };                           // the brass eagle lectern in the aisle. K (Diliff 2014 mid-choir); G place

export const CHECKED = [
  ['floor at the south door\'s sill +0.62 (FFL 65.02) throughout the antechapel and choir', 'K', 'topographic survey 210239-P-10 ("FFL 65.02" at the threshold)'],
  ['walls 1.15 thick: inner faces v -20.9 / -30.0 (9.1 m inside), west inner face u -15.45; apse inner half-decagon on a 4.55 m circle', 'K', 'BGS 2018 block plan 1:200 (1.22 thick, 9.09 inside); the west wall\'s thickness G'],
  ['stone rib vault, crown 15.82 (15.2 m above the floor)', 'K', 'gilbertscott.org ("fifty feet high vaulting"); every interior photograph'],
  ['vault form: pointed tunnel with pointed lunettes over each window, transverse ribs, groin ribs, tiercerons to mid-bay bosses, ridge rib, wall ribs; springing 10.2, lunette crowns 14.4 - 14.8', 'G', 'form K (Diliff 2014 x3, Hoser 2015, gilbertscott.org); the geometry simplified and its figures judged from the windows'],
  ['the webs banded cream and buff', 'K', 'gilbertscott.org (Bath and Temple Guiting stone); photographs; band width G'],
  ['clustered wall shafts (a dark ringed marble shaft between two pale ones) with foliage capitals, on corbels over the stalls, to the floor in the antechapel and apse', 'K', 'Diliff 2014 looking west (the pale corbels), Diliff 2006, Nyca 2012; sizes G'],
  ['window splays to rear arches (nave 3.4 wide, apse 2.3) with sloping sills', 'G', 'photographs show deep splays; figures G'],
  ['stained glass: deep blue and red panes in a leaded pattern (abstract colour fields, no figures)', 'K', 'every interior photograph (Clayton and Bell: PHOTO_NOTES); the pattern G by intent'],
  ['the glass\'s leading irregular (pieces on a jittered lattice, each split at a slant), four designs taken in turn window by window, a medallion in each', 'G', '2026-11-23: a regular 12 px grid on every light read as a grid; M Hoser 2015 (figurative panels, red, white and gold as much as blue)'],
  ['the west bay is the antechapel, entered by the south porch door; a stone screen at u -10.75 .. -10.05', 'K', 'Diliff 2014 looking west, photo sphere 2016; PHOTO_NOTES (I: the door opens into it); the screen\'s place on the first bay division G'],
  ['the screen: moulded pointed arch 2.3 wide to +3.95 on clustered red marble shafts, iron gates open, two painted tabernacles, gallery parapet of pierced quatrefoils to +5.2, stone cross to +6.6', 'K', 'photo sphere 2016, Diliff 2014, R Sones 2012, gilbertscott.org (the cross); figures G'],
  ['the gallery over the antechapel (floor +4.4, underside +4.1); the antechapel\'s boarded ceiling', 'G', 'the gallery K (photographs); its depth and the ceiling not seen'],
  ['the organ on the gallery under three pointed arches: dark timber case, painted facade pipes behind an iron grille', 'K', 'R Sones 2012, Diliff 2014 looking west; sizes G'],
  ['the west wall\'s rose (six-foil wheel) seen from inside, glazed', 'K', 'R Sones 2012, Diliff 2014 (the rose over the organ)'],
  ['stalls: each side a canopied back row on a step (0.79 m stalls, shields on the backs: plain colours, no arms) and two benches with desk fronts, from the screen to u 2.95', 'K', 'Diliff 2014 x2, photo sphere (Bodley 1884: Alden 1903); sizes G'],
  ['brass candlesticks on the desks, cast-iron heating grilles along the aisle, brass eagle lectern in the aisle', 'K', 'Diliff 2014 mid-choir; the lectern\'s place G'],
  ['aisle of large cream lozenges framed by dark strips; the rest flagged', 'K', 'Diliff 2014 x2; lozenge size G'],
  ['sanctuary: one step to encaustic tiles with a cross panel, two marble steps to a landing, two more to the footpace; altar with a plain frontal and two candlesticks', 'K', 'Lawrence OP c2007, gilbertscott.org, Diliff 2006; places and rises G'],
  ['apse: blind arcade of three trefoiled arches a facet under the sills, gold mosaic panels (plain, no likeness) in the three middle facets, dark blue hangings in the outer two', 'K', 'Diliff 2006, Nyca 2012, Lawrence OP; the mosaics drawn plain by intent'],
  ['sedilia of three arches on red marble shafts in the south outer facet', 'G', 'Lawrence OP c2007 (the side not stated); brief'],
  ['the tapestry on the south wall at the east end of the stalls (3.0 wide, +1.0 .. +3.95) in a wooden frame with a cornice: a plain dark hanging', 'K', 'Diliff 2014 mid-choir, Diliff 2006; size G; NOT the real design'],
  ['the moulded archway in the north wall at the apse\'s start, a shut oak door in it, leading to the north projection (vestry)', 'K', 'Nyca 2012, Diliff 2006 (the archway); where it leads I (survey: the projection behind it); size G'],
  ['the turret stair\'s small door in the antechapel\'s south-west corner (shut)', 'G', 'not seen'],
  ['antechapel floor: the aisle\'s cream lozenges in dark strips across it, a dark border', 'G', 'K that it is patterned (Diliff 2014 looking west); the pattern carried from the aisle by guess'],
  ['antechapel walls: blind arcade over a stone bench (north, west), plain marble memorial tablets (blank) in the arches and on the south piers', 'G', 'memorials K (photo sphere 2016, Diliff 2014); the arcade\'s form, the bench and every figure guessed'],
  ['vault webs cream (Bath stone) with only slightly darker buff courses', 'K', 'M Hoser 2015, Diliff 2014 (was a strong brown band: 2026-11-23); the tint by eye G'],
  ['brass candle chandeliers on long cords, 6 a side over the benches at +3.5; brass branches on brackets in the apse', 'K', 'Diliff 2014, Nyca 2012; places and count G'],
];
