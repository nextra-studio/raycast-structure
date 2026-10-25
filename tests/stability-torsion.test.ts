import { test } from "node:test";
import assert from "node:assert/strict";
import { customSection, sectionFromRow } from "../src/core/sections";
import { loadLibrary } from "../src/core/library";
import { formulas, calculate, FormulaValues } from "../src/core/formulas";
import { parseFormulaInput, formulaScalar } from "../src/core/formula-input";
import {
  stVenant,
  rectangleTorsion,
  warpingTorsion,
  lateralBuckling,
  columnFactors,
  steelReduction,
  timberReduction,
  timberLTBReduction,
} from "../src/core/stability-torsion";
const lib = loadLibrary("assets/library"),
  steel = lib.materials.find((m) => m.id === "Steel-S355")!,
  timber = lib.materials.find((m) => m.id === "C24")!;
const i = {
  ...sectionFromRow({
    id: "Ideal IPE200 audit",
    shape: "i",
    h: "200",
    b: "100",
    tf: "8.5",
    tw: "5.6",
    J: "68500",
    Iw: "1.275e10",
  }),
  J: 68500,
};
const near = (a: number, b: number, tol = 1e-8) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
test("Circular and annular SV stress, twist, units and sign: independent polar integration", () => {
  for (const shape of ["circle", "chs"] as const) {
    const s = customSection(shape, shape === "circle" ? [100] : [100, 5]),
      inner = shape === "circle" ? 0 : 90,
      J = (Math.PI * (100 ** 4 - inner ** 4)) / 32;
    for (const sign of [-1, 0, 1]) {
      const r = stVenant(s, 80000, sign * 2e6, 3000);
      near(r.J, J);
      near(r.tau!, (2e6 * Math.abs(sign) * 50) / J);
      near(r.twist!, (sign * 2e6 * 3000) / (80000 * J));
    }
  }
});
test("Rectangular exact series agrees with handbook square coefficients and thin-strip limit", () => {
  const square = rectangleTorsion(100, 100);
  near(square.J / 100 ** 4, 0.140577014955, 1e-10);
  near(square.stressPerTorque * 100 ** 3, 4.8039, 2e-5);
  const strip = rectangleTorsion(10000, 10);
  near(strip.J / ((10000 * 10 ** 3) / 3), 1 - (0.630248876 * 10) / 10000, 1e-9);
  near(strip.stressPerTorque, 10 / strip.J);
  near(rectangleTorsion(100, 200).J, rectangleTorsion(200, 100).J);
});
test("RHS Bredt stress uses median enclosed area, not Tr/J", () => {
  const s = customSection("rhs", [200, 100, 5]),
    r = stVenant(s, 80000, 1e6);
  near(r.tau!, 1e6 / (2 * 195 * 95 * 5));
});
test("Open I-section flange SV hand example and supplied Wt override", () => {
  near(stVenant(i, 80000, 300000).tau!, (300000 * 8.5) / 68500);
  near(stVenant(i, 80000, 300000, undefined, { Wt: 10000 }).tau!, 30);
});
test("Cantilever restrained-warping solution agrees at every station with independent hyperbolic closed form", () => {
  const E = 210000,
    G = 81000,
    T = 1e6,
    L = 3000,
    k = Math.sqrt((G * i.J!) / (E * i.Iw!));
  const r = warpingTorsion(i, E, G, T, L, L);
  for (const s of r.stations) {
    const c = Math.cosh(k * (L - s.x)) / Math.cosh(k * L),
      sn = Math.sinh(k * (L - s.x)) / Math.cosh(k * L);
    near(s.Tsv, T * (1 - c));
    near(s.Tw, T * c);
    near(s.B, (-T / k) * sn);
    near(
      s.theta,
      (T / (G * i.J!)) *
        (s.x -
          (Math.sinh(k * L) - Math.sinh(k * (L - s.x))) /
            (k * Math.cosh(k * L))),
    );
    near(s.sigma!, (s.B * 4787.5) / i.Iw!);
    near(s.tauW!, (s.Tw * ((8.5 * 191.5 * 100 ** 2) / 16)) / (i.Iw! * 8.5));
    near(s.Tsv + s.Tw, T);
  }
  near(r.stations[0].rate, 0);
  near(r.stations.at(-1)!.B, 0);
  near(r.reactions[0].T, -T);
});
test("Free warping gives pure St Venant torque, zero bimoment and TL/GJ twist", () => {
  const r = warpingTorsion(i, 210000, 81000, 1e6, 3000, 3000, {
    torqueCase: 1,
  });
  for (const p of r.stations) {
    near(p.Tsv, 1e6);
    near(p.Tw, 0);
    near(p.B, 0);
    near(p.theta, (1e6 * p.x) / (81000 * 68500));
  }
});
for (const mode of [0, 1, 2, 3])
  test(`Warping case ${mode}: interior torque jump, continuity, end conditions, equilibrium and sign reversal`, () => {
    const r = warpingTorsion(i, 210000, 81000, 1e6, 4000, 1700, {
        torqueCase: mode,
      }),
      neg = warpingTorsion(i, 210000, 81000, -1e6, 4000, 1700, {
        torqueCase: mode,
      });
    near(
      r.reactions.reduce((s, r) => s + r.T, 1e6),
      0,
    );
    const mid = r.stations.filter((p) => p.x === 1700);
    assert.equal(mid.length, 2);
    near(mid[0].theta, mid[1].theta);
    near(mid[0].rate, mid[1].rate);
    near(mid[0].B, mid[1].B);
    near(mid[0].T - mid[1].T, 1e6);
    near(r.stations[0].theta, 0);
    if (mode === 0 || mode === 3) near(r.stations[0].rate, 0);
    else near(r.stations[0].B, 0);
    if (mode >= 2) {
      near(r.stations.at(-1)!.theta, 0);
      if (mode === 3) near(r.stations.at(-1)!.rate, 0);
      else near(r.stations.at(-1)!.B, 0);
    } else near(r.stations.at(-1)!.T, 0);
    r.stations.forEach((p, j) => {
      near(p.Tsv + p.Tw, p.T);
      near(p.theta, -neg.stations[j].theta);
      near(p.B, -neg.stations[j].B);
    });
  });
test("Symmetric restrained torsion: half reactions and symmetric bimoment", () => {
  for (const mode of [2, 3]) {
    const r = warpingTorsion(i, 210000, 81000, 1e6, 4000, 2000, {
      torqueCase: mode,
    });
    near(r.reactions[0].T, -5e5);
    near(r.reactions[1].T, -5e5);
    near(r.stations[0].B, r.stations.at(-1)!.B, 1e-7);
  }
});
test("Long cantilever exponential basis remains finite and resolves support layer", () => {
  const r = warpingTorsion(i, 210000, 81000, 1e6, 1e7, 1e7);
  for (const p of r.stations)
    for (const v of Object.values(p)) assert.ok(Number.isFinite(v));
  near(r.stations.at(-1)!.Tsv, 1e6);
  near(r.stations[0].Tsv, 0);
});
test("Torque zero gives zero stress/twist in every supported restraint case", () => {
  for (const mode of [0, 1, 2, 3]) {
    const r = warpingTorsion(i, 210000, 81000, 0, 3000, 1500, {
      torqueCase: mode,
    });
    for (const p of r.stations)
      for (const k of [
        "theta",
        "B",
        "Tsv",
        "Tw",
        "sigma",
        "tauW",
        "tauSV",
      ] as const)
        near(p[k]!, 0);
  }
});
test("Steel Mcr matches equivalent pi/L square-root expression, no invented fy", () => {
  const r = lateralBuckling(i, steel, 3000, 210000, 81000),
    expected =
      (Math.PI / 3000) *
      Math.sqrt(210000 * i.Iz * 81000 * 68500) *
      Math.sqrt(
        1 + (Math.PI ** 2 * 210000 * 1.275e10) / (3000 ** 2 * 81000 * 68500),
      );
  near(r.Mcr, expected);
  assert.equal(r.factor, undefined);
  const fact = lateralBuckling(i, steel, 3000, 210000, 81000, { fy: 355 });
  near(fact.lambda!, Math.sqrt((i.Wy * 355) / expected));
  near(fact.factor!, steelReduction(fact.lambda!, 0.34));
});
test("LTB load height changes Mcr in stabilising/destabilising directions", () => {
  const base = lateralBuckling(i, steel, 3000, 210000, 81000, { ltbCase: 1 }),
    top = lateralBuckling(i, steel, 3000, 210000, 81000, {
      ltbCase: 1,
      zg: 100,
    }),
    bottom = lateralBuckling(i, steel, 3000, 210000, 81000, {
      ltbCase: 1,
      zg: -100,
    });
  assert.ok(top.Mcr < base.Mcr && base.Mcr < bottom.Mcr);
  near(
    lateralBuckling(i, steel, 3000, 210000, 81000, { ltbCase: 2 }).Mcr /
      lateralBuckling(i, steel, 3000, 210000, 81000).Mcr,
    1.348,
  );
});
test("EC5 LTB uses E05/G05 and effective length, then piecewise kcrit", () => {
  const s = customSection("rectangle", [100, 300]),
    E = 7400,
    G = 460,
    fm = 24,
    r = lateralBuckling(s, timber, 6000, 11000, 690, {
      E05: E,
      G05: G,
      fm,
      ltbCase: 1,
    });
  const J = rectangleTorsion(100, 300).J,
    expected = (Math.PI / 5400) * Math.sqrt(E * s.Iz * G * J);
  near(r.Mcr, expected);
  near(r.stress!, expected / s.Wy);
  near(r.lambda!, Math.sqrt(fm / (expected / s.Wy)));
  near(r.factor!, timberLTBReduction(r.lambda!));
  near(r.E, E);
  near(r.G, G);
});
test("Four reduction-factor examples at lambda=1 and code thresholds", () => {
  near(steelReduction(1, 0.34), 0.5970231915934775);
  near(timberReduction(1, 0.2), 0.6893426737865147);
  near(timberLTBReduction(1), 0.81);
  near(steelReduction(0.2, 0.34), 1);
  near(timberReduction(0.3, 0.2), 1);
  near(timberLTBReduction(0.75), 1);
  near(timberLTBReduction(1.4), 0.51);
  near(timberLTBReduction(2), 0.25);
});
test("Column FYI both axes: independent effective lengths and characteristic timber stiffness", () => {
  const s = customSection("rectangle", [100, 200]);
  for (const m of [steel, timber]) {
    const r = columnFactors(s, m, 3000, 210000, 1, {
      fy: 355,
      E05: 7400,
      fc: 21,
      Ky: 0.5,
      Kz: 2,
    })!;
    near(
      r.axes[0].Ncr,
      (Math.PI ** 2 * (m === steel ? 210000 : 7400) * s.Iy) / 1500 ** 2,
    );
    near(
      r.axes[1].Ncr,
      (Math.PI ** 2 * (m === steel ? 210000 : 7400) * s.Iz) / 6000 ** 2,
    );
    for (const a of r.axes)
      near(a.lambda, Math.sqrt((s.A * (m === steel ? 355 : 21)) / a.Ncr));
  }
  assert.throws(() => columnFactors(s, steel, 3000, 210000), /fy/);
});
test("Principal-axis column factors, supplied effective properties and modulus basis", () => {
  const angle = customSection("angle", [100, 100, 10, 10]),
    r = columnFactors(angle, steel, 3000, 210000, 1, { fy: 355 })!;
  assert.deepEqual(
    r.axes.map((a) => a.axis),
    ["u", "v"],
  );
  const s = sectionFromRow({ ...i.raw, Aeff: "2000", Weffy: "100000" });
  near(
    columnFactors(s, steel, 3000, 210000, 1, { fy: 355, areaBasis: 1 })!.area,
    2000,
  );
  near(
    lateralBuckling(s, steel, 3000, 210000, 81000, { modulusBasis: 2 }).W,
    100000,
  );
});
test("Reject unavailable warping/effective data, asymmetric Mcr and unsupported preset assumptions", () => {
  assert.throws(
    () =>
      warpingTorsion(
        customSection("rectangle", [100, 200]),
        210000,
        81000,
        1e6,
        3000,
        3000,
      ),
    /Iw/,
  );
  assert.throws(
    () =>
      lateralBuckling(
        customSection("angle", [100, 100, 10, 10]),
        steel,
        3000,
        210000,
        81000,
      ),
    /doubly symmetric/,
  );
  assert.throws(
    () => lateralBuckling(i, steel, 3000, 210000, 81000, { kw: 0.5 }),
    /Custom/,
  );
  assert.throws(
    () => columnFactors(i, steel, 3000, 210000, 1, { fy: 355, areaBasis: 1 }),
    /Aeff/,
  );
  assert.throws(
    () => warpingTorsion(i, 210000, 81000, 1e6, 3000, 3000, { torqueCase: 2 }),
    /locally/,
  );
});
test("New input examples, optional length, fifth-power alias isolation and torque/position units", () => {
  const f = formulas.find((f) => f.id === "torsion-sv")!,
    p = parseFormulaInput("T=1kNm, S355, IPE200, 3m", f, lib);
  assert.deepEqual(p.errors, []);
  near(p.values.T!, 1e6);
  near(p.values.L!, 3000);
  const warp = formulas.find((f) => f.id === "torsion-warping")!,
    q = parseFormulaInput(
      "fork free,3m,T=-2kNm,at 0.3L,Steel-S355,IPE200,Iw=12750cm6",
      warp,
      lib,
    );
  assert.deepEqual(q.errors, []);
  near(q.values.a!, 900);
  near(q.values.Iw!, 12750e6);
  near(q.values.torqueCase!, 2);
  const euler = formulas.find((f) => f.id === "euler")!,
    m = parseFormulaInput("3m,C24,100x200,Ky=0.5,Kz=2", euler, lib);
  assert.deepEqual(m.errors, []);
  assert.equal(m.material?.id, "C24");
  assert.equal(m.values.C2, undefined);
  near(formulaScalar(warp, "Ww", "10cm4"), 1e5);
});
test("All three new formula entry points produce the independently audited core outputs", () => {
  const v: FormulaValues = {
    L: 3000,
    T: 1e6,
    E: 210000,
    G: 81000,
    I: i.Iy,
    A: i.A,
    W: i.Wy,
    N: 0,
    M: 0,
    P: 0,
    q: 0,
    K: 1,
    a: 3000,
    section: i,
    material: steel,
  };
  for (const id of ["torsion-sv", "torsion-warping", "ltb"]) {
    const out = calculate(
      formulas.find((f) => f.id === id)!,
      v,
    );
    assert.ok(out.length >= 1);
    out.forEach((a) => assert.ok(Number.isFinite(a.value)));
  }
});
