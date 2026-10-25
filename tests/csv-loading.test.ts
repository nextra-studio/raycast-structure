import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLibrary, libraryCSVFiles } from "../src/core/library";
import { writeCSV } from "../src/core/csv";
test("Additional material and section CSVs are loaded from disk; edits are read on reload and base IDs win", () => {
  const directory = mkdtempSync(join(tmpdir(), "structural-csv-loader-"));
  try {
    cpSync(join(process.cwd(), "assets/library"), directory, {
      recursive: true,
    });
    const file = join(directory, "materials-project.csv");
    const rows = [
      { id: "C24", family: "Sawn", E: "99999", G: "" },
      { id: "Project timber", family: "Project", E: "12345", G: "600" },
    ];
    writeFileSync(file, writeCSV(rows));
    writeFileSync(
      join(directory, "sections-project.csv"),
      writeCSV([
        {
          id: "Project 80x160",
          family: "Project rectangles",
          shape: "rectangle",
          b: "80",
          h: "160",
        },
      ]),
    );
    const first = loadLibrary(directory);
    assert.equal(first.materials.length, 49);
    assert.equal(first.sections.length, 714);
    assert.equal(first.materials.find((m) => m.id === "C24")?.E, 11000);
    assert.equal(
      first.materials.find((m) => m.id === "Project timber")?.E,
      12345,
    );
    assert.equal(
      first.sections.find((s) => s.id === "Project 80x160")?.family,
      "Project rectangles",
    );
    assert.ok(libraryCSVFiles(directory).includes("materials-project.csv"));
    rows[1].E = "23456";
    writeFileSync(file, writeCSV(rows));
    assert.equal(
      loadLibrary(directory).materials.find((m) => m.id === "Project timber")
        ?.E,
      23456,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
