import { describe, expect, it } from 'vitest';
import {
  checkDisk,
  checkPathBudget,
  checkPlatform,
  chooseVariant,
  compareDotted,
  rootBudgetChars,
} from './preflight';
import { AI_RUNTIME_CATALOGUE } from './catalogue';

describe('compareDotted', () => {
  it('orders driver versions numerically, not lexically', () => {
    expect(compareDotted('592.82', '525.60')).toBeGreaterThan(0);
    expect(compareDotted('525.60', '525.60')).toBe(0);
    expect(compareDotted('471.11', '525.60')).toBeLessThan(0);
    expect(compareDotted('1000.1', '999.9')).toBeGreaterThan(0);
  });
});

describe('chooseVariant', () => {
  const minDriver = AI_RUNTIME_CATALOGUE.cu126.minDriver;

  it('picks cu126 for an NVIDIA card with a new-enough driver and 4 GB', () => {
    const c = chooseVariant({ name: 'NVIDIA GeForce GTX 1650 Ti with Max-Q Design', driverVersion: '592.82', vramTotalMB: 4096 }, minDriver);
    expect(c.variant).toBe('cu126');
  });

  it('falls back to cpu with no GPU, an old driver, or too little VRAM', () => {
    expect(chooseVariant(null, minDriver).variant).toBe('cpu');
    expect(chooseVariant({ name: null, driverVersion: null, vramTotalMB: null }, minDriver).variant).toBe('cpu');
    const old = chooseVariant({ name: 'NVIDIA GeForce GTX 1060', driverVersion: '471.11', vramTotalMB: 6144 }, minDriver);
    expect(old.variant).toBe('cpu');
    expect(old.reason).toMatch(/driver 471\.11/);
    const small = chooseVariant({ name: 'NVIDIA GeForce MX450', driverVersion: '592.82', vramTotalMB: 2048 }, minDriver);
    expect(small.variant).toBe('cpu');
    expect(small.reason).toMatch(/4 GB/);
  });

  it('treats an unknown driver version as acceptable (nvidia-smi present, field missing)', () => {
    expect(chooseVariant({ name: 'NVIDIA RTX 3060', driverVersion: null, vramTotalMB: 12288 }, minDriver).variant).toBe('cu126');
  });
});

describe('checkPathBudget', () => {
  const maxRel = AI_RUNTIME_CATALOGUE.cu126.maxRelativePathLength; // 126 → budget 132

  it('computes the root budget as 259 - maxRel - 1', () => {
    expect(rootBudgetChars(126)).toBe(132);
    expect(rootBudgetChars(152)).toBe(106); // the unpruned lab stack
  });

  it('accepts a typical user profile root', () => {
    const root = 'C:\\Users\\Hasan\\AppData\\Roaming\\VidTSX Studio\\ai-runtime\\2026.09.1-cu126';
    expect(root.length).toBeLessThan(rootBudgetChars(maxRel));
    expect(checkPathBudget(root, maxRel, false)).toBeNull();
  });

  it('refuses a root past the budget and names the policy; passes when long paths are on', () => {
    const root = 'C:\\' + 'a'.repeat(140);
    const issue = checkPathBudget(root, maxRel, false);
    expect(issue?.code).toBe('path-too-long');
    expect(issue?.message).toMatch(/LongPathsEnabled/);
    expect(checkPathBudget(root, maxRel, true)).toBeNull();
  });
});

describe('checkDisk', () => {
  it('needs zip + extracted + 5 %', () => {
    const e = AI_RUNTIME_CATALOGUE.cpu;
    const needed = Math.ceil((e.bytes + e.bytesOnDisk) * 1.05);
    expect(checkDisk(needed, e)).toBeNull();
    const issue = checkDisk(needed - 1, e);
    expect(issue?.code).toBe('disk');
    expect(issue?.message).toMatch(/GB needed/);
  });
});

describe('checkPlatform', () => {
  it('is Windows-only for now', () => {
    expect(checkPlatform('win32')).toBeNull();
    expect(checkPlatform('darwin')?.code).toBe('unsupported-platform');
  });
});
