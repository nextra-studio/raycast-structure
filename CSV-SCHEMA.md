# Editable library schema

CSV is UTF-8, comma separated, with a header. Quote commas/newlines in text using standard CSV quoting. Each table needs unique nonempty `id` values. Decimal separator is a period. Numeric blanks mean unavailable. Extra columns are preserved.

## materials.csv

| Column | Meaning / unit |
|---|---|
| id | Unique preset name, e.g. C24 or GL24h |
| family | Sawn, Glulam, LVL, Steel, Concrete, Custom, Panel or CLT |
| E | Explicit elastic modulus override, MPa |
| G | Explicit shear modulus override, MPa |
| density | Explicit density override, kg/m³ |
| E0_mean | Legacy mean longitudinal modulus, MPa; used when E is blank |
| G_mean | Legacy mean shear modulus, MPa; used when G is blank |
| rho_mean | Legacy mean density, kg/m³; used when density is blank |
| standard / source | Source text or reference |
| status | EN / VERIFY / TEMPLATE / USER |
| notes | Qualification and assumptions |

All original strength, directional stiffness and density fields from the supplied timber library are retained. `fm_*`, `ft*`, `fc*`, `fv*`, `fr*` and `ftor*` strength columns use MPa. `E*` and `G*` stiffness columns use MPa. `rho_*` uses kg/m³. Strengths are reference data in this release; they are not checked against loads. Do not substitute one timber directional stiffness for another without explicitly choosing the appropriate model.

TEMPLATE is blocked from calculations. VERIFY is displayed with its qualification. Panel/CLT records are reference-only until a user supplies an effective member model. A concrete record without E cannot be used until the user defines stiffness. Never enter zero to mean an unknown modulus.

## sections.csv

| Column | Meaning / unit |
|---|---|
| id, family | Unique designation and grouping |
| shape | rectangle, circle, rhs, shs, chs, i, t, channel, angle |
| b, h, d, t, tw, tf | Width, height, diameter, wall, web and flange thickness; mm |
| r | Catalogue root radius, mm; recorded but schematic drawing omits fillets |
| A | Optional published area, mm² |
| Iy, Iz, Iyz | Optional centroidal second moments/product, mm⁴ |
| Wy, Wz | Optional elastic section moduli, mm³ |
| Wply, Wplz | Optional plastic moduli, mm³ |
| J | Optional Saint-Venant torsion constant, mm⁴ |
| Iw | Optional warping constant, mm⁶ |
| Ay, Az | Optional effective shear areas for shear forces along y and z, mm² |
| cy, cz | Optional centroid from section bounding-box origin, mm |
| mass | Optional catalogue mass, kg/m |
| source, notes | Data source and modelling assumptions |

Without published A/I/W values, idealized geometry is calculated. SHS uses h as side length. RHS uses h/b/t; CHS d/t. I/T/channel/angle use h/b/tw/tf. The T flange is at the top; the channel web is at the left; the angle legs are at the left and bottom of the section drawing.

Published values override the corresponding geometric property. Do not retain stale catalogue overrides when altering geometry. The section editor removes A/I/W/J and other derived catalogue fields automatically when dimension values change. CSV edits are explicit and must remain internally consistent. Nonzero product of inertia is displayed; ordinary beam templates reject coupled bending instead of silently treating it as uncoupled.

RHS/SHS/CHS entered geometry is idealized and does not represent a manufacturer catalogue. IPE starter entries use rounded British Steel published values. No unprovided catalogue shear area is guessed. Rectangle effective shear area is 5A/6; solid circle is 6A/7, explicitly for the Timoshenko option.

## Suggested new material

```csv
id,family,E,G,density,status,source,notes
My timber,Custom,11000,690,420,USER,User specification,Longitudinal elastic properties
```

## Suggested new section

```csv
id,family,shape,b,h,t,source,notes
My RHS,Custom,rhs,100,200,6,User geometry,Idealized sharp corners
```

Use the existing bundled files as the schema when adding rows; the examples above illustrate minimum records. Save and reload to validate. A bad row causes a visible library error rather than silently falling back to another value.

## Concrete material fields

C12/15–C90/105 use first-generation EN 1992-1-1:2004 Table 3.1. E/Ecm and Ecm_formula are MPa, strengths fck/fck_cube/fcm/fctm/fctk_005/fctk_095 are MPa, epsilon_* are per mille, and n/nu are dimensionless. E is the rounded tabulated uncracked quartzite value. The density field is an editable 2400 kg/m³ plain-concrete assumption. No code design checks use these strengths yet.

On upgrade, missing concrete IDs are appended once and existing IDs/extra fields are preserved. Only the original bundled generic sample sections and empty Concrete-custom placeholder are removed. New user section records remain.


## Additional catalogues and overrides

The loader reads `sections.csv` first, then `sections-*.csv` in filename order. IDs are deduplicated case-insensitively; the first record wins. Add a new file with the same schema and reload to discover its family headings automatically. App edits to imported records create overrides in `sections.csv`. Existing personal files are preserved when bundled additional files are copied on first use.

`sections-steel.csv` adds the published ArcelorMittal and SCI ranges described in README.md. Its `Wy_published` and `Wz_published` columns preserve rounded source values; active Wy/Wz are derived from the published inertia and extreme-fibre distance. Equal-angle Iyz comes from published principal inertias. Source/notes explain these derivations. These published properties are separate from schematic idealized geometry.

The L/20 suggestion chooses existing records; it does not write or alter CSV data. A custom suggested rectangle is an input geometry, not a new catalogue record. You can always type another size. Catalogue presence does not establish that a section passes a design check.

## Optional section learning/reference properties

Additional columns can supply `Anet`/`A_net`, `Aeff`/`A_eff`, `Weffy`/`Weff_y`/`W_eff_y`, `Weffz`/`Weff_z`/`W_eff_z`, `Avy`/`Av_y`/`A_v_y`, `Avz`/`Av_z`/`A_v_z`, `Qy`/`Q_y`, `Qz`/`Q_z`, `Wt`/`W_t`, and `Ww`/`W_omega`/`Womega`. Units are mm² for areas, mm³ for section/statical/torsional stress moduli, and mm⁴ for warping modulus. `Iw` remains in mm⁶. These fields are shown only when supplied and finite. Net/effective properties must come from a calculation for the relevant holes, stress distribution and code assumptions; this app does not derive them.

`Ay` and `Az` retain the existing effective **energy shear area** meaning for the Timoshenko model. Plastic **code shear areas** `Avy` and `Avz` are separate display/reference fields and are not substituted into the FE model. Since aliases differ between catalogues, import first moments with unambiguous Qy/Qz rather than Sy/Sz, which can also mean elastic modulus. Changing dimensions in the section editor clears geometric/catalogue and these optional derived properties so stale design values are not retained.
