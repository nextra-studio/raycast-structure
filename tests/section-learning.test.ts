import { test } from "node:test";
import assert from "node:assert/strict";
import { customSection, sectionFromRow } from "../src/core/sections";
import { sectionPropertyValues } from "../src/core/section-properties";
import { calculate, formulas, FormulaValues } from "../src/core/formulas";
import { loadLibrary } from "../src/core/library";
import { join } from "node:path";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const rectangle = customSection("rectangle", [100, 200]);
test("Rectangle property manual checks: elastic/plastic modulus, first moment, energy shear area, radii and polar moment", () => {
  const p = Object.fromEntries(
    sectionPropertyValues(rectangle).map((p) => [p.key, p.value]),
  );
  near(p.A, 20000);
  near(p.Iy, (100 * 200 ** 3) / 12);
  near(p.Iz, (200 * 100 ** 3) / 12);
  near(p.Wy, (100 * 200 ** 2) / 6);
  near(p.Wply, (100 * 200 ** 2) / 4);
  near(p.Qy, (100 * 200 ** 2) / 8);
  near(p.Qz, (200 * 100 ** 2) / 8);
  near(p.Asy, (20000 * 5) / 6);
  near(p.Asz, (20000 * 5) / 6);
  near(p.Ip, p.Iy + p.Iz);
  near(p.ry, Math.sqrt(p.Iy / p.A));
  near(p.rz, Math.sqrt(p.Iz / p.A));
  for (const key of ["Anet", "Aeff", "Avy", "Avz", "Weffy", "Iw"])
    assert.equal(p[key], undefined, key);
});
test("Supplied effective/net/code shear/warping properties remain distinct from energy shear properties", () => {
  const s = sectionFromRow({
    ...rectangle.raw,
    Anet: "18000",
    Aeff: "17000",
    Av_z: "12000",
    Weff_y: "500000",
    Iw: "0",
  });
  const p = sectionPropertyValues(s),
    v = Object.fromEntries(p.map((p) => [p.key, p.value]));
  near(v.Anet, 18000);
  near(v.Aeff, 17000);
  near(v.Avz, 12000);
  near(v.Weffy, 500000);
  near(v.Iw, 0);
  near(v.Asz, (20000 * 5) / 6);
  assert.notEqual(v.Asz, v.Avz);
  assert.match(p.find((p) => p.key === "Asz")!.use, /not automatically/);
});
test("Published properties are not supplied with invented statical moments or net/effective areas", () => {
  const lib = loadLibrary(join(process.cwd(), "assets/library"));
  for (const s of lib.sections) {
    const p = sectionPropertyValues(s);
    for (const v of p) assert.ok(Number.isFinite(v.value), s.id + v.key);
  }
  const s = lib.sections.find((s) => s.id.replace(/\s/g, "") === "IPE200")!,
    p = sectionPropertyValues(s);
  assert.ok(p.some((p) => p.key === "Iw"));
  assert.ok(!p.some((p) => p.key === "Qy"));
  assert.ok(!p.some((p) => p.key === "Anet"));
});
const euler = formulas.find((f) => f.id === "euler")!;
function column(s = rectangle): FormulaValues {
  return {
    section: s,
    eulerAboutSection: true,
    L: 3000,
    E: 210000,
    I: s.Iminor,
    K: 1,
    A: s.A,
    W: s.Wy,
    N: 0,
    M: 0,
    P: 0,
    q: 0,
    a: 0,
  };
}
test("Euler returns independent y/z loads and follows the selected effective length", () => {
  const v = column(),
    a = calculate(euler, v);
  assert.deepEqual(
    a.map((a) => a.label),
    ["Ncr,y", "Ncr,z"],
  );
  near(
    a[0].value,
    (Math.PI ** 2 * 210000 * ((100 * 200 ** 3) / 12)) / 3000 ** 2 / 1000,
  );
  near(
    a[1].value,
    (Math.PI ** 2 * 210000 * ((200 * 100 ** 3) / 12)) / 3000 ** 2 / 1000,
  );
  const b = calculate(euler, { ...v, K: 2 });
  b.forEach((b, i) => near(b.value, a[i].value / 4));
  const flipped = calculate(
    euler,
    column(customSection("rectangle", [200, 100])),
  );
  near(flipped[0].value, a[1].value);
});
test("Asymmetric Euler loads use inertia-tensor eigenvalues; a single explicit I remains one result", () => {
  const s = customSection("angle", [100, 75, 8, 8]),
    a = calculate(euler, column(s));
  assert.deepEqual(
    a.map((a) => a.label),
    ["Ncr,u", "Ncr,v"],
  );
  const disc = Math.sqrt((s.Iy - s.Iz) ** 2 + 4 * s.Iyz ** 2),
    eigen = [(s.Iy + s.Iz + disc) / 2, (s.Iy + s.Iz - disc) / 2];
  a.forEach((v, i) =>
    near(v.value, (Math.PI ** 2 * 210000 * eigen[i]) / 3000 ** 2 / 1000),
  );
  const one = calculate(euler, {
    ...column(s),
    eulerAboutSection: false,
    I: 1e7,
  });
  assert.equal(one.length, 1);
  near(one[0].value, (Math.PI ** 2 * 210000 * 1e7) / 3000 ** 2 / 1000);
});
