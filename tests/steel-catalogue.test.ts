import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import fixtures from "./steel-source-fixtures.json";
import { parseCSV } from "../src/core/csv";
import { sectionFromRow } from "../src/core/sections";
const rows = new Map(
  parseCSV(readFileSync("assets/library/sections-steel.csv", "utf8")).map(
    (r) => [r.id, r],
  ),
);
const number = (s: string) => Number(s.replace(/,/g, ""));
test("All 687 added catalogue records: original dimensions and published numerical fields match frozen source tables", () => {
  const last: Record<string, number[]> = {};
  let comparisons = 0;
  for (const fixture of fixtures) {
    const raw = rows.get(fixture.id)!;
    assert.ok(raw, fixture.id);
    const s = sectionFromRow(raw),
      r = fixture.cells;
    const check = (key: string, value: number) => {
      assert.ok(
        Math.abs(Number(raw[key]) - value) <=
          1e-10 * Math.max(1, Math.abs(value)),
        `${s.id}: ${key} ${raw[key]} != ${value}`,
      );
      comparisons++;
    };
    if (["IPE", "HEA", "HEB", "HEM"].includes(s.family)) {
      for (const [key, index, factor] of [
        ["mass", 2, 1],
        ["h", 3, 1],
        ["b", 4, 1],
        ["tw", 5, 1],
        ["tf", 6, 1],
        ["r", 7, 1],
        ["Iy", 16, 1e4],
        ["Iz", 17, 1e4],
        ["Wy_published", 20, 1e3],
        ["Wz_published", 21, 1e3],
        ["Wply", 22, 1e3],
        ["Wplz", 23, 1e3],
        ["Iw", 26, 1e12],
        ["J", 27, 1e4],
        ["A", 28, 100],
      ] as [string, number, number][])
        check(key, number(r[index]) * factor);
    } else if (s.family === "UPN") {
      for (const [key, index, factor] of [
        ["mass", 2, 1],
        ["h", 3, 1],
        ["b", 4, 1],
        ["tw", 5, 1],
        ["tf", 6, 1],
        ["r", 7, 1],
        ["cy", 12, 10],
        ["Iy", 18, 1e4],
        ["Iz", 19, 1e4],
        ["Wy_published", 22, 1e3],
        ["Wz_published", 23, 1e3],
        ["Wply", 24, 1e3],
        ["Wplz", 25, 1e3],
        ["Iw", 28, 1e12],
        ["J", 29, 1e4],
        ["A", 30, 100],
      ] as [string, number, number][])
        check(key, number(r[index]) * factor);
    } else if (s.family === "Equal L") {
      if (r[0]) last[s.family] = r[0].split("x").map(number);
      check("h", last[s.family][0]);
      check("b", last[s.family][1]);
      for (const [key, index, factor] of [
        ["tw", 1, 1],
        ["tf", 1, 1],
        ["mass", 3, 1],
        ["r", 4, 1],
        ["cy", 6, 10],
        ["cz", 6, 10],
        ["Iy", 7, 1e4],
        ["Iz", 7, 1e4],
        ["Wy_published", 13, 1e3],
        ["Wz_published", 13, 1e3],
        ["J", 14, 1e4],
        ["A", 16, 100],
      ] as [string, number, number][])
        check(key, number(r[index]) * factor);
      check("Iyz", (-(number(r[8]) - number(r[9])) * 1e4) / 2);
    } else {
      const dims = r[0].match(/\d+(?:\.\d+)?/g)!.map(number);
      if (dims.length > 1) last[s.family] = dims.slice(0, -1);
      check("h", last[s.family][0]);
      check("b", last[s.family][1] || last[s.family][0]);
      check("t", dims.at(-1)!);
      check("mass", number(r[1]));
      check("A", number(r[2]) * 100);
      const indices =
        s.family === "RHS"
          ? [
              ["Iy", 5, 1e4],
              ["Iz", 6, 1e4],
              ["Wy_published", 9, 1e3],
              ["Wz_published", 10, 1e3],
              ["Wply", 11, 1e3],
              ["Wplz", 12, 1e3],
              ["J", 13, 1e4],
            ]
          : [
              ["Iy", 4, 1e4],
              ["Iz", 4, 1e4],
              ["Wy_published", 6, 1e3],
              ["Wz_published", 6, 1e3],
              ["Wply", 7, 1e3],
              ["Wplz", 7, 1e3],
              ["J", 8, 1e4],
            ];
      for (const [key, index, factor] of indices as [string, number, number][])
        check(key, number(r[index]) * factor);
    }
  }
  assert.equal(rows.size, 687);
  assert.ok(comparisons > 8000);
  console.log(comparisons + " individual published numeric fields compared");
});
