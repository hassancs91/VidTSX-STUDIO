import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TemplateIpc } from '@shared/ipc/types';
import type { ParamValue, TemplateFormatOption } from '@shared/types/templates';
import {
  activePresetId,
  applyPreset as overlayPreset,
  buildInputProps,
  defaultValues,
  resolveFormat,
  resolveValues,
  toSavedState,
  type TemplateValues,
} from '@shared/templates/values';

const AUTOSAVE_MS = 400;
/** What both `/asset` routes (preview and render) serve, per file control. */
const PICK_FILTERS = {
  image: { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'] },
  audio: { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac'] },
} as const;

interface Staged {
  entryPath: string;
  workDir: string;
  assetBaseUrl: string | null;
  format: string | null;
}

export type TemplateSessionStatus = 'idle' | 'preparing' | 'ready' | 'error';

export interface TemplateSession {
  template: TemplateIpc | null;
  status: TemplateSessionStatus;
  error: string | null;
  values: TemplateValues;
  /** The format the user picked (the form highlights this one). */
  format: TemplateFormatOption | null;
  /** The staged entry the preview loads and the render bundles. */
  entryPath: string | null;
  /** Every control plus the format prop — for the preview AND the render. */
  inputProps: TemplateValues;
  activePresetId: string | null;
  /** Anything differs from the manifest defaults. */
  isCustomized: boolean;
  open: (template: TemplateIpc) => Promise<void>;
  close: () => void;
  setValue: (key: string, value: ParamValue) => void;
  setFormat: (value: string) => void;
  applyPreset: (presetId: string) => void;
  reset: () => void;
  /** The OS picker for an `image` or `audio` control. */
  pickFile: (key: string, kind: keyof typeof PICK_FILTERS) => Promise<void>;
  /** A url the form can load for a file value (picture, or sound to play); null for ''. */
  fileUrlFor: (value: ParamValue) => string | null;
}

/**
 * One open template: its form values, its chosen format, and the staged
 * working copy (docs/templates-plan.md §4). Values autosave per template, so
 * reopening one — today or after a restart — brings back what was set.
 */
export function useTemplateSession(): TemplateSession {
  const [template, setTemplate] = useState<TemplateIpc | null>(null);
  const [status, setStatus] = useState<TemplateSessionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<TemplateValues>({});
  const [formatValue, setFormatValue] = useState<string | undefined>(undefined);
  const [staged, setStaged] = useState<Staged | null>(null);

  // A newer open/format switch wins; a slower, older reply is dropped.
  const tokenRef = useRef(0);
  // Only a user action makes the session worth saving — not the load itself.
  const dirtyRef = useRef(false);
  const latestRef = useRef<{ template: TemplateIpc | null; values: TemplateValues; formatValue: string | undefined }>({
    template: null,
    values: {},
    formatValue: undefined,
  });
  latestRef.current = { template, values, formatValue };

  const flush = useCallback(() => {
    const { template: t, values: v, formatValue: f } = latestRef.current;
    if (!t || !dirtyRef.current) return;
    dirtyRef.current = false;
    void window.api.templatesStateSave({
      id: t.manifest.id,
      state: toSavedState(t.manifest, v, resolveFormat(t.manifest, f)),
    });
  }, []);

  const stage = useCallback(async (id: string, format: string | undefined, token: number) => {
    const res = await window.api.templatesStage({ id, format });
    if (token !== tokenRef.current) return;
    if (!res.success || !res.entryPath || !res.workDir) {
      setStatus('error');
      setError(res.error ?? 'Could not prepare this template.');
      return;
    }
    setStaged({
      entryPath: res.entryPath,
      workDir: res.workDir,
      assetBaseUrl: res.assetBaseUrl ?? null,
      format: res.format ?? null,
    });
    setStatus('ready');
  }, []);

  const open = useCallback(async (next: TemplateIpc) => {
    flush();
    const token = ++tokenRef.current;
    setTemplate(next);
    setStatus('preparing');
    setError(null);
    setStaged(null);
    setValues(defaultValues(next.manifest));
    try {
      const { state } = await window.api.templatesStateLoad({ id: next.manifest.id });
      if (token !== tokenRef.current) return;
      const format = resolveFormat(next.manifest, state?.format);
      setValues(resolveValues(next.manifest, state?.values));
      setFormatValue(format?.value);
      await stage(next.manifest.id, format?.value, token);
    } catch (err) {
      if (token !== tokenRef.current) return;
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Could not open this template.');
    }
  }, [flush, stage]);

  const close = useCallback(() => {
    flush();
    tokenRef.current += 1;
    setTemplate(null);
    setStaged(null);
    setStatus('idle');
    setError(null);
  }, [flush]);

  const setValue = useCallback((key: string, value: ParamValue) => {
    dirtyRef.current = true;
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setFormat = useCallback((value: string) => {
    const t = latestRef.current.template;
    if (!t || value === latestRef.current.formatValue) return;
    dirtyRef.current = true;
    setFormatValue(value);
    // The old canvas stays on screen until the new one is staged.
    void stage(t.manifest.id, value, ++tokenRef.current);
  }, [stage]);

  const applyPreset = useCallback((presetId: string) => {
    const preset = latestRef.current.template?.manifest.presets.find((p) => p.id === presetId);
    if (!preset) return;
    dirtyRef.current = true;
    setValues((prev) => overlayPreset(prev, preset));
  }, []);

  const reset = useCallback(() => {
    const t = latestRef.current.template;
    if (!t) return;
    dirtyRef.current = true;
    setValues(defaultValues(t.manifest));
  }, []);

  const pickFile = useCallback(async (key: string, kind: keyof typeof PICK_FILTERS) => {
    const { name, extensions } = PICK_FILTERS[kind];
    const res = await window.api.dialogOpen({ filters: [{ name, extensions: [...extensions] }] });
    if (!res.canceled && res.filePaths[0]) setValue(key, res.filePaths[0]);
  }, [setValue]);

  // Debounced autosave; whatever is pending is written on close and on unmount.
  useEffect(() => {
    if (!template || !dirtyRef.current) return;
    const timer = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [template, values, formatValue, flush]);
  useEffect(() => flush, [flush]);

  const format = useMemo(
    () => (template ? resolveFormat(template.manifest, formatValue) : null),
    [template, formatValue],
  );

  // The format PROP follows what is staged, not what was just clicked — the
  // layout and the canvas must change in the same frame.
  const inputProps = useMemo(() => {
    if (!template) return {};
    const stagedFormat = resolveFormat(template.manifest, staged?.format ?? formatValue);
    return buildInputProps(template.manifest, values, stagedFormat);
  }, [template, values, staged?.format, formatValue]);

  const fileUrlFor = useCallback((value: ParamValue): string | null => {
    if (typeof value !== 'string' || value === '' || !staged?.assetBaseUrl) return null;
    const absolute = /^(?:[A-Za-z]:[\\/]|\/|\\\\)/.test(value);
    const abs = absolute ? value : `${staged.workDir.replace(/\\/g, '/')}/${value}`;
    return `${staged.assetBaseUrl}/asset?path=${encodeURIComponent(abs)}`;
  }, [staged]);

  const isCustomized = useMemo(
    () => (template ? template.manifest.controls.some((c) => values[c.key] !== c.default) : false),
    [template, values],
  );

  return {
    template,
    status,
    error,
    values,
    format,
    entryPath: staged?.entryPath ?? null,
    inputProps,
    activePresetId: template ? activePresetId(template.manifest, values) : null,
    isCustomized,
    open,
    close,
    setValue,
    setFormat,
    applyPreset,
    reset,
    pickFile,
    fileUrlFor,
  };
}
