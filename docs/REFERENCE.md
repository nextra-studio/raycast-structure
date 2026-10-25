# Structures for Raycast

Quick engineering calculations that also make the mechanics visible: **sketch → equation → substituted values → result**. This is a general elastic calculator and reference library. Eurocode design/resistance checks are intentionally not included.

## Documentation and maintenance

| Read this | For |
| --- | --- |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Full developer map: every source module, APIs/dependencies, data flow, numerical methods, units/signs, input state, CSV precedence, graphics/zoom, saved data, extension recipes, tests, build/update and troubleshooting. |
| [CSV-SCHEMA.md](../CSV-SCHEMA.md) | Add/edit materials and sections, optional properties and units. |
| [VALIDATION.md](../VALIDATION.md) | Independent hand-method checks, source comparisons and what the tests do/do not verify. |
| [DATA-AUDIT.md](../DATA-AUDIT.md) | Recorded data sources and known discrepancies preserved for review. |

**For the next developer:** edit `src/`, then run the checks and rebuild. Do not edit generated `dist/*.js`. The app uses the Raycast SDK, React, Node filesystem APIs, MathJax and resvg WASM; it calculates locally and does not call a remote engineering/AI API. Start with the architecture guide's “Which files should I edit?” table before changing input parsing, a formula or the UI.

## Install or update on Windows

1. Extract the entire `structural-toolbox` folder, for example into `C:\Users\tatsu\OneDrive\Digitalization\Raycast_extension`.
2. Close the previous Structural Toolbox development terminal and keep Raycast open.
3. Double-click **Install.cmd**. It installs the exact dependencies, checks the code and calculations, builds the commands, and imports the extension into the release Raycast installation.
4. Search Raycast for **Structures**. Its start screen lists the calculators; select one and press Enter. Keep the installer window open while using the development extension.

Node.js 22.22.2 or newer is required. No administrator privileges are required. The icon has a transparent background. Raycast search shows three commands: **Structures**, **Library** and **Guide**. Open Library to choose **Materials** or **Sections**; these pages retain all their existing features without separate duplicate commands.

## Start with a calculation

Open **Structures → Beam and frame**, then type a complete expression:

```text
simply, 6m, 3kN/m, C24, 100x300
cantilever, 4m, 10kN, at 40%, S355, IPE200
rafter, 8m, pitch 30deg, global down, projected, 3kN/m, GL24h, 140x450
continuous 5, 4m each, 10kN, span 2, at 40%, C24, 100x300
```

Or choose the suggestions: **system → span → pitch (if inclined/roof) → direction and UDL basis (if inclined/roof) → load → material → section family/size**. Free text remains order-independent when units or names identify the values. Bare `100x200` means a rectangle in mm. A bare `3` after a span offers **3 kN/m** and **3 kN** for confirmation. Numbers and dimensions are never fuzzy-corrected. Common spelling mistakes in names, including `simpyl` and `fixde`, are recognized or offered as selectable corrections.

The first beam suggestions are support systems, with Simply supported first. Enter advances through the missing inputs. After `cantilever, 6m, 3kN/m,`, choose a material, then an L/20 starting section or an exact size. Presets carried from the start screen are suggestions until confirmed; full stress and deflection results wait for confirmed material and section. The preview keeps entered loads visible during these steps. Existing complete inputs can still be supplied in any order.

Calculated beam results start with the diagram and actual parameters. Examples never precede or masquerade as the selected material. Equations, deflection decomposition and explanatory notes follow below. The summary combines tensile/compressive normal stress into a range; the Section stresses view retains the individual results. **Raycast extension preferences → Diagram Text Size** offers Compact (18), Readable (22, default) and Extra large (26). The shared diagram canvas is 560 units wide; labels wrap instead of shrinking. Result cards use two columns and stresses have their own cards. The layout uses more vertical space so numbers remain readable in a narrow detail pane. Old 13/16 settings map to 18/20, and the previous default 18 upgrades to the new readable 22. Roof and inclined drawings use a single physical scale for horizontal and vertical coordinates, with the actual pitch labelled. Identical UDLs on a multi-span beam share one load caption; each reaction remains beside its own support.

Suggestions stay available after a result appears. Choose a grade, choose a family such as HEB, then choose a size. Selecting an option inserts its accepted text and advances the comma-separated input. Sawn/glulam size labels omit their family prefixes; group headings retain that context. IPE and other steel sections prioritize S355, sawn sections C24, and glulam GL24h when a material has not explicitly been chosen.

**Fast selection:** the first suggestion is highlighted automatically. Enter accepts it; arrows select another option; typing an exact size or grade remains available. Type `concrete` to see concrete grades (C30/37 first), `timber` for timber grades (C24 first), `glulam` for glulam grades (GL24h first), or `steel` (S355 first). Both `concrete C30/37` and `C30/37` select that grade. Names can tolerate spelling mistakes; grade numbers are not silently corrected.

When a span is known, section suggestions include **one starting size per compatible family** using the nearest available depth to **L/20**. Continuous beams use the longest span; references use L for each equal span. Within a family such as IPE, at most nine matching sizes are shown, ordered around the target depth; the first is a suggestion, and any other exact size can be typed. For a rectangle, a suggested `100x300` for 6 m uses an editable example width of 100 mm. This is a preliminary depth guide, not load-based optimization or a strength, stiffness or stability check. It never replaces an explicitly entered size.

Unsigned analysis loads act downward. Explicit signs and direction words are respected. `at 2m`, `at 40%` or `at 0.4L` controls point position; omission means the selected member midpoint. The guided flow starts by asking for the system. Complete legacy expressions that omit a system retain the visible simply-supported default. Continuous models accept one to five spans. Roof rafters have no bottom tie by default, pinned eaves and a hinged ridge; true axial trusses use joint loads.

## Larger views and images

Use **Actions → Open Full View** (Ctrl+Shift+F) for the selected result or library page at full Raycast width, including its images and equations. For beam and calculator results, select **Enlarge diagram** and press Enter to open the image inside Raycast. Its actions include **Open Zoom Viewer in Browser** and **Open Diagram Image** for external zoom controls. Raycast’s native Detail API does not expose wheel/pinch handlers to extensions; custom Ctrl+wheel zoom for the right pane is not implemented. Diagram Text Size in extension preferences remains available.

## One command, connected calculators

The visible small calculators use a consistent readable overview: a rounded result card beside its typeset equation, relevant parameter chips and a section/calculation sketch. The next relevant suggestion is highlighted first; Enter accepts it. The full example stays visible while inputs are incomplete; completed results show actual inputs. Equations retain their natural readable size, and longer equations use a separate full-width row.

The input sequence follows the calculation. Axial stress, bending stress and rectangle shear ask for their force/moment, then a section or explicit A/W; they do not ask for a material. Axial extension asks for force, span, material/E and section/A. Euler buckling asks for span, material/E and section/I, with K=1 visible and editable. A selected section reports both y/z axes, or principal u/v for a coupled section. The common K applies to both axes; an explicit single I reports that supplied axis only. Section Properties starts with geometry and includes elastic/plastic moduli; the gyration-radius tool also accepts direct matching I and A. Presets are suggestions until selected; explicitly entered properties can replace them. Custom E is shown without claiming an inherited material grade was used. Selecting a candidate section previews its shape; the preview is labelled until applied.

The Structures start screen provides direct entries. Search for **stress**, **Euler**, **buckling**, **modulus** or **radius**, or choose a row and press Enter. Opening or searching the start screen does not automatically open another calculator. The beam support dropdown only changes supports; it never opens a different module.

The calculators include:

- **Beam systems:** flexible 2D FE analysis, with material/section thumbnails, support and load diagrams, reactions, forces, stresses and governing equations.
- **Section properties:** one calculator with General, Bending, Shear, Torsion, Warping and Stability categories. Choose a category with the top selector, then a property row for its value, aliases, unit, physical meaning, equations and use. Empty categories are hidden. Elastic/plastic section modulus is consolidated here; its duplicate standalone entry was removed. Section-library Enter opens this calculator directly. Dimensions have their own row below the axis drawing, keeping height labels clear of y/z labels. Net/effective areas/moduli, plastic design shear areas and warping properties appear only when supplied. First moments are at the stated centroidal cut; inferred catalogue fillet properties are not fabricated.
- **Stress calculators:** axial, bending and solid-rectangle shear expressions. Shear accepts `V=10kN` as well as `P=10kN`. Examples include both the force/moment and section. Presets, custom geometry and explicit property overrides are accepted.
- **Quick formulas:** ten visible scalar/section tools include section properties, stresses, √(I/A) gyration radius, axial extension and Euler load. Section-based Euler results show both axes and mark the minimum as governing for the displayed common K. For asymmetric sections principal axes are used. A direct I override produces one result. This is not a code buckling resistance. Existing saved I/c formula snapshots remain readable.
- **Formula reference:** 92 selectable arrangements derived from the supplied reference photographs, including triangular/tent loads, point forces, applied moments, guided ends, multiple forces, continuous spans, temperature gradients and pattern envelopes.
- **Data library:** separate material and section tables.

The reference library calculates all relevant reactions, moment/shear, bending deflection and rotations together. L means **each span**, and P is the magnitude of **each** point force. Entering a position updates variable-position cases. Reference calculations show analytical coefficients, numerical substitutions and diagrams. Decimal coefficients are rounded for display. Pattern envelopes exhaust all nonempty fully-loaded/unloaded span patterns and explicitly mark non-concurrent extrema; the accompanying diagram identifies one actual critical pattern. Six/seven-span reference arrangements are available in the reference library; the flexible quick beam model remains limited to five spans.

## Bending and shear deformation

Where G and effective shear area are available, results show, for example:

```text
20.455 mm (bending) + 0.783 mm (shear increment)
```

These components are evaluated at the **same** governing location. The first is the Euler result. The second is the Timoshenko-minus-Euler increment; for indeterminate systems it includes redistribution, so it is not presented as a separately maximized pure-shear quantity. The deflection diagram shows the **total Timoshenko curve** in blue, **Euler bending** dashed and the **shear-flexibility increment** dotted, all on the same physical displacement scale. The general beam module compares exact FE recovery at matching stations, including both theories' extrema; reference cases use independently integrated curvature/shear compatibility. Forces, reactions and stresses retain the beam theory selected in Parameters, identified above the result cards. Missing shear stiffness leaves the qualified bending-only result.

The Overview uses rounded force/deflection cards, a separate stress strip and aligned diagram rows. The section thumbnail has its own scale. Green reaction arrows sit around each support: straight arrows follow signed horizontal/vertical forces, and a curved arrow follows the signed moment (positive counterclockwise). Numerical reaction magnitudes have kN or kN·m units. Near-zero reactions are hidden. Five-span reaction values are centred beneath their own arrows to avoid collisions; duplicate moment labels at a shared support are suppressed.

Rectangles use effective area 5A/6 and solid circles 6A/7. Other shapes use an energy calculation on idealized section geometry unless an effective area was supplied; rolled fillets and detailed thin-wall shear flow are approximated. These deformation areas are not silently equated to steel strength shear areas. G and As can be overridden. Missing G prevents a shear increment rather than inventing one. Thermal examples display their assumed alpha and accept `alpha=12e-6`, `dT=20`, `G=690MPa` and `As=25000mm2`; confirm the applicable expansion coefficient and units.

## Editable data

The bundled library has **48 material records and 713 unique sections**. It retains the original material/section CSV files and adds `sections-steel.csv` containing 687 published records; 11 existing IPE IDs take precedence over duplicates. Added families: 18 IPE, 24 each HEA/HEB/HEM, 18 UPN, 192 equal angles, 123 SHS, 161 RHS and 103 CHS. Hollow sections are the SCI hot-finished EN 10210 product range, not every worldwide product or manufacturing route.

On first use the extension creates personal copies. **Actions → Open sections-steel.csv** opens the additional catalogue; **Open Sections CSV** opens the original/override file. Save and choose **Reload CSV Library**. You can add `sections-any-name.csv` with the same schema: its family categories appear automatically. Existing IDs in `sections.csv` take precedence, so edits made through the app can override an imported record without altering its source file. Open **Library → CSV Files** to see the actual runtime folder, each loaded filename, raw CSV row counts and unique material/section totals. Use **Copy CSV Folder Path**, **Open Library Folder**, or **Open CSV Folder Settings**. The **Custom CSV Library Folder (Optional)** preference accepts one folder containing all your catalogues; a blank value means the displayed automatic personal folder. Both `materials-any-name.csv` and `sections-any-name.csv` are loaded. Base-file IDs take precedence; each CSV change is read when you reopen or use Reload CSV Library. The downloaded package includes all bundled CSVs in `assets/library/`.

Properties are stored in N/mm/MPa-based units; extra columns are retained. Manufacturer-rounded elastic moduli are preserved as `Wy_published`/`Wz_published`; new catalogue Wy/Wz are derived from the published inertia and extreme-fibre distance to avoid coarse table rounding. Drawings omit fillets/taper; published properties retain their effects. Angles have coupled bending: general beam templates reject that unsupported assumption rather than pretending they are symmetric. Their geometry/principal properties remain available.

Original source CSV values were not changed. The earlier seven field discrepancies for GL28h and Kerto-S/Q remain pending review, with visible notices. Five generic/template/product records still lack independent source certification. See DATA-AUDIT.md and VALIDATION.md.

## Methods and checks

Beam: linear 2D frame/truss direct-stiffness FE engine, transformed global/local loads, consistent point/UDL/moment loads and end releases. Formula reference: independently implemented equilibrium and integration of M/EI, extended with shear-strain compatibility. Quick formulas: explicit scalar expressions. Each result labels its method; equations remain visible for learning.

The suite checks every implemented reference arrangement, the existing scalar formulas, all geometry families, manual stress benchmarks, Euler/Timoshenko comparisons and each added catalogue record. Added source-table checks compare 9,162 individual numeric fields; all listed hollow sections also have independent hand-formula geometry checks. Passing these checks does not certify every possible input or unverified product source. Native Raycast interaction remains a separate first-run check.

```text
npm ci
npm run typecheck
npm test
npm run test:ui
npm run build
```

Sources: [ArcelorMittal Orange Book](https://orangebook.arcelormittal.com/), [SCI / Steel for Life Blue Book](https://www.steelforlifebluebook.co.uk/), the retained British Steel IPE source, and the user's supplied EN1995 data/reference photographs. No code resistance, cracking, creep, geometric nonlinearity, dynamics, torsional stress or 3D analysis is included.

## Property learning references

The category grouping follows the requested [Dlubal section-property approach](https://www.dlubal.com/en/cross-section-properties/series-ipe-euronorm-89-british-steel). The app uses y/z as cross-section axes and x along the member. `As` is an energy shear-stiffness area; `Av` is a separately supplied code plastic shear area. `Q`/statical moment and elastic `W`/section modulus remain distinct despite overlapping catalogue aliases. Code expressions are explanatory references, labelled with the first-generation EN 1993-1-1 (2005) numbering, not executed resistance checks. Consult the applicable standard/edition and National Annex. Torsion/warping properties are available for reference; they do not add 3D torsion or warping DOFs to the 2D FE engine.


## Torsion, LTB and material buckling factors

Structures retains the existing **Euler buckling** calculator. Its elastic results remain first; **EC3/EC5 factors — FYI** appear below for the selected material. No resistances, utilization ratios or design pass/fail checks are calculated. The visible calculators now also include **St. Venant torsion**, **Warping torsion** and **Lateral buckling** (ten scalar/section tools total).

- Euler: y/z (or principal u/v) critical loads. Optional `Ky=0.5, Kz=2` overrides the common K independently. Steel FYI shows relative slenderness and chi for both axes; timber shows E0,05-based critical loads, relative slenderness and kc for both axes. EC3 curve b is an explicit editable assumption, not automatic curve selection/classification. Use `alphaY=0.21`, `alphaZ=0.34`, or the editor. Timber beta_c defaults to 0.2 for sawn timber and 0.1 for glulam/LVL, subject to the stated product/straightness conditions.
- LTB: select `uniform moment`, `udl`, `point` (central point force) or `custom coefficients`, then unbraced length, material and section. Steel presets use NCCI SN003b C1/C2, fork supports and free warping; the custom case accepts C1/C2, signed `zg` in mm, `kLT` and `kw`. Channels, tees and angles are rejected by this doubly symmetric model. EC3 uses the 2005 general reduction method (6.3.2.2), with explicit elastic/plastic/supplied-effective modulus basis. The alternative rolled-section method is not calculated. Timber kcrit is limited to solid rectangular member geometry; effective-length presets are 1.0/0.9/0.8 Lb for constant moment/UDL/central point, using E0,05 and G0,05. In custom timber mode, the entered length is the effective length, incorporating any load-height/restraint correction. Supplied G0,05 provenance remains visible; existing derived library values are not silently certified or changed.
- St. Venant: torque, material/G and section, with optional length. Circular/CHS stress uses Tr/J; solid rectangle uses a converged elastic Fourier series; RHS/SHS uses a single-cell thin-wall median-line model; open sections use the thin-strip approximation. Wt can be supplied explicitly. Rectangular geometric J is recomputed with the same series unless an explicit J is supplied. Uniform scalar G is assumed; timber orthotropy needs an appropriate effective torsional G.
- Warping: first choose `cantilever restrained`, `cantilever free`, `fork free`, or `both restrained`; enter length, one point torque, material and section. Omitted position means the tip for a cantilever or centre for the two-end cases. `at 40%`, `at 0.4L` and `at 2m` are supported. The exact prismatic one-dimensional Vlasov solution determines twist, St. Venant torque, warping torque and bimoment; it is separate from the 2D frame FE engine. The exponential basis avoids hyperbolic overflow. Exact extrema and torque discontinuities are included. Iw must be supplied or derived for supported ideal I-geometry. Known Iw=0 directs the user to St. Venant torsion. Normal stress needs Womega or the ideal symmetric I-sectorial geometry; warping shear recovery is currently available for the ideal thin I-flange model. Peak shear/normal values occur at different points and are never combined into an invented equivalent stress.

Examples (comma-separated, named values also work in any order):

```text
3m, S355, IPE200, fy=355MPa, Ky=1, Kz=1
uniform moment, 3m, S355, IPE200, fy=355MPa
udl, 6m, C24, 100x300
T=1kNm, S355, IPE200, 3m
cantilever restrained, 3m, T=1kNm, S355, IPE200
fork free, 3m, T=1kNm, at 40%, S355, IPE200
```

Existing steel rows contain elastic properties but no verified yield strength. Grade-name fy is offered as a selectable nominal suggestion, not silently assumed; confirm the actual product/thickness value. All optional properties and factors can be entered via **Edit Inputs** without modifying a CSV.

**Enlarge diagram** is a visible result row. Select it and press Enter (or use Ctrl+Shift+Z) to open one image at full Raycast width. Calculated Overview rows also make enlargement the first action. Inline PNGs remain bare images so Raycast fits them to the pane; they are deliberately not clickable file links. In the enlarged view, **Open Zoom Viewer in Browser** (Ctrl+O) opens the local HTML viewer with fit width, 100%, +/−, Ctrl+wheel and drag panning. Next/Previous Diagram stays inside Raycast. **Open Diagram Image** and **Copy Image Path** provide PNG fallbacks. No server, uploads or remote resources are used. **Open Full View** remains a full-width reading view.

Theory references: [SCI P385](https://www.steelconstruction.info/images/6/6f/Sci_p385.pdf), [NCCI SN003b](https://steelconstruction.info/images/0/0f/SN003b.pdf), [JRC steel worked examples](https://publications.jrc.ec.europa.eu/repository/bitstream/JRC96658/jrc_steel_report_2015_07_22.pdf), [Swedish Wood Volume 2](https://www.svenskttra.se/siteassets/5-publikationer/pdfer/design-of-timber-structures-2-2016.pdf). These factor calculations use first-generation EN 1993-1-1:2005 and EN 1995-1-1:2004; they do not implement a complete project design workflow or automatically select a National Annex.
