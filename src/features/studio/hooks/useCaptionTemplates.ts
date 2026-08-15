// Caption templates in the renderer (D13): the installed list, and the
// live-imported template components the Player renders.
//
// Same shape as useShotModules — main keeps path authority, the renderer asks
// by namespaced templateId and dynamic-imports the served ESM. Templates are
// loaded ON DEMAND (the active one, plus whichever gallery cards are visible),
// so opening the panel doesn't transpile ten files at once.

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { setupVirtualModuleGlobals } from '@features/player';
import type { CaptionRuntimeProps } from '../types';
import type { StudioCaptionTemplateInfo } from '@shared/ipc/types';

export type CaptionComponent = ComponentType<CaptionRuntimeProps>;

/** The installed templates, fetched once per mount (a folder drop lands on
 *  the next open — install v1 is Explorer, PACKS_DESIGN.md). */
export function useCaptionTemplateList(): {
  templates: StudioCaptionTemplateInfo[];
  loading: boolean;
} {
  const [templates, setTemplates] = useState<StudioCaptionTemplateInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void window.api.studioCaptionTemplates().then((res) => {
      if (cancelled) return;
      setTemplates(res.success && res.templates ? res.templates : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { templates, loading };
}

/**
 * Components for the requested template ids. An id that fails to load (pack
 * uninstalled, broken template) resolves to `null` and simply paints nothing:
 * a missing template must never break the editor or a project.
 */
export function useCaptionTemplateModules(
  templateIds: string[],
): Record<string, CaptionComponent | null> {
  const [components, setComponents] = useState<Record<string, CaptionComponent | null>>({});
  const cache = useRef(new Map<string, Promise<CaptionComponent | null>>());

  const load = useCallback(async (templateId: string): Promise<CaptionComponent | null> => {
    // Pins the app's React/Remotion onto the virtual-module globals BEFORE the
    // import, so the template's useCurrentFrame() resolves against the host
    // Player — the same rule shots live by.
    await setupVirtualModuleGlobals();
    const res = await window.api.studioCaptionTemplateModule({ templateId });
    if (!res.success || !res.moduleUrl) return null;
    const mod = (await import(/* @vite-ignore */ res.moduleUrl)) as { default: CaptionComponent };
    return typeof mod.default === 'function' ? mod.default : null;
  }, []);

  const key = templateIds.slice().sort().join('|');
  useEffect(() => {
    let cancelled = false;
    for (const templateId of key === '' ? [] : key.split('|')) {
      if (cache.current.has(templateId)) continue;
      const pending = load(templateId).catch(() => null);
      cache.current.set(templateId, pending);
      void pending.then((component) => {
        if (cancelled) return;
        setComponents((prev) => ({ ...prev, [templateId]: component }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [key, load]);

  return components;
}

/** Convenience wrapper for the single template the timeline renders. */
export function useCaptionTemplate(templateId: string | null): CaptionComponent | undefined {
  const ids = templateId ? [templateId] : [];
  const components = useCaptionTemplateModules(ids);
  if (!templateId) return undefined;
  return components[templateId] ?? undefined;
}
