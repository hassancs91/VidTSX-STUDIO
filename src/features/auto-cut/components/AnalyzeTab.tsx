import { useEffect, useMemo, useState } from 'react';
import type { StudioAnalysisJson } from '@shared/ipc/types';
import { sttEntriesWithTimestamps } from '@shared/presets/stt-models';
import { useWhisperAvailability } from '../hooks/useWhisperAvailability';

type AnalysisProvider = 'local-whisper' | 'assemblyai';

export interface AnalyzeTabProps {
  isRunning: boolean;
  canRun: boolean;
  runError: string | null;
  onRun: (sttModelId: string) => void;
  // Cached mechanical analysis — present after the first successful run
  analysis: StudioAnalysisJson | null;
  // Clears analysis + any derived state (cut plan, hidden flags). Called when
  // the user explicitly discards. Re-analyze is just `onRun` again — the main
  // process handler clears stale derived state automatically.
  onDiscardAnalysis: () => void;
  // True when the project has a cut plan or hidden clips — re-analyzing or
  // discarding will invalidate that work, so the UI warns first.
  hasDerivedState: boolean;
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}m${r > 0 ? ` ${r.toFixed(0)}s` : ''}`;
}

// Only timestamp-capable models can drive cut decisions — OpenRouter's
// text-only entries are excluded by this filter automatically.
const TIMESTAMP_ENTRIES = sttEntriesWithTimestamps();
const WHISPER_ENTRIES = TIMESTAMP_ENTRIES.filter((e) => e.provider === 'local-whisper');
const ASSEMBLYAI_ENTRIES = TIMESTAMP_ENTRIES.filter((e) => e.provider === 'assemblyai');

export function AnalyzeTab({
  isRunning,
  canRun,
  runError,
  onRun,
  analysis,
  onDiscardAnalysis,
  hasDerivedState,
}: AnalyzeTabProps) {
  const whisper = useWhisperAvailability();
  const [provider, setProvider] = useState<AnalysisProvider>('local-whisper');
  const [whisperModel, setWhisperModel] = useState('base');
  const [assemblyModel, setAssemblyModel] = useState(ASSEMBLYAI_ENTRIES[0]?.model ?? 'universal');
  const [hasAssemblyKey, setHasAssemblyKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api
      .providerKeysGet()
      .then((res) => {
        if (!cancelled && res.success) setHasAssemblyKey(res.hasKeys.assemblyai);
      })
      .catch(() => {
        /* key check is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the whisper model pinned to something actually downloaded.
  useEffect(() => {
    if (whisper.downloadedModelIds.length === 0) return;
    if (!whisper.downloadedModelIds.includes(whisperModel)) {
      setWhisperModel(
        whisper.downloadedModelIds.includes('base') ? 'base' : whisper.downloadedModelIds[0],
      );
    }
  }, [whisper.downloadedModelIds, whisperModel]);

  const selectedSttModelId = useMemo(
    () =>
      provider === 'local-whisper'
        ? `local-whisper/${whisperModel}`
        : `assemblyai/${assemblyModel}`,
    [provider, whisperModel, assemblyModel],
  );

  const localBlocked = provider === 'local-whisper' && !whisper.ready;
  const assemblyBlocked = provider === 'assemblyai' && !hasAssemblyKey;
  const blocked = localBlocked || assemblyBlocked;

  const handleRun = () => {
    if (analysis && hasDerivedState) {
      const ok = window.confirm(
        'Re-analyzing will discard the current cut plan and restore any hidden segments. Continue?'
      );
      if (!ok) return;
    }
    onRun(selectedSttModelId);
  };

  const handleDiscard = () => {
    const msg = hasDerivedState
      ? 'Discard the analysis? This also clears the cut plan and restores any hidden segments.'
      : 'Discard the analysis?';
    if (!window.confirm(msg)) return;
    onDiscardAnalysis();
  };

  return (
    <div className="flex flex-col gap-[14px] p-[12px] overflow-auto h-full">
      <Section title="Transcription">
        <div className="flex flex-col gap-[6px]">
          <ProviderOption
            label="Local — Whisper"
            tagline={
              whisper.loading
                ? 'Checking for Whisper…'
                : whisper.ready
                  ? 'Free · runs offline on your machine'
                  : 'Install Whisper in Settings to enable'
            }
            selected={provider === 'local-whisper'}
            disabled={false}
            onSelect={() => setProvider('local-whisper')}
          />
          <ProviderOption
            label="AssemblyAI"
            tagline={
              hasAssemblyKey
                ? 'Exact word timing · speakers · sentiment'
                : 'Add an AssemblyAI API key in Settings'
            }
            selected={provider === 'assemblyai'}
            disabled={false}
            onSelect={() => setProvider('assemblyai')}
          />
        </div>

        {/* Model picker for the selected provider. */}
        {provider === 'local-whisper' ? (
          whisper.ready ? (
            <ModelSelect
              value={whisperModel}
              onChange={setWhisperModel}
              options={WHISPER_ENTRIES.filter((e) =>
                whisper.downloadedModelIds.includes(e.model),
              ).map((e) => ({ value: e.model, label: e.name }))}
            />
          ) : null
        ) : (
          <ModelSelect
            value={assemblyModel}
            onChange={setAssemblyModel}
            options={ASSEMBLYAI_ENTRIES.map((e) => ({ value: e.model, label: e.name }))}
          />
        )}

        {/* Description for the currently-selected provider only. */}
        {provider === 'local-whisper' ? (
          <p className="text-text-ghost text-[10px] leading-snug">
            Runs fully offline and free on your machine. Word timing is approximated from
            segment bounds — great for captions and cuts, without speaker or sentiment signals.
          </p>
        ) : (
          <p className="text-text-ghost text-[10px] leading-snug">
            Cloud transcription with exact word timestamps, speaker labels, key moments, and
            sentiment — the sharpest auto-cut signal. Billed to your AssemblyAI account.
          </p>
        )}
        {localBlocked && !whisper.loading && (
          <p
            className="text-[10px] px-[8px] py-[6px] rounded-[4px] leading-snug"
            style={{
              color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-app-active)',
            }}
          >
            {whisper.binaryInstalled
              ? 'Download a Whisper model in Settings > Transcription to analyze locally.'
              : 'Install Whisper in Settings > Transcription to analyze locally.'}
          </p>
        )}
        {assemblyBlocked && (
          <p
            className="text-[10px] px-[8px] py-[6px] rounded-[4px] leading-snug"
            style={{
              color: 'var(--color-text-muted)',
              backgroundColor: 'var(--color-app-active)',
            }}
          >
            Add your AssemblyAI API key in Settings &gt; Providers to use cloud analysis.
          </p>
        )}
      </Section>

      <Section>
        <button
          onClick={handleRun}
          disabled={!canRun || isRunning || blocked}
          className="flex items-center justify-center gap-[6px] h-[30px] rounded-[6px] text-[11px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--color-accent)' }}
          title={
            blocked
              ? localBlocked
                ? 'Install Whisper (Settings > Transcription) or switch to AssemblyAI'
                : 'Add an AssemblyAI API key (Settings > Providers) or switch to Local Whisper'
              : canRun
                ? analysis
                  ? 'Re-analyze with the selected model'
                  : 'Analyze with the selected model'
                : 'Add a video clip first'
          }
        >
          {isRunning ? (
            <>
              <div
                className="w-[10px] h-[10px] rounded-full border-[1.5px] border-t-transparent animate-spin"
                style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}
              />
              Analyzing…
            </>
          ) : (
            <>
              <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="4" />
                <path d="M9 9L12 12" />
              </svg>
              {analysis ? 'Re-analyze' : 'Analyze'}
            </>
          )}
        </button>
        {!canRun && !analysis && (
          <p className="text-text-ghost text-[10px] leading-snug">
            Add a video to the timeline. Analysis produces the transcript and prosody signal
            that auto-cut, captions, TSX, SFX, and transitions all consume.
          </p>
        )}
        {runError && (
          <div
            className="text-[10px] px-[8px] py-[6px] rounded-[4px] leading-snug"
            style={{
              color: 'var(--color-status-error, #ef4444)',
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '0.5px solid rgba(239,68,68,0.3)',
            }}
          >
            {runError}
          </div>
        )}
      </Section>

      {analysis && (
        <Section
          title="Analyzed"
          right={
            <span
              className="px-[6px] py-[1px] rounded-[3px] text-[9px] font-medium uppercase tracking-wider"
              style={{
                color: 'rgba(34,197,94,1)',
                backgroundColor: 'rgba(34,197,94,0.16)',
              }}
            >
              Ready
            </span>
          }
        >
          {/* Minimal summary — duration + word count. The full mechanical
              breakdown (utterances, silences, disfluencies, prosody) is
              internal signal the user doesn't need to see here. */}
          <div
            className="flex items-center justify-between px-[8px] py-[6px] rounded-[4px] text-[10px]"
            style={{ backgroundColor: 'var(--color-app-active)' }}
          >
            <span className="text-text-dim">
              {formatSeconds(analysis.source.duration)}
            </span>
            <span className="text-text-primary font-mono">
              {analysis.stats.totalWords.toLocaleString()} words
            </span>
          </div>
          <button
            onClick={handleDiscard}
            className="h-[22px] rounded-[3px] text-[10px] text-text-muted hover:text-status-error hover:bg-app-hover transition-colors"
          >
            Discard analysis
          </button>
        </Section>
      )}
    </div>
  );
}

function ModelSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[26px] px-[8px] rounded-[4px] text-[11px] text-text-primary outline-none"
      style={{
        backgroundColor: 'var(--color-app-base)',
        border: '0.5px solid var(--color-border)',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ProviderOption({
  label,
  tagline,
  selected,
  disabled,
  badge,
  onSelect,
}: {
  label: string;
  tagline: string;
  selected: boolean;
  disabled: boolean;
  badge?: string;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className="flex items-center gap-[8px] px-[10px] py-[8px] rounded-[6px] text-left transition-colors disabled:cursor-not-allowed"
      style={{
        backgroundColor: selected ? 'var(--color-app-active)' : 'var(--color-app-base)',
        border: selected
          ? '1px solid var(--color-accent)'
          : '0.5px solid var(--color-border)',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {/* Radio dot */}
      <span
        className="shrink-0 flex items-center justify-center w-[14px] h-[14px] rounded-full"
        style={{
          border: selected
            ? '4px solid var(--color-accent)'
            : '1px solid var(--color-border-hover)',
        }}
      />
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-[6px]">
          <span className="text-text-primary text-[11px] font-medium">{label}</span>
          {badge && (
            <span
              className="text-[8px] font-semibold uppercase tracking-wider px-[5px] py-[1px] rounded-[3px]"
              style={{
                color: 'var(--color-accent-light)',
                backgroundColor: 'rgba(127,119,221,0.18)',
              }}
            >
              {badge}
            </span>
          )}
        </span>
        <span className="block text-text-ghost text-[10px] mt-[1px]">{tagline}</span>
      </span>
    </button>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      {(title || right) && (
        <div className="flex items-center justify-between">
          {title && (
            <span className="text-text-muted text-[10px] uppercase tracking-wider">
              {title}
            </span>
          )}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}
