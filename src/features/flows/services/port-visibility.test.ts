import { describe, expect, it } from 'vitest';
import type { PortDef } from '../../../shared/types/flows';
import { drawnPorts } from './port-visibility';

describe('drawnPorts — a record-only output is filed in the run record but never drawn (D-r22 (2))', () => {
  const band: PortDef = { id: 'band', label: 'Band', dataType: 'text', from: 'field:band' };
  const answer: PortDef = { id: 'answer', label: 'Answer', dataType: 'text', from: 'field:answer' };
  const p: PortDef = { id: 'p', label: 'p (run record)', dataType: 'number', from: 'field:p', recordOnly: true };

  it('drops record-only ports and keeps the order of the rest', () => {
    expect(drawnPorts([band, answer, p])).toEqual([band, answer]);
    expect(drawnPorts([p, band])).toEqual([band]);
  });

  it('draws every port when none is record-only', () => {
    expect(drawnPorts([band, answer])).toEqual([band, answer]);
    expect(drawnPorts([])).toEqual([]);
  });
});
