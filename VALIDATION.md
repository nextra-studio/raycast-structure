# Validation record — 23 October 2026

## Completed checks

- TypeScript compilation and official Raycast distribution build for all three command entry points (Structures, Library and Guide).
- **368 numerical, data, input and geometry tests**, including independently derived coefficients and reference comparisons.
- Host-adapter UI checks: every one of the 92 reference cases renders a sketch and typeset equations; calculators show live results, worked substitutions, material/section selection and relevant diagrams. Keyboard-first material/section choices, alternatives, explicit sizes and longest-span L/20 suggestions are exercised.
- Rendered PNG inspection: section beside geometry, load/reaction arrows, filled force diagrams, worked fractions, thermal-gradient sketches and compact numerical summaries. The extension icon is transparent; no dark square background.
- The two original bundled CSV files retain their recorded SHA-256 fingerprints. Existing discrepancies are documented, not silently corrected.

## Independent engineering methods

The flexible beam command uses the production 2D finite-element direct-stiffness engine. A separately implemented Macaulay equilibrium/compatibility solver derives the reference coefficients without reusing that engine's stiffness assembly or linear solver. Each of the 85 mechanical reference arrangements is compared with the FE implementation for both Euler and Timoshenko response. Fixed/propped/guided restraints, variable point forces and moments, triangular/tent loads, repeated forces and continuous/pattern loading are included.

Four thermal arrangements are checked against hand-derived curvature and compatibility coefficients. A further hand calculation checks shear-flexible propped thermal reactions. Three pattern envelopes enumerate all nonempty loaded/unloaded span patterns; the two-span envelope is independently checked for M+ = 49qL²/512, M− = −qL²/8, the −qL/16 uplift reaction and the 5qL/4 middle reaction. Displayed extrema are explicitly non-concurrent.

The existing suite includes simply supported qL²/8 and 5qL⁴/(384EI), point-load PL/4 and PL³/(48EI), cantilever/fixed/propped cases, one-to-five-span equilibrium, E scaling, support-position loads, end releases, imposed moments, partial line loads, sloping global/local loads, horizontal projection, rafter thrust and axial trusses. Six frozen comparisons with the supplied EN1995 Python reference cover unequal spans, overhangs and shear flexibility.

Stress checks use independent rectangle and circle formulas, combined concurrent axial/bending stress and section shear distributions. Coupled-angle M/W using the ordinary bounding-axis W is rejected; an explicit principal-axis scalar W can be supplied. The solid-rectangle shear shortcut rejects other shapes. These safeguards do not turn the general calculator into a code design check.

Deflection splitting evaluates Euler bending and Timoshenko−Euler increment at the same governing station. The determinate rectangular UDL benchmark checks both terms against hand expressions. Other-section shear areas use an explicitly labelled idealized energy approximation; they are not silently identified with code strength shear areas.

## Approved overview and complete deflection curves

The visible small calculators use a common result/equation/sketch overview, with Section Properties now using its grouped property browser. Module-specific flow tests cover force/moment first, span first for Euler, force then span for axial extension, and geometry/direct properties for modulus/radius. Material-independent tools omit material grades from suggestions. Inherited material and section defaults require selection before dependent results appear, or can be replaced by explicit E/I/A/W inputs. Bare-number suggestions preserve each module's units; legacy beam-point formulas suggest P rather than the shear-only V alias. Host-adapter tests exercise Enter-only choice flows for every retained scalar tool and verify their independent hand results. Candidate geometry previews are labelled and do not silently apply a choice.

The overview now uses rounded result cards, a separate stress strip and section/geometry panels. Chart labels and units occupy a fixed gutter; the system and diagram member boundaries share horizontal positions. Force diagrams have filled areas. Reactions are drawn around the actual support: signed vertical/horizontal vectors and a signed curved moment arrow. Five-span reaction captions are centred below their own arrows; duplicate shared-support moment labels are suppressed. Missing/inactive responses remain hidden.

Deflection diagrams overlay total Timoshenko (solid), Euler (dashed) and the pointwise Timoshenko−Euler increment (dotted), using one displacement scale. Both numerical solutions are recovered at exactly matching stations, including both theories' extrema and load discontinuities, rather than cubic interpolation of a distributed-load displacement field. The selected beam theory still governs displayed forces, reactions and stresses and is identified in the header. In indeterminate systems the increment includes redistribution.

New independent checks evaluate every cantilever curve station against integrated UDL expressions for both load signs, an off-centre point force on both sides of its location, unequal continuous spans at matching recovered positions, and missing shear stiffness. The 5 m, 8 kN/m, 200×1000 mm, E=33000 MPa, G=13750 MPa benchmark gives 1.136363636 mm bending + 0.043636364 mm shear = 1.180000000 mm total. Force-vector tests cover left/right/up/down/zero; moment tests verify counterclockwise/clockwise arc travel and sign reversal. Host-adapter checks render the complete overlays and signed support arrows; PNGs are inspected in light and dark appearances, including cantilever, roof and five-span layouts. This is renderer/component verification, not a native Raycast screenshot.

## Catalogue checks

The 687 added published steel records are compared with frozen original source-table cells: **9,162 numeric fields**. All CHS areas/inertias/torsion have independent circle-equation checks; all SHS/RHS areas and both inertias have independent rounded-corner geometry checks. All loaded sections have positive valid inertia tensors and geometry; mass/area and section-modulus identities use source-rounding tolerances. The unique loaded catalogue contains 713 sections.

The earlier audit of 85 original records made 808 numerical comparisons. Seven material-field discrepancies and five incompletely verified generic/product records remain in DATA-AUDIT.md. Original CSV values were preserved as requested. Manufacturer editions, routes and rounding remain relevant; future user CSV additions are not automatically externally certified.

L/20 recommendations are tested as a depth-ranking heuristic: one nearest-depth candidate per compatible family, longest continuous span, alternatives retained, exact dimensions preserved. They perform no load-dependent sizing, optimization, stability or resistance checks. Rectangle width 100 mm is visibly an editable example.

## Reproduce

```text
npm ci
npm run typecheck
npm test
npm run test:ui
npm run build
```

The source table fixtures make published-field comparisons reproducible offline. Tests do not prove every possible input combination. The extension has not been interactively verified inside the user's native Raycast app; native image display, keyboard behavior, CSV opening and first-run installation require a check there. The host adapter verifies component state, action callbacks and generated images, and is not native UI automation.

No Eurocode resistance/design compliance, cracked/creep concrete, nonlinear behavior, dynamic analysis or general 3D frame behavior is claimed. The separate torsion calculators have the specific scope and audits below.


## Startup and retained-calculator regression checks

Structures now opens an explicit calculator list. No dropdown or selection callback on that screen navigates to another view. The beam dropdown contains only support systems, ignores obsolete `tool-*` values, does not persist a navigation value, and places the selected support first. Tests replay empty, stale navigation and unchanged initialization values and verify both the navigation stack and typed beam input remain unchanged.

Seven scalar/section entries remain visible, with section modulus consolidated into Section Properties. Legacy scalar modulus snapshots remain readable. Integration checks open axial stress, bending stress, rectangular shear, axial extension, Euler critical load and gyration radius from the start screen and compare live results with independent hand calculations. Examples: N=10 kN with a 100×200 rectangle gives 0.5 MPa; M=20 kN·m gives 30 MPa; V=10 kN gives 0.75 MPa. Euler E=210000 MPa, I=10^7 mm⁴, L=3 m and K=1 gives 2302.908 kN. Searches by “buckling”, “Euler buckling”, “eurler”, “stress finder”, modulus and radius find the corresponding calculators. These are host-adapter checks; native Raycast interaction remains to be checked.


## System-first flow and diagram-first results

Eight additional tests cover pasteable system-first examples, system → span → load → material → section, context-dependent units, explicit load directions/point locations, concrete grade preservation, longest-span section suggestions and custom-dimension hints. Integration tests start Analysis with carried material/section presets and verify those do not suppress the material/section confirmation steps. Sequential Enter actions reach a calculated result with the suggested L/20 rectangle. Complete expressions remain order-independent.

The user's cantilever expression `cantilever, C30/37, rect 200x1000, 4.5m, 4.5kN/m` is checked for actual C30/37 metadata, no stale C24 example, and a result starting with its diagram. Its independent hand values are |M|=45.5625 kN·m, V=20.25 kN, bending deflection 0.4194 mm (E=33000 MPa), and extreme-fibre stress 1.366875 MPa. Solver arithmetic was not changed by this UI revision.

Text-size settings are exercised at the default 22, extra-large 26 and legacy 13 (mapped to 18). The shared 560-unit canvas, wrapping two-column result/stress cards and larger labels are rendered at an actual 430-pixel detail-pane width in both appearances. Scalar result/equation/sketch panels use the same readable scale; long equations stack instead of being reduced to fit a half-width card. Multi-span load captions are consolidated and support IDs, span lengths and reactions have separate rows. Native Raycast checks remain separate and are not implied by renderer/component tests.

## Pitch geometry and direction-first guidance

Five independent geometry checks verify 15°, 30°, 45° and 60° roof proportions, height-cap behaviour, changed rise and negative inclination. X and Z use the same physical scale; steep geometry reduces both together. A further guided-flow test covers all offered global/local/projected directions for rafters and inclined beams before magnitude, preserving existing complete expressions with omitted direction. Component tests accept the first direction with Enter, then load, then material, and verify actual pitch in the preview. The first direction preserves the existing global-down/member-metre default. No FE stiffness or catalogue values were changed in this UI update.

## Command menu simplification

The material and section pages remain inside Library. The redundant standalone Materials and Sections commands were removed from the extension manifest; the current distribution exposes Structures, Library and Guide. Library navigation to both pages is exercised by the existing host-adapter checks. This menu change does not modify the calculation engine or CSV libraries.

## CSV visibility and full-view actions

Library → CSV Files shows the resolved runtime folder, loaded filenames, raw row counts and unique totals. Blank optional-folder preferences are labelled as the automatic personal folder. Additional material CSVs now follow the same deterministic, base-ID-first merge rule as additional section CSVs. An isolated temporary-folder test verifies custom materials/section families, base-ID precedence and disk edits read on reload. Existing bundled and user CSVs are preserved. Host checks verify source-page navigation, 48/713 loaded totals, copyable active path, and an expanded result retaining its complete Markdown/images. The native API has no custom wheel handler; Full View and external image opening are explicit alternatives.

## Grouped section properties and biaxial Euler results

Section Properties groups available values under General, Bending, Shear, Torsion, Warping and Stability. Missing supplied properties and empty groups are hidden. The duplicate standalone modulus entry is removed from visible navigation; legacy snapshots retain their original calculation definition. The full section drawing puts b/h dimensions on a separate bottom row to prevent y-axis/height-label collisions. Property detail shows its meaning, use, units, aliases, origin and typeset equations. Code examples remain labelled learning references, without adding design resistance logic.

Five independent checks cover rectangle gross/inertia/elastic/plastic/statical/energy/polar properties, net/effective/code-shear field visibility, all catalogue records with finite values, explicit code-vs-energy shear distinction, Euler y/z loads, K-squared scaling, axis reversal, asymmetric eigenvalue loads and explicit-single-I behaviour. For 100×200 mm, E=210000 MPa, L=3 m, K=1, Ncr,y=15352.717957 kN and Ncr,z=3838.179489 kN. The minimum is marked governing for the common K. A selected asymmetric section reports u/v rather than falsely treating the coupled y/z axes as independent. The UI host renders every property-reference equation, exercises category filtering, checks hidden rectangle warping and present IPE warping, and captures the separated labels and two Euler cards at a 430 px pane width in both appearances.


## Torsion and buckling FYI update — 23 October 2026

368 core tests pass (346 retained checks plus 22 new cases). The new independent audits cover circular/annular polar integration; square rectangle torsion coefficient J/a4=0.140577014955 and the thin-strip series limit; RHS median-cell Bredt stress; open I-plate stresses and Wt; exact hyperbolic cantilever warping at every station against the separate exponential-basis solver; all four restraint cases, interior torque jumps, continuity, equilibrium, sign reversal, zero torque and long-member numerical stability; Mcr against the equivalent pi/L stiffness expression; load-height trends; EC5 characteristic stiffness and effective length; reduction-curve examples and thresholds; independent y/z lengths, effective-area/property bases and principal axes; rejected assumptions and torque/position/property units. The previously existing beam/manual/catalogue audits remain intact. New exact Vlasov torsion presets are not part of the 2D frame FE assembly.

The input parser regression specifically checks that C24 is a material, not a C2 coefficient. Example strings and all three new formula entry points are covered. Steel fy is never fabricated from an elastic preset; its grade-derived value requires explicit selection or input. Current steel default curves are visibly editable assumptions. No alternate EC3 rolled-section LTB method, complete section classification or resistance check is claimed.

Component/renderer tests cover all new calculators in steel/timber, both-column-axis FYI, staged restraint choices, supported LaTeX, and the missing-fy action. The actual generated local viewer script is executed against a DOM adapter to exercise +/−, fit, 100%, Ctrl+wheel, plot selection and drag panning. Preview links and CSP/no-remote-script behavior are checked. Native Raycast image-link launching and OS browser integration are not verified by the adapter. Numeric card and plot PNGs are inspected at 430 px pane width in light/dark themes.

Sources checked: SCI P385 Chapter 2 (torsion and stress recovery); NCCI SN003b Table 3.2 (UDL C1=1.127/C2=0.454, central point C1=1.348/C2=0.630); JRC steel member-buckling worked examples (2005 code basis); Swedish Wood Volume 2, sections 4/5 and Table 4.1 (characteristic stiffness, kcrit, kc and effective lengths). User-provided notes are reference material; numerical examples are independently recomputed. No original CSV values have been changed.


## Native image-size regression and popup repair

The previous component checks incorrectly accepted linked-image markdown. The Windows screenshot supplied by the user showed that a PNG wrapped in a file link was displayed at an oversized/clipped scale. Inline output now uses bare image markdown, with a regression check that forbids `[![...](data:...)](file:...)` and normalizes old wrappers. No local HTML viewer is generated during inline rendering.

Calculated beam/formula views expose an Enlarge diagram row. The primary calculation action and that row push an image-only Raycast Detail; popup navigation and Next/Previous image changes are covered by the component adapter. Browser zoom and PNG export are optional built-in Raycast actions from the popup, with explicit local file URLs/paths and copyable fallbacks. Tests include the exact reported simply/6m/3kN-m/C14/100x300 input. These are regression contracts for native markup/navigation; the host adapter cannot prove native Windows image sizing or OS launching.
