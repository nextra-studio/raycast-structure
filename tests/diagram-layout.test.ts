import { test } from "node:test";
import assert from "node:assert/strict";
import { diagramLayout } from "../src/core/diagram-layout";
import { Model } from "../src/core/types";
function roof(pitch: number): Model {
  const rise = 4000 * Math.tan((pitch * Math.PI) / 180);
  return {
    nodes: [
      { id: "A", x: 0, z: 0, restraints: [true, true, false] },
      { id: "B", x: 4000, z: rise, restraints: [false, false, false] },
      { id: "C", x: 8000, z: 0, restraints: [true, true, false] },
    ],
    members: [
      {
        id: "M1",
        start: "A",
        end: "B",
        type: "frame",
        E: 11000,
        A: 20000,
        I: 6.667e7,
      },
      {
        id: "M2",
        start: "B",
        end: "C",
        type: "frame",
        E: 11000,
        A: 20000,
        I: 6.667e7,
      },
    ],
    memberLoads: [],
    nodalLoads: [],
    theory: "euler",
  };
}
for (const pitch of [15, 30, 45, 60])
  test(`Roof drawing preserves ${pitch} degree pitch using a single physical scale`, () => {
    const m = roof(pitch),
      v = diagramLayout(m, 165, 512);
    const a = m.nodes[0],
      b = m.nodes[1],
      run = v.X(b.x) - v.X(a.x),
      rise = v.Y(a.z) - v.Y(b.z);
    assert.ok(Math.abs(rise / run - Math.tan((pitch * Math.PI) / 180)) < 1e-12);
    assert.ok(Math.abs(v.pitch - pitch) < 1e-10);
    assert.ok(v.rise <= 260 + 1e-9);
    assert.ok(v.left >= 165 && v.right <= 512);
    assert.ok(Math.abs(run / (b.x - a.x) - rise / (b.z - a.z)) < 1e-12);
  });
test("Changing pitch changes rendered roof rise, and negative inclination remains negative", () => {
  const a = diagramLayout(roof(15), 165, 512),
    b = diagramLayout(roof(45), 165, 512);
  assert.ok(b.rise > a.rise * 3);
  const v = diagramLayout(roof(-25), 165, 512);
  assert.ok(Math.abs(v.pitch + 25) < 1e-10);
  assert.ok(v.Y(-1000) > v.Y(0));
});
