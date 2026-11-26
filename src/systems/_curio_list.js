// The forty curiosities (systems/curiosities.js): small things to stumble on round the city, placed by hand at real
// spots. Pure data (no imports), the same for every player; each player finds their own (localStorage, no network).
//
// fields: id, x, z (where it is), y (height of the prop / the thing looked at, default the ground), r (how close counts),
//   how: 'near' (walk / ride up to it) | 'use' (press E: label) | 'sit' (press E to sit: a line) | 'look' (within r and
//        the view pointed at it) | 'high' (in a climbable place: place id, or the camera at least minY up within r)
//   need: null | 'bike' (only from a bicycle) | 'boat' (only from a boat: rowing boat, punt or the steamer)
//   when: null | {night} | {clearNight} | {hours: [a, b]} | {rain} | {fog} | {cold} (frost or snow)
//   prop: what is drawn there (one merged draw for all of them, systems/curiosities.js), face: wall heading for wall props
//   text: the line shown when found (real people only as plain history), pay: £ reward
// The coordinates were checked against the collider (tools/smoke_todo.mjs: on dry, free ground or on a wall face, not in
// a carriageway; boat ones on open water). Real plaques sit where OpenStreetMap maps them (memorial POIs), snapped to the
// drawn wall face (tools/smoke_plaques.mjs); pier: [width, height] of a stone pier drawn behind one whose wall is not drawn.
export const CURIOS = [
  // ---- plaques: plain history (where the map has a memorial / plaque) -----------------------------------------------------
  { id: 'halley', x: 465.51, z: 55.65, y: 1.3, r: 3.5, how: 'near', prop: 'plaque', face: -0.091, pay: 1,
    text: 'A plaque: Edmond Halley (1656–1742), astronomer, lived here while he was Savilian Professor of Geometry. There is still a little observatory on the roof.' },
  { id: 'jane-burden', x: 460.21, z: 33.79, y: 2.6, r: 3.5, how: 'near', prop: 'plaque', face: -0.098, pay: 1,
    text: 'Down St Helen\'s Passage, a plaque: Jane Burden (1839–1914) was born near here. She married William Morris and sat for many of Rossetti\'s paintings.' },
  { id: 'beaumont', x: -187.2, z: -2.05, y: 1.3, r: 3.5, how: 'near', prop: 'plaque', face: 0.065, pier: [0.62, 1.95], pay: 1,
    text: 'A plaque on Beaumont Street: near here stood the King\'s Houses, Beaumont Palace, where Richard the Lionheart (1157) and King John (1166) were born.' },
  { id: 'morris-garage', x: 762.16, z: 51.98, y: 2.6, r: 3.5, how: 'near', prop: 'plaque', face: 2.291, pay: 1,
    text: 'A plaque on Longwall Street: in a garage here William Morris, later Lord Nuffield, built his first motor car in 1912–13. A city of bicycles, and it started here.' },
  { id: 'jewish-cemetery', x: 876.19, z: 390.18, y: 2.4, r: 3.5, how: 'near', prop: 'plaque', face: 2.625, pay: 1,
    text: 'A plaque by the Botanic Garden: this was the medieval Jewish cemetery of Oxford, until the Jews were expelled from England in 1290.' },
  { id: 'painted-room', x: 150.2, z: 296.0, y: 3.0, r: 3.5, how: 'near', prop: 'plaque', face: -1.291, pay: 1,
    text: 'Up the stairs at 3 Cornmarket: the Painted Room, wall paintings of about 1560 in what was a tavern. Shakespeare is said to have stayed here on his way to Stratford.' },
  { id: 'hodgkin', x: 350.89, z: -337.32, y: 2.6, r: 3.5, how: 'near', prop: 'plaque', face: 0.327, pay: 1,
    text: 'A plaque: Dorothy Crowfoot Hodgkin worked here. She won the Nobel Prize in Chemistry in 1964 for finding the shapes of molecules, penicillin and vitamin B12 among them.' },
  { id: 'alice', x: 267.79, z: 977.12, y: 1.7, r: 3.5, how: 'near', prop: 'plaque', face: 1.636, pay: 1,
    text: 'A plaque on the boat-hire kiosk: on 4 July 1862 Charles Dodgson rowed the three Liddell sisters upriver from Folly Bridge to Godstow, and on the way told the story that became "Alice\'s Adventures in Wonderland".' },
  { id: 'inklings', x: 43.09, z: -250.01, y: 2.6, r: 3.5, how: 'near', prop: 'plaque', face: -1.304, pay: 1,
    text: 'A plaque on St Giles\': C. S. Lewis, J. R. R. Tolkien and their friends, the Inklings, met in a pub along here on Tuesday mornings to read each other what they were writing.' },
  // ---- lanes and passages -----------------------------------------------------------------------------------------------
  { id: 'logic-lane', x: 611, z: 300, r: 4, how: 'near', prop: null, pay: 1,
    text: 'Logic Lane: a lane with a covered bridge over it, named, they say, after a school of logicians that stood here in the Middle Ages. Nobody has argued with it since.' },
  { id: 'turl', x: 285, z: 262, r: 4, how: 'near', prop: null, pay: 1,
    text: 'The Turl. Probably named after a "twirling gate", a turnstile in the old city wall at its north end. Now it is mostly bicycles.' },
  { id: 'martyrs-joke', x: 64, z: -20, r: 5, how: 'near', prop: null, when: { hours: [9, 18] }, pay: 1,
    text: 'A tour guide is telling a group that the Martyrs\' Memorial is the spire of an underground church. It isn\'t. They are all writing it down.' },
  // ---- creatures ---------------------------------------------------------------------------------------------------------
  { id: 'tortoise', x: 708, z: 112, r: 3, how: 'near', prop: 'tortoise', when: { hours: [9, 17] }, pay: 2,
    text: 'A tortoise on the lawn of New College garden, eating a dandelion with total concentration. He is probably older than the porter.' },
  { id: 'wall-cat', x: 619.62, z: 474.15, y: 6.9, r: 9, how: 'look', prop: 'cat', pay: 1,
    text: 'A black cat asleep on top of the old city wall above Dead Man\'s Walk. It opens one eye, decides you are not important, and closes it.' },
  { id: 'canal-heron', x: -712, z: -258, r: 9, how: 'near', prop: 'heron', when: { hours: [6, 11] }, pay: 2,
    text: 'A heron on the edge of the canal, perfectly still, pretending to be a post. A narrowboat goes by. It does not blink.' },
  { id: 'river-heron', x: 447, z: 1077, r: 22, how: 'near', need: 'boat', prop: 'heron', pay: 2,
    text: 'From the water: a heron on a post under the meadow\'s willows, watching the river go by with the expression of a disappointed tutor.' },
  { id: 'kingfisher', x: 823, z: 937, r: 14, how: 'near', need: 'boat', prop: null, pay: 2,
    text: 'A flash of blue under the bank of the Cherwell: a kingfisher, gone before you are sure you saw it. You saw it.' },
  { id: 'rain-frogs', x: 841, z: 528, r: 6, how: 'near', prop: null, when: { rain: true }, pay: 2,
    text: 'In the rain the lower Botanic Garden is full of tiny frogs crossing the path, very slowly, in no particular direction.' },
  { id: 'broadwalk-owl', x: 405, z: 650, r: 8, how: 'near', prop: null, when: { night: true }, pay: 2,
    text: 'Broad Walk at night: a tawny owl calls from the elms, then flies over the path without making a sound.' },
  // ---- high places, night, fog, the hour ------------------------------------------------------------------------------
  { id: 'carfax-roof', x: 127, z: 337, r: 8, how: 'high', place: 'cw_carfax_roof', prop: null, pay: 2,
    text: 'Scratched into the lead on top of Carfax, among the initials: "K.M. 1983 WAS ERE". Above the crossroads, a pigeon judges you.' },
  { id: 'stmary-gallery', x: 421, z: 233, r: 12, how: 'high', place: 'rad_tower', prop: null, pay: 2,
    text: 'From the gallery of St Mary\'s you can see straight into the college gardens you have been turned away from. They are, it turns out, mostly lawn.' },
  { id: 'mound-ball', x: 726, z: 118.5, r: 6, how: 'high', minY: 6, prop: null, pay: 2,
    text: 'From the top of the Mound: a croquet ball in the herbaceous border, where it has very probably been since about 1950.' },
  { id: 'midnight-square', x: 414, z: 199, r: 6, how: 'near', prop: null, when: { hours: [0, 1] }, pay: 2,
    text: 'You stand in the middle of Radcliffe Square at midnight, exactly as a student once told you to. Nothing happens. It was worth checking.' },
  { id: 'meadow-stars', x: -1030, z: -1100, r: 40, how: 'near', prop: null, when: { clearNight: true }, pay: 2,
    text: 'The sky over Port Meadow is darker than the city\'s: the Milky Way, faintly, over the horses.' },
  { id: 'tower-fog', x: 932, z: 386, r: 14, how: 'near', prop: null, when: { fog: true }, pay: 2,
    text: 'In the fog Magdalen Tower vanishes from the top down. You can hear the clock strike and see nothing at all of it.' },
  { id: 'matilda', x: -203, z: 318, r: 14, how: 'near', prop: null, when: { cold: true }, pay: 2,
    text: 'White frost on the Castle Mound. In 1142 the Empress Matilda escaped from the besieged castle across the frozen river, dressed in white. You can see how.' },
  // ---- benches: sit down for a line -----------------------------------------------------------------------------------
  { id: 'lyra-bench', x: 810, z: 564, r: 2.2, how: 'sit', label: 'Sit on the bench', prop: null, pay: 1,
    text: 'A bench at the back of the Botanic Garden. In a novel, two people from two different worlds promised to sit here once a year at the same time. Somebody has carved "L + W" into the arm.' },
  { id: 'river-bench', x: 559, z: 1160, r: 2.2, how: 'sit', label: 'Sit on the bench', prop: null, pay: 1,
    text: 'The best seat in Oxford for watching eight people go backwards very fast while a ninth shouts at them.' },
  { id: 'parks-bench', x: 1032, z: -297, r: 2.2, how: 'sit', label: 'Sit on the bench', prop: null, pay: 1,
    text: 'Along here was Parson\'s Pleasure: until 1991 a riverside spot where men bathed naked, and passing punts were expected to look the other way.' },
  { id: 'southpark-view', x: 2018, z: 306, r: 2.2, how: 'sit', label: 'Sit on the bench', prop: null, pay: 1,
    text: 'From the top of South Park: the spires over the trees, exactly as on a thousand postcards. It is annoyingly good.' },
  // ---- things ---------------------------------------------------------------------------------------------------------
  { id: 'geocache', x: 414, z: 653.2, r: 2.6, how: 'use', label: 'Look behind the bench', prop: 'tin', pay: 2,
    text: 'A tin behind the bench! Inside: a logbook signed by forty years of people with time on their hands, a plastic dinosaur and £2 left "for the next one". You sign the book.' },
  { id: 'rope-swing', x: 993.5, z: -493.3, r: 2.4, how: 'use', label: 'Have a go on the rope swing', prop: 'rope', pay: 2, swing: true,
    text: 'A rope swing over the Cherwell. Out over the water... and back. Your shoes stay dry. Mostly.' },
  { id: 'water-gate', x: 583.03, z: 484.61, r: 2.2, how: 'use', label: 'Try the little gate in the wall', prop: 'door', face: 0.262, when: { hours: [7, 9] }, pay: 2, locked: 'The little gate in the old wall is locked. A card in the keyhole says "Gardeners: mornings".',
    text: 'The little gate in the city wall stands open (for the gardeners, early): beyond it, Merton\'s Fellows\' Garden and a walk along the top of the wall. Somebody is pruning a rose and pretends not to see you.' },
  { id: 'pig-gargoyle', x: 528.97, z: 90.88, y: 16.7, face: -1.722, r: 26, how: 'look', prop: 'pig', pay: 2,
    text: 'Look up: among the carved heads on the gate tower, one is unmistakably a pig. Possibly a portrait of a former Bursar.' },
  { id: 'busker', x: 116, z: 238, r: 4, how: 'near', prop: 'busker', when: { hours: [10, 18] }, pay: 1,
    text: 'A busker on Cornmarket plays you a song he swears he wrote himself. You have heard it in every shop in England. He insists you take a pound from the hat "for the bus".' },
  { id: 'iron-man', x: 239, z: 89, y: 14, r: 34, how: 'look', prop: null, pay: 2,
    text: 'Look up: a cast-iron man stands on the edge of a college roof over Broad Street, looking down at you. A sculptor put him there in 2009 and he has not blinked since.' },
  { id: 'fox-box', x: 1503, z: 718, r: 3, how: 'near', prop: 'foxbox', pay: 1,
    text: 'Somebody has painted the street cabinet on the Cowley Road with a fox, which is also, now you look, wearing a scarf.' },
  { id: 'tree-bike', x: -672, z: 222, r: 3, how: 'near', prop: 'treebike', pay: 1,
    text: 'A bicycle locked to the station rack so long ago that a sapling has grown up through the back wheel. Nobody is going to move it now.' },
  { id: 'cobbles', x: 620, z: 386, r: 9, how: 'near', need: 'bike', prop: null, pay: 2,
    text: 'Merton Street on two wheels: the cobbles play your teeth like a xylophone. Nobody rides it twice on purpose.' },
  { id: 'meadow-bike', x: -960, z: -920, r: 45, how: 'near', need: 'bike', prop: null, pay: 2,
    text: 'Port Meadow on a bicycle: a mile of grass, horses, geese, and not one person to ring your bell at.' },
];
