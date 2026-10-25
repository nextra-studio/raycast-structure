import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { loadLibrary, migrateLibrary } from "../src/core/library";
import { concreteRows } from "../src/core/concrete";
import { writeCSV, parseCSV } from "../src/core/csv";
import { formulas } from "../src/core/formulas";
import { parseFormulaInput, formulaScalar } from "../src/core/formula-input";
const lib = loadLibrary(join(process.cwd(), "assets/library"));
const formula = (id: string) => formulas.find((f) => f.id === id)!;
test("concrete presets retain grade strengths and explicitly qualified elastic properties", () => {
  assert.equal(concreteRows().length, 14);
  const c = lib.materials.find((m) => m.id === "C30/37")!;
  assert.equal(c.E, 33000);
  assert.equal(c.G, 13750);
  assert.equal(c.raw.fck, "30");
  assert.equal(c.raw.fcm, "38");
  assert.match(c.source, /2004/);
  assert.match(c.raw.notes, /Cracking, creep/);
  assert.ok(!lib.sections.some((s) => s.family === "General geometry"));
});
test("formula material names are not mistaken for numeric parameters", () => {
  const f = formulas.find((f) => f.equation.includes("PL/4"))!;
  for (const id of ["C24", "C30/37", "GL24h"]) {
    const p = parseFormulaInput(`6m, P10kN, ${id}`, f, lib);
    assert.deepEqual(p.errors, []);
    assert.equal(p.material?.id, id);
    assert.equal(p.values.L, 6000);
    assert.equal(p.values.P, 10000);
  }
});
test("formula names, units and geometry support independent overrides", () => {
  const f = formula("axial-stress");
  const p = parseFormulaInput("N=-12kN, A=100cm2", f, lib);
  assert.deepEqual(p.errors, []);
  assert.equal(p.values.N, -12000);
  assert.equal(p.values.A, 10000);
  const b = formulas.find(
    (f) => f.inputs.includes("M") && f.inputs.includes("W"),
  )!;
  const q = parseFormulaInput("M20kNm, W194cm3, rhs 200x100x6", b, lib);
  assert.deepEqual(q.errors, []);
  assert.equal(q.values.M, 20e6);
  assert.equal(q.values.W, 194000);
  assert.equal(q.section?.shape, "rhs");
  const r = parseFormulaInput("I=1943cm4, c=100mm", formula("modulus"), lib);
  assert.deepEqual(r.errors, []);
  assert.equal(r.values.I, 1943e4);
  assert.equal(r.values.a, 100);
});
test("positional input skips already named values and rejects unsupported inputs", () => {
  const f = formulas.find((f) => f.equation.includes("PL/4"))!;
  const p = parseFormulaInput("L6m, 10kN", f, lib);
  assert.deepEqual(p.errors, []);
  assert.equal(p.values.P, 10000);
  assert.match(
    parseFormulaInput("q3", formula("axial-stress"), lib).errors[0],
    /not used/,
  );
  assert.match(parseFormulaInput("banana", f, lib).errors[0], /Unrecognized/);
  assert.throws(() => formulaScalar(f, "I", "5cm3"));
});
test("CSV upgrade preserves existing concrete overrides and user records", () => {
  const dir = mkdtempSync(join(tmpdir(), "structural-migration-"));
  try {
    writeFileSync(
      join(dir, "materials.csv"),
      writeCSV([
        { id: "C30/37", E: "30001", myColumn: "preserve" },
        { id: "My material", E: "12345" },
      ]),
    );
    writeFileSync(
      join(dir, "sections.csv"),
      writeCSV([{ id: "My section", family: "User", source: "Me" }]),
    );
    migrateLibrary(dir);
    migrateLibrary(dir);
    const rows = parseCSV(readFileSync(join(dir, "materials.csv"), "utf8"));
    assert.equal(rows.filter((r) => r.id === "C30/37").length, 1);
    assert.equal(rows.find((r) => r.id === "C30/37")?.E, "30001");
    assert.equal(rows.find((r) => r.id === "C30/37")?.myColumn, "preserve");
    assert.ok(rows.some((r) => r.id === "My material"));
    assert.equal(
      parseCSV(readFileSync(join(dir, "sections.csv"), "utf8"))[0].id,
      "My section",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
