import { useRef } from 'react';
import { useThumbnailGenerator } from '../hooks/useThumbnailGenerator';

const IDEA_OPTIONS = [3, 4, 5, 6, 8, 10, 12, 15, 20] as const;

interface ThumbnailGeneratorScreenProps {
  onBack: () => void;
}

export function ThumbnailGeneratorScreen({ onBack }: ThumbnailGeneratorScreenProps) {
  const gen = useThumbnailGenerator();
  const listRef = useRef<HTMLDivElement>(null);

  const canGenerate = gen.topic.trim().length > 0 && gen.selectedProvider && !gen.loading;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center h-[40px] px-3 bg-app-surface shrink-0 gap-2"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 3.5L5 7L8.5 10.5" />
          </svg>
          Tools
        </button>
        <div className="w-px h-4 bg-border" />
        <span className="text-[13px] font-medium text-text-secondary">
          YouTube Thumbnail Generator
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-[640px] mx-auto flex flex-col gap-4">
          {/* Provider */}
          {gen.providers.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-medium">AI Provider</label>
              <select
                value={gen.selectedProvider}
                onChange={(e) => gen.setSelectedProvider(e.target.value)}
                className="h-[30px] px-2 rounded-[6px] bg-app-surface text-[11px] text-text-primary outline-none"
                style={{ border: '0.5px solid var(--color-border)' }}
              >
                {gen.providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Topic */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-text-muted font-medium">Video Topic / Title</label>
            <textarea
              value={gen.topic}
              onChange={(e) => gen.setTopic(e.target.value)}
              placeholder="Enter your video topic, title, or a brief description..."
              rows={3}
              className="px-2 py-1.5 rounded-[6px] bg-app-surface text-[12px] text-text-primary placeholder-text-dim resize-none outline-none"
              style={{ border: '0.5px solid var(--color-border)' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canGenerate) {
                  gen.generate();
                }
              }}
            />
          </div>

          {/* Options row */}
          <div className="flex flex-wrap gap-4">
            {/* Number of ideas */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-medium">Number of Ideas</label>
              <select
                value={gen.numberOfIdeas}
                onChange={(e) => gen.setNumberOfIdeas(Number(e.target.value))}
                className="h-[30px] px-2 rounded-[6px] bg-app-surface text-[11px] text-text-primary outline-none"
                style={{ border: '0.5px solid var(--color-border)' }}
              >
                {IDEA_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Orientation */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-medium">Orientation</label>
              <div className="flex rounded-[6px] overflow-hidden" style={{ border: '0.5px solid var(--color-border)' }}>
                {(['horizontal', 'vertical'] as const).map((o) => (
                  <button
                    key={o}
                    onClick={() => gen.setOrientation(o)}
                    className={`px-3 h-[30px] text-[11px] transition-colors ${
                      gen.orientation === o
                        ? 'bg-accent text-white'
                        : 'bg-app-surface text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {o === 'horizontal' ? '16:9' : '9:16'}
                  </button>
                ))}
              </div>
            </div>

            {/* Include text */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-text-muted font-medium">Text in Prompts</label>
              <button
                onClick={() => gen.setIncludeText(!gen.includeText)}
                className={`h-[30px] px-3 rounded-[6px] text-[11px] transition-colors ${
                  gen.includeText
                    ? 'bg-accent text-white'
                    : 'bg-app-surface text-text-muted hover:text-text-primary'
                }`}
                style={{ border: '0.5px solid var(--color-border)' }}
              >
                {gen.includeText ? 'Include Text' : 'No Text'}
              </button>
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={gen.generate}
            disabled={!canGenerate}
            className="h-[34px] px-4 rounded-[6px] bg-accent text-white text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {gen.loading ? 'Generating...' : 'Generate Thumbnail Ideas'}
          </button>

          {/* Error */}
          {gen.error && (
            <div className="px-3 py-2 rounded-[6px] bg-red-500/10 text-red-400 text-[11px]">
              {gen.error}
            </div>
          )}

          {/* Results */}
          {gen.prompts.length > 0 && (
            <div className="flex flex-col gap-3" ref={listRef}>
              {/* Results header */}
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-text-secondary font-medium">
                  {gen.prompts.length} Prompt{gen.prompts.length !== 1 ? 's' : ''} Generated
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={gen.clearPrompts}
                    className="text-[11px] text-text-dim hover:text-text-muted transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={gen.sendToImageStudio}
                    className="h-[28px] px-3 rounded-[6px] bg-accent text-white text-[11px] font-medium hover:opacity-90 transition-opacity"
                  >
                    Send to Image Studio
                  </button>
                </div>
              </div>

              {/* Prompt cards */}
              {gen.prompts.map((prompt, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-1.5 p-3 rounded-[8px] bg-app-surface"
                  style={{ border: '0.5px solid var(--color-border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-text-dim shrink-0 pt-0.5">#{index + 1}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => gen.copyPrompt(index)}
                        className="p-1 rounded text-text-dim hover:text-text-muted transition-colors"
                        title="Copy"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
                          <path d="M8 4V2.5A1 1 0 007 1.5H2.5A1 1 0 001.5 2.5V7A1 1 0 002.5 8H4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => gen.removePrompt(index)}
                        className="p-1 rounded text-text-dim hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 3h8M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M9 3v6.5a1 1 0 01-1 1H4a1 1 0 01-1-1V3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={prompt}
                    onChange={(e) => gen.updatePrompt(index, e.target.value)}
                    rows={3}
                    className="w-full bg-transparent text-[11px] text-text-primary resize-none outline-none leading-relaxed"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
