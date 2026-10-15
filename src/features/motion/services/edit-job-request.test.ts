import { describe, expect, it } from 'vitest';
import {
  editJobRequest,
  fixInstruction,
  fixJobRequest,
  fixThreadText,
  linesAround,
  versionNumberOf,
  type EditInput,
} from './edit-job-request';

// The Edit box and "Fix with AI" as builder edits of the open version: a
// `build` job with `editOf` (the folder + the open version), no code sent.

const target = { folderPath: 'C:/projects/bounce', versionPath: 'C:/projects/bounce/v2.tsx' };

const edit = (over: Partial<EditInput> = {}): EditInput => ({
  prompt: '  make the ball blue  ',
  providerId: 'claude-subscription',
  model: '',
  budget: 'standard',
  target,
  referenceImages: [],
  ...over,
});

describe('versionNumberOf', () => {
  it('reads N from vN.tsx on either slash', () => {
    expect(versionNumberOf('C:/p/bounce/v12.tsx')).toBe(12);
    expect(versionNumberOf('C:\\p\\bounce\\v3.tsx')).toBe(3);
    expect(versionNumberOf('C:/p/bounce/original.tsx')).toBeNull();
  });
});

describe('editJobRequest', () => {
  it('edits the open version at the picked budget, the provider default model', () => {
    expect(editJobRequest(edit())).toEqual({
      kind: 'build',
      prompt: 'make the ball blue',
      providerId: 'claude-subscription',
      build: { budget: 'standard', editOf: { folderPath: 'C:/projects/bounce', version: 2 } },
    });
  });

  it('carries the model and reference images when given', () => {
    const image = { mimeType: 'image/png', data: 'abc' } as never;
    expect(editJobRequest(edit({ model: 'claude-opus-5-5', budget: 'craft', referenceImages: [image] }))).toMatchObject({
      options: { model: 'claude-opus-5-5' },
      build: { budget: 'craft', referenceImages: [image] },
    });
  });

  it('edits the latest version when the open file is not a vN.tsx', () => {
    expect(editJobRequest(edit({ target: { folderPath: 'C:/p/x', versionPath: 'C:/p/x/scratch.tsx' } }))?.build?.editOf).toEqual({ folderPath: 'C:/p/x' });
  });

  it('needs a prompt and a provider', () => {
    expect(editJobRequest(edit({ prompt: '   ' }))).toBeNull();
    expect(editJobRequest(edit({ providerId: '' }))).toBeNull();
  });
});

describe('fixJobRequest', () => {
  const code = ['line one', 'line two', 'const x = ;', 'line four', 'line five', 'line six'].join('\n');
  const fix = { providerId: 'claude-subscription', model: '', target, code, error: 'Unexpected ";"\n  at <anon>', location: { line: 3, column: 10, file: 'v2.tsx' } };

  it('is a Quick builder edit whose thread line is the error, not the instruction', () => {
    const request = fixJobRequest(fix)!;
    expect(request).toMatchObject({
      kind: 'build',
      providerId: 'claude-subscription',
      build: { budget: 'quick', editOf: { folderPath: 'C:/projects/bounce', version: 2 }, threadText: 'Fix with AI: Unexpected ";"' },
    });
    expect(request.prompt).toBe(fixInstruction(fix));
  });

  it('names the version, the error, where it is and the lines around it', () => {
    const text = fixInstruction(fix);
    expect(text.startsWith("The Creator's preview cannot load v2: it fails with this error at line 3, column 10:")).toBe(true);
    expect(text).toContain('Unexpected ";"\n  at <anon>');
    expect(text).toContain('The saved single file v2.tsx (it bundles your files) reads there:\n  1 | line one\n  2 | line two\n> 3 | const x = ;\n  4 | line four\n  5 | line five');
    expect(text).toContain('keep the design and the motion as they are');
  });

  it('leaves the excerpt out without a location, or with one outside the file', () => {
    expect(fixInstruction({ ...fix, location: undefined })).not.toContain('reads there');
    expect(fixInstruction({ ...fix, location: { line: 99, column: 1, file: 'v2.tsx' } })).not.toContain('reads there');
  });

  it('needs an error and a provider', () => {
    expect(fixJobRequest({ ...fix, error: '  ' })).toBeNull();
    expect(fixJobRequest({ ...fix, providerId: '' })).toBeNull();
  });
});

describe('linesAround / fixThreadText', () => {
  it('pads the numbers to the widest one', () => {
    const code = Array.from({ length: 12 }, (_, i) => `l${i + 1}`).join('\n');
    expect(linesAround(code, 10)).toEqual(['   8 | l8', '   9 | l9', '> 10 | l10', '  11 | l11', '  12 | l12']);
  });

  it('cuts a long first line', () => {
    expect(fixThreadText('x'.repeat(300))).toHaveLength('Fix with AI: '.length + 158);
  });
});
