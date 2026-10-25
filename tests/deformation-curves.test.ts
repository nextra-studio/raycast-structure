import { test } from "node:test";
import assert from "node:assert/strict";
import { buildModel, Template } from "../src/core/templates";
import { customSection } from "../src/core/sections";
import { deformationParts, withShearProperties } from "../src/core/deformation";
import { analyze } from "../src/core/engine";
import { reactionVector, rotationVector } from "../src/core/diagram-vectors";
const section = customSection("rectangle", [200, 1000]);
const material = {
  id: "hand benchmark",
  family: "Concrete",
  E: 33000,
  G: 13750,
  density: 2500,
  status: "",
  source: "",
  raw: {},
};
const model = (template: Template = "cantilever", q = -8) =>
  withShearProperties(
    buildModel({
      template,
      spans: template === "continuous" ? [5, 4, 6] : [5],
      pitch: 0,
      section,
      material,
      axis: "y",
      q,
      direction: "globalZ",
      basis: "member",
      theory: "euler",
      tie: false,
      ridgeHinge: false,
      selfWeight: false,
      leftOverhang: 0,
      rightOverhang: 0,
    }),
  );
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
for (const sign of [-1, 1])
  test(`Every cantilever curve station equals independent bending and shear integration, load sign ${sign}`, () => {
    const m = model("cantilever", 8 * sign),
      d = deformationParts(m)!,
      L = 5000,
      E = 33000,
      G = 13750,
      I = (200 * 1000 ** 3) / 12,
      As = (5 * 200 * 1000) / 6;
    for (const s of d.curves[0].stations) {
      const x = s.x;
      near(
        s.bending,
        (sign * 8 * x * x * (6 * L * L - 4 * L * x + x * x)) / (24 * E * I),
      );
      near(s.increment, (sign * 8 * (L * x - (x * x) / 2)) / (G * As));
      near(s.total, s.bending + s.increment);
    }
    near(Math.abs(d.bending), 1.1363636363636365);
    near(Math.abs(d.increment), 0.04363636363636364);
    near(Math.abs(d.total), 1.18);
    near(d.x, L);
  });
test("Off-centre point load: exact values across and beyond the load, without cubic interpolation error", () => {
  const m = model();
  m.memberLoads = [
    {
      member: "M1",
      kind: "point",
      magnitude: -13000,
      direction: "globalZ",
      basis: "member",
      position: 1733,
    },
  ];
  const d = deformationParts(m)!,
    a = 1733,
    P = -13000,
    E = 33000,
    G = 13750,
    I = section.Iy,
    As = (5 * section.A) / 6;
  for (const s of d.curves[0].stations) {
    const x = s.x;
    near(
      s.bending,
      x <= a
        ? (P * x * x * (3 * a - x)) / (6 * E * I)
        : (P * a * a * (3 * x - a)) / (6 * E * I),
    );
    near(s.increment, (P * Math.min(x, a)) / (G * As));
  }
});
test("Continuous unequal spans compare exact Euler and Timoshenko recovery at every same station", () => {
  const m = model("continuous"),
    d = deformationParts(m)!,
    samples = Object.fromEntries(
      d.curves.map((c) => [c.member, c.stations.map((s) => s.x)]),
    );
  const e = analyze({ ...m, theory: "euler" }, samples),
    t = analyze({ ...m, theory: "timoshenko" }, samples);
  for (const c of d.curves)
    for (const s of c.stations) {
      near(
        s.bending,
        e.members
          .find((v) => v.id === c.member)!
          .stations.find((v) => v.x === s.x)!.v,
      );
      near(
        s.total,
        t.members
          .find((v) => v.id === c.member)!
          .stations.find((v) => v.x === s.x)!.v,
      );
      near(s.total, s.bending + s.increment);
    }
  assert.match(d.description, /redistribution/);
});
test("Missing shear stiffness never invents a total or shear increment", () => {
  const m = model();
  m.members[0].G = undefined;
  assert.equal(deformationParts(m), undefined);
});
test("Signed force vectors: right, left, up, down, and zero", () => {
  const right = reactionVector(10, 20, 4, 0)!,
    left = reactionVector(10, 20, -4, 0)!,
    up = reactionVector(10, 20, 0, 4)!,
    down = reactionVector(10, 20, 0, -4)!;
  assert.ok(right.tipX > 10);
  assert.ok(left.tipX < 10);
  assert.ok(up.tipY < 20);
  assert.ok(down.tipY > 20);
  assert.equal(reactionVector(0, 0, 0, 0), undefined);
});
test("Moment vector sign reverses both arc travel and tangent arrowhead; zero has no arrow", () => {
  const ccw = rotationVector(0, 0, 100)!,
    cw = rotationVector(0, 0, -100)!;
  const points = (d: string) =>
    [...d.matchAll(/[ML]([^,]+),([^ ML]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
  const sense = (d: string) => {
    const p = points(d);
    return p
      .slice(1)
      .reduce((s, b, i) => s + p[i][0] * b[1] - p[i][1] * b[0], 0);
  };
  assert.ok(sense(ccw.arc) < 0);
  assert.ok(sense(cw.arc) > 0);
  near(ccw.tipX, cw.tipX);
  near(ccw.tipY, -cw.tipY);
  assert.equal(rotationVector(0, 0, 0), undefined);
});
