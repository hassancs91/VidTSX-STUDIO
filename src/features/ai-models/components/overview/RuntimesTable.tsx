import { useSystemRuntimes } from '../../hooks/useSystemRuntimes';
import { AiRuntimeRow } from '../AiRuntimeRow';
import { LocalSectionPanel } from '../local/LocalSectionPanel';
import { RUNTIME_GRID_COLS, RuntimeRow } from './RuntimeRow';

function Caption({ children }: { children: string }) {
  return <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-text-dim">{children}</div>;
}

/**
 * Overview → Runtimes (docs/ai-models-redesign.md §3.1): one table for every
 * runtime the app downloads on first use — whisper.cpp, sd-cli, the full
 * ffmpeg for GPU proxies, and the AI runtime (Python + PyTorch), which keeps
 * its own row with variants, Repair and Remove-with-models. Replaces the
 * Engines cards; the hidden engines (sherpa, node-llama-cpp) have no row.
 */
export function RuntimesTable() {
  const rt = useSystemRuntimes();

  return (
    <LocalSectionPanel
      id="runtimes"
      title="Runtimes"
      caption="Downloaded once from the official releases, on first use. Nothing runs until you click, and each one can be removed here."
      isEmpty={rt.loading && rt.runtimes === null}
      empty="Checking…"
    >
      <div className="px-3 py-1.5" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <div className={`grid ${RUNTIME_GRID_COLS} items-center gap-x-3`}>
          <Caption>Runtime</Caption>
          <Caption>Status</Caption>
          <Caption>On disk</Caption>
          <div />
        </div>
      </div>

      {rt.runtimes?.map((runtime) => (
        <RuntimeRow
          key={runtime.id}
          runtime={runtime}
          progress={rt.installs[runtime.id]}
          onInstall={() => void rt.install(runtime.id)}
          onRemove={() => void rt.remove(runtime.id)}
        />
      ))}

      {/* The AI runtime: variants, Repair, Remove with its models — its own row shape. */}
      <div className="px-3" data-runtime-row="ai-runtime">
        <AiRuntimeRow />
      </div>

      {rt.error && (
        <div className="flex items-center justify-between gap-3 px-3 py-2" style={{ borderTop: '0.5px solid var(--color-border)' }}>
          <span className="text-[11px] text-accent-red">{rt.error}</span>
          <button type="button" onClick={rt.clearError} className="text-[10px] text-text-dim hover:text-text-secondary">
            Dismiss
          </button>
        </div>
      )}
    </LocalSectionPanel>
  );
}
