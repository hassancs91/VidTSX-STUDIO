import { useState, useCallback, useMemo } from 'react';
import { Button, ProgressBar } from '@shared/components';
import { useImageAITester } from '../hooks/useImageAITester';

// ─── Icons ────────────────────────────────────────────────────────────

const BackIcon = () => (
  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 3L4.5 7L8.5 11" />
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

const SAMPLERS = ['euler', 'euler_a', 'heun', 'dpm2', 'dpm++2s_a', 'dpm++2m', 'dpm++2mv2', 'lcm'];
const SCHEDULES = ['', 'discrete', 'karras', 'exponential', 'ays', 'gits'];

// ─── Main Screen ──────────────────────────────────────────────────────

export function ImageAITesterScreen({ onBack }: { onBack: () => void }) {
  const {
    models,
    selectedModelId,
    setSelectedModelId,
    loading,
    sdCliInstalled,
    generation,
    generate,
    cancel,
  } = useImageAITester();

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const defaults = selectedModel?.defaults;

  const [prompt, setPrompt] = useState('A beautiful mountain landscape at sunset, photorealistic, 8k');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [width, setWidth] = useState(defaults?.width ?? 512);
  const [height, setHeight] = useState(defaults?.height ?? 512);
  const [steps, setSteps] = useState(defaults?.steps ?? 20);
  const [cfgScale, setCfgScale] = useState(defaults?.cfgScale ?? 7.0);
  const [sampler, setSampler] = useState(defaults?.sampler ?? 'euler_a');
  const [seed, setSeed] = useState(-1);
  const [schedule, setSchedule] = useState('');
  const [offloadToCpu, setOffloadToCpu] = useState(false);
  const [clipOnCpu, setClipOnCpu] = useState(false);
  const [vaeOnCpu, setVaeOnCpu] = useState(false);
  const [threads, setThreads] = useState(0);
  const [batchCount, setBatchCount] = useState(1);

  // Sync defaults when model changes
  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    const model = models.find((m) => m.id === modelId);
    if (model?.defaults) {
      setWidth(model.defaults.width);
      setHeight(model.defaults.height);
      setSteps(model.defaults.steps);
      setCfgScale(model.defaults.cfgScale);
      setSampler(model.defaults.sampler);
    }
  }, [models, setSelectedModelId]);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    generate({
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim() || undefined,
      width,
      height,
      steps,
      cfgScale,
      sampler,
      seed: seed === -1 ? undefined : seed,
      schedule: schedule || undefined,
      offloadToCpu,
      clipOnCpu,
      vaeOnCpu,
      threads: threads > 0 ? threads : undefined,
      batchCount: batchCount > 1 ? batchCount : undefined,
    });
  }, [prompt, negativePrompt, width, height, steps, cfgScale, sampler, seed, schedule, offloadToCpu, clipOnCpu, vaeOnCpu, threads, batchCount, generate]);

  const imageDataUrl = useMemo(() => {
    if (!generation.imageBase64) return null;
    return `data:image/png;base64,${generation.imageBase64}`;
  }, [generation.imageBase64]);

  const available = sdCliInstalled && models.length > 0;

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
        <span className="text-[13px] font-medium text-text-secondary">Image AI Tester</span>

        {/* Engine status */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${sdCliInstalled ? 'bg-accent-green' : 'bg-accent-red'}`} />
          <span className="text-[10px] text-text-dim">
            {sdCliInstalled ? 'sd-cli ready' : 'sd-cli not found'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-[12px] text-text-muted">Loading models...</div>
        ) : !sdCliInstalled ? (
          <div className="bg-app-surface rounded-[8px] p-4 border border-border text-center max-w-[600px]">
            <div className="text-[12px] text-text-secondary mb-1">sd-cli binary not found</div>
            <div className="text-[10px] text-text-dim">Ensure sd-cli.exe is in resources/binaries/.</div>
          </div>
        ) : models.length === 0 ? (
          <div className="bg-app-surface rounded-[8px] p-4 border border-border text-center max-w-[600px]">
            <div className="text-[12px] text-text-secondary mb-1">No models downloaded</div>
            <div className="text-[10px] text-text-dim">Download image models from Settings &rarr; Local Models first.</div>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Left: Controls */}
            <div className="w-[340px] shrink-0 flex flex-col gap-3">
              {/* Model selection */}
              <div>
                <div className="text-[10px] text-text-dim mb-1">Model</div>
                <select
                  className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer"
                  value={selectedModelId ?? ''}
                  onChange={(e) => handleModelChange(e.target.value)}
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.family.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Prompt */}
              <div>
                <div className="text-[10px] text-text-dim mb-1">Prompt</div>
                <textarea
                  className="w-full bg-app-base border border-border rounded-[6px] px-3 py-2 text-[12px] text-text-secondary outline-none focus:border-accent resize-none"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the image to generate..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
              </div>

              {/* Negative prompt */}
              <div>
                <div className="text-[10px] text-text-dim mb-1">Negative prompt</div>
                <textarea
                  className="w-full bg-app-base border border-border rounded-[6px] px-3 py-2 text-[12px] text-text-secondary outline-none focus:border-accent resize-none"
                  rows={2}
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="What to avoid..."
                />
              </div>

              {/* Parameters grid */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] text-text-dim mb-1">Width</div>
                  <input
                    type="number"
                    min={256}
                    max={2048}
                    step={64}
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value) || 512)}
                    className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-text-dim mb-1">Height</div>
                  <input
                    type="number"
                    min={256}
                    max={2048}
                    step={64}
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value) || 512)}
                    className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-text-dim mb-1">Steps</div>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={steps}
                    onChange={(e) => setSteps(parseInt(e.target.value) || 20)}
                    className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] text-text-dim mb-1">CFG Scale</div>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    step={0.5}
                    value={cfgScale}
                    onChange={(e) => setCfgScale(parseFloat(e.target.value) || 7.0)}
                    className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-text-dim mb-1">Sampler</div>
                  <select
                    className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer"
                    value={sampler}
                    onChange={(e) => setSampler(e.target.value)}
                  >
                    {SAMPLERS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] text-text-dim mb-1">Seed (-1 = random)</div>
                  <input
                    type="number"
                    min={-1}
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value) ?? -1)}
                    className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Schedule & Threads */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] text-text-dim mb-1">Schedule</div>
                  <select
                    className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                  >
                    <option value="">Default</option>
                    {SCHEDULES.filter(Boolean).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[10px] text-text-dim mb-1">Threads (0 = auto)</div>
                  <input
                    type="number"
                    min={0}
                    max={64}
                    value={threads}
                    onChange={(e) => setThreads(parseInt(e.target.value) || 0)}
                    className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-text-dim mb-1">Batch count</div>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={batchCount}
                    onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-app-base border border-border rounded-[6px] px-2 h-[28px] text-[11px] text-text-secondary outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Memory offload options */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offloadToCpu}
                    onChange={(e) => setOffloadToCpu(e.target.checked)}
                    className="accent-accent w-3 h-3"
                  />
                  <span className="text-[11px] text-text-secondary">Offload to CPU</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clipOnCpu}
                    onChange={(e) => setClipOnCpu(e.target.checked)}
                    className="accent-accent w-3 h-3"
                  />
                  <span className="text-[11px] text-text-secondary">CLIP on CPU</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vaeOnCpu}
                    onChange={(e) => setVaeOnCpu(e.target.checked)}
                    className="accent-accent w-3 h-3"
                  />
                  <span className="text-[11px] text-text-secondary">VAE on CPU</span>
                </label>
              </div>

              {/* Generate / Cancel */}
              <div className="flex items-center gap-3">
                {generation.generating ? (
                  <Button variant="primary" onClick={cancel}>
                    Cancel
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleGenerate}
                    disabled={!selectedModelId || !prompt.trim()}
                  >
                    Generate
                  </Button>
                )}
                <span className="text-[10px] text-text-dim">Ctrl+Enter</span>
              </div>

              {/* Progress */}
              {generation.generating && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-text-dim">
                      {generation.totalSteps > 0
                        ? `Step ${generation.step} / ${generation.totalSteps}`
                        : 'Starting...'}
                    </span>
                    <span className="text-[10px] text-text-dim">{generation.percent}%</span>
                  </div>
                  <ProgressBar value={generation.percent} />
                </div>
              )}

              {/* Preflight notice (e.g. CPU offload auto-enabled) */}
              {generation.notice && (
                <div className="text-[11px] text-accent-amber bg-accent-amber/10 rounded-[6px] px-3 py-2">
                  {generation.notice}
                </div>
              )}

              {/* Error */}
              {generation.error && (
                <div className="text-[11px] text-accent-red bg-accent-red/10 rounded-[6px] px-3 py-2">
                  {generation.error}
                </div>
              )}
            </div>

            {/* Right: Result preview */}
            <div className="flex-1 min-w-0">
              {imageDataUrl ? (
                <div className="bg-app-surface rounded-[8px] p-3 border border-border">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {generation.width && generation.height && (
                      <StatBadge label="Size" value={`${generation.width}x${generation.height}`} />
                    )}
                    {generation.seed !== null && generation.seed !== -1 && (
                      <StatBadge label="Seed" value={String(generation.seed)} />
                    )}
                    {generation.durationMs !== null && (
                      <StatBadge label="Time" value={`${(generation.durationMs / 1000).toFixed(1)}s`} />
                    )}
                  </div>
                  <img
                    src={imageDataUrl}
                    alt="Generated"
                    className="w-full rounded-[6px] bg-app-base"
                    style={{ imageRendering: 'auto' }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-[11px] text-text-dim text-center">
                    {generation.generating ? 'Generating image...' : 'Generated image will appear here'}
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
