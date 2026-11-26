// Exeter College, STANDALONE model: the list of part modules, in build order. A part is a file in this directory whose
// default export is
//   { id, title, replaces: [map building ids it builds by hand], build(ctx), CHECKED: [[what, 'K' | 'G', source], ...] }
// and build(ctx) draws into ctx.B (a Batch already in the college's LOCAL frame), registering what it must:
//   ctx.floor(ring, y | (u, v) => y)   a walking surface (LOCAL ring, y above the datum); later calls win
//   ctx.solid(ring)                    a collider round a LOCAL ring (walls people cannot walk through)
//   ctx.seg(u1, v1, u2, v2)            one collider segment
//   ctx.lamp(u, y, v)                  a lantern's light (night glow + pool)
//   ctx.pack, ctx.world, ctx.game, ctx.K (the kit), ctx.S (_exeter_shared.js), ctx.opts (the viewer's switches)
// A part that is not written yet is simply not listed: exeter_massing.js stands a plain LIDAR-height block on every
// mapped outline no listed part `replaces`, so the college is always whole.
export const PART_FILES = [
  'exeter_grounds.js',
  'exeter_west.js',
  'exeter_hall.js',
  'exeter_hallint.js',      // (the Hall's interior: after the hall, its floors win inside)
  'exeter_chapel.js',
  'exeter_chapelint.js',    // (the Chapel's interior: after the chapel, its floors win inside)
  'exeter_east.js',
  'exeter_rector.js',
  'exeter_margary.js',
  'exeter_broad.js',        // (after margary: the floor of its basement area wins over the quad's)
  'exeter_garden.js',
  'exeter_library.js',      // (after the garden: its thresholds' floors win over the garden's ground)
  'exeter_massing.js',
  'exeter_kitdemo.js',      // (demo: only with ?parts=grounds,kitdemo)
];
