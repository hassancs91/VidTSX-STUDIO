// `template.json` validation: the shape, type-agreeing defaults, presets that
// name real controls — and every BUILT-IN manifest the app ships must parse.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TemplateManifestError, controlValueProblem, parseTemplateManifest } from './manifest';
import type { TemplateControl } from '../types/templates';

const base = () => ({
  formatVersion: 1,
  id: 'acme/title-card',
  name: 'Title Card',
  version: '1.0.0',
  author: { name: 'Acme' },
  minAppVersion: '1.0.0',
  category: 'titles',
  controls: [
    { key: 'title', label: 'Title', type: 'text', default: 'Hello' },
    { key: 'size', label: 'Size', type: 'number', default: 40, min: 10, max: 100 },
    { key: 'accent', label: 'Accent', type: 'color', default: '#FF3B30' },
    { key: 'align', label: 'Align', type: 'select', default: 'left', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
    { key: 'logo', label: 'Logo', type: 'image', default: '' },
  ],
});

function problemsOf(raw: unknown, appVersion?: string): string[] {
  try {
    parseTemplateManifest(raw, appVersion ? { appVersion } : {});
    return [];
  } catch (err) {
    if (err instanceof TemplateManifestError) return err.problems;
    throw err;
  }
}

describe('parseTemplateManifest', () => {
  it('accepts a minimal manifest and fills the defaults', () => {
    const m = parseTemplateManifest(base());
    expect(m.entry).toBe('composition.tsx');
    expect(m.presets).toEqual([]);
    expect(m.tags).toEqual([]);
    expect(m.files).toEqual([]);
    expect(m.formats).toBeUndefined();
  });

  it('reports every problem at once', () => {
    const problems = problemsOf({ ...base(), id: 'NoNamespace', formatVersion: 9 });
    expect(problems.some((p) => p.includes('formatVersion 9'))).toBe(true);
    expect(problems.some((p) => p.includes('<namespace>/<name>'))).toBe(true);
  });

  it('refuses an app that is too old', () => {
    expect(problemsOf({ ...base(), minAppVersion: '9.0.0' }, '1.1.0')).toEqual(['needs VidTSX 9.0.0 (this app is 1.1.0)']);
    expect(problemsOf({ ...base(), minAppVersion: '1.1.0' }, '1.1.0')).toEqual([]);
  });

  it('refuses an entry that escapes the folder or is not TSX', () => {
    expect(problemsOf({ ...base(), entry: '../evil.tsx' })[0]).toContain('entry');
    expect(problemsOf({ ...base(), entry: 'composition.js' })[0]).toContain('entry');
    expect(problemsOf({ ...base(), thumbnail: 'C:/x.jpg' })[0]).toContain('thumbnail');
  });

  it('requires a default that agrees with the control type', () => {
    const withControl = (c: Record<string, unknown>) => ({ ...base(), controls: [c] });
    expect(problemsOf(withControl({ key: 'n', label: 'N', type: 'number', default: '5' }))[0]).toContain('must be a number');
    expect(problemsOf(withControl({ key: 'b', label: 'B', type: 'boolean', default: 'yes' }))[0]).toContain('must be a boolean');
    expect(problemsOf(withControl({ key: 'c', label: 'C', type: 'color', default: 'red' }))[0]).toContain('#hex');
    expect(problemsOf(withControl({ key: 'n', label: 'N', type: 'number', default: 5, min: 10 }))[0]).toContain('below min');
    expect(problemsOf(withControl({ key: 's', label: 'S', type: 'select', default: 'a' }))).toEqual(
      expect.arrayContaining([expect.stringContaining('needs options')]),
    );
    expect(problemsOf(withControl({ key: 'i', label: 'I', type: 'image', default: '../up.jpg' }))).toEqual(
      expect.arrayContaining([expect.stringContaining('safe path inside the template')]),
    );
  });

  it('refuses duplicate and non-identifier keys', () => {
    const dup = { ...base(), controls: [...base().controls, { key: 'title', label: 'Again', type: 'text', default: '' }] };
    expect(problemsOf(dup)).toEqual(['controls: duplicate key "title"']);
    const bad = { ...base(), controls: [{ key: 'my-title', label: 'T', type: 'text', default: '' }] };
    expect(problemsOf(bad)[0]).toContain('valid prop name');
  });

  it('keeps the format prop out of the controls', () => {
    const formats = {
      prop: 'align',
      default: 'wide',
      options: [{ value: 'wide', label: '16:9', width: 1920, height: 1080 }],
    };
    expect(problemsOf({ ...base(), formats })[0]).toContain('format picker owns that prop');
    expect(problemsOf({ ...base(), formats: { ...formats, prop: 'format', default: 'tall' } })[0]).toContain('not one of the options');
  });

  it('checks preset values against the controls they name', () => {
    const presets = [{ id: 'loud', name: 'Loud', values: { size: 500, missing: 1, accent: 'blue', logo: '/abs.png' } }];
    const problems = problemsOf({ ...base(), presets });
    expect(problems).toEqual(
      expect.arrayContaining([
        'presets.loud.size: is above max 100',
        'presets.loud: "missing" is not a control',
        'presets.loud.accent: must be a #hex colour',
        "presets.loud.logo: must be '' or a safe path inside the template",
      ]),
    );
  });
});

describe('controlValueProblem', () => {
  const text: TemplateControl = { key: 't', label: 'T', type: 'text', default: '', maxLength: 3 };
  it('enforces maxLength on text', () => {
    expect(controlValueProblem(text, 'abc')).toBeNull();
    expect(controlValueProblem(text, 'abcd')).toContain('maxLength');
  });
  it('refuses a non-finite number', () => {
    const n: TemplateControl = { key: 'n', label: 'N', type: 'number', default: 0 };
    expect(controlValueProblem(n, Number.NaN)).toContain('finite');
  });
});

describe('built-in templates', () => {
  const root = path.resolve(__dirname, '../../../resources/templates');
  const found: Array<{ id: string; file: string }> = [];
  for (const namespace of fs.readdirSync(root)) {
    for (const name of fs.readdirSync(path.join(root, namespace))) {
      found.push({ id: `${namespace}/${name}`, file: path.join(root, namespace, name, 'template.json') });
    }
  }

  it('ships at least one', () => {
    expect(found.length).toBeGreaterThan(0);
  });

  it.each(found)('$id parses, matches its folder, and its files exist', ({ id, file }) => {
    const manifest = parseTemplateManifest(JSON.parse(fs.readFileSync(file, 'utf-8')));
    expect(manifest.id).toBe(id);
    const dir = path.dirname(file);
    expect(fs.existsSync(path.join(dir, manifest.entry))).toBe(true);
    if (manifest.thumbnail) expect(fs.existsSync(path.join(dir, manifest.thumbnail))).toBe(true);
    // Every bundled image a default or a preset points at must really ship.
    const images = new Set(manifest.controls.filter((c) => c.type === 'image').map((c) => c.key));
    const referenced = [
      ...manifest.controls.filter((c) => images.has(c.key)).map((c) => c.default),
      ...manifest.presets.flatMap((p) => Object.entries(p.values).filter(([k]) => images.has(k)).map(([, v]) => v)),
    ].filter((v): v is string => typeof v === 'string' && v !== '');
    for (const rel of referenced) expect(fs.existsSync(path.join(dir, rel)), rel).toBe(true);
    // Every control key must be a prop the composition actually destructures.
    const source = fs.readFileSync(path.join(dir, manifest.entry), 'utf-8');
    for (const c of manifest.controls) expect(source, `prop ${c.key}`).toMatch(new RegExp(`\\b${c.key}\\b`));
    if (manifest.formats) expect(source).toMatch(new RegExp(`\\b${manifest.formats.prop}\\b`));
  });
});
