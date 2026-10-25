import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadLibrary } from "../src/core/library";
import { parseCSV, writeCSV } from "../src/core/csv";
import { customSection } from "../src/core/sections";
import {
  parseQuick,
  parseSection,
  quantity,
  spansInput,
} from "../src/core/input";
import { calculate, formulas, FormulaValues } from "../src/core/formulas";
import { buildModel, AnalysisInput } from "../src/core/templates";
import { analyze } from "../src/core/engine";
const lib = loadLibrary(join(process.cwd(), "assets", "library")),
  near = (a: number, b: number, tol = 1e-6) =>
    assert.ok(Math.abs(a - b) < tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const E = 11000,
  s = customSection("rectangle", [100, 300]);
test("all source material columns and timber grades are preserved", () => {
  assert.equal(lib.materials.length, 48);
  for (const id of [
    "C14",
    "C24",
    "C40",
    "GL20h",
    "GL24h",
    "GL32h",
    "GL24c",
    "GL32c",
  ]) {
    const m = lib.materials.find((m) => m.id === id)!;
    assert.ok(m.E! > 0);
    assert.ok(m.raw.fm_k);
    assert.ok(m.raw.standard);
  }
  assert.equal(lib.materials.find((m) => m.id === "C24")!.E, 11000);
});
test("catalogue units and original timber trade sizes", () => {
  const i = lib.sections.find((s) => s.id === "IPE 200")!;
  near(i.Iy, 1943e4);
  near(i.A, 2850);
  near(i.J!, 6.92e4);
  near(i.Iw!, 0.0131e12);
  assert.ok(lib.sections.some((s) => s.id === "Sawn 45x195"));
  assert.ok(lib.sections.some((s) => s.id === "Glulam 140x450"));
});
test("rectangle, circle and hollow geometric properties", () => {
  near(s.A, 30000);
  near(s.Iy, 225e6);
  near(s.Wy, 1.5e6);
  const c = customSection("circle", [100]);
  near(c.Iy, (Math.PI * 100 ** 4) / 64);
  near(c.J!, 2 * c.Iy);
  const r = customSection("rhs", [200, 100, 6]);
  near(r.A, 3456);
  near(r.Iy, (100 * 200 ** 3 - 88 * 188 ** 3) / 12);
});
test("asymmetric angle has product inertia and distinct principal axes", () => {
  const a = customSection("angle", [100, 80, 8, 8]);
  assert.ok(Math.abs(a.Iyz) > 0);
  assert.ok(a.Imajor > a.Iminor);
  near(a.Imajor + a.Iminor, a.Iy + a.Iz);
});
test("bad section dimensions are rejected", () => {
  assert.throws(() => customSection("rhs", [100, 100, 60]));
  assert.throws(() => customSection("circle", [0]));
});
test("CSV round trip preserves quoted commas, multiline notes and extra columns", () => {
  const rows = [
    { id: "A", notes: 'a, "quoted"\nline', E: "11000", custom: "yes" },
  ];
  assert.deepEqual(parseCSV(writeCSV(rows)), rows);
  assert.throws(() => parseCSV("id,E\nA,1\na,2\n"), /duplicate/);
  assert.throws(() => parseCSV("id,E\nA,1,2\n"), /expected/);
});
test("units, explicit defaults and comma-free decimal parsing", () => {
  near(quantity("210GPa", "modulus"), 210000);
  near(quantity("6000mm", "length"), 6);
  near(quantity("10000N", "force"), 10);
  assert.deepEqual(spansInput("4000/5000/4000mm"), [4, 5, 4]);
  assert.throws(() => quantity("2,5m", "length"));
});
test("flexible section separators and named dimensions retain orientation", () => {
  for (const str of [
    "rhs 200x100x6",
    "rhs 200 100 6",
    "rhs h200 b100 t6",
    "rhs b100 h200 t6",
  ]) {
    const r = parseSection(str, lib)!;
    near(r.h, 200);
    near(r.b, 100);
    near(r.t, 6);
  }
  near(parseSection("circle r50", lib)!.d, 100);
  near(parseSection("rect 10x30 cm", lib)!.h, 300);
});
test("quick input accepts order variation, pitch, E override and fuzzy template", () => {
  const p = parseQuick(
    "C24, udl -3kN/m, continuos, spans 4/5/4m, E=12GPa, rect 100x300",
    lib,
  );
  assert.equal(p.messages.length, 0);
  assert.equal(p.unresolved.length, 0);
  assert.equal(p.template, "continuous");
  near(p.E!, 12000);
  near(p.q!, -3);
  assert.deepEqual(p.spans, [4, 5, 4]);
  const r = parseQuick("roof, 8m, pitch 30deg, point -10kN", lib);
  near(r.pitch!, 30);
  near(r.P!, -10);
  assert.equal(r.messages.length, 0);
});
const values: FormulaValues = {
  L: 6000,
  P: 10000,
  q: 5,
  E,
  I: s.Iy,
  A: s.A,
  W: s.Wy,
  N: 10000,
  M: 2e7,
  K: 1,
  a: 2500,
  section: s,
};
test("formula beam cases agree with independent frame calculation", () => {
  for (const f of formulas.filter((f) => f.beam)) {
    const material = lib.materials.find((m) => m.id === "C24")!;
    const input: AnalysisInput = {
      template: f.beam!,
      spans: [6],
      pitch: 0,
      section: s,
      material,
      axis: "y",
      q: f.loading === "udl" ? -values.q : 0,
      direction: "globalZ",
      basis: "member",
      theory: "euler",
      tie: true,
      ridgeHinge: true,
      selfWeight: false,
      leftOverhang: 0,
      rightOverhang: 0,
      point:
        f.loading === "point"
          ? {
              member: "M1",
              value: -values.P,
              position:
                f.id === "ss-offcentre"
                  ? values.a / 1000
                  : f.beam === "cantilever"
                    ? 6
                    : 3,
            }
          : undefined,
    };
    const r = analyze(buildModel(input)),
      answers = calculate(f, values),
      station = r.members.flatMap((m) => m.stations);
    const def = answers.find((a) => /deflection/.test(a.label));
    if (def) near(def.value, -Math.min(...station.map((s) => s.v)), 2e-6);
    const sag = answers.find((a) => /sagging moment/.test(a.label));
    if (sag) near(sag.value, Math.max(...station.map((s) => s.M)) / 1e6, 2e-6);
  }
});
test("off-centre point-load formula matches frame result", () => {
  const m: AnalysisInput = {
    template: "simple",
    spans: [6],
    pitch: 0,
    section: s,
    material: lib.materials[0],
    E,
    axis: "y",
    q: 0,
    direction: "globalZ",
    basis: "member",
    theory: "euler",
    tie: true,
    ridgeHinge: true,
    selfWeight: false,
    leftOverhang: 0,
    rightOverhang: 0,
    point: { member: "M1", value: -10000, position: 2.5 },
  };
  const r = analyze(buildModel(m)),
    f = formulas.find((f) => f.id === "ss-offcentre")!;
  near(
    calculate(f, values).find((a) => a.label === "Maximum downward deflection")!
      .value,
    -Math.min(...r.members[0].stations.map((s) => s.v)),
  );
});
test("roof rafters carry bending under UDL and axial force from decomposition", () => {
  const m: AnalysisInput = {
    template: "roof",
    spans: [8],
    pitch: 30,
    section: s,
    material: lib.materials.find((m) => m.id === "C24")!,
    axis: "y",
    q: -3,
    direction: "globalZ",
    basis: "projected",
    theory: "euler",
    tie: true,
    ridgeHinge: true,
    selfWeight: false,
    leftOverhang: 0,
    rightOverhang: 0,
  };
  const r = analyze(buildModel(m));
  near(r.reactions.A[1], 12000);
  near(r.reactions.C[1], 12000);
  assert.ok(Math.max(...r.members[0].stations.map((s) => s.M)) > 0);
  assert.ok(Math.abs(r.members[2].stations[0].N) > 0);
  assert.ok(Math.abs(r.displacements.B[1]) > 0);
});
test("true triangular truss has axial forces and no bending", () => {
  const m: AnalysisInput = {
    template: "truss",
    spans: [8],
    pitch: 30,
    section: s,
    material: lib.materials.find((m) => m.id === "C24")!,
    axis: "y",
    q: 0,
    direction: "globalZ",
    basis: "member",
    theory: "euler",
    tie: true,
    ridgeHinge: true,
    selfWeight: false,
    leftOverhang: 0,
    rightOverhang: 0,
    jointLoad: -10000,
  };
  const r = analyze(buildModel(m));
  near(r.reactions.A[1], 5000);
  near(r.reactions.C[1], 5000);
  near(r.members[0].stations[0].N, -10000);
  assert.ok(
    r.members.every((m) => m.stations.every((s) => s.M === 0 && s.V === 0)),
  );
});
