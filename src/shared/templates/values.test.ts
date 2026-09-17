// What the form holds vs. what is saved vs. what the composition receives.

import { describe, it, expect } from 'vitest';
import { parseTemplateManifest } from './manifest';
import {
  activePresetId,
  applyPreset,
  buildInputProps,
  changedValues,
  defaultValues,
  resolveFormat,
  resolveValues,
  toSavedState,
} from './values';

const manifest = parseTemplateManifest({
  formatVersion: 1,
  id: 'acme/title-card',
  name: 'Title Card',
  version: '2.0.0',
  author: { name: 'Acme' },
  minAppVersion: '1.0.0',
  category: 'titles',
  formats: {
    prop: 'format',
    default: 'landscape',
    options: [
      { value: 'landscape', label: '16:9', width: 1920, height: 1080 },
      { value: 'portrait', label: '9:16', width: 1080, height: 1920 },
    ],
  },
  controls: [
    { key: 'title', label: 'Title', type: 'text', default: 'Hello' },
    { key: 'size', label: 'Size', type: 'number', default: 40, min: 10, max: 100 },
    { key: 'accent', label: 'Accent', type: 'color', default: '#FF3B30' },
    { key: 'bell', label: 'Bell', type: 'boolean', default: true },
  ],
  presets: [
    { id: 'ocean', name: 'Ocean', values: { accent: '#2D8CFF' } },
    { id: 'big-ocean', name: 'Big Ocean', values: { accent: '#2D8CFF', size: 90 } },
  ],
});

describe('resolveValues', () => {
  it('is the defaults when nothing is saved', () => {
    expect(resolveValues(manifest, undefined)).toEqual(defaultValues(manifest));
    expect(defaultValues(manifest)).toEqual({ title: 'Hello', size: 40, accent: '#FF3B30', bell: true });
  });

  it('drops what no longer fits after a template update', () => {
    const stale = { title: 'Mine', size: 500, accent: 'not-a-colour', bell: 'yes', removedControl: 'x', extra: null };
    expect(resolveValues(manifest, stale)).toEqual({ title: 'Mine', size: 40, accent: '#FF3B30', bell: true });
  });
});

describe('resolveFormat', () => {
  it('falls back to the default for a stale or missing value', () => {
    expect(resolveFormat(manifest, 'portrait')?.width).toBe(1080);
    expect(resolveFormat(manifest, 'cinema')?.value).toBe('landscape');
    expect(resolveFormat(manifest, undefined)?.value).toBe('landscape');
  });
});

describe('saved state', () => {
  it('keeps only what differs from the defaults', () => {
    const values = { ...defaultValues(manifest), title: 'Mine', bell: false };
    expect(changedValues(manifest, values)).toEqual({ title: 'Mine', bell: false });
    expect(toSavedState(manifest, values, resolveFormat(manifest, 'portrait'))).toEqual({
      templateVersion: '2.0.0',
      format: 'portrait',
      values: { title: 'Mine', bell: false },
    });
  });

  it('round-trips through resolveValues', () => {
    const values = { ...defaultValues(manifest), size: 72 };
    const saved = toSavedState(manifest, values, null);
    expect(resolveValues(manifest, saved.values)).toEqual(values);
  });
});

describe('presets', () => {
  it('overlays its keys and keeps the rest', () => {
    const mine = { ...defaultValues(manifest), title: 'Mine' };
    expect(applyPreset(mine, manifest.presets[0])).toEqual({ ...mine, accent: '#2D8CFF' });
  });

  it('names the matching preset, preferring the one that pins the most keys', () => {
    expect(activePresetId(manifest, defaultValues(manifest))).toBeNull();
    expect(activePresetId(manifest, applyPreset(defaultValues(manifest), manifest.presets[0]))).toBe('ocean');
    expect(activePresetId(manifest, applyPreset(defaultValues(manifest), manifest.presets[1]))).toBe('big-ocean');
  });
});

describe('buildInputProps', () => {
  it('passes every control plus the format prop', () => {
    const props = buildInputProps(manifest, { ...defaultValues(manifest), title: 'Mine' }, resolveFormat(manifest, 'portrait'));
    expect(props).toEqual({ title: 'Mine', size: 40, accent: '#FF3B30', bell: true, format: 'portrait' });
  });
});
