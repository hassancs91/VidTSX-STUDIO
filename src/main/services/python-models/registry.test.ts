import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  PYTHON_MODEL_CATALOG,
  PYTHON_MODEL_STACK,
  pythonModelAllFiles,
  pythonModelById,
  pythonModelFileTaskId,
  pythonModelOwnBytes,
  formatModelBytes,
} from './registry';
import { AI_RUNTIME_VERSION } from '../ai-runtime/catalogue';

/** Catalogue + capability-descriptor invariants (plan §7b: every model has inputs/outputs/options and a licence). */
describe('PYTHON_MODEL_CATALOG invariants', () => {
  it('has unique ids and both Stage 3/4 models', () => {
    const ids = PYTHON_MODEL_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['rembg-u2net', 'triposr']));
  });

  for (const p of PYTHON_MODEL_CATALOG) {
    describe(p.id, () => {
      it('pins the live runtime stack', () => {
        expect(p.runtime.id).toBe('pytorch');
        expect(p.runtime.stack).toBe(PYTHON_MODEL_STACK);
        expect(AI_RUNTIME_VERSION.startsWith(`${PYTHON_MODEL_STACK}.`)).toBe(true);
      });

      it('declares every file with https URL, sha256, bytes and a relative dest', () => {
        expect(p.files.length).toBeGreaterThan(0);
        for (const f of p.files) {
          expect(f.url).toMatch(/^https:\/\//);
          expect(f.url).not.toMatch(/learnwithhasan\.com|cdn\.vidtsx\.com/); // never re-hosted
          expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
          expect(f.bytes).toBeGreaterThan(0);
          expect(f.dest).not.toMatch(/^[\\/]|^[a-zA-Z]:|\.\./);
          expect(f.label.length).toBeGreaterThan(0);
        }
      });

      it('companions resolve to catalogue models', () => {
        for (const c of p.companions) expect(pythonModelById(c)).toBeDefined();
        expect(p.companions).not.toContain(p.id);
      });

      it('has a permissive licence with a link and a source page', () => {
        expect(p.licence.name).toMatch(/MIT|Apache/);
        expect(p.licence.url).toMatch(/^https:\/\//);
        expect(p.sourceUrl).toMatch(/^https:\/\//);
      });

      it('capability descriptor: image in, one artifact out, zod options, tool id, timings', () => {
        const cap = p.capability;
        expect(cap.inputs).toEqual([{ kind: 'image' }]);
        expect(cap.outputs).toHaveLength(1);
        expect(['image', 'model3d']).toContain(cap.outputs[0].kind);
        expect(cap.needs).toBe('ai-runtime');
        expect(cap.toolId).toMatch(/^[a-z0-9_]+$/);
        expect(cap.description.length).toBeGreaterThan(20);
        expect(cap.estimatedSeconds.gpu).toBeGreaterThan(0);
        expect(cap.estimatedSeconds.cpu).toBeGreaterThan(0);
        // the options shape must be a valid zod object accepting {}
        expect(z.object(cap.options).safeParse({}).success).toBe(true);
        for (const [key, schema] of Object.entries(cap.options)) {
          expect((schema as { description?: string }).description, `${p.id}.options.${key} needs a description`).toBeTruthy();
        }
      });

      it('GPU floor is consistent with cpuOk', () => {
        if (p.vramMb !== null) expect(p.vramMb).toBeGreaterThanOrEqual(4096);
        expect(p.cpuOk).toBe(true); // both wave-1 models run on the CPU
      });
    });
  }

  it('unique tool ids', () => {
    const tools = PYTHON_MODEL_CATALOG.map((p) => p.capability.toolId);
    expect(new Set(tools).size).toBe(tools.length);
  });

  it('triposr needs the u2net companion and lists it once', () => {
    const triposr = pythonModelById('triposr')!;
    const files = pythonModelAllFiles(triposr);
    expect(files.map((f) => f.dest)).toEqual([
      'triposr/model.ckpt',
      'triposr/config.yaml',
      'dino-vitb16/config.json',
      'rembg/models/u2net/u2net.onnx',
    ]);
    expect(pythonModelOwnBytes(triposr)).toBe(1_677_246_742 + 987 + 454);
    expect(pythonModelOwnBytes(pythonModelById('rembg-u2net')!)).toBe(175_997_641);
  });

  it('file task ids are stable and shared across models', () => {
    const u2net = pythonModelById('rembg-u2net')!.files[0];
    expect(pythonModelFileTaskId(u2net)).toBe('pymodel-rembg-models-u2net-u2net-onnx');
    const viaTriposr = pythonModelAllFiles(pythonModelById('triposr')!).find((f) => f.dest === u2net.dest)!;
    expect(pythonModelFileTaskId(viaTriposr)).toBe(pythonModelFileTaskId(u2net));
  });

  it('formatModelBytes', () => {
    expect(formatModelBytes(175_997_641)).toBe('176 MB');
    expect(formatModelBytes(1_677_246_742)).toBe('1.7 GB');
    expect(formatModelBytes(987)).toBe('1 KB');
  });
});
