import { useState, useCallback } from 'react';
import { Button } from '@shared/components';
import { useEmbeddingTester, type EmbedResultEntry } from '../hooks/useEmbeddingTester';

// ─── Icons ────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 3L4.5 7L8.5 11" />
  </svg>
);

const PlusIcon = () => (
  <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
    <path d="M6 2v8M2 6h8" />
  </svg>
);

const TrashIcon = () => (
  <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h8M4.5 3V2h3v1M3 3v7h6V3" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-app-base">
      <span className="text-[9px] text-text-dim uppercase">{label}</span>
      <span className="text-[11px] text-text-secondary font-mono">{value}</span>
    </div>
  );
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function similarityColor(score: number): string {
  if (score >= 0.8) return 'text-accent-green';
  if (score >= 0.5) return 'text-yellow-400';
  return 'text-text-dim';
}

// ─── Similarity Matrix ───────────────────────────────────────────────

function SimilarityMatrix({ results }: { results: EmbedResultEntry[] }) {
  if (results.length < 2) return null;

  return (
    <div className="bg-app-surface rounded-[8px] border border-border p-3">
      <div className="text-[10px] text-text-dim uppercase tracking-wider mb-2">
        Cosine Similarity Matrix
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr>
              <th className="text-left text-text-dim font-normal px-2 py-1" />
              {results.map((_, j) => (
                <th key={j} className="text-center text-text-dim font-normal px-2 py-1 min-w-[60px]">
                  #{j + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((rowResult, i) => (
              <tr key={i}>
                <td className="text-text-dim px-2 py-1 truncate max-w-[150px]" title={rowResult.text}>
                  #{i + 1}
                </td>
                {results.map((colResult, j) => {
                  const score = cosineSimilarity(rowResult.embedding, colResult.embedding);
                  const isIdentity = i === j;
                  return (
                    <td key={j} className="text-center px-2 py-1">
                      <span
                        className={`font-mono ${isIdentity ? 'text-text-dim' : similarityColor(score)}`}
                      >
                        {score.toFixed(4)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Vector Preview ──────────────────────────────────────────────────

function VectorPreview({ result, index }: { result: EmbedResultEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const preview = result.embedding.slice(0, 8).map((v) => v.toFixed(4)).join(', ');

  return (
    <div className="bg-app-surface rounded-[8px] border border-border p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-dim">#{index + 1}</span>
          <span className="text-[11px] text-text-secondary truncate max-w-[300px]" title={result.text}>
            {result.text}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-text-dim">{result.dimensions}d</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-accent-light hover:underline"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      <div className="font-mono text-[10px] text-text-muted bg-app-base rounded-[6px] px-2 py-1.5 overflow-auto max-h-[200px]">
        [{expanded ? result.embedding.map((v) => v.toFixed(6)).join(', ') : `${preview}, ...`}]
      </div>
    </div>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────

export function EmbeddingTesterScreen({ onBack }: { onBack: () => void }) {
  const hook = useEmbeddingTester();
  const [texts, setTexts] = useState<string[]>(['', '']);

  const handleTextChange = useCallback((index: number, value: string) => {
    setTexts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const addText = useCallback(() => {
    setTexts((prev) => [...prev, '']);
  }, []);

  const removeText = useCallback((index: number) => {
    setTexts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleEmbed = useCallback(() => {
    const nonEmpty = texts.filter((t) => t.trim());
    if (nonEmpty.length === 0) return;
    hook.embed(nonEmpty);
  }, [texts, hook.embed]);

  const nonEmptyCount = texts.filter((t) => t.trim()).length;

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
        <span className="text-[13px] font-medium text-text-secondary">Embedding Tester</span>

        {/* Model loaded indicator */}
        <div className="ml-auto flex items-center gap-1.5">
          {hook.activeModelId && (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-green" />
              <span className="text-[10px] text-accent-green">
                {hook.models.find((m) => m.id === hook.activeModelId)?.name ?? hook.activeModelId} loaded
              </span>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {hook.loading ? (
          <div className="text-[12px] text-text-muted">Loading models...</div>
        ) : hook.models.length === 0 ? (
          <div className="bg-app-surface rounded-[8px] p-4 border border-border text-center max-w-[600px]">
            <div className="text-[12px] text-text-secondary mb-1">No embedding models downloaded</div>
            <div className="text-[10px] text-text-dim">
              Download models from Settings &rarr; Local AI Models &rarr; Embeddings first.
            </div>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Left: Controls */}
            <div className="w-[380px] shrink-0 flex flex-col gap-3">
              {/* Model selection */}
              <div>
                <div className="text-[10px] text-text-dim mb-1">Model</div>
                <select
                  className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer"
                  value={hook.selectedModelId ?? ''}
                  onChange={(e) => hook.setSelectedModelId(e.target.value)}
                >
                  {hook.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.dimensions}d, {m.sizeLabel})
                    </option>
                  ))}
                </select>
                {hook.selectedModelId && hook.activeModelId !== hook.selectedModelId && (
                  <div className="text-[9px] text-text-dim mt-1">
                    Model will be auto-loaded on embed
                  </div>
                )}
              </div>

              {/* Text inputs */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] text-text-dim">Texts to embed</div>
                  <button
                    onClick={addText}
                    className="flex items-center gap-1 text-[10px] text-accent-light hover:underline"
                  >
                    <PlusIcon />
                    Add
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {texts.map((text, i) => (
                    <div key={i} className="flex gap-1.5">
                      <input
                        type="text"
                        className="flex-1 bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
                        value={text}
                        onChange={(e) => handleTextChange(i, e.target.value)}
                        placeholder={`Text #${i + 1}...`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            e.preventDefault();
                            handleEmbed();
                          }
                        }}
                      />
                      {texts.length > 1 && (
                        <button
                          onClick={() => removeText(i)}
                          className="flex items-center justify-center w-[28px] h-[28px] rounded-[6px] text-text-dim hover:text-accent-red hover:bg-app-hover transition-colors"
                          title="Remove"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Embed button */}
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  onClick={handleEmbed}
                  disabled={nonEmptyCount === 0 || !hook.selectedModelId || hook.embedding || hook.modelLoading}
                >
                  {hook.modelLoading ? 'Loading model...' : hook.embedding ? 'Embedding...' : 'Embed'}
                </Button>
                <span className="text-[10px] text-text-dim">Ctrl+Enter</span>
                {hook.results.length > 0 && (
                  <Button variant="secondary" onClick={hook.clearResults}>
                    Clear
                  </Button>
                )}
              </div>

              {/* Stats */}
              {hook.latencyMs !== null && (
                <div className="flex items-center gap-2 flex-wrap">
                  <StatBadge label="Latency" value={`${hook.latencyMs}ms`} />
                  <StatBadge label="Texts" value={String(hook.results.length)} />
                  {hook.results[0] && (
                    <StatBadge label="Dims" value={String(hook.results[0].dimensions)} />
                  )}
                </div>
              )}

              {/* Error */}
              {hook.error && (
                <div className="text-[11px] text-accent-red bg-accent-red/10 rounded-[6px] px-3 py-2">
                  {hook.error}
                </div>
              )}
            </div>

            {/* Right: Results */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              {hook.results.length > 0 ? (
                <>
                  {/* Similarity matrix */}
                  <SimilarityMatrix results={hook.results} />

                  {/* Vector previews */}
                  <div className="text-[10px] text-text-dim uppercase tracking-wider">
                    Embedding Vectors
                  </div>
                  {hook.results.map((result, i) => (
                    <VectorPreview key={i} result={result} index={i} />
                  ))}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-[11px] text-text-dim text-center">
                    {hook.embedding
                      ? hook.modelLoading
                        ? 'Loading model...'
                        : 'Computing embeddings...'
                      : 'Enter texts and click Embed to see results'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
