<p align="center"><img src="docs/img/banner.svg" alt="Structural Toolbox for Raycast" width="100%"></p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Raycast%20for%20Windows-red">
  <img alt="Runs locally" src="https://img.shields.io/badge/runs-100%25%20locally-brightgreen">
  <img alt="Node" src="https://img.shields.io/badge/node-%E2%89%A5%2022.22-339933">
</p>

**Quick structural engineering calculations inside Raycast that show the mechanics, not just a number:**
sketch → equation → substituted values → result. Everything is calculated locally; no AI or remote engineering API is involved.

> General elastic calculator and reference library. Eurocode design/resistance checks are intentionally **not** included.

---

## What you can do

| Type this in **Structures** | You get |
| --- | --- |
| `simply, 6m, 3kN/m, C24, 100x300` | Beam diagram, reactions, shear/moment/deflection curves, stresses |
| `cantilever, 4m, 10kN, at 40%, S355, IPE200` | Point load at 40 % of the span on a steel section |
| `rafter, 8m, pitch 30deg, global down, projected, 3kN/m, GL24h, 140x450` | Inclined roof rafter with a true-scale drawing |
| `continuous 5, 4m each, 10kN, span 2, at 40%, C24, 100x300` | Five-span continuous beam |
| `udl, 6m, C24, 100x300` | Lateral-torsional buckling factors |
| `T=1kNm, S355, IPE200, 3m` | St. Venant torsion |

You never need to remember the syntax: the suggestion list walks you through **system → span → load → material → section**, and the first suggestion is always highlighted so **Enter** accepts it.

## How a result looks

<p align="center"><img src="metadata/structural-toolbox-2.png" alt="Enlarged result: values, section, loads, reactions, shear, moment and deflection on one screen" width="100%"></p>

**Enlarge** shows the values *and* the diagrams together on one screen: result cards, section, loads and reactions, then shear, moment and deflection curves.

<table><tr>
<td><img src="metadata/structural-toolbox-1.png" alt="Structures start screen"></td>
<td><img src="metadata/structural-toolbox-4.png" alt="Deflection page"></td>
</tr><tr>
<td><img src="metadata/structural-toolbox-3.png" alt="Beam result overview"></td>
<td><img src="metadata/structural-toolbox-5.png" alt="Section library"></td>
</tr></table>

<sub>Screenshots are real Raycast windows. The result images can be regenerated with <code>npm run render:readme</code> (rendered by the extension's own diagram engine, shown below for the dark theme).</sub>

<p align="center"><img src="docs/img/result-simply-supported-wide.png" alt="Simply supported beam, dark theme" width="48%"> <img src="docs/img/result-continuous-wide.png" alt="Three-span continuous beam, dark theme" width="48%"></p>

## Three commands

| Command | Purpose |
| --- | --- |
| **Structures** | The calculators: beams/frames/trusses, stresses, section properties, Euler buckling, torsion, warping, lateral buckling, 92 reference load cases |
| **Library** | Browse and edit **48 materials** and **713 sections** (IPE, HEA/HEB/HEM, UPN, angles, SHS/RHS/CHS, timber, glulam, CLT…) |
| **Guide** | Examples, units, assumptions and how to edit the library |

```mermaid
flowchart LR
    A[Open Structures] --> B{Pick or type}
    B -->|guided| C[System → span → load → material → section]
    B -->|expression| D["simply, 6m, 3kN/m, C24, 100x300"]
    C --> E[Result]
    D --> E
    E --> F[Diagram + equations + numbers]
    E --> G[Enlarge / zoom viewer]
    E --> H[Edit inputs and compare]
```

## Feature map

| Area | Highlights |
| --- | --- |
| **Beams and frames** | 2D linear FE, 1–5 spans, pinned/fixed/roller supports, point/UDL/moment loads, inclined roofs, bending + shear (Timoshenko) deflection |
| **Sections** | y/z and principal axes, elastic/plastic moduli, shear areas, torsion constant, warping, first moments |
| **Stresses** | axial, bending, rectangle shear, with presets or custom geometry |
| **Stability and torsion** | Euler buckling (both axes), lateral-torsional buckling factors, St. Venant torsion, Vlasov warping torsion |
| **Reference library** | 92 arrangements: tent/triangular loads, guided ends, temperature gradients, pattern-load envelopes |
| **Data** | editable CSV materials and sections, extra catalogues auto-loaded, reload without restarting |
| **Visuals** | readable diagram text sizes, enlarge in Raycast, local zoom viewer, full-width view |

## Install (Windows)

1. Install **Node.js 22.22.2 or newer** and keep **Raycast** open.
2. Clone or download this repository.
3. Double-click **`Install.cmd`**. It installs dependencies, runs checks and calculations, builds, and imports the extension into Raycast.
4. Search Raycast for **Structures**. Keep the installer window open while you use the development extension.

No administrator rights are needed.

```text
npm ci
npm run typecheck
npm test
npm run build
```

## Documentation

| Read | For |
| --- | --- |
| [docs/REFERENCE.md](docs/REFERENCE.md) | Full user reference: every calculator, input rule, method and example |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Developer map of every module, data flow and extension recipes |
| [CSV-SCHEMA.md](CSV-SCHEMA.md) | Add or edit materials and sections |
| [VALIDATION.md](VALIDATION.md) | Hand-method checks and what the tests do and do not verify |
| [DATA-AUDIT.md](DATA-AUDIT.md) | Data sources and known discrepancies |

## Limits

No code resistance, cracking, creep, geometric nonlinearity, dynamics or 3D analysis. Always confirm results against the applicable standard before using them for design.

## License

[Apache License 2.0](LICENSE). See [NOTICE](NOTICE).
