import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { StatusBadge, TextInput } from '@shared/components';
import { PROVIDER_CAPABILITY_LABELS, type ProviderDefinition } from '@shared/providers/registry';
import type { KeyTestState } from '../../hooks/useProviderKeyDrafts';
import { CapabilityBadge } from './CapabilityBadge';
import { ProviderGridRow } from './ProviderGridRow';

interface ProviderKeyRowProps {
  row: ProviderDefinition;
  saved: boolean;
  draft: string;
  clearing: boolean;
  visible: boolean;
  onDraft: (value: string) => void;
  onToggleVisible: () => void;
  onClear: () => void;
  test?: {
    state?: KeyTestState;
    /** Disabled until a key exists to test (saved or typed), plus the Cloudflare account id. */
    disabled: boolean;
    onTest: () => void;
  };
  /** Cloudflare's plain (non-secret) account id, rendered under the key. */
  extraField?: {
    value: string;
    hint: string;
    placeholder: string;
    onChange: (value: string) => void;
  };
}

/** One shared bring-your-own-key provider in the API keys table. */
export function ProviderKeyRow({
  row,
  saved,
  draft,
  clearing,
  visible,
  onDraft,
  onToggleVisible,
  onClear,
  test,
  extraField,
}: ProviderKeyRowProps) {
  const hasDraft = draft.trim().length > 0;
  const status = clearing ? (
    <StatusBadge tone="warn">Removing on save</StatusBadge>
  ) : hasDraft ? (
    <StatusBadge tone="accent">Unsaved</StatusBadge>
  ) : saved ? (
    <StatusBadge tone="success">Key saved</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">No key</StatusBadge>
  );

  const result = test?.state;
  const below =
    extraField || (result && !result.testing) ? (
      <div className="flex flex-col gap-1.5">
        {extraField && (
          <div>
            <div className="mb-1 text-[10px] text-text-dim">{extraField.hint}</div>
            <TextInput
              value={extraField.value}
              onChange={(e) => extraField.onChange(e.target.value)}
              placeholder={extraField.placeholder}
              className="w-full max-w-[420px]"
            />
          </div>
        )}
        {result && !result.testing && (
          <div className={`flex items-center gap-1 text-[10px] ${result.success ? 'text-accent-green' : 'text-accent-red'}`}>
            {result.success ? <Check size={11} strokeWidth={2} /> : <X size={11} strokeWidth={2} />}
            {result.success
              ? `Connected${result.durationMs !== undefined ? ` (${result.durationMs} ms)` : ''}`
              : result.error || 'Failed'}
          </div>
        )}
      </div>
    ) : undefined;

  return (
    <ProviderGridRow
      rowId={row.id}
      name={
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium text-text-secondary">{row.name}</span>
          <span className="block truncate text-[10px] text-text-dim" title={row.keyHint}>
            {row.keyHint}
          </span>
        </span>
      }
      powers={row.capabilities.map((cap) => (
        <CapabilityBadge key={cap} label={PROVIDER_CAPABILITY_LABELS[cap]} />
      ))}
      status={status}
      detail={
        <div className="flex items-center gap-1">
          <TextInput
            type={visible ? 'text' : 'password'}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            placeholder={clearing ? 'Key will be removed on save' : saved ? 'Enter a new key to replace…' : row.keyPlaceholder}
            className="flex-1"
            aria-label={`${row.name} API key`}
          />
          <button
            type="button"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-text-muted transition-colors hover:bg-app-hover"
            onClick={onToggleVisible}
            title={visible ? 'Hide key' : 'Show key'}
          >
            {visible ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
          </button>
        </div>
      }
      actions={
        <>
          {test && (
            <button
              type="button"
              onClick={test.onTest}
              disabled={test.disabled || result?.testing}
              className="cursor-pointer text-[10px] text-text-dim transition-colors hover:text-text-secondary disabled:cursor-default disabled:opacity-40"
              title={row.test === 'video' ? 'Checks this key against the video API — generates nothing' : 'Generates a tiny test image with this key'}
            >
              {result?.testing ? (
                <span className="flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" /> Testing…
                </span>
              ) : (
                'Test'
              )}
            </button>
          )}
          {saved && !clearing && (
            <button
              type="button"
              onClick={onClear}
              className="cursor-pointer text-[10px] text-text-dim transition-colors hover:text-accent-red"
              title="Remove this key on save"
            >
              Remove
            </button>
          )}
        </>
      }
      below={below}
    />
  );
}
