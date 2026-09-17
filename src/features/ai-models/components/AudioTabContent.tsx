import { useMemo } from 'react';
import { SectionHeader, StatusBadge } from '@shared/components';
import { Select } from '@shared/components/Select';
import { isFeatureEnabled } from '@shared/feature-flags';
import { useSettings } from '@renderer/hooks/useSettings';
import { useWhisper } from '@renderer/hooks/useWhisper';
import { splitWhisperCatalog, whisperToCatalogRow } from '../services/whisper-catalog';
import { AudioModelsContent } from './AudioModelsContent';
import { AllModelsList } from './local/AllModelsList';
import { InstalledSimpleRow } from './local/InstalledSimpleRow';
import { LocalDefaultsRow } from './local/LocalDefaultsRow';
import { LocalModelPage } from './local/LocalModelPage';
import { LocalModelStatusStrip } from './local/LocalModelStatusStrip';
import { LocalRuntimeChip } from './local/LocalRuntimeChip';
import { LocalSectionPanel } from './local/LocalSectionPanel';
import { RecommendedModelsList } from './local/RecommendedModelsList';

function openProviders(): void {
  window.dispatchEvent(
    new CustomEvent('vidtsx:navigate', { detail: { screen: 'ai-models', section: 'providers' } }),
  );
}

/**
 * The Audio section on the local-model template (docs/ai-models-redesign.md
 * §3.6): Whisper is one family, its sizes are the entries, whisper.cpp is the
 * runtime chip, the default transcription model is the Defaults row. Cloud
 * transcription lives under Providers — one pointer, no rows here. The sherpa
 * voice engine stays env-gated and appears as a second family when on.
 */
export function AudioTabContent() {
  const { whisperModel, setWhisperModel, loading: settingsLoading } = useSettings();
  const whisper = useWhisper();
  const sections = useMemo(() => splitWhisperCatalog(whisper.models), [whisper.models]);
  const rows = useMemo(
    () => ({ recommended: sections.recommended.map(whisperToCatalogRow), all: sections.all.map(whisperToCatalogRow) }),
    [sections],
  );
  const showVoiceEngine = isFeatureEnabled('audio-engine');
  const binary = whisper.binaryStatus;

  const catalogActions = {
    onDownload: (id: string) => void whisper.downloadModel(id),
    onPause: (id: string) => void whisper.pauseDownload(id),
    onResume: (id: string) => void whisper.resumeDownload(id),
    onCancel: (id: string) => void whisper.cancelDownload(id),
  };

  const runtime = (
    <LocalRuntimeChip
      id="whisper-cpp"
      name="whisper.cpp"
      description="Runs the Whisper models for transcription and captions on your CPU or GPU. Downloaded once from the official release."
      state={binary.installing ? 'installing' : binary.installed ? 'installed' : 'missing'}
      detail={binary.installed ? undefined : 'Needed to transcribe'}
      actionLabel={!binary.installed && !binary.installing ? 'Install' : undefined}
      onAction={() => void whisper.installBinary()}
      progress={binary.progress}
      progressLabel={binary.installing ? `Downloading whisper.cpp… ${Math.round(binary.progress)}%` : undefined}
      error={binary.error}
    />
  );

  return (
    <>
      <LocalModelPage
        strip={
          <LocalModelStatusStrip
            runtime={runtime}
            note={
              <>
                Cloud transcription and sound generation use your provider keys →{' '}
                <button type="button" onClick={openProviders} className="text-accent-light hover:underline">
                  Providers
                </button>
              </>
            }
          />
        }
        loading={whisper.loading}
        loadingLabel="Loading models…"
        error={whisper.error ? { message: whisper.error } : null}
        onClearError={whisper.clearError}
        defaults={
          <LocalDefaultsRow
            label="Default transcription model"
            hint="Used by Transcribe, captions and Studio unless a project picks its own."
          >
            <Select
              value={whisperModel}
              onChange={setWhisperModel}
              disabled={settingsLoading || sections.installed.length === 0}
              options={
                sections.installed.length === 0
                  ? [{ value: whisperModel, label: `${whisperModel} (not downloaded)` }]
                  : sections.installed.map((m) => ({ value: m.id, label: `Whisper ${m.name}` }))
              }
              className="min-w-[180px]"
            />
          </LocalDefaultsRow>
        }
        installed={
          <LocalSectionPanel
            id="installed"
            title="Installed"
            count={sections.installed.length}
            isEmpty={sections.installed.length === 0}
            empty={
              <>
                <div className="text-[12px] text-text-muted">No Whisper model downloaded yet</div>
                <div className="mt-1 text-[11px] text-text-dim">Pick one under Recommended — Small is the everyday choice.</div>
              </>
            }
          >
            {sections.installed.map((m) => (
              <InstalledSimpleRow
                key={m.id}
                id={m.id}
                name={`Whisper ${m.name}`}
                family="whisper"
                sizeLabel={m.size}
                badges={m.id === whisperModel ? <StatusBadge tone="accent">Default</StatusBadge> : undefined}
                onDelete={(id) => void whisper.deleteModel(id)}
              />
            ))}
          </LocalSectionPanel>
        }
        recommended={
          <RecommendedModelsList
            rows={rows.recommended}
            downloads={whisper.downloads}
            caption="Whisper is one family in five sizes — bigger is more accurate and slower."
            emptyLabel="Every recommended size is downloaded — the rest are under All models."
            {...catalogActions}
          />
        }
        all={
          <AllModelsList
            rows={rows.all}
            downloads={whisper.downloads}
            caption="Every Whisper size whisper.cpp ships."
            {...catalogActions}
          />
        }
      />

      {showVoiceEngine && (
        <div className="mt-8 pt-6" style={{ borderTop: '0.5px solid var(--color-border)' }}>
          <SectionHeader>Voice Engine (TTS &amp; live speech-to-text)</SectionHeader>
          <p className="-mt-2 mb-3 text-[11px] text-text-muted">
            Models for the built-in voice engine — text-to-speech and real-time transcription.
          </p>
          <AudioModelsContent />
        </div>
      )}
    </>
  );
}
