// Templates — ready-made TSX compositions edited through a FORM instead of a
// prompt (docs/templates-plan.md). The TypeScript contract for `template.json`;
// the validator is `shared/templates/manifest.ts`.
//
// The control schema is NEXT_FEATURES_DESIGN Q8c's `ParamSpec` ("manifests are
// data, code is code" — the form is declared, never parsed out of the TSX) with
// the three kinds a full composition needs on top of an effect's knobs: `text`,
// `textarea` and `image`. Transitions and effects can adopt the same field
// renderer (`shared/components/ParamField`) when they become pack kinds.

import type { AgentAuthor, AgentFileEntry } from './agents';

/** What a control holds and what the composition receives as a prop. */
export type ParamValue = string | number | boolean;

export const TEMPLATE_CONTROL_TYPES = [
  'text',
  'textarea',
  'number',
  'color',
  'select',
  'boolean',
  'image',
] as const;
export type TemplateControlType = (typeof TEMPLATE_CONTROL_TYPES)[number];

export interface TemplateControlOption {
  value: string;
  label: string;
}

/** One form field. `key` is the prop name the composition destructures. */
export interface TemplateControl {
  key: string;
  label: string;
  type: TemplateControlType;
  /** Type must agree with `type`: number → number, boolean → boolean, the rest
   *  → string. An `image` default is '' or a path relative to the template. */
  default: ParamValue;
  /** Section heading. Consecutive controls sharing a group render together. */
  group?: string;
  /** One line under the field. */
  help?: string;
  placeholder?: string;
  /** `number` only. */
  min?: number;
  max?: number;
  step?: number;
  /** `text` / `textarea` only. */
  maxLength?: number;
  /** `select` only; `default` must be one of these values. */
  options?: TemplateControlOption[];
}

/** One canvas the template lays itself out for. */
export interface TemplateFormatOption {
  /** The value passed as the format prop (`'portrait'`). */
  value: string;
  label: string;
  width: number;
  height: number;
}

/**
 * The format picker. It is NOT an ordinary control because choosing one changes
 * two things at once: the prop the composition reads AND the canvas size, which
 * lives in the file's `compositionConfig` and is rewritten when the template is
 * staged (`shared/templates/stage-source.ts`).
 */
export interface TemplateFormats {
  /** Prop name that receives the chosen `value`. */
  prop: string;
  default: string;
  options: TemplateFormatOption[];
}

/** A named set of values the author ships — a one-click look. */
export interface TemplatePreset {
  id: string;
  name: string;
  /** Partial: only the keys this preset changes. */
  values: Record<string, ParamValue>;
}

export interface TemplateManifest {
  formatVersion: number;
  /** `<namespace>/<name>` — the id grammar agents and flows share. */
  id: string;
  name: string;
  version: string;
  description: string;
  author: AgentAuthor;
  license?: string;
  minAppVersion: string;
  /** Gallery filter, a slug (`milestones`, `data`, `overlays`). */
  category: string;
  tags: string[];
  /** The composition file, relative to the template folder. */
  entry: string;
  /** Gallery card image, relative to the template folder. */
  thumbnail?: string;
  /** Renders on a transparent background, meant to sit over footage. */
  overlay?: boolean;
  formats?: TemplateFormats;
  controls: TemplateControl[];
  presets: TemplatePreset[];
  /** Every packaged file except the manifest; written by the packer and
   *  verified by the importer. Empty for a built-in. */
  files: AgentFileEntry[];
}

/** A template as the app found it on disk. */
export interface InstalledTemplate {
  manifest: TemplateManifest;
  origin: 'builtin' | 'user';
  /** Absolute path of the template folder. */
  dir: string;
}

/** What the user has set for one template — autosaved beside its working copy. */
export interface TemplateSavedState {
  /** The template version the values were saved against. */
  templateVersion: string;
  /** Chosen format value; absent when the template has no formats. */
  format?: string;
  /** Only keys that differ from the manifest default. */
  values: Record<string, ParamValue>;
}
