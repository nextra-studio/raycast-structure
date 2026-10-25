/** Renders real result diagrams with the extension's own renderer for README/Store use: node scripts/render-readme-images.mjs */
import { build } from "esbuild";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const scratch = mkdtempSync(join(tmpdir(), "structural-render-"));
const out = resolve("docs/img");
mkdirSync(out, { recursive: true });
const api = `export const environment={supportPath:${JSON.stringify(scratch)},assetsPath:${JSON.stringify(resolve("assets"))},appearance:process.env.APPEARANCE||"dark"};export const LocalStorage={getItem:async()=>undefined,setItem:async()=>{}};export const getPreferenceValues=()=>({defaultMaterial:"C24",precision:"3",diagramTextSize:"22"});`;
const entry = `
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadLibrary } from ${JSON.stringify(resolve("src/core/library"))};
import { buildModel } from ${JSON.stringify(resolve("src/core/templates"))};
import { analyze } from ${JSON.stringify(resolve("src/core/engine"))};
import { customSection } from ${JSON.stringify(resolve("src/core/sections"))};
import { withShearProperties } from ${JSON.stringify(resolve("src/core/deformation"))};
import { analysisDashboard, enlargedDiagram } from ${JSON.stringify(resolve("src/ui/drawings"))};
import { initializeRenderer, pngFromSVG } from ${JSON.stringify(resolve("src/ui/raster"))};
const lib = loadLibrary(${JSON.stringify(resolve("assets/library"))});
await initializeRenderer(${JSON.stringify(resolve("assets"))});
const cases = [
  ["result-simply-supported", { template: "simple", spans: [6], q: -3, section: customSection("rectangle", [100, 300]), material: "C24" }],
  ["result-continuous", { template: "continuous", spans: [4, 4, 4], q: -3, section: customSection("rectangle", [100, 300]), material: "C24" }],
];
for (const [name, c] of cases) {
  const material = lib.materials.find((m) => m.id === c.material);
  const model = withShearProperties(buildModel({
    template: c.template, spans: c.spans, pitch: 0, section: c.section, material, axis: "y", q: c.q,
    direction: "globalZ", basis: "member", theory: "timoshenko", tie: false, ridgeHinge: false,
    selfWeight: false, leftOverhang: 0, rightOverhang: 0,
  }));
  const svg = analysisDashboard(model, analyze(model), c.section, "y", true, { material: c.material });
  
  const uri = analysisDashboard(model, analyze(model), c.section, "y", false, { material: c.material });
  writeFileSync(join(${JSON.stringify(out)}, name + "-wide.png"), Buffer.from(enlargedDiagram(uri).split(",")[1], "base64"));
  console.log("wrote", name);
}
`;
try {
  await build({
    stdin: { contents: entry, resolveDir: resolve("scripts"), loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: join(scratch, "render.mjs"),
    logLevel: "error",
    banner: {
      js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
    },
    plugins: [
      {
        name: "raycast-stub",
        setup(b) {
          b.onResolve({ filter: /^@raycast\/api$/ }, (a) => ({
            path: a.path,
            namespace: "stub",
          }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
            contents: api,
            loader: "js",
          }));
        },
      },
    ],
  });
  await import(pathToFileURL(join(scratch, "render.mjs")).href);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
