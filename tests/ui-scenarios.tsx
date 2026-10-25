import { propertyInfo } from "../src/core/section-properties";
import { equation } from "../src/ui/equations";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import * as hooks from "react";
import { pushed, environment } from "@raycast/api";
import {
  ViewActions,
  saveDiagramImage,
  diagramFromMarkdown,
  saveDiagramViewer,
  previewMarkdown,
  DiagramPreview,
  EnlargeDiagramRow,
} from "../src/ui/view-actions";
import { initializeRenderer } from "../src/ui/raster";
import { pngFromSVG } from "../src/ui/raster";
import Library from "../src/library";
import Formulas from "../src/formulas";
import Analysis from "../src/analysis";
import Structures from "../src/structures";
import Guide from "../src/guide";
import ReferenceLibrary from "../src/reference-library";
import { referenceCases } from "../src/core/reference-cases";
import { loadLibrary } from "../src/core/library";
import { buildModel } from "../src/core/templates";
import { analyze } from "../src/core/engine";
import { deformationParts, withShearProperties } from "../src/core/deformation";
import {
  analysisDashboard,
  modelDrawing,
  formulaDrawing,
} from "../src/ui/drawings";
import { customSection } from "../src/core/sections";
import { formulaCatalog } from "../src/core/formula-catalog";
import { FormulaCalculator } from "../src/formula-command";
import { formulas } from "../src/core/formulas";
import { runInNewContext } from "node:vm";
function nodes(tree: any): any[] {
  if (!tree || typeof tree !== "object") return [];
  return [
    tree,
    ...[
      tree.props?.children,
      tree.props?.detail,
      tree.props?.actions,
      tree.props?.searchBarAccessory,
    ]
      .flat(Infinity)
      .flatMap(nodes),
  ];
}
async function render(C: any, props: any = {}) {
  let t: any;
  for (let j = 0; j < 3; j++) {
    hooks.start();
    t = C(props);
    hooks.flush();
    await new Promise((r) => setImmediate(r));
  }
  return t;
}
const visible = (md: string) => md.replace(/data:image\/png;base64,[^)]+/g, "");
const action = (tree: any, title: string) => {
  const node = nodes(tree).find(
    (n) => n.props?.title === title && n.props?.onAction,
  );
  assert.ok(node, title + " must exist");
  node.props.onAction();
};
function markdown(tree: any, prefix: string) {
  const node = nodes(tree).find((n) => n.props?.markdown?.includes(prefix));
  assert.ok(node, prefix + " must exist");
  return node.props.markdown as string;
}
function qa(name: string, md: string) {
  if (!process.env.STRUCTURAL_QA_DIR) return;
  mkdirSync(process.env.STRUCTURAL_QA_DIR, { recursive: true });
  const images = [
    ...md.matchAll(/!\[[^\]]*\]\((data:image\/png;base64,[^)]+)\)/g),
  ];
  assert.ok(images.length);
  images.forEach((match, i) => {
    const png = Buffer.from(match[1].split(",")[1], "base64");
    assert.equal(png.readUInt32BE(0), 0x89504e47);
    writeFileSync(
      process.env.STRUCTURAL_QA_DIR + "/" + name + "-" + i + ".png",
      png,
    );
    const w = png.readUInt32BE(16),
      h = png.readUInt32BE(20);
    const pane = pngFromSVG(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${environment.appearance === "dark" ? "#25272d" : "#ffffff"}"/><image href="${match[1]}" width="${w}" height="${h}"/></svg>`,
      430,
    );
    assert.equal(pane.readUInt32BE(16), 430);
    writeFileSync(
      process.env.STRUCTURAL_QA_DIR + "/" + name + "-" + i + "-pane.png",
      pane,
    );
  });
}
async function main() {
  await initializeRenderer(environment.assetsPath);
  const plain = "![Diagram](data:image/png;base64,AAAA)";
  assert.equal(
    previewMarkdown(
      `[${plain}](file:///C:/diagram-previews/old.html#diagram=0)`,
    ),
    plain,
  );
  assert.equal(previewMarkdown(plain), plain);
  const engineeringLib = loadLibrary("assets/library"),
    engineeringMaterial = engineeringLib.materials.find(
      (m) => m.id === "Steel-S355",
    )!,
    engineeringSection = engineeringLib.sections.find(
      (s) => s.id === "IPE 200",
    )!;
  for (const [id, input, checks] of [
    [
      "torsion-sv",
      "T=1kNm,S355,IPE200,3m",
      ["Open-section thin-strip", "St. Venant torsion"],
    ],
    [
      "torsion-sv",
      "T=1kNm,C24,100x300,3m",
      ["Solid rectangle", "converged elastic series"],
    ],
    [
      "torsion-warping",
      "cantilever restrained,3m,T=1kNm,S355,IPE200",
      ["Stress recovery", "Bimoment", "Warping normal"],
    ],
    [
      "torsion-warping",
      "fork free,3m,T=1kNm,at 0.3L,S355,IPE200",
      ["Support reactions", "Torque split diagram"],
    ],
    [
      "ltb",
      "uniform moment,3m,S355,IPE200,fy=355MPa",
      ["EC3 factors", "Mcr", "Class 3"],
    ],
    ["ltb", "udl,6m,C24,100x300", ["EC5 factors", "E0,05", "kcrit"]],
    [
      "euler",
      "3m,C24,100x200,Ky=0.5,Kz=2",
      ["EC5 column factors", "kc", "E0,05"],
    ],
    ["euler", "3m,S355,IPE200,fy=355MPa", ["EC3 column factors", "curve b"]],
    [
      "euler",
      "3m,S355,IPE200",
      ["confirm the applicable product", "fy=355MPa"],
    ],
  ] as [string, string, string[]][]) {
    hooks.reset();
    const props = {
      formula: formulas.find((f) => f.id === id)!,
      library: engineeringLib,
      initial: {
        material: engineeringMaterial,
        section: engineeringSection,
        values: {},
        overrides: {},
      },
      initialQuery: input,
    };
    const view = await render(FormulaCalculator, props),
      md = nodes(view).find((n) => n.props?.id === "calculation").props.detail
        .props.markdown;
    assert.ok(!visible(md).includes("Check input:"), visible(md));
    for (const text of checks)
      assert.ok(visible(md).includes(text), id + ": " + text);
    qa(
      "new-" +
        id +
        "-" +
        (input.includes("C24")
          ? "timber"
          : input.includes("fork")
            ? "fork"
            : "steel"),
      md,
    );
    assert.ok(
      nodes(ViewActions({ markdown: md, title: id })).some(
        (n) => n.props?.title === "Enlarge Diagram",
      ),
    );
    const file = saveDiagramViewer(md, id),
      html = readFileSync(file, "utf8");
    assert.ok(html.includes("Content-Security-Policy"));
    assert.ok(!html.includes("<script src="));
    const script = html.match(/<script>([\s\S]*)<\/script>/)![1];
    const elements: any = {};
    for (const name of [
      "viewport",
      "image",
      "level",
      "diagram",
      "plus",
      "minus",
      "fit",
      "actual",
      "full",
    ])
      elements[name] = {
        style: {},
        classList: { add: () => {}, remove: () => {} },
        clientWidth: 900,
        naturalWidth: 840,
        scrollLeft: 0,
        scrollTop: 0,
        scrollTo: () => {},
        setPointerCapture: () => {},
        addEventListener(event: string, fn: any) {
          this[event] = fn;
        },
      };
    const dom: any = {
      getElementById: (k: string) => elements[k],
      documentElement: { requestFullscreen: () => {} },
      exitFullscreen: () => {},
    };
    runInNewContext(script, { document: dom });
    elements.image.onload();
    const width = parseInt(elements.image.style.width);
    elements.plus.onclick();
    assert.ok(parseInt(elements.image.style.width) > width);
    elements.actual.onclick();
    assert.equal(elements.image.style.width, "840px");
    let prevented = false;
    elements.viewport.wheel({
      ctrlKey: true,
      deltaY: -1,
      preventDefault: () => {
        prevented = true;
      },
    });
    assert.ok(prevented);
    assert.ok(parseInt(elements.image.style.width) > 840);
    elements.viewport.onpointerdown({
      button: 0,
      clientX: 200,
      clientY: 200,
      pointerId: 1,
    });
    elements.viewport.onpointermove({ clientX: 100, clientY: 80 });
    assert.equal(elements.viewport.scrollLeft, 100);
    assert.equal(elements.viewport.scrollTop, 120);
    elements.viewport.onpointerup();
    runInNewContext(script, {
      document: dom,
      location: { hash: "#diagram=1" },
    });
    const expectedImages = JSON.parse(
      script.match(/const images=(\[[\s\S]*?\]);const vp/)![1],
    );
    assert.equal(
      elements.image.src,
      expectedImages[Math.min(1, expectedImages.length - 1)],
    );
    elements.diagram.onchange({ target: { value: "0" } });
    assert.ok(elements.image.src.startsWith("data:image/png;base64,"));
    assert.equal(
      previewMarkdown(md),
      md,
      "Inline images must stay bare, never wrapped in links",
    );
    assert.ok(
      !md.includes("[!["),
      "Linked images cause native Windows clipping",
    );
    assert.ok(
      !md.includes("file:///"),
      "Inline rendering must not depend on external file links",
    );
    const rowNode = nodes(view).find((n) => n.type === EnlargeDiagramRow);
    assert.ok(rowNode, "A visible Enlarge diagram row is required");
    const row = EnlargeDiagramRow(rowNode.props);
    action(row, "Enlarge Diagram");
    const descriptor = pushed.at(-1)!;
    assert.equal(descriptor.type, DiagramPreview);
    hooks.reset();
    let popup = await render(descriptor.type, descriptor.props);
    assert.equal(popup.type.displayName, "Detail");
    assert.ok(popup.props.markdown.startsWith("!["));
    assert.ok(!popup.props.markdown.includes("[!["));
    assert.equal(
      [...popup.props.markdown.matchAll(/!\[/g)].length,
      1,
      "Native popup contains only one full-width image",
    );
    assert.ok(popup.props.navigationTitle.includes("Diagram 1 /"));
    const browser = nodes(popup).find(
      (n) => n.props?.title === "Open Zoom Viewer in Browser",
    );
    assert.ok(browser.props.url.startsWith("file:///"));
    const pngAction = nodes(popup).find(
      (n) => n.props?.title === "Open Diagram Image",
    );
    assert.equal(
      readFileSync(pngAction.props.target).readUInt32BE(0),
      0x89504e47,
    );
    const next = nodes(popup).find((n) => n.props?.title === "Next Diagram");
    if (next) {
      const before = popup.props.markdown;
      next.props.onAction();
      popup = await render(descriptor.type, descriptor.props);
      assert.ok(popup.props.navigationTitle.includes("Diagram 2 /"));
      assert.notEqual(popup.props.markdown, before);
    }

    if (process.env.STRUCTURAL_QA_DIR)
      writeFileSync(
        process.env.STRUCTURAL_QA_DIR + "/" + id + "-viewer.html",
        html,
      );
  }
  for (const id of ["torsion-warping", "ltb"]) {
    hooks.reset();
    const props = {
      formula: formulas.find((f) => f.id === id)!,
      library: engineeringLib,
      initial: {
        material: engineeringMaterial,
        section: engineeringSection,
        values: {},
        overrides: {},
      },
    };
    let view = await render(FormulaCalculator, props);
    const chosen = nodes(view).find(
      (n) => n.props?.id === view.props.selectedItemId,
    );
    assert.ok(chosen);
    assert.ok(/Cantilever|Uniform moment/.test(chosen.props.title));
    action(chosen, "Use " + chosen.props.title);
    view = await render(FormulaCalculator, props);
    assert.ok(
      view.props.searchText.includes(
        id === "ltb" ? "uniform moment" : "cantilever restrained",
      ),
    );
  }
  hooks.reset();
  let clipped = await render(Analysis);
  clipped.props.onSearchTextChange("simply, 6m, 3kN/m, C14, rect 100x300,");
  clipped = await render(Analysis);
  const reported = nodes(clipped).find((n) => n.props?.id === "results");
  assert.ok(reported);
  const reportedMD = reported.props.detail.props.markdown;
  assert.ok(reportedMD.startsWith("![Analysis summary"));
  assert.ok(
    !reportedMD.includes("[!["),
    "Reported C14 summary must remain a bare, fit-to-pane image",
  );
  const firstAction = reported.props.actions.props.children
    .flat(Infinity)
    .find((n: any) => n && typeof n === "object");
  assert.equal(
    firstAction.type,
    ViewActions,
    "Calculated Overview primary action must enlarge, not edit",
  );
  assert.ok(
    nodes(clipped).some((n) => n.type === EnlargeDiagramRow),
    "Reported beam must have a visible enlarge row",
  );
  console.log(
    "Torsion, warping, EC3/EC5 FYI, staged cases, equation rendering and real viewer zoom/pan handlers passed",
  );
  if (process.env.STRUCTURAL_QA_ENGINEERING_ONLY === "1") return;
  for (const p of propertyInfo) {
    assert.match(equation(p.tex), /data:image\/png;base64,/);
    if (p.codeTex) assert.match(equation(p.codeTex), /data:image\/png;base64,/);
  }

  for (const category of ["material", "section"]) {
    hooks.reset();
    const hub = await render(Library);
    const pageName = category === "material" ? "Materials" : "Sections";
    const before = pushed.length;
    action(hub, "Open " + pageName);
    assert.equal(pushed.length, before + 1);
    const destination = pushed.at(-1)!;
    assert.equal(destination.props.category, category);
    hooks.reset();
    let view = await render(destination.type, destination.props);
    if (category === "section") {
      assert.ok(nodes(view).some((n) => n.props?.id === "family-HEB"));
      view.props.onSearchTextChange("IPE200");
      view = await render(Library, { category });
    }
    const names = nodes(view)
      .filter((n) => n.type?.displayName === "List.Item")
      .map((n) => n.props.title);
    assert.ok(names.includes(category === "material" ? "C30/37" : "IPE 200"));
    assert.ok(!names.includes(category === "material" ? "IPE 200" : "C30/37"));
    assert.ok(!names.some((n) => n?.startsWith("Custom ")));
    assert.ok(
      nodes(view)
        .filter((n) => n.props?.markdown)
        .every((n) => !n.props.markdown.includes("Unavailable")),
    );
  }
  hooks.reset();
  const hub = await render(Library);
  action(hub, "Show CSV Files and Path");
  const sourcesPage = pushed.at(-1)!;
  hooks.reset();
  const sources = await render(sourcesPage.type, sourcesPage.props);
  assert.match(sources.props.markdown, /Active folder/);
  assert.match(
    sources.props.markdown,
    /48 unique materials and 713 unique sections/,
  );
  for (const name of ["materials.csv", "sections.csv", "sections-steel.csv"])
    assert.ok(sources.props.markdown.includes(name));
  const copyPath = nodes(sources).find(
    (n) => n.props?.title === "Copy CSV Folder Path",
  );
  assert.equal(
    copyPath.props.content,
    require("node:path").join(environment.supportPath, "library"),
  );
  assert.ok(sources.props.markdown.includes(copyPath.props.content));
  assert.match(sources.props.markdown, /Automatic personal folder/);
  console.log(
    "Library hub opens both pages; CSV status shows the resolved folder, files and loaded counts",
  );
  hooks.reset();
  const beforeStartup = pushed.length;
  let home = await render(Structures);
  assert.equal(
    pushed.length,
    beforeStartup,
    "Opening Structures must not navigate",
  );
  assert.equal(home.props.navigationTitle, "Structures");
  assert.ok(
    !home.props.searchBarAccessory,
    "Start menu has no navigation dropdown",
  );
  for (const id of [
    "euler",
    "axial-stress",
    "bending-stress",
    "rect-shear",
    "axial-deformation",
    "properties",
    "radius",
  ])
    assert.ok(
      nodes(home).some((n) => n.props?.id === id),
      id + " remains visible",
    );
  home.props.onSearchTextChange("buckling");
  home = await render(Structures);
  assert.ok(nodes(home).some((n) => n.props?.id === "euler"));
  assert.equal(pushed.length, beforeStartup, "Searching must not navigate");
  home.props.onSearchTextChange("eurler");
  home = await render(Structures);
  assert.ok(nodes(home).some((n) => n.props?.id === "euler"));
  home.props.onSearchTextChange("stress finder");
  home = await render(Structures);
  for (const id of ["axial-stress", "bending-stress", "rect-shear"])
    assert.ok(nodes(home).some((n) => n.props?.id === id));
  home.props.onSearchTextChange("6m,3kN/m,C24,100x300");
  home = await render(Structures);
  action(
    nodes(home).find((n) => n.props?.id === "typed-input"),
    "Calculate Typed Values",
  );
  const quickBeam = pushed.at(-1);
  assert.equal(quickBeam.props.initialQuery, "6m,3kN/m,C24,100x300");
  hooks.reset();
  const quickBeamView = await render(quickBeam.type, quickBeam.props);
  assert.ok(nodes(quickBeamView).some((n) => n.props?.id === "results"));
  assert.equal(
    nodes(quickBeamView.props.searchBarAccessory).find(
      (n) => n.type?.displayName === "List.Dropdown.Item",
    ).props.value,
    quickBeamView.props.searchBarAccessory.props.value,
  );
  hooks.reset();
  home = await render(Structures);
  home.props.onSearchTextChange("100x200");
  home = await render(Structures);
  action(
    nodes(home).find((n) => n.props?.id === "typed-input"),
    "Calculate Typed Values",
  );
  const quickSection = pushed.at(-1);
  assert.equal(quickSection.props.formula.id, "properties");
  hooks.reset();
  const quickSectionView = await render(quickSection.type, quickSection.props);
  assert.match(
    nodes(quickSectionView).find((n) => n.props?.id === "calculation").props
      .detail.props.markdown,
    /20,000 mm²/,
  );
  assert.ok(!nodes(home).some((n) => n.props?.id === "modulus"));
  const categories = quickSectionView.props.searchBarAccessory;
  const categoryNames = nodes(categories)
    .filter((n) => n.type?.displayName === "List.Dropdown.Item")
    .map((n) => n.props.value);
  for (const group of ["General", "Bending", "Shear", "Torsion", "Stability"])
    assert.ok(categoryNames.includes(group));
  assert.ok(
    !categoryNames.includes("Warping"),
    "Rectangle without Iw must not offer a warping category",
  );
  const geometryMD = nodes(quickSectionView).find(
    (n) => n.props?.id === "property-Wy",
  ).props.detail.props.markdown;
  assert.match(geometryMD, /Elastic section modulus about y/);
  assert.match(geometryMD, /When to use/);
  assert.match(geometryMD, /data:image\/png;base64,/);
  qa(
    "properties-rectangle",
    nodes(quickSectionView).find((n) => n.props?.id === "calculation").props
      .detail.props.markdown,
  );
  qa("property-elastic-modulus", geometryMD);
  categories.props.onChange("Bending");
  let filteredProperties = await render(quickSection.type, quickSection.props);
  assert.ok(
    nodes(filteredProperties).some((n) => n.props?.id === "property-Wy"),
  );
  assert.ok(
    !nodes(filteredProperties).some((n) => n.props?.id === "property-Asz"),
  );
  qa(
    "properties-bending",
    nodes(filteredProperties).find((n) => n.props?.id === "calculation").props
      .detail.props.markdown,
  );
  const checks = [
    [
      "euler",
      "Euler buckling",
      "3m, E=210000MPa, I=10000000mm4, K=1",
      /\*\*2,302\.908 kN/,
    ],
    ["axial-stress", "Axial stress", "N=10kN,100x200", /\*\*0\.5 MPa/],
    ["bending-stress", "Bending stress", "M=20kNm,100x200", /\*\*30 MPa/],
    ["rect-shear", "Rectangle shear", "V=10kN,100x200", /\*\*0\.75 MPa/],
    [
      "axial-deformation",
      "Axial extension",
      "3m,N=10kN,E=210000MPa,100x200",
      /\*\*0\.007 mm/,
    ],
    ["radius", "Gyration radius", "I=10000000mm4,A=10000mm2", /\*\*31\.623 mm/],
  ] as const;
  for (const [id, title, input, expected] of checks) {
    hooks.reset();
    home = await render(Structures);
    action(
      nodes(home).find((n) => n.props?.id === id),
      "Open " + title,
    );
    const target = pushed.at(-1);
    assert.equal(target.props.formula.id, id);
    hooks.reset();
    let view = await render(target.type, target.props);
    assert.ok(
      String(view.props.selectedItemId).startsWith("choice-"),
      "Startup highlights the next relevant input",
    );
    const first = nodes(view).find(
      (n) => n.props?.id === view.props.selectedItemId,
    );
    assert.ok(
      first && !String(first.props.id).includes("Material"),
      "Initial choice must be the missing force, span or section",
    );
    qa(
      "small-" + id + "-empty",
      nodes(view).find((n) => n.props?.id === "calculation").props.detail.props
        .markdown,
    );
    for (
      let step = 0;
      step < 6 && view.props.selectedItemId !== "calculation";
      step++
    ) {
      const option = nodes(view).find(
        (n) => n.props?.id === view.props.selectedItemId,
      );
      assert.ok(option, "Next choice must exist");
      if (
        [
          "axial-stress",
          "bending-stress",
          "rect-shear",
          "modulus",
          "radius",
        ].includes(id)
      )
        assert.ok(
          !String(option.props.id).includes("Material"),
          "Material-independent tools must not ask for grades",
        );
      action(option, "Use " + option.props.title);
      view = await render(target.type, target.props);
    }
    assert.equal(
      view.props.selectedItemId,
      "calculation",
      id + " Enter-only flow reaches the overview",
    );
    qa(
      "small-" + id + "-guided",
      nodes(view).find((n) => n.props?.id === "calculation").props.detail.props
        .markdown,
    );
    const navigationCount = pushed.length;
    view.props.onSearchTextChange(input);
    view = await render(target.type, target.props);
    const detail = nodes(view).find((n) => n.props?.id === "calculation").props
      .detail.props.markdown;
    qa("small-" + id + "-result", detail);
    assert.match(detail, expected, id);
    assert.ok(!detail.includes("**Check input:**"), visible(detail));
    assert.equal(
      pushed.length,
      navigationCount,
      "Editing inputs must not open another page",
    );
  }
  hooks.reset();
  home = await render(Structures);
  home.props.onSearchTextChange("section modulus");
  home = await render(Structures);
  assert.ok(nodes(home).some((n) => n.props?.id === "properties"));
  assert.ok(!nodes(home).some((n) => n.props?.id === "modulus"));
  hooks.reset();
  home = await render(Structures);
  action(
    nodes(home).find((n) => n.props?.id === "euler"),
    "Open Euler buckling",
  );
  const column = pushed.at(-1)!;
  hooks.reset();
  let eulerView = await render(column.type, column.props);
  eulerView.props.onSearchTextChange("3m,E=210000MPa,100x200,K=1");
  eulerView = await render(column.type, column.props);
  const columnMD = nodes(eulerView).find((n) => n.props?.id === "calculation")
    .props.detail.props.markdown;
  assert.match(columnMD, /Ncr,y/);
  assert.match(columnMD, /Ncr,z/);
  assert.match(columnMD, /15,352\.718/);
  assert.match(columnMD, /3,838\.179/);
  qa("euler-two-axes", columnMD);
  hooks.reset();
  let catalogueProps = await render(quickSection.type, quickSection.props);
  catalogueProps.props.onSearchTextChange("IPE200");
  catalogueProps = await render(quickSection.type, quickSection.props);
  assert.ok(
    nodes(catalogueProps.props.searchBarAccessory).some(
      (n) => n.props?.value === "Warping",
    ),
  );
  assert.ok(nodes(catalogueProps).some((n) => n.props?.id === "property-Iw"));
  qa(
    "property-warping",
    nodes(catalogueProps).find((n) => n.props?.id === "property-Iw").props
      .detail.props.markdown,
  );
  hooks.reset();
  let stable = await render(Analysis);
  stable.props.onSearchTextChange("6m,3kN/m");
  stable = await render(Analysis);
  let dropdown = stable.props.searchBarAccessory;
  assert.ok(
    nodes(dropdown)
      .filter((n) => n.type?.displayName === "List.Dropdown.Item")
      .every((n) => !n.props.value.startsWith("tool-")),
  );
  const navigationCount = pushed.length;
  for (const value of [
    "",
    "tool-section",
    "tool-stress",
    "tool-quick",
    dropdown.props.value,
  ])
    dropdown.props.onChange(value);
  stable = await render(Analysis);
  assert.equal(
    pushed.length,
    navigationCount,
    "Stale dropdown initialization values must never navigate",
  );
  assert.equal(stable.props.searchText, "6m,3kN/m");
  console.log(
    "Stable Structures startup and stale dropdown events passed; every retained scalar calculator produces its independent hand-check result",
  );

  hooks.reset();
  let finder = await render(Formulas);
  const formulaRows = nodes(finder).filter(
    (n) => n.type?.displayName === "List.Item",
  );
  assert.equal(formulaRows.length, 10);
  for (const row of formulaRows) {
    assert.ok(row.props.title.length <= 18, row.props.title);
    assert.match(
      row.props.detail.props.markdown,
      /data:image\/png;base64,/,
      row.props.id,
    );
    qa(
      "browse-" + row.props.id.replace(/@/g, "-"),
      row.props.detail.props.markdown,
    );
  }
  finder.props.onSearchTextChange("deflection");
  finder = await render(Formulas);
  assert.ok(
    nodes(finder).some(
      (n) =>
        n.type?.displayName === "List.Section" &&
        n.props.title === "Deflection",
    ),
  );
  assert.ok(
    nodes(finder).some(
      (n) =>
        n.props?.title === "Simply supported" && n.props.subtitle === "UDL",
    ),
  );
  console.log(
    "Ten visible quick calculators show illustrations with compact case labels under output headings",
  );
  finder.props.onSearchTextChange("PL/4");
  finder = await render(Formulas);
  action(finder, "Open Calculator");
  const descriptor = pushed.at(-1);
  hooks.reset();
  let calc = await render(descriptor.type, descriptor.props);
  let md = markdown(calc, "**Bending moment");
  assert.match(md, /Missing: span and point/);
  assert.ok(!md.includes("15 kN·m"));
  assert.match(md, /data:image\/png;base64,/);
  calc.props.onSearchTextChange("6m,10kN,C30/37");
  calc = await render(descriptor.type, descriptor.props);
  md = markdown(calc, "**Bending moment");
  assert.match(md, /\*\*15 kN·m/);
  assert.ok(!md.includes("Elastic modulus (E)"));
  assert.ok(!md.includes("Check input"));
  qa("formula-moment", md);
  console.log(
    "Formula search opens one fixed calculator; no invented span/load; moment needs no stiffness",
  );
  hooks.reset();
  finder = await render(Formulas);
  finder.props.onSearchTextChange("ss-offcentre@deflection");
  finder = await render(Formulas);
  action(finder, "Open Calculator");
  const def = pushed.at(-1);
  hooks.reset();
  calc = await render(def.type, def.props);
  action(calc, "Edit Inputs / Custom Geometry");
  const editor = pushed.at(-1);
  let applied: any;
  const props = { ...editor.props, onApply: (c: any) => (applied = c) };
  hooks.reset();
  let form = await render(editor.type, props);
  nodes(form)
    .find((n) => n.props?.id === "sectionPreset")
    .props.onChange("__custom");
  nodes(form)
    .find((n) => n.props?.id === "materialPreset")
    .props.onChange("__custom");
  form = await render(editor.type, props);
  nodes(form)
    .find((n) => n.type?.displayName === "Action.SubmitForm")
    .props.onSubmit({
      geometry: "rect 100x300",
      materialName: "My timber",
      E: "12GPa",
      L: "6",
      P: "10",
      I: "",
    });
  assert.ok(applied);
  assert.equal(applied.material.E, 12000);
  assert.equal(applied.section.A, 30000);
  console.log(
    "Custom material and geometry remain available in relevant formula inputs",
  );
  hooks.reset();
  let analysis = await render(Analysis);
  assert.equal(
    analysis.props.searchBarPlaceholder,
    "simply, 6m, 3kN/m, C24, 100x300",
  );
  analysis.props.onSearchTextChange("simply,9m,");
  analysis = await render(Analysis);
  assert.ok(!nodes(analysis).some((n) => n.props?.id === "results"));
  assert.match(
    markdown(analysis, "**Next: Enter a load"),
    /Enter a load to calculate/,
  );
  analysis.props.onSearchTextChange("6m, 3kN/m, IPE160, S355");
  analysis = await render(Analysis);
  md = markdown(analysis, "Analysis summary");
  assert.match(md, /Steel-S355/);
  assert.ok(!nodes(analysis).some((n) => n.props?.id === "response-N"));
  assert.ok(!visible(md).includes("M1"));
  assert.ok(!md.includes("Unavailable"));
  qa("analysis-simple", md);
  const viewActions = ViewActions({ markdown: md, title: "Beam result" });
  assert.ok(
    nodes(viewActions).some((n) => n.props?.title === "Enlarge Diagram"),
  );
  const beforeExpanded = pushed.length;
  action(viewActions, "Open Full View");
  assert.equal(pushed.length, beforeExpanded + 1);
  assert.equal(pushed.at(-1)!.props.markdown, md);
  assert.equal(pushed.at(-1)!.props.navigationTitle, "Beam result");
  assert.equal(
    diagramFromMarkdown(
      "![Equation](data:image/png;base64,AAAA)\n![Section](data:image/png;base64,BBBB)",
    ),
    "data:image/png;base64,BBBB",
  );
  const diagramURI = md.match(/data:image\/png;base64,[^)]+/)![0];
  const exported = readFileSync(saveDiagramImage(diagramURI));
  const original = Buffer.from(diagramURI.split(",")[1], "base64");
  assert.equal(exported.readUInt32BE(0), 0x89504e47);
  assert.equal(exported.readUInt32BE(16), original.readUInt32BE(16));
  assert.equal(exported.readUInt32BE(20), original.readUInt32BE(20));

  analysis.props.onSearchTextChange("simply,6m,10kN,");
  analysis = await render(Analysis);
  assert.ok(
    nodes(analysis).some((n) => n.props?.title === "C24"),
    "Material choices remain after calculation",
  );
  assert.ok(
    nodes(analysis).some((n) => n.props?.title === "at 40%"),
    "Point position choices remain after calculation",
  );
  analysis.props.onSearchTextChange("6m,3");
  analysis = await render(Analysis);
  assert.ok(nodes(analysis).some((n) => n.props?.title === "3 kN/m"));
  assert.ok(nodes(analysis).some((n) => n.props?.title === "3 kN"));
  analysis.props.onSearchTextChange("6m, 3kN/m, IPE160, S355");
  analysis = await render(Analysis);
  md = markdown(analysis, "Analysis summary");
  const moment = nodes(analysis).find((n) => n.props?.id === "response-M");
  assert.ok(moment);
  assert.ok(!moment.props.detail.props.markdown.includes("| Shear force"));
  analysis.props.onSearchTextChange(
    "rafter, 8m, pitch 30deg, 3kN/m, global down, projected, GL24h, 100x300",
  );
  analysis = await render(Analysis);
  md = markdown(analysis, "Analysis summary");
  assert.ok(nodes(analysis).some((n) => n.props?.id === "response-stresses"));
  assert.ok(nodes(analysis).some((n) => n.props?.id === "response-N"));
  qa("analysis-roof", md);
  const library = loadLibrary(environment.assetsPath + "/library"),
    section = library.sections.find((s) => s.id === "IPE 200")!,
    material = library.materials.find((m) => m.id === "C24")!;
  for (const selected of [
    section,
    customSection("rhs", [200, 100, 6]),
    customSection("chs", [168, 6]),
  ]) {
    const image = formulaDrawing(
      formulaCatalog.find((f) => f.id === "ss-udl@deflection")!,
      selected,
      {
        L: 6000,
        P: 10000,
        q: 3,
        E: 11000,
        I: selected.Iy,
        A: selected.A,
        W: selected.Wy,
        N: 0,
        M: 0,
        K: 1,
        a: 3000,
      },
      false,
    );
    qa("section-" + selected.shape, `![Section and system](${image})`);
  }
  const textModel = buildModel({
    template: "simple",
    spans: [6],
    section,
    material,
    axis: "y",
    q: -3,
    direction: "globalZ",
    basis: "member",
    theory: "euler",
    tie: false,
    ridgeHinge: false,
    selfWeight: false,
    leftOverhang: 0,
    rightOverhang: 0,
    pitch: 0,
  });
  const textResult = analyze(textModel),
    normalDrawing = analysisDashboard(
      textModel,
      textResult,
      section,
      "y",
      true,
    );
  assert.match(normalDrawing, /font-size:22px/);
  (globalThis as any).__qaDiagramTextSize = "26";
  const largeDrawing = analysisDashboard(
    textModel,
    textResult,
    section,
    "y",
    true,
  );
  assert.match(largeDrawing, /font-size:26px/);
  assert.ok(
    Number(largeDrawing.match(/height="([\d.]+)"/)![1]) >
      Number(normalDrawing.match(/height="([\d.]+)"/)![1]),
  );
  (globalThis as any).__qaDiagramTextSize = "13";
  const compactDrawing = analysisDashboard(
    textModel,
    textResult,
    section,
    "y",
    true,
  );
  assert.match(compactDrawing, /font-size:18px/);
  (globalThis as any).__qaDiagramTextSize = "18";
  assert.match(
    analysisDashboard(textModel, textResult, section, "y", true),
    /font-size:22px/,
    "Existing Larger preference must upgrade to readable size",
  );
  (globalThis as any).__qaDiagramTextSize = "compact";
  assert.match(
    analysisDashboard(textModel, textResult, section, "y", true),
    /font-size:18px/,
  );
  (globalThis as any).__qaDiagramTextSize = "large";
  assert.match(
    analysisDashboard(textModel, textResult, section, "y", true),
    /font-size:26px/,
  );
  delete (globalThis as any).__qaDiagramTextSize;
  assert.match(normalDrawing, /width="560"/);
  for (const match of normalDrawing.matchAll(/font-size:([\d.]+)px/g))
    assert.ok(
      Number(match[1]) >= 18,
      "Every overview label must remain readable",
    );
  const firstImage = md.match(/data:image\/png;base64,[^)]+/)?.[0];
  analysis.props.onSearchTextChange(
    "rafter, 8m, pitch 30deg, 3kN/m, global down, projected, GL24h, rect 150x350",
  );
  analysis = await render(Analysis);
  assert.notEqual(
    markdown(analysis, "Analysis summary").match(
      /data:image\/png;base64,[^)]+/,
    )?.[0],
    firstImage,
    "Changing section dimensions must update the diagram",
  );
  for (const template of ["roof", "continuous"] as const) {
    const model = buildModel({
      template,
      spans: template === "roof" ? [8] : [6, 6],
      pitch: 30,
      section,
      material,
      axis: "y",
      q: template === "roof" ? -3 : 0,
      point:
        template === "continuous"
          ? { member: "M1", value: -10000, position: 3 }
          : undefined,
      direction: "globalZ",
      basis: "projected",
      theory: "euler",
      tie: false,
      ridgeHinge: true,
      selfWeight: false,
      leftOverhang: 0,
      rightOverhang: 0,
    });
    const result = analyze(model);
    for (const svg of [
      modelDrawing(model, true, result, true),
      analysisDashboard(model, result, section, "y", true),
    ]) {
      // Compare loads and reactions within the same coordinate system. Dashboard
      // response charts are translated separately and reuse local X/Y values.
      const scene = svg.match(
        /<!-- beam-scene-start -->([\s\S]*?)<!-- beam-scene-end -->/,
      )![1];
      const vertical = [
        ...scene.matchAll(
          /<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)" stroke="(?:#65c99c|#187b58)"[^>]*\/>/g,
        ),
      ].filter((m) => m[1] === m[3]);
      assert.equal(vertical.length, template === "roof" ? 2 : 3);
      for (const line of vertical) {
        const tailY = Number(line[2]),
          tipY = Number(line[4]);
        assert.notEqual(tailY, tipY);
        const blue = [
          ...scene.matchAll(
            /<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)" stroke="#88b7ff"[^>]*\/>/g,
          ),
        ];
        assert.ok(
          !blue.some(
            (b) =>
              b[1] === line[1] &&
              b[3] === line[3] &&
              Math.min(Number(b[2]), Number(b[4])) < Math.max(tailY, tipY) &&
              Math.max(Number(b[2]), Number(b[4])) > Math.min(tailY, tipY),
          ),
          "Vertical loads and reactions must not overlap",
        );
      }
      if (template === "roof")
        assert.ok(
          vertical.every((m) => Number(m[4]) < Number(m[2])),
          "Both roof reactions point up",
        );
      else
        assert.ok(
          vertical.some((m) => Number(m[4]) > Number(m[2])),
          "First-span point load creates a downward far reaction",
        );
    }
  }
  console.log(
    "Rendered arrows: pin-pin roof reactions point up in separate lanes; continuous uplift reaction points down",
  );
  analysis.props.onSearchTextChange(
    "continuous 5, 4m each, 10kN, span 2, at 40%, C24, 100x300",
  );
  analysis = await render(Analysis);
  assert.ok(
    nodes(analysis).some((n) => n.props?.id === "results"),
    visible(
      nodes(analysis).find((n) => n.props?.markdown)?.props.markdown ||
        "no markdown",
    ).slice(0, 1800),
  );
  assert.ok(!visible(markdown(analysis, "Analysis summary")).includes("M1"));
  analysis.props.onSearchTextChange(
    "angled, 6m, pitch 25deg, 10kN, at 40%, local down, C24, 100x300",
  );
  analysis = await render(Analysis);
  assert.ok(
    nodes(analysis).some((n) => n.props?.id === "results"),
    visible(
      nodes(analysis).find((n) => n.props?.markdown)?.props.markdown ||
        "no markdown",
    ).slice(0, 1800),
  );
  analysis.props.onSearchTextChange(
    "truss, 8m, pitch 30deg, 10kN, S355, CHS114.3x5",
  );
  analysis = await render(Analysis);
  assert.ok(nodes(analysis).some((n) => n.props?.id === "response-N"));
  assert.ok(!nodes(analysis).some((n) => n.props?.id === "response-M"));
  assert.ok(!nodes(analysis).some((n) => n.props?.id === "response-V"));
  console.log(
    "Analysis: missing load, steel aliases, projected rafters, five spans, positioned inclined load, axial truss and focused relevant diagrams passed",
  );
  hooks.reset();
  let refs = await render(ReferenceLibrary);
  const refRows = nodes(refs).filter(
    (n) => n.type?.displayName === "List.Item",
  );
  assert.equal(refRows.length, referenceCases.length);
  for (const c of referenceCases) {
    refs.props.onSelectionChange(c.id);
    refs = await render(ReferenceLibrary);
    const row = nodes(refs).find((n) => n.props?.id === c.id);
    assert.ok(row);
    const detail = row.props.detail.props.markdown;
    assert.match(detail, /data:image\/png;base64,/, c.id);
    if (
      [
        "simple-uniform-load",
        "guided-triangular-load",
        "thermal-propped",
        "continuous-4-udl",
        "simple-moment-at-a",
        "envelope-3",
      ].includes(c.id)
    )
      qa("reference-" + c.id, detail);
  }
  refs.props.onSelectionChange("simple-uniform-load");
  refs = await render(ReferenceLibrary);
  action(
    nodes(refs).find((n) => n.props?.id === "simple-uniform-load"),
    "Open Reference Calculator",
  );
  const refCalc = pushed.at(-1);
  hooks.reset();
  let liveRef = await render(refCalc.type, refCalc.props);
  liveRef.props.onSearchTextChange("6m,3kN/m,C24,100x300");
  liveRef = await render(refCalc.type, refCalc.props);
  const refMd = markdown(liveRef, "**Simply supported:");
  assert.match(refMd, /Moment 13.5/);
  assert.match(refMd, /20.455 mm \(bending\) \+ 0.783 mm/);
  qa("reference-live", refMd);
  console.log(
    referenceCases.length +
      " photographed/reference cases render; live analytical result shows bending plus shear and equations",
  );
  hooks.reset();
  refs = await render(ReferenceLibrary);
  action(
    nodes(refs).find((n) => n.props?.id === "simple-point-at-a"),
    "Open Reference Calculator",
  );
  const variableCalc = pushed.at(-1);
  hooks.reset();
  let variableRef = await render(variableCalc.type, variableCalc.props);
  variableRef.props.onSearchTextChange("6m,10kN,C24,100x300");
  variableRef = await render(variableCalc.type, variableCalc.props);
  assert.match(markdown(variableRef, "**Simply supported:"), /Moment 15/);
  variableRef.props.onSearchTextChange("6m,10kN,C24,100x300,G=0MPa");
  variableRef = await render(variableCalc.type, variableCalc.props);
  assert.match(
    markdown(variableRef, "**Simply supported:"),
    /G must be positive/,
  );
  hooks.reset();
  let guided = await render(Analysis);
  guided.props.onSearchTextChange("simply,C24,rhs");
  guided = await render(Analysis);
  const titles = [];
  for (let k = 0; k < 5; k++) {
    const row = nodes(guided).find((n) => n.props?.id === "guidance");
    assert.ok(row);
    titles.push(row.props.title);
    assert.match(row.props.detail.props.markdown, /data:image\/png/);
    const use = nodes(row).find((n) => n.props?.title?.startsWith("Use "));
    assert.ok(use);
    use.props.onAction();
    guided = await render(Analysis);
  }
  for (const [i, word] of [
    "height",
    "width",
    "thickness",
    "span",
    "load",
  ].entries())
    assert.match(titles[i].toLowerCase(), new RegExp(word));
  assert.ok(nodes(guided).some((n) => n.props?.id === "results"));
  hooks.reset();
  let smart = await render(Analysis);
  smart.props.onSearchTextChange("simply,6m,3kN/m,concrete");
  smart = await render(Analysis);
  let first = nodes(smart).find(
    (n) => n.props?.id === smart.props.selectedItemId,
  );
  assert.equal(first.props.title, "C30/37");
  action(first, "Use C30/37");
  smart = await render(Analysis);
  first = nodes(smart).find((n) => n.props?.id === smart.props.selectedItemId);
  assert.equal(first.props.title, "100 × 300 mm");
  qa("starting-rectangle", first.props.detail.props.markdown);
  action(first, "Use 100 × 300 mm");
  smart = await render(Analysis);
  assert.match(smart.props.searchText, /rect 100x300/);
  smart.props.onSearchTextChange("continuous 3,4/7/5m,S355,IPE");
  smart = await render(Analysis);
  first = nodes(smart).find((n) => n.props?.id === smart.props.selectedItemId);
  assert.equal(first.props.title.replace(/\s/g, ""), "IPE360");
  assert.match(first.props.detail.props.markdown, /not sized/);
  qa("starting-ipe", first.props.detail.props.markdown);
  const sizes = nodes(smart).filter((n) =>
    n.props?.id?.startsWith("choice-Section / IPE-"),
  );
  assert.equal(sizes.length, 9);
  smart.props.onSelectionChange(sizes[1].props.id);
  smart = await render(Analysis);
  assert.equal(smart.props.selectedItemId, sizes[1].props.id);
  action(
    nodes(smart).find((n) => n.props?.id === sizes[1].props.id),
    "Use " + sizes[1].props.title,
  );
  smart = await render(Analysis);
  assert.ok(!smart.props.searchText.endsWith("IPE"));
  console.log(
    "Keyboard-first material → L/20 rectangle, longest-span steel suggestions, alternatives and explicit selections passed",
  );
  const flowProps = {
    initialMaterial: library.materials.find((m) => m.id === "C24"),
    initialSection: customSection("rectangle", [100, 200]),
  };
  hooks.reset();
  let flow = await render(Analysis, flowProps);
  let picked = nodes(flow).find(
    (n) => n.props?.id === flow.props.selectedItemId,
  );
  assert.equal(picked.props.title, "Simply supported");
  assert.ok(
    !nodes(flow).some((n) => n.props?.id?.startsWith("choice-Material /")),
  );
  action(picked, "Use Simply supported");
  flow = await render(Analysis, flowProps);
  picked = nodes(flow).find((n) => n.props?.id === flow.props.selectedItemId);
  assert.equal(picked.props.title, "6m");
  action(picked, "Use 6m");
  flow = await render(Analysis, flowProps);
  picked = nodes(flow).find((n) => n.props?.id === flow.props.selectedItemId);
  assert.equal(picked.props.title, "3kN/m");
  action(picked, "Use 3kN/m");
  flow = await render(Analysis, flowProps);
  assert.ok(
    !nodes(flow).some((n) => n.props?.id === "results"),
    "Unconfirmed presets must not produce stiffness/stress results",
  );
  picked = nodes(flow).find((n) => n.props?.id === flow.props.selectedItemId);
  assert.equal(picked.props.title, "C24");
  assert.ok(picked.props.detail.props.markdown.startsWith("![Model preview]"));
  qa("next-material", picked.props.detail.props.markdown);
  action(picked, "Use C24");
  flow = await render(Analysis, flowProps);
  picked = nodes(flow).find((n) => n.props?.id === flow.props.selectedItemId);
  assert.equal(picked.props.title, "100 × 300 mm");
  action(picked, "Use 100 × 300 mm");
  flow = await render(Analysis, flowProps);
  assert.equal(flow.props.selectedItemId, "results");
  const resultMd = nodes(flow).find((n) => n.props?.id === "results").props
    .detail.props.markdown;
  assert.ok(resultMd.startsWith("![Analysis summary"));
  assert.ok(!resultMd.includes("Example:"));
  flow.props.onSearchTextChange("cantilever,C30/37,rect 200x1000,4.5m,4.5kN/m");
  flow = await render(Analysis, flowProps);
  const concreteMd = nodes(flow).find((n) => n.props?.id === "results").props
    .detail.props.markdown;
  assert.ok(concreteMd.startsWith("![Analysis summary"));
  assert.match(concreteMd, /C30\/37/);
  assert.ok(!visible(concreteMd).includes("C24"));
  assert.ok(
    concreteMd.indexOf("Results and equations") > concreteMd.indexOf("C30/37"),
  );
  qa("concrete-cantilever", concreteMd);
  console.log(
    "System → span → load → material → L/20 section passes with carried defaults; actual concrete parameters and image-first results pass",
  );
  for (const template of ["rafter", "angled"]) {
    hooks.reset();
    let roofFlow = await render(Analysis);
    roofFlow.props.onSearchTextChange(template + ",8m,pitch 45deg,");
    roofFlow = await render(Analysis);
    let choice = nodes(roofFlow).find(
      (n) => n.props?.id === roofFlow.props.selectedItemId,
    );
    assert.equal(choice.props.title, "Global down");
    assert.match(choice.props.detail.props.markdown, /pitch 45°/);
    qa("pitch-45-" + template, choice.props.detail.props.markdown);
    action(choice, "Use Global down");
    roofFlow = await render(Analysis);
    choice = nodes(roofFlow).find(
      (n) => n.props?.id === roofFlow.props.selectedItemId,
    );
    assert.equal(choice.props.title, "3kN/m");
    action(choice, "Use 3kN/m");
    roofFlow = await render(Analysis);
    choice = nodes(roofFlow).find(
      (n) => n.props?.id === roofFlow.props.selectedItemId,
    );
    assert.equal(choice.props.title, "C24");
  }
  hooks.reset();
  flow = await render(Analysis, flowProps);
  for (const [name, query] of [
    ["overview-cantilever", "cantilever, 5m, 8kN/m, C30/37, 200x1000"],
    ["overview-uplift", "cantilever, 5m, q=8kN/m, C30/37, 200x1000"],
    [
      "overview-roof",
      "rafter, 8m, pitch 30deg, 3kN/m, global down, projected, GL24h, 150x350",
    ],
    ["overview-simple", "simply,6m,3kN/m,C14,100x300"],
    [
      "overview-roof-15",
      "rafter,8m,pitch 15deg,global down,projected,3kN/m,GL24h,150x350",
    ],
    [
      "overview-roof-45",
      "rafter,8m,pitch 45deg,global down,projected,3kN/m,GL24h,150x350",
    ],
    ["overview-five-spans", "continuous 5, 4m each, 3kN/m, C24, 100x300"],
  ]) {
    flow.props.onSearchTextChange(query);
    flow = await render(Analysis, flowProps);
    const md = nodes(flow).find((n) => n.props?.id === "results")?.props.detail
      .props.markdown;
    assert.ok(md, query);
    qa(name, md);
  }
  const benchmark = withShearProperties(
    buildModel({
      template: "cantilever",
      spans: [5],
      pitch: 0,
      section: customSection("rectangle", [200, 1000]),
      material: { ...material, E: 33000, G: 13750 },
      axis: "y",
      q: -8,
      direction: "globalZ",
      basis: "member",
      theory: "euler",
      tie: false,
      ridgeHinge: false,
      selfWeight: false,
      leftOverhang: 0,
      rightOverhang: 0,
    }),
  );
  for (const sign of [1, -1]) {
    benchmark.memberLoads[0].magnitude = -8 * sign;
    const r = analyze(benchmark);
    r.deformation = deformationParts(benchmark);
    const drawing = analysisDashboard(
      benchmark,
      r,
      customSection("rectangle", [200, 1000]),
      "y",
      true,
    );
    assert.match(drawing, /data-deflection="total"/);
    assert.match(drawing, /data-deflection="bending"/);
    assert.match(drawing, /data-deflection="shear-increment"/);
    assert.match(
      drawing,
      new RegExp(
        'data-reaction-rotation="' +
          (sign > 0 ? "counterclockwise" : "clockwise") +
          '"',
      ),
    );
    assert.match(
      drawing,
      new RegExp('data-direction="' + (sign > 0 ? "up" : "down") + '"'),
    );
    assert.match(drawing, /1.18 mm/);
    assert.match(drawing, /100 kN/);
  }
  console.log(
    "Rounded overview, complete total/bending/shear curves, and signed support force/moment arrows passed",
  );
  hooks.reset();
  const guide = await render(Guide);
  assert.ok(guide.type);
  console.log("Changing hints, live previews and guide passed");
}
module.exports = main();
