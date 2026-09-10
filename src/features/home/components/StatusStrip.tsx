import { isFeatureEnabled } from '@shared/feature-flags';
import type { HomeStatus } from '@shared/ipc/types';
import { goToScreen } from '../services/home-navigation';
import { SectionRow } from './SectionRow';

type Tone = 'ok' | 'warn' | 'off' | 'busy';

const TONE_COLOR: Record<Tone, string> = {
  ok: 'var(--color-accent-green)',
  warn: 'var(--color-accent-amber)',
  busy: 'var(--color-accent)',
  off: 'var(--color-text-dim)',
};

interface Cell {
  id: string;
  label: string;
  value: string;
  tone: Tone;
  screen: string;
  title: string;
}

/** The four facts as cells — pure, so the strip is one map. */
export function statusCells(status: HomeStatus): Cell[] {
  const providers = status.providersConfigured;
  const runtime = status.aiRuntime;
  const running = status.queueRunning;
  const failed = status.queueFailed;
  const queued = status.queueQueued;
  return [
    {
      id: 'providers',
      label: 'Providers',
      value: `${providers} of ${status.providersTotal} configured`,
      tone: providers > 0 ? 'ok' : 'off',
      screen: 'ai-models',
      title: 'Provider keys — open the AI page',
    },
    {
      id: 'runtime',
      label: 'AI runtime',
      value: runtime === 'installed' ? 'Installed' : runtime === 'broken' ? 'Needs repair' : 'Not installed',
      tone: runtime === 'installed' ? 'ok' : runtime === 'broken' ? 'warn' : 'off',
      screen: 'ai-models',
      title: 'The optional local runtime (background removal, 3D)',
    },
    {
      id: 'queue',
      label: 'Render queue',
      value:
        running === 0 && failed === 0 && queued === 0
          ? 'Idle'
          : [
              running > 0 ? `${running} running` : '',
              queued > 0 ? `${queued} queued` : '',
              failed > 0 ? `${failed} failed` : '',
            ]
              .filter(Boolean)
              .join(' · '),
      tone: failed > 0 ? 'warn' : running > 0 ? 'busy' : 'off',
      screen: 'render',
      title: 'Open the render queue',
    },
    {
      id: 'whisper',
      label: 'Whisper',
      value: !status.whisperInstalled
        ? 'Not installed'
        : status.whisperModels === 0
          ? 'No model downloaded'
          : `${status.whisperModels} model${status.whisperModels === 1 ? '' : 's'}`,
      tone: status.whisperInstalled && status.whisperModels > 0 ? 'ok' : 'off',
      screen: 'ai-models',
      title: 'Local speech-to-text — models download on the AI page',
    },
  ];
}

interface Props {
  status: HomeStatus | null;
}

export function StatusStrip({ status }: Props) {
  const cells = status ? statusCells(status) : [];
  return (
    <section data-home-section="status">
      <SectionRow title="Status" />
      <div
        className="flex flex-wrap rounded-[8px] bg-app-surface overflow-hidden"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        {cells.map((cell) => (
          <button
            key={cell.id}
            onClick={() => goToScreen(isFeatureEnabled(cell.screen) ? cell.screen : 'ai-models')}
            title={cell.title}
            data-home-status={cell.id}
            className="flex-1 min-w-[160px] flex items-center gap-2 px-3 h-[36px] text-left hover:bg-app-hover transition-colors"
            style={{ borderRight: '0.5px solid var(--color-border)' }}
          >
            <span
              className="shrink-0 rounded-full"
              style={{ width: 6, height: 6, background: TONE_COLOR[cell.tone] }}
            />
            <span className="text-[10px] text-text-dim">{cell.label}</span>
            <span className="text-[11px] text-text-secondary truncate">{cell.value}</span>
          </button>
        ))}
        {!status && <div className="px-3 h-[36px] flex items-center text-[11px] text-text-dim">Reading…</div>}
      </div>
    </section>
  );
}
