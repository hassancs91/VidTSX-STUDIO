import { Panel, StatusBadge } from '@shared/components';
import { PROVIDER_CAPABILITY_LABELS, PROVIDER_REGISTRY } from '@shared/providers/registry';
import type { ProviderKeyDrafts, ProviderKeysApi } from '../../hooks/useProviderKeyDrafts';
import { decisionKeyTestGate, decisionSectionRows } from '../../services/decision-providers';
import { CapabilityBadge } from './CapabilityBadge';
import { ProviderGridHeader, ProviderGridRow } from './ProviderGridRow';
import { ProviderKeyRow } from './ProviderKeyRow';

interface DecisionsProvidersSectionProps {
  keys: ProviderKeysApi;
  drafts: ProviderKeyDrafts;
}

/**
 * AI → Providers "Decisions" (DECISION_MODELS_DESIGN.md §8, §15.3 2): the TypeSafe key row (its key lives here, not in API keys) and
 * OpenRouter listed under it too (its one key row stays in API keys). The TypeSafe Test button sends `decisions:decide` `{ test: 'jev' }`
 * and tests the SAVED key — disabled until one is saved (D-r19 (3)); a typed key is saved with "Save changes" like every other key.
 */
export function DecisionsProvidersSection({ keys, drafts }: DecisionsProvidersSectionProps) {
  const { keyRows, listedRows } = decisionSectionRows(PROVIDER_REGISTRY);

  return (
    <Panel>
      <ProviderGridHeader detailLabel="API key" />
      {keyRows.map((row) => {
        const draft = drafts.drafts[row.id] ?? '';
        const clearing = drafts.clearing.includes(row.id);
        const saved = keys.hasKeys[row.id] && !clearing;
        const gate = decisionKeyTestGate({ saved: !!keys.hasKeys[row.id], draft, clearing });
        return (
          <ProviderKeyRow
            key={row.id}
            row={row}
            saved={saved}
            draft={draft}
            clearing={clearing}
            visible={!!drafts.visible[row.id]}
            onDraft={(value) => drafts.setDraft(row.id, value)}
            onToggleVisible={() => drafts.toggleVisible(row.id)}
            onClear={() => drafts.markClearing(row.id)}
            test={
              row.test === 'decision'
                ? { state: drafts.tests[row.id], disabled: gate.disabled, title: gate.title, onTest: () => void drafts.testDecision(row.id) }
                : undefined
            }
          />
        );
      })}
      {listedRows.map((row) => (
        <ProviderGridRow
          key={row.id}
          rowId={`decisions-${row.id}`}
          name={<span className="block truncate text-[12px] font-medium text-text-secondary">{row.name}</span>}
          powers={<CapabilityBadge label={PROVIDER_CAPABILITY_LABELS.decision} />}
          status={
            keys.hasKeys[row.id] ? <StatusBadge tone="success">Key saved</StatusBadge> : <StatusBadge tone="neutral">No key</StatusBadge>
          }
          detail={
            <span className="text-[10px] text-text-dim">
              Uses the {row.name} key in API keys above — Microsoft-Decision-1. Order and model: Settings › General › Decisions.
            </span>
          }
        />
      ))}
    </Panel>
  );
}
