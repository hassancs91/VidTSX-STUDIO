import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { Button, TextInput } from '@shared/components';
import { isFeatureEnabled } from '@shared/feature-flags';
import type { DecisionsMode } from '@shared/types/decisions';
import {
  addHostedRung,
  decisionsNowText,
  hostedRungViews,
  keyDotsText,
  localRungText,
  moveHostedRung,
  normalizeOpenRouterModel,
  removeHostedRung,
  rungLineText,
} from '@shared/decisions-view';
import { useDecisionsSettings } from '../../../hooks/useDecisionsSettings';
import { DecisionsTester } from './DecisionsTester';

const MODES: { value: DecisionsMode; label: string }[] = [
  { value: 'auto', label: 'Auto (default) — the first ready provider in the order' },
  { value: 'off', label: 'Off — refuse every decision request' },
];

const iconButton =
  'flex h-[22px] w-[22px] items-center justify-center rounded-[4px] text-text-muted transition-colors hover:bg-app-hover hover:text-text-secondary disabled:opacity-30 disabled:hover:bg-transparent';

/**
 * "Decisions" — Settings › General beside "Library" (DECISION_MODELS_DESIGN.md §8; the LibrarySearchRow pattern). The mode, the hosted
 * order with has-key dots (re-order / switch off / back on), the OpenRouter model, the local rung ("none available" — D3 failed) and,
 * behind the dev-preview flag, the developer tester. Has-key booleans only; never a key, never a probability outside the tester.
 */
export function DecisionsRow() {
  const { status, error, saving, apply } = useDecisionsSettings();
  const [modelDraft, setModelDraft] = useState('');
  useEffect(() => setModelDraft(status?.openRouterModel ?? ''), [status?.openRouterModel]);
  const model = normalizeOpenRouterModel(modelDraft);
  const modelDirty = !!status && modelDraft.trim() !== status.openRouterModel;
  const views = status ? hostedRungViews(status) : [];
  const order = status?.hostedOrder ?? [];
  const busy = !status || saving;

  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border" data-decisions-row>
      <div className="flex flex-col gap-2">
        <div className="min-w-0">
          <div className="text-[11px] text-text-muted mb-1">Decisions</div>
          <div className="text-[10px] text-text-dim">
            Calibrated yes / no and pick-one answers for flows and the agent (the decide, verify and route steps). Answers come
            from TypeSafe Jev or Microsoft-Decision-1 on OpenRouter with your own key (AI → Providers); no call happens without
            one. The order below is tried top to bottom.
          </div>
          {status && (
            <div className="text-[10px] text-text-secondary mt-1" data-decisions-state>
              Now: {decisionsNowText(status)} · {keyDotsText(status)}
            </div>
          )}
          {error && (
            <div className="text-[10px] text-accent-red mt-1" data-decisions-error>
              {error}
            </div>
          )}
        </div>

        <select
          className="min-w-0 bg-app-base border border-border rounded px-2 py-1 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer"
          value={status?.mode ?? 'auto'}
          onChange={(e) => void apply({ mode: e.target.value as DecisionsMode })}
          disabled={busy}
          aria-label="Decisions mode"
          data-decisions-mode
        >
          {MODES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="flex flex-col gap-1" data-decisions-order>
          {views.map((v) => (
            <div key={v.id} className="flex items-center gap-2 rounded-[6px] bg-app-base px-2 py-1" data-decisions-rung={v.id}>
              <span className="w-[14px] text-[10px] text-text-dim">{v.position ?? '–'}</span>
              <span
                className={`h-[6px] w-[6px] shrink-0 rounded-full ${v.hasKey ? 'bg-accent-green' : 'bg-text-dim'}`}
                title={v.hasKey ? 'Key set' : 'No key'}
              />
              <span className={`text-[12px] ${v.enabled ? 'text-text-secondary' : 'text-text-dim'}`}>{v.label}</span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-text-dim">
                {rungLineText(v)}
              </span>
              {v.enabled ? (
                <>
                  <button type="button" className={iconButton} title="Move up" disabled={busy || v.position === 1}
                    onClick={() => void apply({ hostedOrder: moveHostedRung(order, v.id, -1) })}>
                    <ChevronUp size={13} strokeWidth={2} />
                  </button>
                  <button type="button" className={iconButton} title="Move down" disabled={busy || v.position === order.length}
                    onClick={() => void apply({ hostedOrder: moveHostedRung(order, v.id, 1) })}>
                    <ChevronDown size={13} strokeWidth={2} />
                  </button>
                  <button type="button" className={iconButton} title="Switch off (remove from the order)" disabled={busy}
                    onClick={() => void apply({ hostedOrder: removeHostedRung(order, v.id) })}>
                    <X size={13} strokeWidth={2} />
                  </button>
                </>
              ) : (
                <button type="button" className={iconButton} title="Switch back on (last in the order)" disabled={busy}
                  onClick={() => void apply({ hostedOrder: addHostedRung(order, v.id) })}>
                  <Plus size={13} strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
          {status && (
            <div className="flex items-center gap-2 rounded-[6px] bg-app-base px-2 py-1" data-decisions-local>
              <span className="w-[14px] text-[10px] text-text-dim">–</span>
              <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-text-dim" />
              <span className="text-[12px] text-text-dim">Local</span>
              <span className="min-w-0 flex-1 truncate text-[10px] text-text-dim">{localRungText(status)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 text-[10px] text-text-dim">OpenRouter model</span>
          <TextInput
            value={modelDraft}
            onChange={(e) => setModelDraft(e.target.value)}
            className="min-w-0 flex-1"
            aria-label="OpenRouter decision model"
            disabled={busy}
            data-decisions-openrouter-model
          />
          <Button variant="secondary" disabled={busy || !modelDirty || model === null}
            onClick={() => model !== null && void apply({ openRouterModel: model })}>
            Save
          </Button>
        </div>

        {isFeatureEnabled('decisions-tester') && <DecisionsTester />}
      </div>
    </div>
  );
}
