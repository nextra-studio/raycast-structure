import { test } from "node:test";
import assert from "node:assert/strict";
import cases from "./reference-benchmarks.json";
import { buildModel, AnalysisInput } from "../src/core/templates";
import { customSection } from "../src/core/sections";
import { analyze } from "../src/core/engine";
import { loadLibrary } from "../src/core/library";
import { join } from "node:path";
const lib = loadLibrary(join(process.cwd(), "assets/library")),
  section = customSection("rectangle", [100, 300]),
  material = lib.materials.find((m) => m.id === "C24")!;
for (const c of cases)
  test("EN1995 reference comparison: " + c.name, () => {
    const i: AnalysisInput = {
      template: "continuous",
      spans: c.spans,
      pitch: 0,
      section,
      material,
      axis: "y",
      q: -3,
      direction: "globalZ",
      basis: "member",
      theory: c.shear ? "timoshenko" : "euler",
      tie: false,
      ridgeHinge: false,
      selfWeight: false,
      leftOverhang: c.aL,
      rightOverhang: c.aR,
    };
    const model = buildModel(i);
    const supports = model.nodes.filter((n) => n.id !== "L" && n.id !== "R");
    if (c.fixL) supports[0].restraints = [true, true, true];
    if (c.fixR) supports.at(-1)!.restraints = [true, true, true];
    for (const [p, x] of c.points) {
      let acc = 0;
      const idx = c.spans.findIndex((L) => {
        const hit = x >= acc && x <= acc + L;
        if (!hit) acc += L;
        return hit;
      });
      model.memberLoads.push({
        member: model.members[idx + (c.aL ? 1 : 0)].id,
        kind: "point",
        magnitude: -p * 1000,
        position: (x - acc) * 1000,
        direction: "globalZ",
        basis: "member",
      });
    }
    const r = analyze(model);
    const near = (actual: number, expected: number) =>
      assert.ok(
        Math.abs(actual - expected) < 2e-5 * Math.max(1, Math.abs(expected)),
        `${c.name}: ${actual} != ${expected}`,
      );
    supports.forEach((n, j) =>
      near(r.reactions[n.id][1] / 1000, c.reactions[j]),
    );
    for (const s of c.stations) {
      const member = r.members[s.k - 1 + (c.aL ? 1 : 0)];
      const target = s.s * 1000;
      const isPoint = model.memberLoads.some(
        (l) =>
          l.member === member.id &&
          l.kind === "point" &&
          Math.abs(l.position! - target) < 1e-5,
      );
      const p = member.stations
        .filter((p) => !isPoint || p.x < target)
        .reduce((a, b) =>
          Math.abs(a.x - target) < Math.abs(b.x - target) ? a : b,
        );
      near(p.M / 1e6, s.M);
      near(p.V / 1000, s.V);
      near(p.v / 1000, s.v);
    }
  });
