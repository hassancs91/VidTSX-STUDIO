import { describe, expect, it } from 'vitest';
import { renderCpuUsageConcurrency } from './render-cpu-usage';

describe('renderCpuUsageConcurrency', () => {
  it('maps the four Settings stops to the render dialog\'s concurrency values', () => {
    expect(renderCpuUsageConcurrency('low')).toBe('25%');
    expect(renderCpuUsageConcurrency('medium')).toBe('50%');
    expect(renderCpuUsageConcurrency('high')).toBe('75%');
    expect(renderCpuUsageConcurrency('max')).toBeNull();
  });
});
