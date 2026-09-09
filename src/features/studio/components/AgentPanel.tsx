import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Brain, RotateCcw, Scissors, Send, Sparkles, Square, Wrench } from 'lucide-react';
import type { AgentChatMessage, UseStudioAgentResult } from '../hooks/useStudioAgent';
import { useMemoryProposals } from '../hooks/useMemoryProposals';
import { useStylePromotions } from '../hooks/useStylePromotions';
import { useVocabularyProposals } from '../hooks/useVocabularyProposals';
import { usePresetProposals } from '../hooks/usePresetProposals';
import { MemoryDialog } from '@renderer/components/memory/MemoryDialog';
import { ModelPickerChip } from '@renderer/components/ModelPickerChip';
import { useProviderPicker } from '@renderer/hooks/useProviderPicker';
import type { StudioAgentSettings } from '../types';
import { MemoryProposalCard } from './MemoryProposalCard';
import { StylePromotionCard } from './StylePromotionCard';
import { VocabularyProposalCard } from './VocabularyProposalCard';
import { PresetUpdateCard } from './PresetUpdateCard';

/** Warn when the next turn is estimated at ≥40% of the context budget. */
const CONTEXT_WARN_RATIO = 0.4;

/** Friendly labels for agent tool events; unknown tools show their raw name. */
const TOOL_LABELS: Record<string, string> = {
  get_transcript: 'Reading transcript',
  list_shots: 'Checking the shot pool',
  propose_cuts: 'Proposing cuts',
  generate_tsx_shot: 'Generating shot',
  propose_shots: 'Proposing shots',
  generate_image: 'Generating image',
  remove_background: 'Removing background',
  capture_webpage: 'Capturing webpage',
  capture_scripted: 'Capturing webpage states',
  propose_memory: 'Proposing a memory',
  propose_style_promotion: 'Proposing a brand promotion',
  // W3: the end-to-end steps.
  transcribe_asset: 'Transcribing',
  run_auto_cut: 'Running Auto Cut',
  generate_video: 'Generating video',
  insert_asset: 'Proposing an insert',
  list_assets: 'Listing assets',
  get_brand: 'Reading the brand',
  set_captions: 'Setting captions',
  accept_proposal: 'Applying the proposal',
  export_project: 'Queuing the export',
  // W4: script and vocabulary.
  get_script: 'Reading the script',
  propose_vocabulary: 'Proposing vocabulary',
  // W5: editing presets.
  get_preset: 'Reading the preset',
  propose_preset_update: 'Learning from this video',
};

interface Props {
  projectId: string;
  agent: UseStudioAgentResult;
  /** The project's agent settings — the chip edits them (W1), so the choice
   *  applies to the next turn and sticks with the project. */
  settings: StudioAgentSettings;
  onSettingsChange: (patch: Partial<StudioAgentSettings>) => void;
}

/** The Assistant tab: chat with the editing agent. Cut proposals it creates
 *  land on the timeline + Inspector review flow — never applied directly. */
export function AgentPanel({ projectId, agent, settings, onSettingsChange }: Props) {
  const [draft, setDraft] = useState('');
  const [memoryOpen, setMemoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const memoryProposals = useMemoryProposals(projectId);
  const stylePromotions = useStylePromotions(projectId);
  const vocabulary = useVocabularyProposals(projectId);
  const presetUpdates = usePresetProposals(projectId);
  const { providers } = useProviderPicker();

  const { messages, busy, send, cancel, clear, contextUsage, toolsAvailable } = agent;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [
    messages,
    memoryProposals.proposals.length,
    stylePromotions.proposals.length,
    vocabulary.proposals.length,
    presetUpdates.proposals.length,
  ]);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    void send(text);
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 space-y-2.5">
        {messages.length === 0 &&
        memoryProposals.proposals.length === 0 &&
        stylePromotions.proposals.length === 0 &&
        vocabulary.proposals.length === 0 &&
        presetUpdates.proposals.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((m) => <MessageRow key={m.id} message={m} />)
        )}
        {memoryProposals.proposals.map((p) => (
          <MemoryProposalCard
            key={p.id}
            proposal={p}
            sameKindActive={memoryProposals.sameKindActive(p)}
            error={memoryProposals.error}
            resolving={memoryProposals.resolving}
            onAccept={(edited) => void memoryProposals.accept(p, edited)}
            onReject={() => void memoryProposals.reject(p)}
          />
        ))}
        {stylePromotions.proposals.map((p) => (
          <StylePromotionCard
            key={p.id}
            proposal={p}
            error={stylePromotions.error}
            resolving={stylePromotions.resolving}
            onAccept={() => void stylePromotions.accept(p)}
            onReject={() => void stylePromotions.reject(p)}
          />
        ))}
        {vocabulary.proposals.map((p) => (
          <VocabularyProposalCard
            key={p.id}
            proposal={p}
            error={vocabulary.error}
            resolving={vocabulary.resolving}
            onAccept={(terms) => void vocabulary.accept(p, terms)}
            onReject={() => void vocabulary.reject(p)}
          />
        ))}
        {presetUpdates.proposals.map((p) => (
          <PresetUpdateCard
            key={p.id}
            proposal={p}
            error={presetUpdates.error}
            resolving={presetUpdates.resolving}
            onAccept={() => void presetUpdates.accept(p)}
            onReject={() => void presetUpdates.reject(p)}
          />
        ))}
        {presetUpdates.lastOutcome && presetUpdates.proposals.length === 0 && (
          <div className="text-[10px] text-text-dim px-1" data-preset-update-outcome>
            Preset &ldquo;{presetUpdates.lastOutcome.presetName}&rdquo; updated
            {presetUpdates.lastOutcome.knobsChanged > 0
              ? ` · ${presetUpdates.lastOutcome.knobsChanged} knob${presetUpdates.lastOutcome.knobsChanged === 1 ? '' : 's'} changed`
              : ' · knobs unchanged'}
            {' · a "Learned from" section was added to its PRESET.md'}
          </div>
        )}
        {vocabulary.lastOutcome && vocabulary.proposals.length === 0 && (
          <div className="text-[10px] text-text-dim px-1" data-vocabulary-outcome>
            Brand vocabulary updated
            {vocabulary.lastOutcome.added.length > 0 ? ` · added ${vocabulary.lastOutcome.added.join(', ')}` : ''}
            {vocabulary.lastOutcome.merged.length > 0 ? ` · aliases added to ${vocabulary.lastOutcome.merged.join(', ')}` : ''}
            {vocabulary.lastOutcome.retiredMemories > 0
              ? ` · ${vocabulary.lastOutcome.retiredMemories} memor${vocabulary.lastOutcome.retiredMemories === 1 ? 'y' : 'ies'} retired`
              : ''}
          </div>
        )}
      </div>

      <div className="p-2.5 shrink-0" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        {contextUsage.ratio >= CONTEXT_WARN_RATIO && (
          <div className="flex items-start gap-1.5 rounded-[6px] bg-amber-500/10 px-2 py-1.5 mb-1.5 text-[10px] text-amber-400 leading-snug">
            <AlertTriangle size={11} strokeWidth={1.75} className="shrink-0 mt-[1px]" />
            <span>
              Long session — the next turn carries roughly {Math.min(999, Math.round(contextUsage.ratio * 100))}%
              of the assistant&rsquo;s context (transcripts + recent chat). Starting a new
              conversation (↺) after applying cuts keeps it sharp — the old one is kept on disk.
            </span>
          </div>
        )}
        <div
          className="rounded-[8px] bg-app-base px-2 py-1.5 focus-within:ring-1 focus-within:ring-accent-blue/40"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Describe an edit… e.g. “do an editorial pass — cut retakes and fillers”"
            className="w-full resize-none bg-transparent text-[11px] text-text-primary placeholder:text-text-ghost outline-none leading-snug"
          />
          <div className="flex items-center gap-1 pt-1">
            <ModelPickerChip
              providers={providers}
              providerId={settings.providerId ?? ''}
              onProviderChange={(providerId) =>
                onSettingsChange({ providerId: providerId || undefined, shotModel: undefined })
              }
              model={settings.model ?? ''}
              onModelChange={(model) => onSettingsChange({ model: model || undefined })}
              thinking={settings.thinking ?? 'off'}
              onThinkingChange={(level) =>
                onSettingsChange({ thinking: level === 'off' ? undefined : level })
              }
              appDefaultLabel="App default"
              disabled={busy}
            />
            <div className="flex-1" />
            <IconAction title="Memory — rules, names, and profile the assistant follows" onClick={() => setMemoryOpen(true)}>
              <Brain size={12} strokeWidth={1.75} />
            </IconAction>
            {messages.length > 0 && !busy && (
              <IconAction title="New conversation — the current one is kept on disk" onClick={clear}>
                <RotateCcw size={12} strokeWidth={1.75} />
              </IconAction>
            )}
            {busy ? (
              <IconAction title="Stop the assistant" onClick={cancel} accent>
                <Square size={12} strokeWidth={1.75} />
              </IconAction>
            ) : (
              <IconAction title="Send (Enter)" onClick={submit} accent disabled={draft.trim().length === 0}>
                <Send size={12} strokeWidth={1.75} />
              </IconAction>
            )}
          </div>
        </div>
      </div>

      <MemoryDialog
        isOpen={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        {...(toolsAvailable !== undefined ? { canPropose: toolsAvailable } : {})}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2.5 text-center px-3">
      <Sparkles size={26} strokeWidth={1.25} className="text-text-ghost" />
      <div className="text-[12px] font-medium text-text-secondary">Editing assistant</div>
      <div className="text-[11px] text-text-dim leading-snug max-w-[220px]">
        Ask for an editorial pass over a transcribed clip — retakes, false starts, and filler words
        come back as a cut proposal you review on the timeline before anything applies.
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: AgentChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-[8px] bg-app-active px-2 py-1.5 text-[11px] text-text-primary whitespace-pre-wrap leading-snug"
          style={{ border: '0.5px solid var(--color-border)' }}
        >
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {message.toolCalls?.map((call, i) => (
        <div key={i} className="flex items-center gap-1 text-[10px] text-text-muted">
          <Wrench size={10} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">
            {TOOL_LABELS[call.tool] ?? call.tool}
            {call.detail ? ` — ${call.detail}` : ''}
          </span>
        </div>
      ))}
      {message.proposalNote && (
        <div className="flex items-center gap-1.5 rounded-[6px] bg-accent-blue/10 px-2 py-1 text-[10px] text-accent-blue">
          <Scissors size={11} strokeWidth={1.75} className="shrink-0" />
          <span>{message.proposalNote}</span>
        </div>
      )}
      {(message.text || message.pending) && (
        <div
          className={`text-[11px] whitespace-pre-wrap leading-snug ${
            message.error ? 'text-red-400' : 'text-text-secondary'
          }`}
        >
          {message.text || <span className="text-text-ghost">Thinking…</span>}
          {message.pending && message.text ? <span className="animate-pulse"> ▍</span> : null}
        </div>
      )}
    </div>
  );
}

function IconAction({
  title,
  onClick,
  children,
  accent,
  disabled,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center w-[22px] h-[22px] rounded-[5px] transition-colors disabled:opacity-40 ${
        accent
          ? 'text-accent-blue hover:bg-accent-blue/15'
          : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}
