// Somerville College, STANDALONE model: the list of part modules, in build order. A part is a file in this directory
// whose default export is
//   { id, title, replaces: [map building ids it builds by hand], build(ctx), CHECKED: [[what, 'K' | 'G', source], ...] }
// and build(ctx) draws into ctx.B (a Batch already in the college's LOCAL frame), registering what it must:
//   ctx.floor(ring, y | (u, v) => y)   a walking surface (LOCAL ring, y above the datum); later calls win
//   ctx.solid(ring)                    a collider round a LOCAL ring (walls people cannot walk through)
//   ctx.seg(u1, v1, u2, v2)            one collider segment
//   ctx.lamp(u, y, v)                  a lantern's light (night glow + pool)
//   ctx.pack, ctx.world, ctx.game, ctx.K (the kit), ctx.S (_somerville_shared.js: L2W, groundY, Y ...),
//   ctx.G (_somerville_ground.js: drape, strip, edgeDown), ctx.opts (the viewer's switches)
// A part that is not written yet is simply not listed: somerville_massing.js stands a plain LIDAR-height block on every
// mapped outline no listed part `replaces`, so the college is always whole.
// Every part is listed from the start; a file that does not exist yet is skipped quietly (somerville.js loadParts).
export const PART_FILES = [
  'somerville_grounds.js',
  'somerville_darbishire.js',
  'somerville_house.js',
  'somerville_hall.js',
  'somerville_library.js',
  'somerville_roq.js',
  'somerville_park.js',
  'somerville_wolfson.js',
  'somerville_penrose.js',
  'somerville_chapel.js',
  'somerville_vaughan.js',
  'somerville_hodgkin.js',
  'somerville_hughes.js',
  'somerville_massing.js',
];
