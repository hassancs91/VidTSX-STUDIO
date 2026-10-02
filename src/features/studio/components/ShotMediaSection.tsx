// The shot inspector's Media section (video-10 import gap 3): which project
// assets this shot receives through its `assets` prop, by key. A bundled
// import fills it from the source's staticFile() calls; here the user fixes
// a file the import could not find, swaps one, or attaches a new one for an
// edit to use. Every change is one undoable timeline action.

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';
import { TextInput } from '@shared/components/TextInput';
import type { StudioMediaAsset, StudioShot } from '../types';
import { isValidShotAssetKey } from '../services/shot-asset-ops';

interface Props {
  shot: StudioShot;
  assets: StudioMediaAsset[];
  disabled?: boolean;
  onChange: (assetRefs: Record<string, string>) => void;
}

const MISSING = '__missing__';

function assetLabel(asset: StudioMediaAsset): string {
  return asset.path.split(/[\\/]/).pop() ?? asset.id;
}

export function ShotMediaSection({ shot, assets, disabled, onChange }: Props) {
  const [newKey, setNewKey] = useState('');
  const [newAssetId, setNewAssetId] = useState('');
  const refs = shot.assetRefs ?? {};
  const entries = Object.entries(refs);
  // A shot draws pictures: images and video are what an <Img>/<OffthreadVideo> can take.
  const visual = assets.filter((a) => a.kind === 'image' || a.kind === 'video');
  const options = visual.map((a) => ({ value: a.id, label: assetLabel(a) }));
  const key = newKey.trim();
  const canAdd = !disabled && isValidShotAssetKey(key) && !(key in refs) && newAssetId !== '';

  const add = () => {
    if (!canAdd) return;
    onChange({ ...refs, [key]: newAssetId });
    setNewKey('');
    setNewAssetId('');
  };

  return (
    <div className="flex flex-col gap-1.5" data-shot-media={shot.id}>
      <span className="text-[10px] text-text-dim">Media (the shot&apos;s `assets` prop)</span>
      {entries.length === 0 && (
        <div className="text-[10px] text-text-muted">No media attached to this shot.</div>
      )}
      {entries.map(([refKey, assetId]) => {
        const known = visual.some((a) => a.id === assetId);
        return (
          <div key={refKey} className="flex items-center gap-1.5" data-shot-media-row={refKey}>
            <span className="w-[42%] shrink-0 truncate font-mono text-[10px] text-text-secondary" title={`assets.${refKey}`}>
              {refKey}
            </span>
            <div className="flex-1 min-w-0">
              <Select
                value={known ? assetId : MISSING}
                disabled={disabled}
                onChange={(value) => {
                  if (value !== MISSING && value !== assetId) onChange({ ...refs, [refKey]: value });
                }}
                options={known ? options : [{ value: MISSING, label: '(missing asset)' }, ...options]}
              />
            </div>
            <button
              type="button"
              title={`Detach ${refKey}`}
              disabled={disabled}
              onClick={() => {
                const { [refKey]: _removed, ...rest } = refs;
                onChange(rest);
              }}
              className="p-0.5 rounded text-text-muted hover:text-accent-red disabled:opacity-50"
            >
              <X size={11} strokeWidth={1.75} />
            </button>
          </div>
        );
      })}

      <div className="flex items-center gap-1.5">
        <div className="w-[42%] shrink-0">
          <TextInput
            value={newKey}
            placeholder="key"
            disabled={disabled}
            onChange={(e) => setNewKey(e.target.value)}
            data-shot-media-key
          />
        </div>
        <div className="flex-1 min-w-0">
          <Select
            value={newAssetId}
            disabled={disabled || options.length === 0}
            onChange={setNewAssetId}
            options={[{ value: '', label: options.length === 0 ? 'No images or video' : 'Asset…' }, ...options]}
          />
        </div>
        <Button variant="secondary" size="sm" disabled={!canAdd} onClick={add} data-shot-media-attach>
          Attach
        </Button>
      </div>
      {key !== '' && !isValidShotAssetKey(key) && (
        <div className="text-[10px] text-accent-red">A key is letters, digits, _ or $, and does not start with a digit.</div>
      )}
      {key in refs && <div className="text-[10px] text-accent-red">This shot already has a &ldquo;{key}&rdquo;.</div>}
    </div>
  );
}
