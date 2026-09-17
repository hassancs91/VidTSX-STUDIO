import { useTemplates } from '../../hooks/useTemplates';
import type { TemplateSession } from '../../hooks/useTemplateSession';
import { TemplateGallery } from './TemplateGallery';
import { TemplateForm } from './TemplateForm';

interface TemplatesPanelProps {
  /** Templates mode has been opened at least once — the list loads then, not at app start. */
  enabled: boolean;
  session: TemplateSession;
}

/** The Creator's left column in Templates mode: the gallery, or the open template's form. */
export function TemplatesPanel({ enabled, session }: TemplatesPanelProps) {
  const { templates, loading, error } = useTemplates(enabled);

  if (session.template) return <TemplateForm session={session} />;
  return (
    <TemplateGallery
      templates={templates}
      loading={loading}
      error={error}
      onOpen={(template) => { void session.open(template); }}
    />
  );
}
