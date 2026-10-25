import { systemExample, annotatedExample } from "../src/ui/input-help";
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadLibrary } from "../src/core/library";
import { parseQuick } from "../src/core/input";
import { analysisGuidance } from "../src/core/guidance";
import { beamChoices } from "../src/core/beam-choices";
import { customSection } from "../src/core/sections";
const lib = loadLibrary(join(process.cwd(), "assets/library"));
function flow(query: string) {
  const quick = parseQuick(query, lib),
    prefix = parseQuick(query.split(",").slice(0, -1).join(","), lib),
    material = quick.material || lib.materials.find((m) => m.id === "C24")!,
    section = quick.section || customSection("rectangle", [100, 200]);
  const confirmed = {
    system: !!quick.template,
    material: !!quick.material,
    section: !!quick.section,
  };
  const c = {
    template: quick.template || "simple",
    spans: quick.spans?.join("/") || "",
    pitch: String(quick.pitch || 0),
    q: quick.q === undefined ? "" : String(quick.q),
    pointValue: quick.P === undefined ? "" : String(quick.P),
    jointLoad: "",
    confirmed,
  };
  const stage = analysisGuidance(query, quick, c),
    choices = beamChoices(query, lib, {
      stage,
      quick,
      material,
      section,
      hasMaterial: confirmed.material,
      hasSection: confirmed.section,
      hasSpan: !!quick.spans,
      hasLoad: quick.q !== undefined || quick.P !== undefined,
      point: quick.P !== undefined,
      roof: ["roof", "inclined"].includes(c.template),
      numberKind: quick.pendingSection
        ? "dimension"
        : prefix.spans
          ? "load"
          : "span",
      spanMetres: quick.spans ? Math.max(...quick.spans) : undefined,
    });
  return { stage, choices, quick };
}
test("Guided beam input follows system, span, load, material and L/20 section", () => {
  const steps: [[string, string, string], ...Array<[string, string, string]>] =
    [
      ["", "system", "simply"],
      ["simply,", "span", "6m"],
      ["simply,6m,", "load", "3kN/m"],
      ["simply,6m,3kN/m,", "material", "C24"],
      ["simply,6m,3kN/m,C24,", "section", "rect 100x300"],
    ];
  for (const [text, kind, value] of steps) {
    const f = flow(text);
    assert.equal(f.stage.kind, kind, text);
    assert.equal(f.choices[0].value, value, text);
  }
  assert.equal(flow("simply,6m,3kN/m,C24,100x300").stage.kind, "ready");
});
test("System-first cantilever still offers material after the load, then the correct span-based depth", () => {
  assert.equal(flow("cantilever,4.5m,4.5kN/m,").choices[0].value, "C24");
  const f = flow("cantilever,4.5m,4.5kN/m,C30/37,");
  assert.equal(f.stage.kind, "section");
  assert.equal(f.choices[0].value, "rect 100x225");
});
test("Free-order complete input retains actual concrete and exact dimensions", () => {
  const f = flow("cantilever,C30/37,rect 200x1000,4.5m,4.5kN/m");
  assert.equal(f.stage.kind, "ready");
  assert.equal(f.quick.material?.id, "C30/37");
  assert.equal(f.quick.material?.E, 33000);
  assert.equal(f.quick.section?.h, 1000);
  assert.equal(f.quick.q, -4.5);
});
test("Bare span and load numbers offer context-specific units rather than skipping the stage", () => {
  assert.equal(flow("simply,6").choices[0].value, "6m");
  const f = flow("simply,6m,3");
  assert.equal(f.choices[0].value, "3kN/m");
  assert.ok(f.choices.some((c) => c.value === "3kN"));
});
test("Roof direction and point position can be entered before material without losing the next step", () => {
  const f = flow("rafter,8m,pitch 30deg,10kN,at 40%,local down,projected,");
  assert.equal(f.stage.kind, "material");
  assert.ok(f.choices.some((c) => c.group.startsWith("Material /")));
  assert.equal(f.quick.direction, "localZ");
  assert.equal(f.quick.basis, "projected");
});
test("Material family filtering and continuous span recommendations remain available in the guided flow", () => {
  assert.equal(flow("simply,6m,3kN/m,concrete").choices[0].value, "C30/37");
  const f = flow("continuous 3,4/7/5m,3kN/m,S355,IPE");
  assert.equal(f.choices[0].value.replace(/\s/g, ""), "IPE360");
  assert.equal(f.choices.length, 9);
});
test("Custom section height suggestion follows the entered span and full results need confirmed properties", () => {
  assert.equal(flow("simply,4.5m,3kN/m,C24,rect,100").stage.value, "225");
  assert.equal(flow("simply,6m,3kN/m").stage.kind, "material");
  assert.equal(flow("simply,6m,3kN/m,C24").stage.kind, "section");
});

test("Every system-first gray example and its annotated help can be pasted into the parser", () => {
  for (const system of [
    "simple",
    "cantilever",
    "fixed",
    "propped",
    "continuous",
    "inclined",
    "roof",
    "truss",
  ])
    for (const text of [systemExample(system), annotatedExample(system)]) {
      const p = parseQuick(text, lib);
      assert.deepEqual(p.messages, [], text);
      assert.deepEqual(p.unresolved, [], text);
      assert.ok(p.template, text);
      assert.ok(p.material, text);
      assert.ok(p.section, text);
    }
});

test("Roof and inclined guidance asks direction before magnitude, without changing complete legacy input", () => {
  for (const system of ["rafter", "angled"]) {
    const prefix = system + ",8m,pitch 30deg,";
    const f = flow(prefix);
    assert.equal(f.stage.kind, "direction");
    assert.equal(f.choices[0].value, "global down, member");
    assert.ok(f.choices.some((c) => c.value === "global down, projected"));
    assert.ok(f.choices.some((c) => c.value === "local down, member"));
    for (const choice of f.choices) {
      const next = flow(prefix + choice.value + ",");
      assert.equal(next.stage.kind, "load");
      const magnitude = flow(prefix + choice.value + ",3kN/m,");
      assert.equal(magnitude.stage.kind, "material");
      assert.deepEqual(magnitude.quick.messages, []);
      assert.deepEqual(magnitude.quick.unresolved, []);
      assert.equal(Math.abs(magnitude.quick.q!), 3);
    }
    assert.equal(flow(prefix + "3kN/m,C24,100x300").stage.kind, "ready");
  }
});
