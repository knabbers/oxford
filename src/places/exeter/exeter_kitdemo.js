// Exeter College, STANDALONE model: a DEMONSTRATION of the kit (not part of the college; built only when asked for:
// viewer ?parts=grounds,kitdemo, tools/exeter_smoke.mjs --parts grounds,kitdemo). One little gabled building on the
// Front Quad's lawn using every helper once, so a change to the kit can be looked at and a builder can see how each
// helper is called. Nothing here is a statement about any real building.
export const CHECKED = [['kit demonstration: not a real building', 'G', 'none']];

export default {
  id: 'kitdemo', title: 'kit demonstration', demo: true, replaces: [], CHECKED,
  build(ctx) {
    const { B, K } = ctx, { frame, wall, rectPts, tudorPts, pointedPts } = K;
    const u0 = -8, u1 = 6, v0 = -5, v1 = 3, H = 7.2;      // a block 14 x 8 m, eaves 7.2
    // SOUTH wall (faces +v): s runs east from u0
    wall(B, frame(u0, 0, v1, 1, 0), rectPts(0, -0.4, u1 - u0, H), [
      { pts: tudorPts(2.2, 1.3, 0, 1.75, 0.35), kind: 'door', doorKey: 'oakDoor', d: 0.35, label: true },
      { pts: rectPts(4.6, 1.2, 7.0, 2.9), kind: 'win', lights: 3, label: true },
      { pts: rectPts(9.0, 1.2, 12.6, 3.3), kind: 'win', lights: 4, transoms: [2.35], label: true },
      { pts: rectPts(4.6, 4.4, 7.0, 6.0), kind: 'win', lights: 3, label: true },
      { pts: pointedPts(10.8, 2.4, 4.2, 5.6, 1.3), kind: 'win', lights: 3, d: 0.4 },
    ], 'bath');
    // NORTH wall (faces -v): s runs west from u1
    wall(B, frame(u1, 0, v0, -1, 0), rectPts(0, -0.4, u1 - u0, H), [{ pts: rectPts(3, 1.1, 4.2, 2.9), kind: 'win', glass: 'sash' }, { pts: rectPts(8, 1.1, 9.2, 2.9), kind: 'win', glass: 'sash' }], 'bathOld');
    // EAST wall (faces +u): s runs north from v1; WEST wall (faces -u): s runs south from v0
    wall(B, frame(u1, 0, v1, 0, -1), rectPts(0, -0.4, v1 - v0, H), [], 'bath');
    wall(B, frame(u0, 0, v0, 0, 1), rectPts(0, -0.4, v1 - v0, H), [], 'bath');
    B.push(frame(u0, 0, v1, 1, 0)); K.stringCourse(B, 'bathDress', 0, u1 - u0, 3.75); K.buttress(B, 'bathDress', 8.0, -0.4, 0.7, [[2.6, 0.75], [5.2, 0.45], [6.6, 0.2]]); B.pop();
    K.roof(B, 'slate', u0, u1, v0, v1, H, 3.4, { ends: ['gable', 'hip'], wallKey: 'bath' });
    K.parapet(B, 'bathDress', [[u0, v1 + 0.15], [u1, v1 + 0.15]], H - 0.1, 0.5, 0.3, { battle: { merlon: 0.8, gap: 0.55, h: 0.5 } });
    K.chimney(B, 'bath', -2, -0.8, -1.6, -0.9, H + 2.0, H + 5.0, { pots: 2 });
    K.pinnacle(B, 'bathDress', u0, v1, H + 0.4, H + 1.6, 0.45, 1.2);
    K.dormer(B, frame(u0 + 4, 0, v1 - 1.2, 1, 0), 1.5, H + 0.75, 1.3, 1.1, 1.6, { lights: 2 });
    K.steps(B, 'pavingSolid', u0 + 1.3, u0 + 3.1, v1, 1, 3, 0.15, 0.32, 0.45, -0.1);
    ctx.lamp(...((p) => [p[0], p[1], p[2]])(K.lantern(B, u0 + 3.6, 2.5, v1 + 0.25)));
    ctx.lamp(...K.lampPost(B, 9, 6, 0.05)); K.bench(B, 9, 2, 0.05, Math.PI / 2); K.tree(B, -11, 8, 0.05, 9, 3.2, 3);
    K.prism(B, 'bath', [[8, -4], [10, -5], [12, -4], [12, -2], [10, -1], [8, -2]], 0, 4, {}); K.coneRoof(B, 'lead', [[8, -4], [10, -5], [12, -4], [12, -2], [10, -1], [8, -2]], 4, [10, -3], 2.2);
    ctx.solid([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  },
};
