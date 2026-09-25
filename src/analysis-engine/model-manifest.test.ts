import { createHash } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ANALYSIS_MODELS, FACE_MODEL_IDS, SUBJECT_MODEL_IDS, analysisModel, sha256OfFile, verifyModelFile } from './model-manifest';

let dir: string;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vidtsx-analysis-models-'));
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('the pinned manifest', () => {
  it('pins the three models by url, sha256 and size, and names what each track needs', () => {
    expect(ANALYSIS_MODELS.map((m) => m.id)).toEqual(['yunet', 'face-mesh', 'modnet']);
    for (const m of ANALYSIS_MODELS) {
      expect(m.url).toMatch(/^https:\/\//);
      expect(m.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(m.bytes).toBeGreaterThan(0);
      expect(m.license).not.toBe('');
    }
    expect(FACE_MODEL_IDS).toEqual(['yunet', 'face-mesh']);
    expect(SUBJECT_MODEL_IDS).toEqual(['modnet']);
    // MODNet's pin, checked against the spike harness's file (25 888 640 bytes, sha256 verified 2026-09-25).
    expect(analysisModel('modnet')).toMatchObject({ bytes: 25888640, sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9', label: 'subject model' });
    expect(analysisModel('face-mesh').label).toBe('face models');
    expect(analysisModel('yunet').file).toBe('yunet-2023mar.onnx');
    expect(() => analysisModel('nope' as 'yunet')).toThrow(/Unknown analysis model/);
  });
});

describe('verifyModelFile', () => {
  it('accepts exactly the pinned bytes and refuses a wrong size, a wrong hash or a missing file', async () => {
    const bytes = Buffer.from('not really a model, but pinned as one');
    const file = path.join(dir, 'model.onnx');
    await fs.writeFile(file, bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    expect(await sha256OfFile(file)).toBe(sha256);

    const spec = { file: 'model.onnx', sha256, bytes: bytes.length };
    expect(await verifyModelFile(file, spec)).toEqual({ ok: true, sha256 });
    expect(await verifyModelFile(file, { ...spec, bytes: bytes.length + 1 })).toMatchObject({ ok: false, reason: expect.stringMatching(/bytes, expected/) });
    expect(await verifyModelFile(file, { ...spec, sha256: 'f'.repeat(64) })).toMatchObject({ ok: false, reason: expect.stringMatching(/integrity check failed/) });
    expect(await verifyModelFile(path.join(dir, 'gone.onnx'), spec)).toMatchObject({ ok: false, reason: expect.stringMatching(/missing/) });
  });
});
