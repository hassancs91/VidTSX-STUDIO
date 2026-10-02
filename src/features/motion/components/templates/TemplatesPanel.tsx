import { useCallback, useEffect } from 'react';
import type { TemplateIpc } from '@shared/ipc/types';
import { useTemplates } from '../../hooks/useTemplates';
import { useTemplateImport } from '../../hooks/useTemplateImport';
import type { TemplateSession } from '../../hooks/useTemplateSession';
import { TemplateGallery } from './TemplateGallery';
import { TemplateForm } from './TemplateForm';

interface TemplatesPanelProps {
  /** Templates mode has been opened at least once — the list loads then, not at app start. */
  enabled: boolean;
  session: TemplateSession;
  /** A double-clicked `.vidtsxtemplate` the screen claimed; imported once, then handed back. */
  pendingPackage: string | null;
  onPendingTaken: () => void;
}

/** The Creator's left column in Templates mode: the gallery, or the open template's form. */
export function TemplatesPanel({ enabled, session, pendingPackage, onPendingTaken }: TemplatesPanelProps) {
  const { templates, loading, error, refresh } = useTemplates(enabled);
  const { open } = session;
  const onChanged = useCallback(
    async (installed?: TemplateIpc) => {
      await refresh();
      if (installed) await open(installed);
    },
    [refresh, open],
  );
  const { importing, importTemplate, removeTemplate } = useTemplateImport(onChanged);

  useEffect(() => {
    if (!pendingPackage) return;
    onPendingTaken();
    void importTemplate(pendingPackage);
  }, [pendingPackage, onPendingTaken, importTemplate]);

  if (session.template) return <TemplateForm session={session} />;
  return (
    <TemplateGallery
      templates={templates}
      loading={loading}
      error={error}
      onOpen={(template) => { void session.open(template); }}
      onImport={() => { void importTemplate(); }}
      importing={importing}
      onRemove={(template) => { void removeTemplate(template); }}
    />
  );
}
