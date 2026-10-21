import { describe, expect, it } from 'vitest';
import type { ExportDiskEstimate } from './disk-estimate';
import { DISK_HEADROOM_BYTES, diskPreflightVerdict, formatBytes } from './disk-preflight';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

const estimate: ExportDiskEstimate = {
  outputBytes: 0.4 * GB,
  tempBytes: 4.3 * GB,
  temp: { remotionCopies: 3.8 * GB, intermediate: 0.4 * GB, audio: 0.1 * GB, shotLayers: 0 },
};

describe('diskPreflightVerdict', () => {
  it('passes when each drive holds its need plus the headroom', () => {
    const v = diskPreflightVerdict(estimate, {
      temp: { key: 'c', label: 'C:', freeBytes: 25 * GB },
      output: { key: 'd', label: 'D:', freeBytes: 7 * GB },
    });
    expect(v.ok).toBe(true);
    expect(v.drives.map((d) => [d.label, d.uses, d.fits])).toEqual([
      ['C:', ['temp'], true],
      ['D:', ['output'], true],
    ]);
  });

  it('adds the needs up when output and temp share a volume', () => {
    const free = estimate.tempBytes + estimate.outputBytes + DISK_HEADROOM_BYTES - 1;
    const v = diskPreflightVerdict(estimate, {
      temp: { key: 'c', label: 'C:', freeBytes: free },
      output: { key: 'c', label: 'C:', freeBytes: free },
    });
    expect(v.ok).toBe(false);
    expect(v.drives).toHaveLength(1);
    expect(v.drives[0].needBytes).toBe(estimate.tempBytes + estimate.outputBytes);
    if (!v.ok) {
      expect(v.message).toContain('C: needs about 5.2 GB free');
      expect(v.message).toContain('temporary files 4.3 GB (copies of the sources 3.8 GB, rendered video 410 MB, audio 102 MB)');
      expect(v.message).toContain('the finished file 410 MB');
      expect(v.message).toContain('512 MB to spare');
    }
  });

  it('refuses with the numbers of the short drive only', () => {
    const v = diskPreflightVerdict(estimate, {
      temp: { key: 'c', label: 'C:', freeBytes: 1.2 * GB },
      output: { key: 'd', label: 'D:', freeBytes: 7 * GB },
    });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.message).toBe(
        'Not enough disk space for this export. C: needs about 4.8 GB free — temporary files 4.3 GB '
          + '(copies of the sources 3.8 GB, rendered video 410 MB, audio 102 MB) + 512 MB to spare — and has 1.2 GB.',
      );
    }
  });

  it('names the output drive when only it is short', () => {
    const v = diskPreflightVerdict(estimate, {
      temp: { key: 'c', label: 'C:', freeBytes: 25 * GB },
      output: { key: 'e', label: 'E:', freeBytes: 100 * MB },
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.message).toBe(
      'Not enough disk space for this export. E: needs about 922 MB free — the finished file 410 MB + 512 MB to spare — and has 100 MB.',
    );
  });
});

describe('formatBytes', () => {
  it('uses Explorer units', () => {
    expect(formatBytes(3.77 * GB)).toBe('3.8 GB');
    expect(formatBytes(412 * MB)).toBe('412 MB');
    expect(formatBytes(1000)).toBe('1 KB');
  });
});
