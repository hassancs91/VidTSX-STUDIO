import { useState } from 'react';
import { Button, TextInput } from '@shared/components';
import { useProviderKeys } from '@renderer/hooks/useProviderKeys';
import type { ProviderKeyId } from '@shared/ipc/types';

interface KeyRowDef {
  id: ProviderKeyId;
  label: string;
  hint: string;
  placeholder: string;
}

const KEY_ROWS: KeyRowDef[] = [
  {
    id: 'fal',
    label: 'Fal',
    hint: 'Image + video generation · fal.ai/dashboard/keys',
    placeholder: 'key_id:key_secret',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'One key for chat, images, and audio · openrouter.ai/keys',
    placeholder: 'sk-or-…',
  },
  {
    id: 'assemblyai',
    label: 'AssemblyAI',
    hint: 'Transcription with word timing + speakers · assemblyai.com',
    placeholder: 'API key',
  },
];

const EyeIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/**
 * Single place to paste provider API keys. Keys are stored in the main
 * process only; this card sees just "saved / not saved" booleans.
 */
export function ApiKeysCard() {
  const { hasKeys, loading, saving, error, saveKeys } = useProviderKeys();
  const [drafts, setDrafts] = useState<Partial<Record<ProviderKeyId, string>>>({});
  const [visible, setVisible] = useState<Partial<Record<ProviderKeyId, boolean>>>({});
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty = Object.values(drafts).some((v) => v && v.trim().length > 0);

  const handleSave = async () => {
    const ok = await saveKeys(drafts);
    if (ok) {
      setDrafts({});
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="bg-app-surface rounded-lg p-3 border border-border mb-6">
        <div className="text-[12px] text-text-muted">Loading API keys…</div>
      </div>
    );
  }

  return (
    <div className="bg-app-surface rounded-lg border border-border overflow-hidden mb-6">
      <div className="p-3" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <div className="text-[12px] text-text-secondary font-medium">API Keys</div>
        <div className="text-[10px] text-text-dim mt-0.5">
          Bring your own keys — entered once, used by every feature. Stored locally on this
          machine, never sent anywhere except the provider itself.
        </div>
      </div>

      {KEY_ROWS.map((row) => (
        <div
          key={row.id}
          className="p-3"
          style={{ borderBottom: '0.5px solid var(--color-border)' }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] text-text-secondary font-medium">
              {row.label}
              {hasKeys[row.id] && !drafts[row.id] && (
                <span className="text-accent-green ml-1.5 text-[10px]">(saved)</span>
              )}
            </div>
          </div>
          <div className="text-[10px] text-text-dim mb-1">{row.hint}</div>
          <div className="flex items-center gap-1">
            <TextInput
              type={visible[row.id] ? 'text' : 'password'}
              value={drafts[row.id] ?? ''}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
              placeholder={hasKeys[row.id] ? 'Enter new key to replace…' : row.placeholder}
              className="flex-1"
            />
            <button
              className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] text-text-muted hover:bg-app-hover transition-colors"
              onClick={() => setVisible((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
              type="button"
            >
              {visible[row.id] ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>
      ))}

      <div className="p-3 flex items-center gap-2">
        <Button variant="primary" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save Keys'}
        </Button>
        {savedFlash && <span className="text-[11px] text-accent-green">Saved ✓</span>}
        {error && <span className="text-[11px] text-accent-red">{error}</span>}
      </div>
    </div>
  );
}
