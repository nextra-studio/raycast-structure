import { test } from "node:test";
import assert from "node:assert/strict";
import { loadLibrary } from "../src/core/library";
import { parseQuick, pointLocation } from "../src/core/input";
import { formulaCatalog, beamCases } from "../src/core/formula-catalog";
import { parseFormulaInput } from "../src/core/formula-input";
import { buildModel, AnalysisInput } from "../src/core/templates";
import { analyze } from "../src/core/engine";
import { activeResponse, memberName } from "../src/core/presentation";
const lib = loadLibrary("assets/library"),
  section = lib.sections.find((s) => s.id === "Sawn 45x195")!,
  material = lib.materials.find((m) => m.id === "C24")!;
const near = (a: number, b: number, tol = 2e-5) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const base: AnalysisInput = {
  template: "simple",
  spans: [6],
  pitch: 0,
  section,
  material,
  axis: "y",
  q: 0,
  direction: "globalZ",
  basis: "member",
  theory: "euler",
  tie: true,
  ridgeHinge: false,
  selfWeight: false,
  leftOverhang: 0,
  rightOverhang: 0,
};
test("unit-based load recognition, aliases and order are explicit", () => {
  for (const text of [
    "6m, 3kN/m, IPE160, S355",
    "S355, IPE160, simply, 3kN/m, 6m",
  ]) {
    const q = parseQuick(text, lib);
    assert.deepEqual(q.messages, []);
    assert.deepEqual(q.unresolved, []);
    assert.equal(q.q, -3);
    assert.equal(q.material?.id, "Steel-S355");
    assert.equal(q.section?.id, "IPE 160");
  }
  const p = parseQuick("cant, 6m,,10kN, at 40%, global up", lib);
  assert.deepEqual(p.messages, []);
  assert.equal(p.P, 10);
  assert.equal(p.pointPosition, "40%");
  assert.equal(p.template, "cantilever");
});
test("continuous count cannot silently become a length", () => {
  const c = parseQuick("continuous 5, 4m each, 3kN/m", lib);
  assert.deepEqual(c.spans, [4, 4, 4, 4, 4]);
  assert.deepEqual(c.messages, []);
  assert.ok(parseQuick("continuous 5, 4/5m", lib).messages.length);
  assert.ok(parseQuick("continuous, 5m", lib).messages.length);
  assert.equal(parseQuick("4/5/4m, 10kN, span 2", lib).pointMember, "M2");
});
test("point ratios use selected sloping-member length; projection does not scale point force", () => {
  const model = buildModel({
    ...base,
    template: "roof",
    pitch: 30,
    spans: [8],
    basis: "projected",
    point: { member: "M2", value: -10000, ...pointLocation("40%") },
  });
  const a = model.nodes[1],
    b = model.nodes[2],
    load = model.memberLoads[0];
  near(load.position!, Math.hypot(b.x - a.x, b.z - a.z) * 0.4);
  assert.equal(load.magnitude, -10000);
  assert.equal(load.basis, "member");
  assert.equal(memberName(model, "M2"), "Right rafter");
  const midpoint = buildModel({
    ...base,
    point: { member: "M1", value: -10000 },
  });
  assert.equal(midpoint.memberLoads[0].position, 3000);
  assert.throws(() => pointLocation("120%"));
  assert.throws(() =>
    buildModel({ ...base, point: { member: "M9", value: -1000 } }),
  );
});
test("projected global rafter loads conserve horizontal-projection resultant", () => {
  const q = parseQuick(
    "rafter, 8m, pitch 30deg, 3kN/m, global down, projected",
    lib,
  );
  assert.deepEqual(q.messages, []);
  assert.deepEqual(q.unresolved, []);
  assert.equal(q.template, "roof");
  assert.equal(q.direction, "globalZ");
  assert.equal(q.basis, "projected");
  const r = analyze(
    buildModel({
      ...base,
      template: "roof",
      pitch: 30,
      spans: [8],
      q: q.q!,
      basis: q.basis!,
      direction: q.direction!,
    }),
  );
  near(r.totals.fz, -24000);
  assert.ok(activeResponse(r, "M"));
  assert.ok(activeResponse(r, "N"));
  const l = parseQuick(
    "rafter, 8m, pitch 30deg, 3kN/m, local down, member",
    lib,
  );
  assert.equal(l.direction, "localZ");
  assert.equal(l.basis, "member");
});
test("new continuous and positioned-point formulas agree with stiffness analysis", () => {
  for (const f of beamCases.filter(
    (f) => f.id.startsWith("continuous-") || f.id.endsWith("-position"),
  )) {
    for (const a of [1700, 3000, 4200]) {
      const v = {
        L: 6000,
        P: 10000,
        q: 3,
        E: material.E!,
        I: section.Iy,
        A: section.A,
        W: section.Wy,
        N: 10000,
        M: 1e7,
        K: 1,
        a,
      };
      const model = buildModel({
        ...base,
        template: f.beam!,
        spans: f.beam === "continuous" ? [6, 6] : [6],
        q: f.loading === "udl" ? -3 : 0,
        point:
          f.loading === "point"
            ? {
                member: "M1",
                value: -10000,
                position: f.id === "continuous-point" ? 3 : a / 1000,
              }
            : undefined,
      });
      const r = analyze(model),
        stations = r.members.flatMap((m) => m.stations),
        answers = f.compute(v);
      const def = answers.find((a) => /deflection/.test(a.label));
      if (def) near(def.value, -Math.min(...stations.map((s) => s.v)));
      for (const name of ["A", "B", "C"]) {
        const ans = answers.find((a) => a.label === "Reaction " + name);
        if (ans) near(ans.value, r.reactions[name][1] / 1000);
      }
      const moments = answers.filter((a) => /moment/.test(a.label));
      near(
        Math.max(...moments.map((a) => Math.abs(a.value))),
        Math.max(...stations.map((s) => Math.abs(s.M))) / 1e6,
      );
    }
  }
});
test("moment calculators omit stiffness input; empty slots and named ratios are preserved", () => {
  const moment = formulaCatalog.find((f) => f.id === "ss-udl@moment")!;
  assert.deepEqual(moment.inputs, ["L", "q"]);
  const deflection = formulaCatalog.find((f) => f.id === "ss-udl@deflection")!;
  assert.ok(deflection.inputs.includes("E"));
  assert.ok(deflection.inputs.includes("I"));
  const positional = beamCases.find((f) => f.id === "cant-position")!;
  const p = parseFormulaInput("6,10,,12000", positional, lib);
  assert.deepEqual(p.errors, []);
  assert.equal(p.values.E, 12000);
  assert.equal(p.values.a, undefined);
  const r = parseFormulaInput("at 40%, L6m, P10kN", positional, lib);
  assert.deepEqual(r.errors, []);
  assert.equal(r.values.a, 2400);
  const simple = analyze(buildModel({ ...base, q: -3 }));
  assert.equal(activeResponse(simple, "N"), false);
});

test("repeated load tokens are rejected instead of silently losing a force", () => {
  assert.ok(parseQuick("6m,10kN,20kN", lib).messages.length);
  assert.ok(parseQuick("6m,3kN/m,4kN/m", lib).messages.length);
  assert.deepEqual(parseQuick("6m,3kN/m,10kN", lib).messages, []);
});

test("pasted explanatory examples remain unambiguous", () => {
  const p = parseQuick(
    "6m (span), 3kN/m (UDL), IPE160 (section), S355 (material)",
    lib,
  );
  assert.deepEqual(p.messages, []);
  assert.deepEqual(p.unresolved, []);
  assert.equal(p.q, -3);
});
