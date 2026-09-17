// `template.json` — the manifest of one template (docs/templates-plan.md §2).
//
// PURE: zod, the shared id grammar, the shared entry-path gate. What the
// running app knows arrives through `TemplateManifestContext`, so one function
// serves the folder scan, a future `scripts/template-pack.mjs --check`, the
// importer and the unit tests — the agents' and flows' arrangement.
//
// A template folder is SELF-DESCRIBING: its metadata lives here, not in a
// pack's `pack.json`, because a single template must be importable on its own.
// A pack is then only a list of such folders.

import { z } from 'zod';
import { isSafeEntryPath } from '../packages/entry-path';
import { parseAgentId } from '../agents/ids';
import { compareAgentVersions } from '../agents/manifest';
import {
  TEMPLATE_CONTROL_TYPES,
  type ParamValue,
  type TemplateControl,
  type TemplateManifest,
} from '../types/templates';

export const TEMPLATE_MANIFEST_NAME = 'template.json';
export const TEMPLATE_PACKAGE_EXT = '.vidtsxtemplate';
export const TEMPLATE_FORMAT_VERSION = 1;

/** A form is the product; past this it has stopped being one. */
export const TEMPLATE_LIMITS = {
  maxControls: 40,
  maxPresets: 12,
  maxFormats: 6,
  maxSelectOptions: 24,
  maxTags: 12,
  maxCanvas: 7680,
} as const;

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9a-zA-Z.-]+)?$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A control key becomes a JS prop name. */
const PROP_NAME_RE = /^[A-Za-z_$][\w$]*$/;
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export class TemplateManifestError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.join('\n'));
    this.name = 'TemplateManifestError';
  }
}

export interface TemplateManifestContext {
  /** When given, `minAppVersion` must not exceed it. */
  appVersion?: string;
}

const paramValue = z.union([z.string(), z.number(), z.boolean()]);

const control = z.object({
  key: z.string().regex(PROP_NAME_RE, 'key must be a valid prop name'),
  label: z.string().min(1).max(60),
  type: z.enum(TEMPLATE_CONTROL_TYPES),
  default: paramValue,
  group: z.string().min(1).max(40).optional(),
  help: z.string().max(160).optional(),
  placeholder: z.string().max(80).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  maxLength: z.number().int().positive().optional(),
  options: z
    .array(z.object({ value: z.string(), label: z.string().min(1).max(60) }))
    .max(TEMPLATE_LIMITS.maxSelectOptions)
    .optional(),
});

const canvas = z.number().int().min(16).max(TEMPLATE_LIMITS.maxCanvas);

const manifestFields = z.object({
  formatVersion: z.number().int().positive(),
  id: z.string(),
  name: z.string().min(1).max(80),
  version: z.string().regex(SEMVER_RE, 'version must be semver (e.g. 1.0.0)'),
  description: z.string().max(500).default(''),
  author: z.object({ name: z.string().min(1), url: z.string().optional() }),
  license: z.string().optional(),
  minAppVersion: z.string().regex(SEMVER_RE, 'minAppVersion must be semver'),
  category: z.string().regex(SLUG_RE, 'category must be a lowercase slug'),
  tags: z.array(z.string().regex(SLUG_RE, 'tags must be lowercase slugs')).max(TEMPLATE_LIMITS.maxTags).default([]),
  entry: z.string().default('composition.tsx'),
  thumbnail: z.string().optional(),
  overlay: z.boolean().optional(),
  formats: z
    .object({
      prop: z.string().regex(PROP_NAME_RE, 'formats.prop must be a valid prop name'),
      default: z.string(),
      options: z
        .array(z.object({ value: z.string().min(1), label: z.string().min(1).max(60), width: canvas, height: canvas }))
        .min(1)
        .max(TEMPLATE_LIMITS.maxFormats),
    })
    .optional(),
  controls: z.array(control).max(TEMPLATE_LIMITS.maxControls).default([]),
  presets: z
    .array(
      z.object({
        id: z.string().regex(SLUG_RE, 'preset id must be a lowercase slug'),
        name: z.string().min(1).max(40),
        values: z.record(z.string(), paramValue),
      }),
    )
    .max(TEMPLATE_LIMITS.maxPresets)
    .default([]),
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        size: z.number().int().nonnegative(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lowercase hex characters'),
      }),
    )
    .default([]),
});

/** The JS type a control's value must have. */
export function valueTypeOf(type: TemplateControl['type']): 'string' | 'number' | 'boolean' {
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
}

/**
 * Why `value` cannot be held by `c`, or null when it can. Shared by the
 * manifest check (defaults, presets) and by `values.ts`, which drops a saved
 * value that no longer fits after a template update.
 */
export function controlValueProblem(c: TemplateControl, value: ParamValue): string | null {
  const expected = valueTypeOf(c.type);
  if (typeof value !== expected) return `must be a ${expected}`;
  if (c.type === 'number') {
    const n = value as number;
    if (!Number.isFinite(n)) return 'must be a finite number';
    if (c.min !== undefined && n < c.min) return `is below min ${c.min}`;
    if (c.max !== undefined && n > c.max) return `is above max ${c.max}`;
  }
  if (c.type === 'select' && !(c.options ?? []).some((o) => o.value === value)) {
    return 'is not one of the options';
  }
  if (c.type === 'color' && !HEX_RE.test(value as string)) return 'must be a #hex colour';
  if ((c.type === 'text' || c.type === 'textarea') && c.maxLength !== undefined && (value as string).length > c.maxLength) {
    return `is longer than maxLength ${c.maxLength}`;
  }
  return null;
}

/**
 * Parse and validate a manifest. Throws `TemplateManifestError` carrying every
 * problem, so an author sees the whole list at once.
 */
export function parseTemplateManifest(raw: unknown, ctx: TemplateManifestContext = {}): TemplateManifest {
  const parsed = manifestFields.safeParse(raw);
  if (!parsed.success) {
    throw new TemplateManifestError(parsed.error.issues.map((i) => `${i.path.join('.') || 'manifest'}: ${i.message}`));
  }
  const m = parsed.data as TemplateManifest;
  const problems: string[] = [];

  if (m.formatVersion !== TEMPLATE_FORMAT_VERSION) {
    problems.push(`formatVersion ${m.formatVersion} is not supported (this app reads ${TEMPLATE_FORMAT_VERSION})`);
  }
  if (!parseAgentId(m.id)) {
    problems.push(`id "${m.id}" must be "<namespace>/<name>", each [a-z0-9-]`);
  }
  if (ctx.appVersion && compareAgentVersions(m.minAppVersion, ctx.appVersion) > 0) {
    problems.push(`needs VidTSX ${m.minAppVersion} (this app is ${ctx.appVersion})`);
  }
  if (!isSafeEntryPath(m.entry) || !m.entry.endsWith('.tsx')) {
    problems.push(`entry "${m.entry}" must be a safe relative path to a .tsx file`);
  }
  if (m.thumbnail !== undefined && !isSafeEntryPath(m.thumbnail)) {
    problems.push(`thumbnail "${m.thumbnail}" is not a safe relative path`);
  }

  const byKey = new Map<string, TemplateControl>();
  for (const c of m.controls) {
    if (byKey.has(c.key)) {
      problems.push(`controls: duplicate key "${c.key}"`);
      continue;
    }
    byKey.set(c.key, c);
    if (c.type === 'select' && (c.options ?? []).length === 0) {
      problems.push(`controls.${c.key}: a select needs options`);
    }
    if (c.min !== undefined && c.max !== undefined && c.min > c.max) {
      problems.push(`controls.${c.key}: min ${c.min} is above max ${c.max}`);
    }
    // '' means "none": the composition draws its own stand-in.
    if (c.type === 'image' && typeof c.default === 'string' && c.default !== '' && !isSafeEntryPath(c.default)) {
      problems.push(`controls.${c.key}: default must be '' or a safe path inside the template`);
    }
    const problem = controlValueProblem(c, c.default);
    if (problem) problems.push(`controls.${c.key}: default ${problem}`);
  }

  if (m.formats) {
    if (byKey.has(m.formats.prop)) {
      problems.push(`formats.prop "${m.formats.prop}" is also a control — the format picker owns that prop`);
    }
    const values = m.formats.options.map((o) => o.value);
    if (new Set(values).size !== values.length) problems.push('formats.options: duplicate value');
    if (!values.includes(m.formats.default)) {
      problems.push(`formats.default "${m.formats.default}" is not one of the options`);
    }
  }

  const presetIds = new Set<string>();
  for (const preset of m.presets) {
    if (presetIds.has(preset.id)) problems.push(`presets: duplicate id "${preset.id}"`);
    presetIds.add(preset.id);
    for (const [key, value] of Object.entries(preset.values)) {
      const c = byKey.get(key);
      if (!c) {
        problems.push(`presets.${preset.id}: "${key}" is not a control`);
        continue;
      }
      if (c.type === 'image' && typeof value === 'string' && value !== '' && !isSafeEntryPath(value)) {
        problems.push(`presets.${preset.id}.${key}: must be '' or a safe path inside the template`);
        continue;
      }
      const problem = controlValueProblem(c, value);
      if (problem) problems.push(`presets.${preset.id}.${key}: ${problem}`);
    }
  }

  for (const file of m.files) {
    if (!isSafeEntryPath(file.path)) problems.push(`files: unsafe entry path "${file.path}"`);
  }

  if (problems.length > 0) throw new TemplateManifestError(problems);
  return m;
}
