import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { formulas, FormulaValues, calculate } from "../src/core/formulas";
import { formulaStage, formulaChoices } from "../src/core/formula-flow";
import { parseFormulaInput } from "../src/core/formula-input";
import { loadLibrary } from "../src/core/library";
import { customSection } from "../src/core/sections";
const lib = loadLibrary(join(process.cwd(), "assets/library")),
  material = lib.materials.find((m) => m.id === "C24")!,
  section = customSection("rectangle", [100, 200]);
function flow(id: string, query = "", numberKey?: string) {
  const f = formulas.find((f) => f.id === id)!,
    parsed = parseFormulaInput(query, f, lib),
    sec = parsed.section || section,
    mat = parsed.material || material;
  const v: FormulaValues = {
    L: NaN,
    P: NaN,
    q: NaN,
    E: mat.E!,
    I: id === "euler" ? sec.Iminor : sec.Iy,
    A: sec.A,
    W: sec.Wy,
    N: NaN,
    M: NaN,
    K: 1,
    a: sec.h / 2,
    section: sec,
    ...parsed.values,
  };
  const stage = formulaStage(f, v, parsed.provided);
  const choices = formulaChoices(query, f, lib, {
    stage,
    material: mat,
    section: sec,
    parsed,
    values: v,
    explicit: parsed.provided,
    numberKey,
  });
  return { f, parsed, v, stage, choices };
}
for (const [id, key] of [
  ["axial-stress", "N"],
  ["bending-stress", "M"],
  ["rect-shear", "P"],
  ["axial-deformation", "N"],
  ["euler", "L"],
])
  test(`${id}: initial first choice is the needed value, not material`, () => {
    const r = flow(id);
    assert.equal(r.stage.key, key);
    assert.equal(r.choices[0].group, "Next input");
    assert.ok(!r.choices.some((c) => c.group.startsWith("Material")));
    assert.ok(!r.stage.ready);
  });
for (const [id, input, want] of [
  ["axial-stress", "N=10kN", 0.5],
  ["bending-stress", "M=20kNm", 30],
  ["rect-shear", "V=10kN", 0.75],
] as const)
  test(`${id}: force then section, no material step, independent hand result`, () => {
    const pending = flow(id, input);
    assert.equal(pending.stage.kind, "section");
    assert.ok(!pending.choices.some((c) => c.group.startsWith("Material")));
    const ready = flow(id, input + ",100x200");
    assert.equal(ready.stage.kind, "ready");
    assert.equal(calculate(ready.f, ready.v)[0].value, want);
  });
test("Axial extension progresses force, span, material, section and uses NL/EA", () => {
  assert.equal(flow("axial-deformation", "N=10kN").stage.key, "L");
  const mat = flow("axial-deformation", "N=10kN,6m,");
  assert.equal(mat.stage.kind, "material");
  assert.equal(mat.choices[0].title, "C24");
  assert.equal(
    flow("axial-deformation", "N=10kN,6m,C24,").stage.kind,
    "section",
  );
  const r = flow("axial-deformation", "N=10kN,6m,C24,100x200");
  assert.ok(r.stage.ready);
  assert.equal(calculate(r.f, r.v)[0].value, (10000 * 6000) / (11000 * 20000));
});
test("Buckling requires confirmed E/I, shows only K choices once ready", () => {
  assert.equal(flow("euler", "6m").stage.kind, "material");
  assert.equal(flow("euler", "6m,C24").stage.kind, "section");
  const r = flow("euler", "3m,E=210000MPa,I=10000000mm4,K=1");
  assert.ok(r.stage.ready);
  assert.ok(r.choices.every((c) => c.group === "Effective length"));
  assert.equal(
    calculate(r.f, r.v)[0].value,
    (Math.PI ** 2 * 210000 * 1e7) / 3000 ** 2 / 1000,
  );
});
for (const id of ["modulus", "radius", "properties"])
  test(`${id}: starts with geometry choices and never material grades`, () => {
    const r = flow(id);
    assert.equal(r.stage.kind, "section");
    assert.ok(r.choices.length);
    assert.ok(!r.choices.some((c) => c.group.startsWith("Material")));
    assert.ok(flow(id, "100x200").stage.ready);
  });
test("Section modulus and gyration accept direct matching properties without inherited geometry confirmation", () => {
  assert.equal(flow("modulus", "I=1943cm4").stage.key, "a");
  assert.equal(flow("radius", "I=1943cm4").stage.key, "A");
  for (const [id, input, want] of [
    ["modulus", "I=10000000mm4,c=100mm", 100000],
    ["radius", "I=10000000mm4,A=10000mm2", Math.sqrt(1000)],
  ] as const) {
    const r = flow(id, input);
    assert.ok(r.stage.ready);
    assert.equal(calculate(r.f, r.v)[0].value, want);
  }
});
test("Bare number interpretation retains module-specific force and property units", () => {
  assert.equal(flow("bending-stress", "20", "M").choices[0].value, "M=20kNm");
  assert.equal(flow("rect-shear", "10", "P").choices[0].value, "V=10kN");
  assert.equal(flow("modulus", "1943", "I").choices[0].value, "I=1943mm4");
});
test("Typed family filters show matching sizes and material families are available only where E matters", () => {
  const rhs = flow("bending-stress", "M=20kNm,RHS");
  assert.ok(rhs.choices.length <= 9);
  assert.ok(rhs.choices.every((c) => c.group === "Section / RHS"));
  const concrete = flow("euler", "6m,concrete");
  assert.equal(concrete.choices[0].title, "C30/37");
  assert.ok(concrete.choices.every((c) => c.group === "Material / Concrete"));
});

test("Legacy beam point formulas suggest a point load that parses as P, never shear-only V", () => {
  const r = flow("ss-point", "6m");
  assert.equal(r.stage.key, "P");
  assert.equal(r.choices[0].value, "10kN");
  assert.equal(parseFormulaInput("6m,10kN", r.f, lib).values.P, 10000);
});
