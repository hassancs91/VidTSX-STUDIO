import { useEffect, useState } from 'react';
import { Select } from '@shared/components/Select';
import { TextInput } from '@shared/components/TextInput';
import type { LlmProviderConfig } from '@shared/ipc/types';
import type { StudioMediaAsset, StudioProject } from '../types';
import type { TranscribeProgress } from '../hooks/useStudioMedia';
import { TranscriptSection } from './TranscriptSection';

interface Props {
  project: StudioProject;
  onUpdate: (updater: (prev: StudioProject) => StudioProject) => void;
  selectedAsset: StudioMediaAsset | null;
  onTranscribe: (asset: StudioMediaAsset, sttModelId: string) => void;
  onCancelTranscribe: (assetId: string) => void;
  getTranscribeProgress: (assetId: string) => TranscribeProgress | null;
}

export function InspectorPanel({
  project,
  onUpdate,
  selectedAsset,
  onTranscribe,
  onCancelTranscribe,
  getTranscribeProgress,
}: Props) {
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);

  useEffect(() => {
    void window.api.llmProvidersGet().then((res) => {
      setProviders(res.providers.filter((p) => p.enabled));
    });
  }, []);

  const providerOptions = [
    { value: '', label: 'App default (active provider)' },
    ...providers.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="flex flex-col gap-4 p-3 overflow-y-auto">
      <section className="flex flex-col gap-2">
        <SectionLabel>Project</SectionLabel>
        <Field label="Name">
          <TextInput
            value={project.name}
            onChange={(e) => {
              const name = e.target.value;
              onUpdate((prev) => ({ ...prev, name }));
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Resolution">
            <ReadOnlyValue>
              {project.settings.width}×{project.settings.height}
            </ReadOnlyValue>
          </Field>
          <Field label="Frame rate">
            <ReadOnlyValue>{project.settings.fps} fps</ReadOnlyValue>
          </Field>
        </div>
      </section>

      {selectedAsset && (
        <section className="flex flex-col gap-2">
          <SectionLabel>
            Transcript · {selectedAsset.path.split(/[\\/]/).pop()}
          </SectionLabel>
          <TranscriptSection
            projectId={project.id}
            asset={selectedAsset}
            sttModelId={project.settings.sttModelId}
            onSttModelChange={(sttModelId) => {
              onUpdate((prev) => ({
                ...prev,
                settings: { ...prev.settings, sttModelId },
              }));
            }}
            onTranscribe={onTranscribe}
            onCancel={onCancelTranscribe}
            progress={getTranscribeProgress(selectedAsset.id)}
          />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel>AI Assistant</SectionLabel>
        <Field label="Provider">
          <Select
            value={project.settings.agent.providerId ?? ''}
            onChange={(providerId) => {
              onUpdate((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  agent: { ...prev.settings.agent, providerId: providerId || undefined },
                },
              }));
            }}
            options={providerOptions}
          />
        </Field>
        <p className="text-[10px] text-text-dim leading-snug">
          The editing agent (auto-cut, TSX shots, SFX) uses this provider.
          Configure providers in the AI tab.
        </p>
      </section>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-wider text-text-muted">{children}</span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-text-dim">{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyValue({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="h-[26px] flex items-center px-2 rounded-[6px] bg-app-base text-[11px] text-text-secondary"
      style={{ border: '0.5px solid var(--color-border)' }}
    >
      {children}
    </div>
  );
}
