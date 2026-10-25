/** Independent hand-method audit: integrate M/EI and solve boundary compatibility.
 * This does not call the FE engine or production formula expressions for expected values. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formulaExample } from "../src/core/formula-examples";
import { parseFormulaInput } from "../src/core/formula-input";
import { loadLibrary } from "../src/core/library";
import { formulaCatalog } from "../src/core/formula-catalog";
import { calculate, FormulaValues } from "../src/core/formulas";
import { customSection } from "../src/core/sections";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 3e-6 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const s = customSection("rectangle", [100, 300]);
const v: FormulaValues = {
  L: 6400,
  P: 11700,
  q: 2.6,
  E: 210000,
  I: 123400000,
  A: 30000,
  W: 1500000,
  N: 37000,
  M: 23.7e6,
  K: 0.8,
  a: 2368,
  section: s,
};
function solve(matrix: number[][], rhs: number[]) {
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let i = 0; i < a.length; i++) {
    const pivot = a[i][i];
    for (let j = i; j <= a.length; j++) a[i][j] /= pivot;
    for (let k = 0; k < a.length; k++)
      if (k !== i) {
        const factor = a[k][i];
        for (let j = i; j <= a.length; j++) a[k][j] -= factor * a[i][j];
      }
  }
  return a.map((row) => row.at(-1)!);
}
function roots(fn: (x: number) => number, length: number) {
  const out: number[] = [];
  for (let i = 1; i <= 512; i++) {
    let lo = (length * (i - 1)) / 512,
      hi = (length * i) / 512;
    if (fn(lo) === 0) out.push(lo);
    if (fn(lo) * fn(hi) < 0) {
      for (let j = 0; j < 48; j++) {
        const mid = (lo + hi) / 2;
        if (fn(lo) * fn(mid) <= 0) hi = mid;
        else lo = mid;
      }
      out.push((lo + hi) / 2);
    }
  }
  return out;
}
// Torsion and LTB have their independent closed-form/source audits in stability-torsion.test.ts.
for (const formula of formulaCatalog.filter(
  (f) => !["torsion-sv", "torsion-warping", "ltb"].includes(f.id),
)) {
  test("manual compatibility audit: " + formula.id, () => {
    const values = { ...v },
      answers = calculate(formula, values),
      id = formula.id.split("@")[0];
    if (!formula.beam) {
      const expected: Record<string, number[]> = {
        properties: [
          30000,
          225e6,
          25e6,
          1.5e6,
          5e5,
          Math.sqrt(7500),
          Math.sqrt(2500 / 3),
        ],
        modulus: [v.I / v.a],
        radius: [Math.sqrt(v.I / v.A)],
        "axial-stress": [37 / 30],
        "bending-stress": [15.8],
        "rect-shear": [0.585],
        "axial-deformation": [(37000 * 6400) / (210000 * 30000)],
        euler: [
          (Math.PI * Math.PI * 210000 * 123400000) / (0.8 * 6400) ** 2 / 1000,
        ],
      };
      assert.ok(expected[id], id);
      answers
        .slice(0, expected[id].length)
        .forEach((a, i) => near(a.value, expected[id][i]));
      if (id === "properties") {
        const extras: Record<string, number> = {
          Iyz: 0,
          cy: 50,
          cz: 150,
          Imajor: 225e6,
          Iminor: 25e6,
        };
        for (const a of answers)
          if (a.label in extras) near(a.value, extras[a.label]);
        // The torsion approximation has its separate independent Fourier-series audit.
      }
      return;
    }
    const L = v.L,
      total = formula.beam === "continuous" ? 2 * L : L,
      q = formula.loading === "udl" ? v.q : 0,
      P = formula.loading === "point" ? v.P : 0,
      a =
        id === "continuous-point"
          ? L / 2
          : formula.inputs.includes("a")
            ? v.a
            : id === "cant-point"
              ? L
              : L / 2,
      EI = v.E * v.I;
    const macaulay = (x: number, power: number) => Math.max(0, x - a) ** power;
    let RA = 0,
      RB = 0,
      RC = 0,
      MA = 0,
      C = 0;
    if (formula.beam === "continuous") {
      [RA, RB, C] = solve(
        [
          [L ** 3 / 6, 0, L],
          [(2 * L) ** 3 / 6, L ** 3 / 6, 2 * L],
          [2 * L, L, 0],
        ],
        [
          (q * L ** 4) / 24 + (P * macaulay(L, 3)) / 6,
          (q * (2 * L) ** 4) / 24 + (P * macaulay(2 * L, 3)) / 6,
          (q * (2 * L) ** 2) / 2 + P * (2 * L - a),
        ],
      );
      RC = q * 2 * L + P - RA - RB;
    } else if (formula.beam === "simple") {
      RA = ((q * L * L) / 2 + P * (L - a)) / L;
      RB = q * L + P - RA;
      C =
        ((q * L ** 4) / 24 + (P * macaulay(L, 3)) / 6 - (RA * L ** 3) / 6) / L;
    } else if (formula.beam === "cantilever") {
      RA = q * L + P;
      MA = -((q * L * L) / 2 + P * a);
    } else {
      const momentRow = formula.beam === "fixed" ? [L, (L * L) / 2] : [1, L];
      const momentRhs =
        formula.beam === "fixed"
          ? (q * L ** 3) / 6 + (P * macaulay(L, 2)) / 2
          : (q * L * L) / 2 + P * (L - a);
      [MA, RA] = solve(
        [[(L * L) / 2, L ** 3 / 6], momentRow],
        [(q * L ** 4) / 24 + (P * macaulay(L, 3)) / 6, momentRhs],
      );
      RB = q * L + P - RA;
    }
    const bend = (x: number) =>
      MA +
      RA * x +
      (formula.beam === "continuous" ? RB * Math.max(0, x - L) : 0) -
      (q * x * x) / 2 -
      P * Math.max(0, x - a);
    const shear = (x: number) =>
      RA +
      (formula.beam === "continuous" && x > L ? RB : 0) -
      q * x -
      (x > a ? P : 0);
    const rotation = (x: number) =>
      (C +
        MA * x +
        (RA * x * x) / 2 +
        (formula.beam === "continuous"
          ? (RB * Math.max(0, x - L) ** 2) / 2
          : 0) -
        (q * x ** 3) / 6 -
        (P * macaulay(x, 2)) / 2) /
      EI;
    const displacement = (x: number) =>
      (C * x +
        (MA * x * x) / 2 +
        (RA * x ** 3) / 6 +
        (formula.beam === "continuous"
          ? (RB * Math.max(0, x - L) ** 3) / 6
          : 0) -
        (q * x ** 4) / 24 -
        (P * macaulay(x, 3)) / 6) /
      EI;
    const candidates = [
        0,
        total,
        L,
        ...roots(shear, total),
        ...roots(rotation, total),
        a,
      ].filter((x) => x >= 0 && x <= total),
      minDef = Math.min(...candidates.map(displacement)),
      maxMoment = Math.max(...candidates.map(bend)),
      minMoment = Math.min(...candidates.map(bend));
    const maxShear = Math.max(
      ...[0, total, a, L]
        .flatMap((x) => [Math.max(0, x - 1e-6), Math.min(total, x + 1e-6)])
        .map((x) => Math.abs(shear(x))),
    );
    for (const answer of answers) {
      const name = answer.label.toLowerCase();
      let expected: number;
      if (name === "reaction a" || name === "vertical reaction")
        expected = RA / 1000;
      else if (name === "reaction b") expected = RB / 1000;
      else if (name === "reaction c") expected = RC / 1000;
      else if (name.includes("location")) {
        near(displacement(answer.value * 1000), minDef);
        continue;
      } else if (name.includes("deflection")) expected = -minDef;
      else if (name.includes("shear")) expected = maxShear / 1000;
      else if (name.includes("sagging")) expected = maxMoment / 1e6;
      else if (name.includes("middle support")) expected = bend(L) / 1e6;
      else if (name.includes("left support")) expected = bend(0) / 1e6;
      else if (name.includes("right support")) expected = bend(L) / 1e6;
      else if (name.includes("moment magnitude"))
        expected = Math.max(Math.abs(minMoment), Math.abs(maxMoment)) / 1e6;
      else if (name.includes("hogging")) expected = minMoment / 1e6;
      else throw Error("Unmapped answer " + answer.label);
      near(answer.value, expected);
    }
  });
}

test("every formula example, including its annotated copy, parses for that formula", () => {
  const lib = loadLibrary("assets/library");
  for (const f of formulaCatalog)
    for (const annotated of [false, true]) {
      const p = parseFormulaInput(formulaExample(f, annotated), f, lib);
      assert.deepEqual(p.errors, [], f.id + " " + formulaExample(f, annotated));
    }
});
