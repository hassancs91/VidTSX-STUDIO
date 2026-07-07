import { useState, useRef, useCallback, useMemo } from 'react';
import { Button, ProgressBar } from '@shared/components';
import { useVoiceAITester } from '../hooks/useVoiceAITester';

// ─── Icons ────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 3L4.5 7L8.5 11" />
  </svg>
);

const PlayIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 3L11 7L4 11V3Z" />
  </svg>
);

const StopIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="8" height="8" rx="1" />
  </svg>
);

const MicIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="1" width="4" height="7" rx="2" />
    <path d="M3 6.5a4 4 0 008 0" />
    <path d="M7 11v2" />
  </svg>
);

const FileIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2h5l3 3v7H3V2z" />
    <path d="M8 2v3h3" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────

function ModelSelect({
  models,
  value,
  onChange,
  label,
}: {
  models: Array<{ id: string; name: string; language: string; sttMode?: string; numSpeakers?: number }>;
  value: string | null;
  onChange: (id: string) => void;
  label: string;
}) {
  return (
    <div>
      <div className="text-[10px] text-text-dim mb-1">{label}</div>
      <select
        className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {models.length === 0 ? (
          <option value="">No models downloaded</option>
        ) : (
          models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.language}{m.sttMode === 'online' ? ' (stream)' : ''}{m.numSpeakers && m.numSpeakers > 1 ? ` (${m.numSpeakers} voices)` : ''}
            </option>
          ))
        )}
      </select>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-app-base">
      <span className="text-[9px] text-text-dim uppercase">{label}</span>
      <span className="text-[11px] text-text-secondary font-mono">{value}</span>
    </div>
  );
}

// ─── TTS Tab ──────────────────────────────────────────────────────────

function TtsTab({
  ttsModels,
  selectedTtsModelId,
  setSelectedTtsModelId,
  tts,
  generateSpeech,
}: ReturnType<typeof useVoiceAITester>) {
  const [text, setText] = useState('Hello! This is a test of the text to speech engine. The quick brown fox jumps over the lazy dog.');
  const [speakerId, setSpeakerId] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedModel = ttsModels.find((m) => m.id === selectedTtsModelId);
  const maxSpeakers = selectedModel?.numSpeakers ?? 1;

  const audioUrl = useMemo(() => {
    if (!tts.audioBase64) return null;
    const binary = atob(tts.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  }, [tts.audioBase64]);

  const handleGenerate = useCallback(() => {
    if (!text.trim()) return;
    generateSpeech(text.trim(), speakerId, speed);
  }, [text, speakerId, speed, generateSpeech]);

  return (
    <div className="flex flex-col gap-4">
      {/* Model selection */}
      <ModelSelect
        models={ttsModels}
        value={selectedTtsModelId}
        onChange={setSelectedTtsModelId}
        label="TTS Model"
      />

      {/* Controls row */}
      <div className="flex gap-3 flex-wrap">
        {maxSpeakers > 1 && (
          <div className="w-[180px]">
            <div className="text-[10px] text-text-dim mb-1">
              Voice / Speaker ID ({maxSpeakers} available)
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={0}
                max={maxSpeakers - 1}
                value={speakerId}
                onChange={(e) => setSpeakerId(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-[11px] text-text-secondary font-mono w-[28px] text-center">
                {speakerId}
              </span>
            </div>
          </div>
        )}
        <div className="w-[140px]">
          <div className="text-[10px] text-text-dim mb-1">Speed</div>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-[11px] text-text-secondary font-mono w-[32px] text-center">
              {speed.toFixed(1)}x
            </span>
          </div>
        </div>
      </div>

      {/* Model info */}
      {selectedModel && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500/15 text-purple-400">
            {selectedModel.language.toUpperCase()}
          </span>
          {maxSpeakers > 1 && (
            <span className="text-[10px] text-text-dim">{maxSpeakers} voices — try different Speaker IDs to hear different voices</span>
          )}
          {maxSpeakers === 1 && (
            <span className="text-[10px] text-text-dim">Single voice model</span>
          )}
        </div>
      )}

      {/* Text input */}
      <div>
        <div className="text-[10px] text-text-dim mb-1">Text to speak</div>
        <textarea
          className="w-full bg-app-base border border-border rounded-[6px] px-3 py-2 text-[12px] text-text-secondary outline-none focus:border-accent resize-none"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to generate speech..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault();
              handleGenerate();
            }
          }}
        />
      </div>

      {/* Generate button */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={tts.generating || !selectedTtsModelId || !text.trim()}
        >
          {tts.generating ? 'Generating...' : 'Generate Speech'}
        </Button>
        <span className="text-[10px] text-text-dim">Ctrl+Enter</span>
      </div>

      {/* Error */}
      {tts.error && (
        <div className="text-[11px] text-accent-red bg-accent-red/10 rounded-[6px] px-3 py-2">
          {tts.error}
        </div>
      )}

      {/* Result */}
      {audioUrl && (
        <div className="bg-app-surface rounded-[8px] p-3 border border-border">
          <div className="flex items-center gap-2 mb-3">
            <StatBadge label="Duration" value={`${tts.durationSeconds?.toFixed(2)}s`} />
            <StatBadge label="Generation" value={`${tts.elapsedMs}ms`} />
            <StatBadge label="Sample Rate" value={`${tts.sampleRate} Hz`} />
            {tts.durationSeconds && tts.elapsedMs && (
              <StatBadge label="RTF" value={`${(tts.elapsedMs / 1000 / tts.durationSeconds).toFixed(3)}x`} />
            )}
          </div>
          <audio ref={audioRef} controls src={audioUrl} className="w-full h-[32px]" />
        </div>
      )}
    </div>
  );
}

// ─── STT Tab ──────────────────────────────────────────────────────────

function SttTab({
  sttModels,
  selectedSttModelId,
  setSelectedSttModelId,
  stt,
  transcribeFile,
  startStreaming,
  stopStreaming,
}: ReturnType<typeof useVoiceAITester>) {
  const selectedModel = sttModels.find((m) => m.id === selectedSttModelId);
  const isStreaming = selectedModel?.sttMode === 'online';

  return (
    <div className="flex flex-col gap-4">
      {/* Model selection */}
      <ModelSelect
        models={sttModels}
        value={selectedSttModelId}
        onChange={setSelectedSttModelId}
        label="STT Model"
      />

      {/* Model info */}
      {selectedModel && (
        <div className="flex items-center gap-2">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${
            isStreaming ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'
          }`}>
            {isStreaming ? 'STREAMING' : 'BATCH'}
          </span>
          <span className="text-[10px] text-text-dim">{selectedModel.language}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={transcribeFile}
          disabled={stt.transcribing || stt.streaming || !selectedSttModelId}
        >
          <span className="flex items-center gap-1.5">
            <FileIcon />
            {stt.transcribing ? 'Transcribing...' : 'Transcribe File'}
          </span>
        </Button>

        {isStreaming && !stt.streaming && (
          <Button
            variant="primary"
            onClick={startStreaming}
            disabled={stt.transcribing || !selectedSttModelId}
          >
            <span className="flex items-center gap-1.5">
              <MicIcon />
              Start Streaming
            </span>
          </Button>
        )}

        {stt.streaming && (
          <Button variant="primary" onClick={stopStreaming}>
            <span className="flex items-center gap-1.5">
              <StopIcon />
              Stop
            </span>
          </Button>
        )}
      </div>

      {/* Streaming indicator */}
      {stt.streaming && (
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-red opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-red" />
          </span>
          <span className="text-[11px] text-accent-red font-medium">Listening...</span>
        </div>
      )}

      {/* Loading indicator for file transcription */}
      {stt.transcribing && (
        <div className="w-[200px]">
          <ProgressBar value={-1} />
        </div>
      )}

      {/* Error */}
      {stt.error && (
        <div className="text-[11px] text-accent-red bg-accent-red/10 rounded-[6px] px-3 py-2">
          {stt.error}
        </div>
      )}

      {/* Live partial result */}
      {stt.streaming && stt.partialText && (
        <div className="bg-app-surface rounded-[8px] p-3 border border-border">
          <div className="text-[10px] text-text-dim mb-1">Live transcript</div>
          <div className="text-[12px] text-text-secondary whitespace-pre-wrap">{stt.partialText}</div>
        </div>
      )}

      {/* Final result */}
      {stt.result && (
        <div className="bg-app-surface rounded-[8px] p-3 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[10px] text-text-dim">Result</div>
            {stt.elapsedMs && <StatBadge label="Time" value={`${stt.elapsedMs}ms`} />}
          </div>
          <div className="text-[12px] text-text-primary whitespace-pre-wrap select-text cursor-text leading-relaxed">
            {stt.result}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────

type TabId = 'tts' | 'stt';

export function VoiceAITesterScreen({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>('tts');
  const hook = useVoiceAITester();

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 h-[40px] px-3 bg-app-surface shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[12px] text-text-muted hover:text-text-secondary transition-colors"
        >
          <BackIcon />
          Tools
        </button>
        <div className="w-px h-4 bg-border" />
        <span className="text-[13px] font-medium text-text-secondary">Voice AI Tester</span>

        {/* Tabs */}
        <div className="flex items-center gap-1 ml-4">
          {([
            { id: 'tts' as const, label: 'Text to Speech' },
            { id: 'stt' as const, label: 'Speech to Text' },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 h-[26px] rounded-md text-[11px] font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-app-active text-accent-light'
                  : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Engine status */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${hook.available ? 'bg-accent-green' : 'bg-accent-red'}`} />
          <span className="text-[10px] text-text-dim">
            {hook.available ? 'Engine ready' : 'Engine unavailable'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-[600px]">
          {hook.loading ? (
            <div className="text-[12px] text-text-muted">Loading models...</div>
          ) : !hook.available ? (
            <div className="bg-app-surface rounded-[8px] p-4 border border-border text-center">
              <div className="text-[12px] text-text-secondary mb-1">sherpa-onnx engine not available</div>
              <div className="text-[10px] text-text-dim">Check that sherpa-onnx-node is installed correctly.</div>
            </div>
          ) : hook.ttsModels.length === 0 && hook.sttModels.length === 0 ? (
            <div className="bg-app-surface rounded-[8px] p-4 border border-border text-center">
              <div className="text-[12px] text-text-secondary mb-1">No models downloaded</div>
              <div className="text-[10px] text-text-dim">Download models from Settings → AI Models (Admin) first.</div>
            </div>
          ) : (
            <>
              {activeTab === 'tts' && <TtsTab {...hook} />}
              {activeTab === 'stt' && <SttTab {...hook} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
