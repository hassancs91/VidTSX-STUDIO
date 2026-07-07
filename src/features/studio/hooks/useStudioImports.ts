import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { StudioImport, StudioImportKind } from '@shared/ipc/types';

const FILE_FILTERS: Record<StudioImportKind, { name: string; extensions: string[] }> = {
  video: { name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv', 'm4v'] },
  image: { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif'] },
  audio: { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'] },
};

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

function makeId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

// Transient per-import proxy generation state. A "ready" proxy isn't tracked
// here — its presence is the import's persisted `proxyPath`. Only in-flight /
// failed jobs live in this map.
export interface ProxyJob {
  status: 'generating' | 'error';
  percent: number;
  error?: string;
}

export interface UseStudioImportsResult {
  imports: StudioImport[];
  byKind: Record<StudioImportKind, StudioImport[]>;
  addImports: (kind: StudioImportKind) => Promise<void>;
  removeImport: (id: string) => void;
  // Video proxy (low-res edit copy) generation, keyed by import id.
  proxyJobs: Record<string, ProxyJob>;
  generateProxy: (item: StudioImport) => Promise<void>;
  cancelProxy: (id: string) => void;
}

export function useStudioImports(
  projectId: string | undefined,
  savedImports: StudioImport[] | undefined,
  onUpdate: (imports: StudioImport[] | undefined) => void
): UseStudioImportsResult {
  const imports = useMemo(() => savedImports ?? [], [savedImports]);
  const onUpdateRef = useRef(onUpdate);
  const importsRef = useRef(imports);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
    importsRef.current = imports;
  }, [onUpdate, imports]);

  const [proxyJobs, setProxyJobs] = useState<Record<string, ProxyJob>>({});

  // Prune stale proxy references once per project load: if a persisted proxy
  // file was deleted off disk, clear its `proxyPath` so the preview falls back
  // to the original instead of failing to load (black frame). Runs only when
  // there's something to verify; the ref guards re-runs for the same project.
  const verifiedProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId) return;
    if (verifiedProjectRef.current === projectId) return;
    const withProxy = importsRef.current.filter((i) => i.kind === 'video' && i.proxyPath);
    if (withProxy.length === 0) return; // nothing yet — re-check when imports change
    verifiedProjectRef.current = projectId;

    let cancelled = false;
    (async () => {
      const res = await window.api.studioProxyVerify({
        projectId,
        importIds: withProxy.map((i) => i.id),
      });
      if (cancelled || !res.success || !res.present) return;
      const present = new Set(res.present);
      const latest = importsRef.current;
      let changed = false;
      const next = latest.map((i) => {
        if (i.kind === 'video' && i.proxyPath && !present.has(i.id)) {
          changed = true;
          const { proxyPath: _drop, ...rest } = i;
          return rest;
        }
        return i;
      });
      if (changed) onUpdateRef.current(next.length > 0 ? next : undefined);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, imports]);

  const byKind = useMemo(() => {
    const groups: Record<StudioImportKind, StudioImport[]> = {
      video: [],
      image: [],
      audio: [],
    };
    for (const item of imports) groups[item.kind].push(item);
    return groups;
  }, [imports]);

  const addImports = useCallback(
    async (kind: StudioImportKind) => {
      const filter = FILE_FILTERS[kind];
      const result = await window.api.dialogOpen({
        filters: [filter],
        multiSelections: true,
      });

      const paths = result.filePaths ?? [];
      if (paths.length === 0) return;

      const existingPaths = new Set(imports.map((i) => i.filePath));
      const now = Date.now();
      const additions: StudioImport[] = paths
        .filter((p) => !existingPaths.has(p))
        .map((filePath) => ({
          id: makeId(),
          kind,
          filePath,
          fileName: basename(filePath),
          addedAt: now,
        }));

      if (additions.length === 0) return;
      const next = [...imports, ...additions];
      onUpdateRef.current(next);
    },
    [imports]
  );

  const removeImport = useCallback(
    (id: string) => {
      const next = imports.filter((i) => i.id !== id);
      onUpdateRef.current(next.length > 0 ? next : undefined);
      setProxyJobs((prev) => {
        if (!prev[id]) return prev;
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    },
    [imports]
  );

  // Live progress for in-flight proxy jobs in this project.
  useEffect(() => {
    if (!projectId) return;
    const off = window.api.onStudioProxyProgress((p) => {
      if (p.projectId !== projectId) return;
      setProxyJobs((prev) => {
        const job = prev[p.importId];
        if (!job || job.status !== 'generating') return prev;
        return { ...prev, [p.importId]: { ...job, percent: p.percent } };
      });
    });
    return off;
  }, [projectId]);

  const generateProxy = useCallback(
    async (item: StudioImport) => {
      if (!projectId || item.kind !== 'video') return;
      setProxyJobs((prev) => ({ ...prev, [item.id]: { status: 'generating', percent: 0 } }));

      const res = await window.api.studioProxyGenerate({
        projectId,
        importId: item.id,
        filePath: item.filePath,
      });

      setProxyJobs((prev) => {
        const copy = { ...prev };
        if (res.success || res.cancelled) {
          delete copy[item.id];
        } else {
          copy[item.id] = { status: 'error', percent: 0, error: res.error };
        }
        return copy;
      });

      if (res.success && res.proxyPath) {
        // Patch the import from the LATEST list (the user may have added/removed
        // imports while the transcode ran).
        const latest = importsRef.current;
        const next = latest.map((i) =>
          i.id === item.id ? { ...i, proxyPath: res.proxyPath } : i
        );
        onUpdateRef.current(next.length > 0 ? next : undefined);
      }
    },
    [projectId]
  );

  const cancelProxy = useCallback(
    (id: string) => {
      if (!projectId) return;
      void window.api.studioProxyCancel({ projectId, importId: id });
    },
    [projectId]
  );

  return { imports, byKind, addImports, removeImport, proxyJobs, generateProxy, cancelProxy };
}
