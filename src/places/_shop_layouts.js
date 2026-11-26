// Supermarkets: interior floor plans (pure data). Local coordinates in metres; the street door is in the front wall at
// z = 0 and the shop extends towards -z. "Left as you enter" = -x.
// Fixture kinds (x,z = centre; axis = direction the run of shelving goes; face = which way its front faces along the
// other axis, +1/-1; len = length):
//   gondola  double-sided island shelving, cats [side facing -, side facing +]     wallshelf  single-sided, cat
//   chiller  open multideck fridge (style 'freezer' = upright glass-door freezer)   freezer    chest freezer, cat
//   till     staffed checkout desk along axis, cashier on `side`                    sco        self-checkout bank of n
//   kiosk    counter + cigarette/lottery gantry                                     news       newspaper stand
//   reduced  the yellow-sticker shelf                                               baskets, trolleys, mags, atm, lift
// Tesco Magdalen Street: ground floor + basement linked by an up/down escalator at the rear opposite aisle 3, and a lift
// by the magazines (AccessAble audit 2021). The basement is laid out beyond the escalator in plan (an interior is its own
// scene, so it doesn't need to sit under the ground floor); its contents are a guess.

const PI = Math.PI;
export const BASEMENT_Y = -4.5;
export const ESC = { x0: -0.3, x1: 2.3, zTop: -26, zBot: -34, mid: 1.0, speed: 0.55 };   // Tesco Magdalen escalator well

export const LAYOUTS = {
  tesco_magdalen: {
    rooms: [
      { x0: -6.5, x1: 6.5, z0: -26, z1: 0, y: 0, h: 3.4, front: { x: 0, w: 2.2 }, openN: [ESC.x0, ESC.x1] },
      { x0: -7, x1: 7, z0: -56, z1: -34, y: BASEMENT_Y, h: 3.3, openS: [ESC.x0, ESC.x1] },
    ],
    escalator: ESC,
    foyer: { x0: -1.6, x1: 1.6, z: -2.4 },            // two sets of automatic double doors (AccessAble)
    spawn: [0, -3.4], exit: [0, -0.9],
    lift: [{ x: -6.5, z: -17.2, y: 0, face: 1, to: 1 }, { x: -7, z: -38.5, y: BASEMENT_Y, face: 1, to: 0 }],
    fixtures: [
      { t: 'kiosk', x: -4.6, z: -1.6, len: 3.4, axis: 'x', face: -1 },
      { t: 'sco', x: -4.2, z: -4.4, n: 4, axis: 'x', face: 1 },
      { t: 'till', x: -5.0, z: -7.0, len: 2.4, axis: 'z', side: -1, id: 0 },
      { t: 'till', x: -2.6, z: -7.0, len: 2.4, axis: 'z', side: -1, id: 1, closed: true },
      { t: 'news', x: 2.9, z: -0.55, len: 1.6, axis: 'x', face: -1 },
      { t: 'chiller', x: 6.05, z: -5.5, len: 7, axis: 'z', face: -1, cat: 'mealdeal', header: 'MEAL DEAL £3' },
      { t: 'chiller', x: 6.05, z: -10.25, len: 2.5, axis: 'z', face: -1, cat: 'drinks' },
      { t: 'wallshelf', style: 'wood', x: 3.2, z: -4.3, len: 2.4, axis: 'x', face: 1, cat: 'bakery', h: 1.5 },
      { t: 'gondola', style: 'crate', x: 3.0, z: -7.6, len: 2.6, axis: 'x', cats: ['produce', 'produce'], h: 1.0 },
      { t: 'baskets', x: -1.2, z: -2.9 }, { t: 'baskets', x: 1.9, z: -3.3 },
      { t: 'gondola', x: -3.6, z: -16, len: 9, axis: 'z', cats: ['household', 'snacks'], aisle: 1 },
      { t: 'gondola', x: -0.6, z: -16, len: 9, axis: 'z', cats: ['snacks', 'dry'], aisle: 2 },
      { t: 'gondola', x: 2.4, z: -16, len: 9, axis: 'z', cats: ['dry', 'drinks'], aisle: 3 },
      { t: 'wallshelf', x: -6.25, z: -12.4, len: 2.8, axis: 'z', face: 1, cat: 'household' },
      { t: 'mags', x: -6.25, z: -15.2, len: 2.4, axis: 'z', face: 1 },
      { t: 'wallshelf', x: -6.25, z: -21.4, len: 4.6, axis: 'z', face: 1, cat: 'dry' },
      { t: 'chiller', x: 6.05, z: -16.5, len: 9, axis: 'z', face: -1, cat: 'dairy' },
      { t: 'chiller', x: -3.5, z: -25.6, len: 6, axis: 'x', face: 1, cat: 'mealdeal' },
      { t: 'chiller', x: 4.3, z: -25.6, len: 4, axis: 'x', face: 1, cat: 'dairy' },
      { t: 'reduced', x: 6.05, z: -22.6, len: 1.8, axis: 'z', face: -1 },
      // basement
      { t: 'gondola', x: -4.2, z: -44, len: 10, axis: 'z', cats: ['dry', 'dry'], aisle: 5, y: BASEMENT_Y },
      { t: 'gondola', x: -1.2, z: -44, len: 10, axis: 'z', cats: ['snacks', 'dry'], aisle: 6, y: BASEMENT_Y },
      { t: 'gondola', x: 1.8, z: -44, len: 10, axis: 'z', cats: ['snacks', 'alcohol'], aisle: 7, y: BASEMENT_Y },
      { t: 'gondola', x: 4.6, z: -44, len: 10, axis: 'z', cats: ['alcohol', 'alcohol'], aisle: 8, y: BASEMENT_Y },
      { t: 'wallshelf', x: 6.75, z: -44, len: 12, axis: 'z', face: -1, cat: 'alcohol', y: BASEMENT_Y },
      { t: 'wallshelf', x: -6.75, z: -46, len: 9, axis: 'z', face: 1, cat: 'dry', y: BASEMENT_Y },
      { t: 'freezer', x: -1.0, z: -52.0, len: 8, axis: 'x', cat: 'frozen', y: BASEMENT_Y },
      { t: 'chiller', style: 'freezer', x: 0, z: -55.6, len: 11, axis: 'x', face: 1, cat: 'frozen', y: BASEMENT_Y },
      { t: 'wallshelf', x: -4.5, z: -34.3, len: 4, axis: 'x', face: -1, cat: 'household', y: BASEMENT_Y },
    ],
    till: 0,
    queue: [[-4.4, -9.0], [-4.4, -9.8], [-4.4, -10.6], [-5.0, -11.5], [-5.0, -12.3], [-5.0, -13.1], [-5.0, -13.9], [-5.0, -14.7], [-5.0, -15.5]],
    guard: [2.6, -3.0, PI], assistant: [-1.6, -4.6, -PI / 2],      // (the guard stands beside the stack of baskets at (1.9, -3.3), not in it)
    shoppers: [[0.9, -16, 3.5], [3.5, -9, 2.5], [-2.0, -21, 2.5], [0.4, -44, 4, BASEMENT_Y], [3.2, -44, 3, BASEMENT_Y]],
    stackers: [[-2.1, -18, PI / 2], [3.2, -46, -PI / 2, BASEMENT_Y]],
    yellow: [4.6, -22.6],
    lights: [[0, 3.0, -6], [0, 3.0, -18], [0, BASEMENT_Y + 3.0, -45]],
  },

  sainsburys_magdalen: {
    rooms: [{ x0: -4, x1: 4, z0: -22, z1: 0, y: 0, h: 3.2, front: { x: -1, w: 1.8 } }],
    spawn: [-1, -2.2], exit: [-1, -0.9],
    fixtures: [
      { t: 'till', x: 2.6, z: -2.6, len: 2.0, axis: 'z', side: 1, id: 0 },
      { t: 'kiosk', x: 3.75, z: -2.6, len: 2.6, axis: 'z', face: -1, gantryOnly: true },
      { t: 'sco', x: -3.4, z: -3.6, n: 2, axis: 'z', face: 1 },
      { t: 'news', x: 1.0, z: -0.55, len: 1.2, axis: 'x', face: -1 },
      { t: 'baskets', x: 0.4, z: -2.8 },
      { t: 'chiller', x: -3.6, z: -9.0, len: 7, axis: 'z', face: 1, cat: 'mealdeal', header: 'MEAL DEAL £3' },
      { t: 'chiller', x: -3.6, z: -14.3, len: 3.6, axis: 'z', face: 1, cat: 'drinks' },
      { t: 'reduced', x: -3.6, z: -17.4, len: 1.6, axis: 'z', face: 1 },
      { t: 'chiller', x: 3.6, z: -9.0, len: 6, axis: 'z', face: -1, cat: 'dairy' },
      { t: 'chiller', style: 'freezer', x: 3.6, z: -14.5, len: 4, axis: 'z', face: -1, cat: 'frozen' },
      { t: 'wallshelf', x: 3.75, z: -18.8, len: 2.6, axis: 'z', face: -1, cat: 'household' },
      { t: 'gondola', x: 0, z: -12.5, len: 12, axis: 'z', cats: ['snacks', 'dry'], aisle: 1 },
      { t: 'wallshelf', x: -1.6, z: -21.75, len: 4.6, axis: 'x', face: 1, cat: 'alcohol' },
      { t: 'wallshelf', style: 'wood', x: 2.4, z: -21.75, len: 2.6, axis: 'x', face: 1, cat: 'bakery' },
    ],
    till: 0,
    queue: [[2.0, -4.2], [1.8, -5.0], [1.8, -5.8], [1.8, -6.6], [1.8, -7.4], [1.8, -8.2], [1.8, -9.0]],
    guard: [-2.4, -1.5, PI], assistant: [-2.2, -5.4, -PI / 2],
    shoppers: [[-1.8, -12, 3], [1.6, -16, 3], [0, -20, 2]],
    stackers: [[-1.5, -14, PI / 2]],
    yellow: [-2.4, -17.4],
    lights: [[0, 2.8, -5], [0, 2.8, -16]],
  },

  tesco_staldates: {
    rooms: [{ x0: -6, x1: 6, z0: -13, z1: 0, y: 0, h: 3.1, front: { x: 3.6, w: 1.8 } }],
    spawn: [3.6, -2.0], exit: [3.6, -0.9],
    noAlcohol: true,
    fixtures: [
      { t: 'till', x: -0.6, z: -2.7, len: 2.4, axis: 'x', side: -1, id: 0 },
      { t: 'kiosk', x: -0.6, z: -4.2, len: 3.0, axis: 'x', face: 1, gantryOnly: true },
      { t: 'sco', x: -4.4, z: -5.4, n: 3, axis: 'x', face: 1 },
      { t: 'news', x: 1.7, z: -0.55, len: 1.3, axis: 'x', face: -1 },
      { t: 'baskets', x: 5.2, z: -1.2 },
      { t: 'chiller', x: 5.55, z: -5.0, len: 6, axis: 'z', face: -1, cat: 'mealdeal', header: 'MEAL DEAL £3' },
      { t: 'chiller', x: 5.55, z: -10.5, len: 4.4, axis: 'z', face: -1, cat: 'drinks' },
      { t: 'gondola', x: -3.4, z: -9.6, len: 5, axis: 'z', cats: ['household', 'snacks'], aisle: 1 },
      { t: 'gondola', x: -0.4, z: -9.6, len: 5, axis: 'z', cats: ['dry', 'snacks'], aisle: 2 },
      { t: 'gondola', x: 2.6, z: -9.6, len: 5, axis: 'z', cats: ['bakery', 'dry'], aisle: 3 },
      { t: 'wallshelf', x: -5.75, z: -9.6, len: 5.5, axis: 'z', face: 1, cat: 'dry' },
      { t: 'chiller', x: -2.6, z: -12.6, len: 5.6, axis: 'x', face: 1, cat: 'dairy' },
      { t: 'reduced', x: 1.6, z: -12.6, len: 1.4, axis: 'x', face: 1 },
      { t: 'atm', x: 3.6, z: -12.8, face: 1 },
    ],
    till: 0,
    queue: [[-0.6, -1.7], [-1.6, -1.6], [-2.6, -1.6], [-3.6, -1.6], [-4.6, -1.8], [-5.2, -2.6]],
    guard: [2.4, -1.4, PI], assistant: [-3.0, -6.4, PI],
    shoppers: [[-1.9, -9, 3], [1.1, -9, 3], [4.0, -7, 2.5]],
    stackers: [[-1.9, -10, PI / 2]],
    yellow: [1.6, -11.4],
    lights: [[0, 2.7, -4], [0, 2.7, -10]],
  },

  sainsburys_westgate: {
    rooms: [{ x0: -11, x1: 11, z0: -30, z1: 0, y: 0, h: 3.6, front: { x: 0, w: 2.4 } }],
    spawn: [0, -2.2], exit: [0, -0.9],
    fixtures: [
      { t: 'sco', x: -6.6, z: -3.4, n: 6, axis: 'x', face: 1 },
      { t: 'till', x: 2.6, z: -5.2, len: 2.6, axis: 'z', side: -1, id: 0 },
      { t: 'till', x: 5.2, z: -5.2, len: 2.6, axis: 'z', side: -1, id: 1 },
      { t: 'till', x: 7.8, z: -5.2, len: 2.6, axis: 'z', side: -1, id: 2, closed: true },
      { t: 'kiosk', x: 8.6, z: -1.6, len: 3.6, axis: 'x', face: -1 },
      { t: 'news', x: -3.2, z: -0.55, len: 2.0, axis: 'x', face: -1 },
      { t: 'trolleys', x: 3.4, z: -1.0, n: 6 }, { t: 'baskets', x: -1.8, z: -2.4 },
      { t: 'gondola', style: 'crate', x: -6.5, z: -8.8, len: 4.5, axis: 'x', cats: ['produce', 'produce'], h: 1.0 },
      { t: 'gondola', style: 'crate', x: -1.2, z: -8.8, len: 3.5, axis: 'x', cats: ['produce', 'bakery'], h: 1.0 },
      { t: 'wallshelf', style: 'wood', x: -10.75, z: -9.5, len: 4, axis: 'z', face: 1, cat: 'bakery' },
      { t: 'wallshelf', x: -10.75, z: -18.5, len: 12, axis: 'z', face: 1, cat: 'dry' },
      { t: 'chiller', x: 10.55, z: -11.0, len: 6, axis: 'z', face: -1, cat: 'mealdeal', header: 'MEAL DEAL £3' },
      { t: 'chiller', x: 10.55, z: -16.0, len: 4, axis: 'z', face: -1, cat: 'drinks' },
      { t: 'wallshelf', x: 10.75, z: -21.5, len: 5, axis: 'z', face: -1, cat: 'alcohol' },
      { t: 'gondola', x: -7.5, z: -17.5, len: 11, axis: 'z', cats: ['dry', 'dry'], aisle: 1 },
      { t: 'gondola', x: -4.5, z: -17.5, len: 11, axis: 'z', cats: ['snacks', 'dry'], aisle: 2 },
      { t: 'gondola', x: -1.5, z: -17.5, len: 11, axis: 'z', cats: ['snacks', 'household'], aisle: 3 },
      { t: 'gondola', x: 1.5, z: -17.5, len: 11, axis: 'z', cats: ['household', 'dry'], aisle: 4 },
      { t: 'gondola', x: 4.5, z: -17.5, len: 11, axis: 'z', cats: ['drinks', 'alcohol'], aisle: 5 },
      { t: 'gondola', x: 7.5, z: -17.5, len: 11, axis: 'z', cats: ['alcohol', 'alcohol'], aisle: 6 },
      { t: 'freezer', x: -4.5, z: -26.4, len: 8, axis: 'x', cat: 'frozen' },
      { t: 'freezer', x: 5.0, z: -26.4, len: 6, axis: 'x', cat: 'frozen' },
      { t: 'chiller', x: -5.5, z: -29.55, len: 10, axis: 'x', face: 1, cat: 'dairy' },
      { t: 'chiller', x: 4.0, z: -29.55, len: 6, axis: 'x', face: 1, cat: 'mealdeal' },
      { t: 'reduced', x: 10.55, z: -26.6, len: 1.8, axis: 'z', face: -1 },
    ],
    till: 0,
    queue: [[3.2, -7.2], [3.2, -8.0], [3.2, -8.8], [3.2, -9.6], [3.0, -10.6], [3.0, -11.6], [3.0, -12.4], [3.0, -13.2], [3.0, -14.0]],
    guard: [1.8, -1.8, PI], assistant: [-3.0, -4.6, -PI / 2],
    shoppers: [[-6, -17, 4], [0, -17, 4], [6, -17, 4], [0, -25, 4]],
    stackers: [[-3.0, -15, PI / 2], [6.0, -20, -PI / 2]],
    yellow: [9.2, -26.6],
    lights: [[-5, 3.2, -10], [5, 3.2, -10], [0, 3.2, -22]],
  },
};

/** Floor height for a layout (Tesco Magdalen's escalator ramp; otherwise flat). */
export function groundFor(id) {
  if (id !== 'tesco_magdalen') return () => 0;
  const E = ESC;
  return (x, z) => {
    if (z > E.zTop) return 0;
    if (z < E.zBot) return BASEMENT_Y;
    return BASEMENT_Y * ((E.zTop - z) / (E.zTop - E.zBot));
  };
}

// ---------------------------------------------------------------------------------------------------- walk-in plans
// The layouts as WALK-IN rooms (core/interiors.js "seamless"; places/_walkin_city.js): each shop sits in place behind
// its mapped frontage, so its plan must be inside the real building. Three of the four fit as drawn (checked against the
// map outline by tools/smoke_walkin_city.mjs; Sainsbury's Local only has its entrance moved 2 m along its front wall so
// that the real frontage is in front of the room). The Westgate store does not: its entrance is at the end of the Church
// Lane recess, with the centre's own wall cutting diagonally across what was the back-left corner of the sales floor —
// so the floor is slid 7.5 m to the right of the entrance (the entrance is near the left end of the front wall, the
// self-checkouts move to where the old entrance was). Nothing else moves. Tesco Magdalen Street's lower floor is
// genuinely below ground (y = -4.5): it needs no outline (the ground hides it) and is reached down the real escalator.
/** how deep into a shop (z) the goods are still drawn while you are out in the street (the rest: only from near the door) */
export const DEEP_Z = -13;
const _sl = {};
export function slLayout(id) {
  if (_sl[id]) return _sl[id];
  const L = LAYOUTS[id]; if (!L) return null;
  if (id === 'sainsburys_magdalen') {
    // the entrance is 1 m right of centre, not left: the frontage (door, a pane to one side, two and the cash machine to
    // the other) then stands in front of the sales floor; the paper stand and the baskets change sides
    const N = { ...L, rooms: L.rooms.map((r) => ({ ...r, front: { ...r.front, x: 1 } })), fixtures: L.fixtures.map((f) => ({ ...f })) };
    N.spawn = [1, -2.2]; N.exit = [1, -0.9];
    for (const f of N.fixtures) { if (f.t === 'news') f.x = -1.4; else if (f.t === 'baskets') { f.x = -0.7; f.z = -2.9; } }
    return (_sl[id] = N);
  }
  if (id !== 'sainsburys_westgate') return (_sl[id] = L);
  const DX = -7.5, N = { ...L, rooms: L.rooms.map((r) => ({ ...r, front: r.front ? { ...r.front, x: DX, w: 2.2 } : r.front })), fixtures: L.fixtures.map((f) => ({ ...f })) };
  N.spawn = [DX, -2.2]; N.exit = [DX, -0.9];
  for (const f of N.fixtures) {
    if (f.t === 'sco') { f.x = -0.9; f.z = -3.4; }
    else if (f.t === 'baskets') { f.x = -9.9; f.z = -2.8; }
    else if (f.t === 'news') { f.x = -2.4; }
  }
  N.guard = [-5.4, -1.9, PI]; N.assistant = [-0.9, -4.7, PI];
  return (_sl[id] = N);
}
