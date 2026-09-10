import { useEffect, useState } from 'react';
import { TextInput } from '@shared/components/TextInput';
import { VideoModelFields } from '@shared/components';
import {
  clampAspectRatio,
  clampDuration,
  clampResolution,
  estimatedCostUsd,
  isCostRateApproximate,
} from '@shared/video/model-constraints';
import type { VideoModelInfoIpc } from '@shared/ipc/types';

interface Props {
  providerId: string;
  model: string;
  config: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
}

/**
 * Duration / aspect / resolution / audio / seed for the Generate Video node,
 * every option read from the selected model's published capabilities — the
 * same `VideoModelInfo` the Videos panel narrows itself by. Before this the
 * node offered the union of every model's values and let the engine clamp at
 * submit, so a saved flow could carry a duration its model never accepts.
 *
 * Like `image-upload`, this field owns a fixed set of config keys rather than
 * one: `durationSeconds`, `aspectRatio`, `resolution`, `generateAudio`, `seed`.
 */
export function VideoModelOptionsField({ providerId, model, config, onPatch }: Props) {
  const [models, setModels] = useState<VideoModelInfoIpc[] | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const durationSeconds = Number(config.durationSeconds) || 0;
  const aspectRatio = typeof config.aspectRatio === 'string' ? config.aspectRatio : '';
  const resolution = typeof config.resolution === 'string' ? config.resolution : '';
  const generateAudio = config.generateAudio === 'on';
  const seed = typeof config.seed === 'string' ? config.seed : '';

  useEffect(() => {
    if (!providerId) {
      setModels(null);
      return;
    }
    let cancelled = false;
    setModels(null);
    void window.api.videoModelsGet({ providerId }).then((res) => {
      if (cancelled) return;
      setModels(res.success ? res.models : []);
    });
    return () => {
      cancelled = true;
    };
  }, [providerId, reloadToken]);

  // A catalog edit re-registers the providers in main, so a model's published
  // capabilities can change under a node that is already open.
  useEffect(() => {
    const onChanged = () => setReloadToken((n) => n + 1);
    window.addEventListener('vidtsx:video-providers-changed', onChanged);
    return () => window.removeEventListener('vidtsx:video-providers-changed', onChanged);
  }, []);

  const info = models?.find((m) => m.id === model);

  // Re-clamp whenever the model changes: a node saved against another model
  // must not keep a value this one would have to be corrected on. Settles in
  // one pass — the clamped values are already legal on the next render.
  useEffect(() => {
    if (!info) return;
    const nextDuration = clampDuration(info, durationSeconds || 5);
    const nextAspect = clampAspectRatio(info, aspectRatio);
    const nextResolution = clampResolution(info, resolution || undefined) ?? '';
    const patch: Record<string, unknown> = {};
    if (String(nextDuration) !== String(config.durationSeconds)) {
      patch.durationSeconds = String(nextDuration);
    }
    if (nextAspect !== aspectRatio) patch.aspectRatio = nextAspect;
    if (nextResolution !== resolution) patch.resolution = nextResolution;
    if (!info.supports.audio && generateAudio) patch.generateAudio = 'off';
    // The model ignores a seed (both Seedance 2.x families do), so a stored
    // one would be a promise the saved flow cannot keep.
    if (!info.supports.seed && seed) patch.seed = '';
    if (Object.keys(patch).length > 0) onPatch(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, durationSeconds, aspectRatio, resolution, generateAudio, seed]);

  if (!providerId) {
    return (
      <div className="text-[11px] text-text-dim">
        Pick a provider and model above to see the options that model publishes.
      </div>
    );
  }

  if (models === null) {
    return <div className="text-[11px] text-text-dim">Loading model options…</div>;
  }

  if (!info) {
    return (
      <div className="text-[11px] text-text-dim">
        {model
          ? `"${model}" is not in your catalog — add it in AI → Providers → Model Catalogs, or pick another model above.`
          : 'Select a model to see its options.'}
      </div>
    );
  }

  const cost = estimatedCostUsd(info, resolution || undefined, durationSeconds);
  const costApprox = isCostRateApproximate(info, resolution || undefined);

  return (
    <div className="flex flex-col gap-3">
      <VideoModelFields
        model={info}
        durationSeconds={durationSeconds}
        onDurationChange={(next) => onPatch({ durationSeconds: String(next) })}
        aspectRatio={aspectRatio}
        onAspectRatioChange={(next) => onPatch({ aspectRatio: next })}
        resolution={resolution || undefined}
        onResolutionChange={(next) => onPatch({ resolution: next })}
        generateAudio={generateAudio}
        onGenerateAudioChange={(next) => onPatch({ generateAudio: next ? 'on' : 'off' })}
      />

      {info.supports.seed && (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            Seed (optional)
          </span>
          <TextInput
            value={seed}
            onChange={(e) => onPatch({ seed: e.target.value })}
            placeholder="leave blank for random"
          />
        </label>
      )}

      {cost !== null && (
        <div className="text-[10px] text-text-dim">
          ~${cost.toFixed(2)} estimated per run{costApprox ? ' at list rate' : ''}
        </div>
      )}
    </div>
  );
}
