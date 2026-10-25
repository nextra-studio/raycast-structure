import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadLibrary } from "../src/core/library";
import {
  referenceCases,
  referenceEnvelope,
  referenceSolution,
  referenceModel,
  RefInput,
  referenceScales,
} from "../src/core/reference-cases";
import { analyze } from "../src/core/engine";
import { customSection } from "../src/core/sections";
import {
  energyShearArea,
  withShearProperties,
  deformationParts,
} from "../src/core/deformation";
import { formulaSearchScore } from "../src/core/formula-presentation";
import { parseFormulaInput } from "../src/core/formula-input";
import { formulas, calculate } from "../src/core/formulas";
import { parseQuick } from "../src/core/input";
import { smartChoices, preferredMaterial } from "../src/core/smart-choices";
const library = loadLibrary(join(process.cwd(), "assets/library")),
  section = customSection("rectangle", [100, 300]),
  material = library.materials.find((m) => m.id === "C24")!;
const near = (a: number, b: number, tol = 1e-5) =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
for (const c of referenceCases.filter(
  (c) => c.kind !== "thermal" && !c.envelope,
))
  test("Independent equilibrium/compatibility versus FE: " + c.id, () => {
    const v: RefInput = {
      L: 4700,
      P: 17000,
      q: 2.3,
      M: 8e6,
      E: 11000,
      I: section.Iy,
      a: 4700 * 0.37,
      alpha: 12e-6,
      dT: 20,
      h: 300,
    };
    const s = referenceSolution(c, v.a / v.L),
      scale = referenceScales(c, v),
      model = referenceModel(c, v, section, material),
      r = analyze(model);
    for (const reaction of s.reactions)
      near(
        r.reactions[String.fromCharCode(65 + reaction.x)][
          reaction.type === "force" ? 1 : 2
        ],
        reaction.value *
          (reaction.type === "force" ? scale.force : scale.moment),
        1e-5,
      );
    for (let i = 0; i < r.members.length; i++)
      for (const p of r.members[i].stations) {
        const x = i + p.x / v.L,
          d = s.at(Math.min(c.spans, x));
        near(p.v, d.v * scale.deflection, 1e-5);
        near(p.rotation, d.rotation * scale.rotation, 1e-5);
        if (
          p.x > 1e-5 &&
          p.x < v.L - 1e-5 &&
          !s.loads.moments.some((m) => Math.abs(m.x - x) < 1e-6)
        )
          near(p.M, d.M * scale.moment, 1e-5);
      }
  });
test("Hand coefficients from photographed cantilever, simple, propped and guided cases", () => {
  near(
    referenceSolution(
      referenceCases.find((c) => c.id === "cantilever-tip-point-force")!,
    ).peakVb.value,
    -1 / 3,
  );
  near(
    referenceSolution(
      referenceCases.find((c) => c.id === "simple-uniform-load")!,
    ).peakVb.value,
    -5 / 384,
  );
  const p = referenceSolution(
    referenceCases.find((c) => c.id === "propped-point-at-centre")!,
  );
  near(
    p.reactions.find((r) => r.x === 0 && r.type === "force")!.value,
    11 / 16,
  );
  near(
    p.reactions.find((r) => r.x === 0 && r.type === "moment")!.value,
    3 / 16,
  );
  near(
    referenceSolution(
      referenceCases.find((c) => c.id === "guided-tip-point-force")!,
    ).peakVb.value,
    -1 / 12,
  );
});
test("Hand thermal curvature: cantilever, simple, propped, fixed", () => {
  const get = (support: string) =>
    referenceSolution(
      referenceCases.find((c) => c.id === "thermal-" + support)!,
    );
  near(get("cantilever").at(1).v, -0.5);
  near(get("cantilever").at(1).rotation, -1);
  near(Math.abs(get("simple").at(0.5).v), 1 / 8);
  near(Math.abs(get("simple").at(0).rotation), 0.5);
  near(Math.abs(get("propped").at(0.5).v), 1 / 32);
  near(Math.abs(get("propped").at(1).rotation), 0.25);
  near(get("fixed").at(0.5).v, 0);
  near(Math.abs(get("fixed").at(0.5).M), 1);
});
test("Bending plus shear increment uses one station and matches exact rectangle UDL", () => {
  const c = referenceCases.find((c) => c.id === "simple-uniform-load")!;
  const v: RefInput = {
    L: 6000,
    P: 10000,
    q: 3,
    M: 1e7,
    E: 11000,
    I: section.Iy,
    a: 3000,
    alpha: 12e-6,
    dT: 20,
    h: 300,
  };
  const model = withShearProperties(referenceModel(c, v, section, material)),
    d = deformationParts(model)!;
  near(d.bending, (-5 * v.q * v.L ** 4) / (384 * v.E * v.I));
  near(
    d.increment,
    (-v.q * v.L * v.L) / ((8 * material.G! * 5 * section.A) / 6),
  );
  near(d.bending + d.increment, d.total);
});
test("Expanded catalogue families, safe bare geometry and contextual suggestions", () => {
  for (const family of [
    "IPE",
    "HEA",
    "HEB",
    "HEM",
    "UPN",
    "Equal L",
    "RHS",
    "SHS",
    "CHS",
  ])
    assert.ok(
      library.sections.some((s) => s.family === family),
      family,
    );
  assert.ok(library.sections.length >= 680);
  near(parseQuick("100x200", library).section!.A, 20000);
  assert.equal(parseQuick("simpyl, 6m, 3kN/m", library).template, "simple");
  assert.equal(parseQuick("fixde, 6m, 3kN/m", library).template, "fixed");
  assert.equal(
    parseQuick("rafter, 8m, pitch 30deg, 3kN/m, -z, projected", library)
      .direction,
    "globalZ",
  );
  const ipe = library.sections.find((s) => s.id === "IPE 200")!;
  assert.equal(preferredMaterial(ipe, library).id, "Steel-S355");
  const context = {
    material,
    section,
    hasMaterial: false,
    hasSection: false,
    hasSpan: true,
    hasLoad: false,
  };
  const choices = smartChoices("6m,3", library, context);
  assert.ok(choices.some((c) => c.value === "3kN/m"));
  assert.ok(choices.some((c) => c.value === "3kN"));
  const next = smartChoices("6m,10kN,", library, {
    ...context,
    hasLoad: true,
    point: true,
  });
  assert.equal(next[0].value, "C24");
  assert.ok(next.some((c) => c.value === "at 40%"));
  const families = smartChoices("S355,", library, {
    ...context,
    material: preferredMaterial(ipe, library),
    hasMaterial: true,
  });
  assert.ok(
    families
      .filter((c) => c.group === "Section families")
      .some((c) => c.value === "HEB"),
  );
  const sizes = smartChoices("HEB", library, context);
  assert.ok(sizes.some((c) => c.value === "HEB 100"));
  assert.ok(
    sizes
      .filter((c) => c.group.startsWith("Section /"))
      .every((c) => c.group === "Section / HEB"),
  );
});
test("Hand CHS geometry for EVERY published hollow-circle size", () => {
  for (const s of library.sections.filter((s) => s.shape === "chs")) {
    const inner = s.d - 2 * s.t,
      A = (Math.PI * (s.d * s.d - inner * inner)) / 4,
      I = (Math.PI * (s.d ** 4 - inner ** 4)) / 64;
    near(s.A, A, 0.006);
    near(s.Iy, I, 0.006);
    near(s.Wy, s.Iy / (s.d / 2), 1e-10);
    near(s.J!, 2 * s.Iy, 0.012);
  }
});
test("Every section has positive mass/geometry, elastic modulus identities and valid inertia tensor", () => {
  for (const s of library.sections) {
    assert.ok(
      s.A > 0 && s.Iy > 0 && s.Iz > 0 && s.Iy * s.Iz > s.Iyz * s.Iyz,
      s.id,
    );
    if (s.raw.Wy_published) {
      near(s.Wy, s.Iy / Math.max(s.cz, s.h - s.cz), 1e-10);
      near(s.Wz, s.Iz / Math.max(s.cy, s.b - s.cy), 1e-10);
    }
    if (s.mass) near(s.mass, s.A * 0.00785, 0.025);
    if (Math.abs(s.Iyz) < 1e-6 * s.Iy)
      assert.ok(energyShearArea(s).value > 0, s.id);
  }
});
for (const c of referenceCases.filter(
  (c) => c.kind !== "thermal" && !c.envelope,
))
  test(
    "Independent shear-compatible integration versus Timoshenko FE: " + c.id,
    () => {
      const v: RefInput = {
        L: 3200,
        P: 17000,
        q: 2.3,
        M: 8e6,
        E: 11000,
        I: section.Iy,
        a: 3200 * 0.41,
        alpha: 12e-6,
        dT: 20,
        h: 300,
      };
      const model = withShearProperties(
        referenceModel(c, v, section, material),
      );
      model.theory = "timoshenko";
      const beta =
          (v.E * v.I) /
          (model.members[0].G! * model.members[0].shearArea! * v.L * v.L),
        s = referenceSolution(c, v.a / v.L, beta),
        scale = referenceScales(c, v),
        r = analyze(model);
      for (const reaction of s.reactions)
        near(
          r.reactions[String.fromCharCode(65 + reaction.x)][
            reaction.type === "force" ? 1 : 2
          ],
          reaction.value *
            (reaction.type === "force" ? scale.force : scale.moment),
          1e-5,
        );
      for (let i = 0; i < r.members.length; i++)
        for (const p of r.members[i].stations) {
          const x = i + p.x / v.L,
            d = s.at(Math.min(c.spans, x));
          near(p.v, d.v * scale.deflection, 1e-5);
          near(p.rotation, d.rotation * scale.rotation, 1e-5);
        }
    },
  );
test("Hand thermal shear-flexibility compatibility: propped reaction = 3/(2+6 beta)", () => {
  const c = referenceCases.find((c) => c.id === "thermal-propped")!,
    beta = 0.02,
    s = referenceSolution(c, 1 / 3, beta);
  near(
    s.reactions.find((r) => r.x === 1 && r.type === "force")!.value,
    3 / (2 + 6 * beta),
  );
});
test("Every published SHS/RHS area and inertia versus independent rounded-corner hand geometry", () => {
  const rounded = (b: number, h: number, r: number) => {
    const c = h / 2 - r;
    return {
      A: b * h - (4 - Math.PI) * r * r,
      I:
        (b * h ** 3) / 12 -
        4 *
          (r ** 4 * (1 / 3 - Math.PI / 16) +
            (c * r ** 3) / 3 +
            c * c * r * r * (1 - Math.PI / 4)),
    };
  };
  for (const s of library.sections.filter((s) =>
    ["shs", "rhs"].includes(s.shape),
  )) {
    const outer = rounded(s.b, s.h, 1.5 * s.t),
      inner = rounded(s.b - 2 * s.t, s.h - 2 * s.t, s.t);
    near(s.A, outer.A - inner.A, 0.007);
    near(s.Iy, outer.I - inner.I, 0.007);
    const oz = rounded(s.h, s.b, 1.5 * s.t),
      iz = rounded(s.h - 2 * s.t, s.b - 2 * s.t, s.t);
    near(s.Iz, oz.I - iz.I, 0.007);
  }
});

test("Hand pattern envelope: two spans, sagging 49/512, hogging 1/8, lift-off 1/16", () => {
  const c = referenceCases.find((c) => c.id === "envelope-2")!,
    e = referenceEnvelope(c);
  near(e.positive, 49 / 512);
  near(e.negative, -1 / 8);
  near(e.reactions[0].min, -1 / 16);
  near(e.reactions[1].max, 5 / 4);
  assert.equal(e.patterns, 3);
});

test("L/20 guide nominates one nearest available depth per steel family and keeps alternative sizes", () => {
  const steel = library.materials.find((m) => m.id === "Steel-S355")!;
  const context = {
    material: steel,
    section,
    hasMaterial: true,
    hasSection: false,
    spanMetres: 6,
    hasSpan: true,
    mode: "analysis" as const,
  };
  const starters = smartChoices("S355,6m,", library, context).filter((c) =>
    c.group.startsWith("Starting sizes"),
  );
  assert.equal(starters.length, 9);
  assert.equal(
    new Set(
      starters.map(
        (c) => library.sections.find((s) => s.id === c.value)!.family,
      ),
    ).size,
    9,
  );
  for (const c of starters) {
    const s = library.sections.find((s) => s.id === c.value)!;
    assert.ok(
      library.sections
        .filter((o) => o.family === s.family)
        .every((o) => Math.abs(o.h - 300) >= Math.abs(s.h - 300)),
    );
    assert.match(c.explanation!, /not sized/);
  }
  const ipe = smartChoices("S355,6m,IPE", library, context);
  assert.equal(ipe[0].value.replace(/\s/g, ""), "IPE300");
  assert.equal(ipe.length, 9);
  assert.ok(ipe.some((c) => c.value !== ipe[0].value));
  assert.equal(parseQuick("S355,6m,IPE160", library).section?.h, 160);
});
test("L/20 rectangle has an editable example width; no span invents no L/20 recommendation", () => {
  const context = {
    material,
    section,
    hasMaterial: true,
    hasSection: false,
    mode: "formula" as const,
  };
  const normal = smartChoices("C24,", library, context);
  assert.ok(!normal.some((c) => c.group.startsWith("Starting sizes")));
  const rect = smartChoices("C24,6m,rect", library, {
    ...context,
    spanMetres: 6,
  });
  assert.equal(rect[0].value, "rect 100x300");
  assert.match(rect[0].explanation!, /Width|width/);
  assert.equal(parseQuick("C24,100x425", library).section?.h, 425);
  const concrete = library.materials.find((m) => m.id === "C30/37")!;
  const choices = smartChoices("C30/37,6m,", library, {
    ...context,
    material: concrete,
    spanMetres: 6,
  });
  assert.equal(choices[0].value, "rect 100x300");
  assert.ok(
    !choices
      .filter((c) => c.group.startsWith("Starting sizes"))
      .some((c) => /Sawn|IPE|RHS/.test(c.value)),
  );
});
test("Material family choices prioritize familiar grades and accept family plus grade or exact grade", () => {
  const context = {
    material,
    section,
    hasMaterial: false,
    hasSection: false,
    mode: "analysis" as const,
  };
  for (const [family, id] of [
    ["concrete", "C30/37"],
    ["timber", "C24"],
    ["steel", "Steel-S355"],
    ["glulam", "GL24h"],
  ]) {
    const c = smartChoices(family, library, context);
    assert.equal(c[0].value, id, family);
    assert.equal(c[0].replace, true);
    assert.equal(
      parseQuick(family + " " + id.replace(/^Steel-/, ""), library).material
        ?.id,
      id,
    );
  }
  assert.equal(parseQuick("C30/37", library).material?.E, 33000);
  assert.equal(parseQuick("concrete C24", library).material, undefined);
  assert.equal(parseQuick("C30/38", library).material, undefined);
  const partial = smartChoices("concrete C30", library, context);
  assert.equal(partial[0].value, "C30/37");
});
test("Completed units and grades advance without a trailing comma and family selection stays open", () => {
  const c = smartChoices("6m,3kN/m,C24", library, {
    material,
    section,
    hasMaterial: true,
    hasSection: false,
    hasSpan: true,
    hasLoad: true,
    spanMetres: 6,
  });
  assert.match(c[0].group, /Starting sizes/);
  assert.equal(c[0].replace, false);
  const f = smartChoices("C24,", library, {
    material,
    section,
    hasMaterial: true,
    hasSection: false,
  });
  assert.equal(f.find((c) => c.value === "rect")?.commit, false);
  assert.equal(f.find((c) => c.value === "Sawn")?.commit, false);
});

test("M/W does not silently use bounding-axis W for a coupled angle", () => {
  const f = formulas.find((f) => f.id === "bending-stress")!,
    a = library.sections.find((s) => s.shape === "angle")!;
  const v = {
    L: 1000,
    P: 1000,
    q: 1,
    E: 210000,
    I: a.Iy,
    A: a.A,
    W: a.Wy,
    N: 1000,
    M: 1e6,
    K: 1,
    a: 0,
    section: a,
  };
  assert.throws(() => calculate(f, v), /coupled bending/);
  assert.equal(calculate(f, { ...v, W: 10000 })[0].value, 100);
});

test("Retained Euler and scalar functions can be found by visible engineering names", () => {
  const f = (id: string) => formulas.find((f) => f.id === id)!;
  for (const word of ["Euler", "Euler buckling", "buckling", "eurler"])
    assert.ok(formulaSearchScore(word, f("euler")) > 0, word);
  for (const id of ["axial-stress", "bending-stress", "rect-shear"])
    assert.ok(formulaSearchScore("stress finder", f(id)) > 0, id);
  assert.ok(formulaSearchScore("section modulus", f("modulus")) > 0);
  assert.ok(formulaSearchScore("gyration radius", f("radius")) > 0);
});
test("Rectangle stress calculator accepts the equation's V notation with exact force units", () => {
  const f = formulas.find((f) => f.id === "rect-shear")!,
    p = parseFormulaInput("V=10kN,100x200", f, library);
  assert.deepEqual(p.errors, []);
  assert.equal(p.values.P, 10000);
  assert.equal(p.section?.A, 20000);
});
