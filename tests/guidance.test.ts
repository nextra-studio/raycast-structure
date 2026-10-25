import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadLibrary } from "../src/core/library";
import { parseQuick } from "../src/core/input";
import { analysisGuidance } from "../src/core/guidance";
const library = loadLibrary(join(process.cwd(), "assets/library"));
const blank = {
  spans: "",
  pitch: "0",
  q: "",
  pointValue: "",
  jointLoad: "",
  template: "simple",
};
test("RHS comma dimensions advance the hint rather than being interpreted as spans", () => {
  for (const [input, index] of [
    ["rhs", 0],
    ["rhs,200", 1],
    ["rhs,200,100", 2],
  ] as const) {
    const q = parseQuick(input, library);
    assert.equal(q.pendingSection?.values.length, index);
    assert.equal(q.spans, undefined);
    assert.match(
      analysisGuidance(input, q, blank).title,
      new RegExp(["Height", "Width", "Thickness"][index], "i"),
    );
  }
  const q = parseQuick("rhs,200,100,6,6m", library);
  assert.equal(q.section?.h, 200);
  assert.equal(q.section?.b, 100);
  assert.equal(q.section?.t, 6);
  assert.deepEqual(q.spans, [6]);
});
test("continuous, roof pitch, load and ready states have different hints", () => {
  const continuous = parseQuick("continuous", library);
  assert.match(
    analysisGuidance("continuous", continuous, {
      ...blank,
      template: "continuous",
    }).title,
    /span lengths/,
  );
  assert.equal(
    analysisGuidance("roof,8m", parseQuick("roof,8m", library), {
      ...blank,
      spans: "8",
      template: "roof",
    }).kind,
    "pitch",
  );
  assert.equal(
    analysisGuidance("6m", parseQuick("6m", library), { ...blank, spans: "6" })
      .kind,
    "load",
  );
  assert.equal(
    analysisGuidance("6m,udl -3", parseQuick("6m,udl -3", library), {
      ...blank,
      spans: "6",
      q: "-3",
    }).kind,
    "ready",
  );
});
