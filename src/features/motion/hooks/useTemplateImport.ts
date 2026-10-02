import { useCallback, useState } from 'react';
import type { TemplateIpc, TemplatesImportResponse } from '@shared/ipc/types';
import { useToast } from '@renderer/contexts/ToastContext';

export interface UseTemplateImportResult {
  importing: boolean;
  /** No path = the OS picker. An older version than the installed one asks first. */
  importTemplate: (path?: string, confirmDowngrade?: boolean) => Promise<void>;
  /** Removes a USER copy after asking; a built-in it shadowed comes back. */
  removeTemplate: (template: TemplateIpc) => Promise<void>;
}

/**
 * The importer (docs/templates-plan.md §7): a `.vidtsxtemplate` into the user
 * root, then `onChanged` (the gallery re-reads; an import also opens the new
 * template). Feedback is the toast, the flows' arrangement.
 */
export function useTemplateImport(
  onChanged: (installed?: TemplateIpc) => void | Promise<void>,
): UseTemplateImportResult {
  const { showToast } = useToast();
  const [importing, setImporting] = useState(false);

  const importTemplate = useCallback(
    async (path?: string, confirmDowngrade?: boolean): Promise<void> => {
      setImporting(true);
      let res: TemplatesImportResponse;
      try {
        res = await window.api.templatesImport({
          ...(path ? { path } : {}),
          ...(confirmDowngrade ? { confirmDowngrade: true } : {}),
        });
      } catch (err) {
        res = { success: false, error: err instanceof Error ? err.message : 'Import failed' };
      } finally {
        setImporting(false);
      }

      if (res.success && res.template) {
        showToast(`Imported "${res.template.manifest.name}"`, 'success');
        if (res.signature?.status !== 'verified') {
          showToast(
            res.signature?.status === 'signed-unknown'
              ? 'This template is signed by a publisher this app does not know.'
              : 'This template is unsigned — install templates only from people you trust.',
            'info',
          );
        }
        await onChanged(res.template);
        return;
      }
      if (res.needsConfirm === 'downgrade') {
        const ok = window.confirm(
          `Version ${res.installedVersion ?? '?'} of this template is installed. Replace it with the older one in this file?`,
        );
        if (ok && res.path) await importTemplate(res.path, true);
        return;
      }
      if (!res.canceled) showToast(res.error ?? 'Import failed', 'error');
    },
    [onChanged, showToast],
  );

  const removeTemplate = useCallback(
    async (template: TemplateIpc): Promise<void> => {
      if (!window.confirm(`Remove "${template.manifest.name}"? Your saved values for it stay.`)) return;
      const res = await window.api.templatesRemove({ id: template.manifest.id });
      if (!res.success) {
        showToast(res.error ?? 'Could not remove the template', 'error');
        return;
      }
      showToast(`Removed "${template.manifest.name}"`, 'success');
      await onChanged();
    },
    [onChanged, showToast],
  );

  return { importing, importTemplate, removeTemplate };
}
