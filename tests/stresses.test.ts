import { test } from "node:test";
import assert from "node:assert/strict";
import { customSection } from "../src/core/sections";
import { shearProfile, sectionStresses } from "../src/core/stresses";
import { buildModel, AnalysisInput } from "../src/core/templates";
import { analyze } from "../src/core/engine";
import { loadLibrary } from "../src/core/library";
const material = loadLibrary("assets/library").materials.find(
  (m) => m.id === "C24",
)!;
const near = (a: number, b: number, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const section = customSection("rectangle", [100, 300]);
const base: AnalysisInput = {
  template: "simple",
  spans: [6],
  pitch: 0,
  section,
  material,
  axis: "y",
  q: -3,
  direction: "globalZ",
  basis: "member",
  theory: "euler",
  tie: false,
  ridgeHinge: true,
  selfWeight: false,
  leftOverhang: 0,
  rightOverhang: 0,
};
test("hand calculation: rectangle UDL normal stress = M/W, shear = 1.5V/A", () => {
  const model = buildModel(base),
    result = analyze(model),
    stress = sectionStresses(model, result)!;
  // By hand: R=qL/2=9kN; M=qL²/8=13.5kNm; A=30000; W=1.5e6.
  near(stress.tension.value, 9);
  near(stress.compression.value, -9);
  near(Math.abs(stress.shear.value), 0.45);
  near(stress.axial.value, 0);
});
test("hand calculation: solid circle shear profile gives 4V/(3A)", () => {
  const s = customSection("circle", [200]),
    profile = shearProfile(s),
    centre = profile.points.find((p) => p.z === 100)!;
  near(centre.Q / (s.Iy * centre.width), 4 / (3 * s.A));
});
test("hand calculation: hollow circle shear at centroid and hollow rectangle strip widths", () => {
  const s = customSection("chs", [200, 10]),
    p = shearProfile(s).points.find((p) => p.z === 100)!;
  near(p.Q, (2 / 3) * (100 ** 3 - 90 ** 3));
  near(p.width, 20);
  const rhs = customSection("rhs", [200, 100, 6]),
    mid = shearProfile(rhs).points.find((p) => p.z === 100)!;
  near(mid.width, 12);
  near(mid.Q, (100 * 200 ** 2 - 88 * 188 ** 2) / 8);
});
test("concurrent stresses: axial plus bending signs, and weak-axis section geometry", () => {
  const model = buildModel({
      ...base,
      template: "cantilever",
      q: 0,
      direction: "globalX",
      point: { member: "M1", value: 30000, position: 6 },
    }),
    r = analyze(model),
    s = sectionStresses(model, r)!;
  near(s.axial.value, 1);
  near(s.tension.value, 1);
  near(s.compression.value, 0);
  const weak = buildModel({ ...base, axis: "z" }),
    wr = analyze(weak),
    ws = sectionStresses(weak, wr)!;
  near(ws.tension.value, 27);
});
test("hand calculation: untied pin-pin roof has horizontal thrust and vertical reactions", () => {
  const model = buildModel({
    ...base,
    template: "roof",
    spans: [8],
    pitch: 30,
    basis: "projected",
  });
  assert.equal(model.members.length, 2);
  assert.deepEqual(model.nodes[0].restraints, [true, true, false]);
  assert.deepEqual(model.nodes[2].restraints, [true, true, false]);
  const r = analyze(model),
    rise = 4 * Math.tan(Math.PI / 6),
    H = ((3 * 8 ** 2) / (8 * rise)) * 1000;
  near(r.reactions.A[0], H);
  near(r.reactions.C[0], -H);
  near(r.reactions.A[1], 12000);
  near(r.reactions.C[1], 12000);
  near(Math.max(...r.members.flatMap((m) => m.stations.map((s) => s.M))), 6e6);
});
test("advanced members without matching geometry do not receive invented stresses", () => {
  const model = buildModel(base);
  delete model.members[0].section;
  const r = analyze(model);
  assert.equal(sectionStresses(model, r), undefined);
});
