import { describe, expect, it } from 'vitest';
import path from 'path';
import { buildPythonRequest, outputExtensionFor, rembgHomeFor, validatePythonOptions } from './request-builder';
import { pythonModelById } from './registry';

const root = path.join('C:', 'Users', 'x', 'AppData', 'Roaming', 'VidTSX Studio', 'ai-models', 'python');
const rembg = pythonModelById('rembg-u2net')!;
const triposr = pythonModelById('triposr')!;

describe('validatePythonOptions', () => {
  it('accepts empty / valid options and rejects unknown keys or bad values', () => {
    expect(validatePythonOptions(rembg, undefined)).toEqual({});
    expect(validatePythonOptions(rembg, { alphaMatting: true })).toEqual({ alphaMatting: true });
    expect(() => validatePythonOptions(rembg, { nope: 1 })).toThrow(/Invalid options for rembg-u2net/);
    expect(() => validatePythonOptions(triposr, { quality: '1024' })).toThrow(/quality/);
    expect(() => validatePythonOptions(triposr, { foregroundRatio: 2 })).toThrow(/foregroundRatio/);
    expect(validatePythonOptions(triposr, { quality: '512', seed: 7 })).toEqual({ quality: '512', seed: 7 });
  });
});

describe('buildPythonRequest', () => {
  it('rembg: paths + rembgHome under the models root, CPU, booleans defaulted', () => {
    const req = buildPythonRequest({
      profile: rembg, modelsRoot: root,
      imagePath: 'C:\\in\\photo.jpg', outputPath: 'C:\\out\\photo-nobg.png',
      options: {}, device: 'auto',
    });
    expect(req).toEqual({
      imagePath: 'C:\\in\\photo.jpg',
      outputPath: 'C:\\out\\photo-nobg.png',
      rembgHome: rembgHomeFor(root),
      model: 'u2net',
      device: 'cpu',
      alphaMatting: false,
      postProcessMask: false,
    });
    expect(String(req.rembgHome)).toBe(path.join(root, 'rembg'));
  });

  it('rembg: writeMatte adds a -matte.png next to the output', () => {
    const req = buildPythonRequest({
      profile: rembg, modelsRoot: root,
      imagePath: 'C:\\in\\a.png', outputPath: 'C:\\out\\a-nobg.png',
      options: { writeMatte: true, alphaMatting: true }, device: 'auto',
    });
    expect(req.mattePath).toBe(path.join('C:\\out', 'a-nobg-matte.png'));
    expect(req.alphaMatting).toBe(true);
  });

  it('triposr: model dir, DINO config, rembg home, defaults, and forced CPU', () => {
    const req = buildPythonRequest({
      profile: triposr, modelsRoot: root,
      imagePath: 'C:\\in\\chair.png', outputPath: 'C:\\out\\mesh.glb',
      options: {}, device: 'auto', previewPath: 'C:\\out\\preview.png',
    });
    expect(req).toMatchObject({
      modelDir: path.join(root, 'triposr'),
      dinoConfigPath: path.join(root, 'dino-vitb16', 'config.json'),
      rembgHome: path.join(root, 'rembg'),
      mcResolution: 256,
      removeBackground: true,
      foregroundRatio: 0.85,
      device: 'auto',
      previewPath: 'C:\\out\\preview.png',
      previewSize: 320,
    });
    expect('seed' in req).toBe(false);

    const cpu = buildPythonRequest({
      profile: triposr, modelsRoot: root,
      imagePath: 'C:\\in\\chair.png', outputPath: 'C:\\out\\mesh.glb',
      options: { quality: '512', removeBackground: false, seed: 42, device: 'cpu' }, device: 'auto',
    });
    expect(cpu).toMatchObject({ mcResolution: 512, removeBackground: false, seed: 42, device: 'cpu' });
    const forced = buildPythonRequest({ profile: triposr, modelsRoot: root, imagePath: 'i', outputPath: 'o', options: {}, device: 'cpu', previewPath: 'p' });
    expect(forced.device).toBe('cpu');
    expect(forced.previewSize).toBe(160); // CPU NeRF render: 27 s at 320², ~7 s at 160²
  });

  it('output extensions follow the artifact kind', () => {
    expect(outputExtensionFor(rembg)).toBe('.png');
    expect(outputExtensionFor(triposr)).toBe('.glb');
  });
});
