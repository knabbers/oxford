// College life at the batch-5 sites (systems/college_life.js): visiting hours, the porter's lines, who crosses which
// quad when, evensong — pure data and functions of the hour / the shared clock, so every player gets the same porter
// mood, the same students on the same paths and the same service; nothing is sent.
//
// Hours are invented but plausible for c. 2013 (G): colleges let visitors in for a few afternoon hours and shut them
// out the rest of the day; the player is a Worcester student, so everywhere else they are a visitor. Real colleges'
// opening times varied by term and year; none of these are claims about a real timetable.
//
// Every spoken line here is an existing voiced crowd line (tools/voices/lines.json): no new lines, no new clips.

export const PORTER_IDLE = ['Can I help you?', 'Name and college?', 'Mind how you go.'];
export const TURN_AWAY = ['College is closed to visitors.', "Members only, I'm afraid.", "No card? Then I'm afraid the answer's still no.", "I've seen that face before. Still no."];
export const WELCOME = ['Enjoy your visit. Keep off the grass.', 'Can I help you?', 'Mind the grass.'];
export const CAUGHT = ['Excuse me! A quick word?', 'Hold on there, please.', "Now then, what's all this?"];
export const ESCORT = ['Lovely. Now, the exit is that way.', "I'll walk round with you, shall I.", 'Mind how you go.'];
export const GRASS = ['Off the grass, please.', 'Oi! OFF THE GRASS!', 'And STAY off it!', 'And let that be a lesson.'];
export const STUDENT_LINES = ['Has anyone seen my gown?', "My tutor said 'interesting'. Bad sign.", 'Three tutes this week. THREE.', 'Essay crisis mode: activated.', 'Library fine. Again.'];
export const DON_LINES = ['Fascinating. Utterly wrong, but fascinating.', 'Have you read the footnotes?', 'High Table awaits.', 'One more footnote...', 'Ah, a tutorial at nine. Splendid.', 'The Senior Common Room has the better port.'];
export const CHAPLAIN_LINES = ['O Lord, open thou our lips.', 'Let us pray.'];

/** the comic escalation for walking on the lawn (shown, not spoken): n = offences so far this game day */
export const GRASS_TOASTS = [
  'A porter appears from nowhere, the way they do. You are walked back to the path.',
  'The porter again. He gives you a leaflet about grass. It is mostly about grass.',
  'The porter writes something in a small black book. You suspect it is your name, spelt wrong.',
  'The porter sighs the sigh of a man who has seen four hundred years of this, and points at the path.',
  'At this point the porter is simply walking beside you, in case you try it again.',
];

/**
 * The colleges. Frames: each site's own quad frame (`_b5_*.js` Q / toQ). zone = the part closed to visitors outside
 * hours, as frame rects [u0, u1, v0, v1]; gate = the passage the porter stands in: box [u0, u1, v0, v1], the point just
 * outside it (where a visitor turned away ends up) and the heading facing out, the porter's spot [u, v, heading];
 * hours [open, close) for visitors; lawn: ellipse [cu, cv, ru, rv] or null; chapel [u, v] (evensong) or null;
 * routes: polylines [[u, v], ...] that students / dons walk (ping-pong), with outfit and lines.
 */
export const COLLEGES = [
  {
    id: 'nc', name: 'New College', frame: 'nc', hours: [11, 17],
    zone: [[-19.5, 31, -17, 21]],
    gate: { box: [-31.5, -19.5, 0.9, 4.9], out: [-33.5, 2.9], outH: null, porter: [-22.0, 0.6, 0], inward: [1, 0] },
    lawn: [6, 1, 17.5, 11.5], chapel: [1.7, -25.5],
    routes: [
      { pts: [[-17.5, 3], [-17.5, -15.2], [29, -15.2]], who: 'gown', lines: 'student', ofs: 0 },
      { pts: [[29, 19.5], [-17.5, 19.5], [-17.5, 5]], who: 'tweed', lines: 'don', ofs: 23 },
      { pts: [[29, -14], [29, 19], [10, 19.5]], who: 'gown', lines: 'student', ofs: 51 },
    ],
    sneak: 'the garden side: along the city wall from Holywell, or over the low wall by the cloister',
  },
  {
    id: 'mt', name: 'Merton College', frame: 'mt', hours: [14, 17],
    zone: [[18, 60, -10.2, 20], [-25, 60, 20, 52]],
    gate: { box: [22.2, 25.8, -17.6, -10.2], out: [24, -19.6], porter: [26.0, -11.4, 0], inward: [0, 1] },
    lawn: [44.5, 38.7, 8, 10], chapel: [0, 3],
    routes: [
      { pts: [[24, -8.5], [30, 6], [52, 14]], who: 'gown', lines: 'student', ofs: 7 },
      { pts: [[53, -8], [40, -8], [26, 12]], who: 'tweed', lines: 'don', ofs: 40 },
    ],
    sneak: 'from the meadow side, through the Fellows\' Garden',
  },
  {
    id: 'kb', name: 'Keble College', frame: 'kb', hours: [14, 17],
    zone: [[-31, 27.2, -26, 37]],
    gate: { box: [27.4, 41.8, 34.2, 38.0], out: [43.5, 36.1], porter: [29.6, 34.5, 0], inward: [-1, 0] },
    lawn: null, chapel: [15, -35.6],
    routes: [
      { pts: [[26.5, 34], [26.5, -24.5], [-29.5, -24.5]], who: 'gown', lines: 'student', ofs: 13 },
      { pts: [[-29.5, -24.5], [-29.5, 34], [24, 34]], who: 'tweed', lines: 'don', ofs: 61 },
    ],
    sneak: 'round the back, from Keble Road',
  },
  {
    id: 'un', name: 'the Oxford Union', frame: 'un', hours: [9, 23],
    zone: [[-16, 6, -19.6, 19.5]],
    gate: { box: [-6.8, -2.2, -22, -18.6], out: [-4.5, -23.2], porter: [-2.4, -18.8, 0], inward: [0, 1] },
    lawn: null, chapel: null,
    routes: [{ pts: [[-4.5, -18.5], [-4.5, -8], [5.2, -6.2]], who: 'gown', lines: 'student', ofs: 31 }],
    sneak: 'over the garden railing on St Michael\'s Street',
  },
];

/** visitors let in at this hour? */
export const isOpen = (c, hour) => hour >= c.hours[0] && hour < c.hours[1];
const fmt = (h) => `${Math.floor(h) % 12 || 12}${h % 1 ? ':' + String(Math.round((h % 1) * 60)).padStart(2, '0') : ''}${h >= 12 && h < 24 ? 'pm' : 'am'}`;
export const hoursText = (c) => `${fmt(c.hours[0])} to ${fmt(c.hours[1])}`;
/** in rect list R (frame coords)? */
export const inRects = (R, u, v) => { for (const r of R) if (u >= r[0] && u <= r[1] && v >= r[2] && v <= r[3]) return true; return false; };
export const inBox = (b, u, v) => u >= b[0] && u <= b[1] && v >= b[2] && v <= b[3];
export const onLawn = (L, u, v) => !!L && ((u - L[0]) / L[2]) ** 2 + ((v - L[1]) / L[3]) ** 2 < 1;
/** the nearest point just outside the lawn ellipse (to walk somebody back to the path) */
export function offLawn(L, u, v, out) {
  let du = (u - L[0]) / L[2], dv = (v - L[1]) / L[3]; const d = Math.hypot(du, dv) || 1; du /= d; dv /= d;
  out[0] = L[0] + du * (L[2] + 1.1); out[1] = L[1] + dv * (L[3] + 1.1); return out;
}

/** deterministic hash 0..1 */
export const h01 = (a, b = 0) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** a pick from a list, the same for everybody for (slot, salt) */
export const pick = (list, slot, salt = 0) => list[Math.floor(h01(slot, salt) * list.length) % list.length];

/** where a walker on route r is at shared time tMs: {u, v, h (frame heading: atan2(du, dv)), moving}; ping-pong at
 *  1.2 m/s with a 6 s pause at each end; quads are walked by day only (caller decides) */
export function walkerAt(r, tMs, out = {}) {
  const P = r.pts; let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  const v = 1.2, pause = 6, T = 2 * (L / v + pause);
  let t = ((tMs / 1000 + (r.ofs || 0)) % T + T) % T;
  let back = false;
  if (t >= T / 2) { back = true; t -= T / 2; }
  let s = Math.max(0, Math.min(L, (t - pause) * v)); out.moving = t > pause && s < L;
  if (back) s = L - s;
  let acc = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (s <= acc + l || i === P.length - 1) {
      const f = Math.max(0, Math.min(1, (s - acc) / (l || 1)));
      out.u = a[0] + (b[0] - a[0]) * f; out.v = a[1] + (b[1] - a[1]) * f;
      out.h = back ? Math.atan2(a[0] - b[0], a[1] - b[1]) : Math.atan2(b[0] - a[0], b[1] - a[1]);
      return out;
    }
    acc += l;
  }
  out.u = P[0][0]; out.v = P[0][1]; out.h = 0; return out;
}

/** evensong at the batch-5 chapels: daily 18:00-18:45 (G: as Christ Church's in this game) */
export const evensongNow = (hour) => hour >= 18 && hour < 18.75;
