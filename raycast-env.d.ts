/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Custom CSV Library Folder (Optional) - One folder can contain multiple materials and sections CSVs. Leave blank for the automatic personal folder; Library → CSV Files shows the active path and loaded files. */
  "libraryDirectory"?: string,
  /** Default Material - Material ID used as a visible suggestion, such as C24, GL24h or Steel-S355. */
  "defaultMaterial": string,
  /** Result Precision - Decimal places used in calculation results. */
  "precision": "2" | "3" | "4",
  /** Diagram Text Size - Readable diagram labels, reactions, stress values and equations. Larger sizes use more vertical space. */
  "diagramTextSize": "compact" | "readable" | "large"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `structures` command */
  export type Structures = ExtensionPreferences & {}
  /** Preferences accessible in the `library` command */
  export type Library = ExtensionPreferences & {}
  /** Preferences accessible in the `guide` command */
  export type Guide = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `structures` command */
  export type Structures = {}
  /** Arguments passed to the `library` command */
  export type Library = {}
  /** Arguments passed to the `guide` command */
  export type Guide = {}
}

