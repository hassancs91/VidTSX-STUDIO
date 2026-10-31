import { Button, TextInput } from '@shared/components';
import { TESTER_FAMILIES, TESTER_PROVIDERS } from '@shared/decisions-tester-form';
import type { DecisionProviderChoice, DecisionTaskFamily } from '@shared/types/decisions';
import { useDecisionsTester } from '../../../hooks/useDecisionsTester';

const field =
  'w-full bg-app-base border border-border rounded px-2 py-1 text-[11px] text-text-secondary outline-none focus:border-accent';

/**
 * The developer tester (DECISION_MODELS_DESIGN.md §8 / §12) — behind the `decisions-tester` dev-preview flag. One typed question →
 * `decisions:decide` with `featureSource: 'decision-test'` and a 30 s budget. THE ONE place a probability is shown: as numbers, in a tester.
 */
export function DecisionsTester() {
  const { form, setField, running, run, submit } = useDecisionsTester();
  const view = run?.kind === 'result' ? run.view : null;

  return (
    <div className="mt-1 flex flex-col gap-2 border-t border-border pt-2" data-decisions-tester>
      <div className="text-[10px] text-text-muted">Developer tester (dev preview) — numbers are shown here only</div>
      <textarea className={`${field} min-h-[56px]`} placeholder="State — the evidence the question is about"
        value={form.state} onChange={(e) => setField('state', e.target.value)} data-decisions-tester-state />
      <div className="flex gap-2">
        <select className={field} value={form.type} aria-label="Question type"
          onChange={(e) => setField('type', e.target.value === 'noul' ? 'noul' : 'choice')}>
          <option value="choice">Pick one (choice)</option>
          <option value="noul">Yes / no (noul)</option>
        </select>
        <select className={field} value={form.provider} aria-label="Provider"
          onChange={(e) => setField('provider', e.target.value as DecisionProviderChoice)}>
          {TESTER_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select className={field} value={form.family} aria-label="Task family"
          onChange={(e) => setField('family', e.target.value as DecisionTaskFamily)}>
          {TESTER_FAMILIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>
      <TextInput value={form.instructions} placeholder="Question instructions" aria-label="Question instructions"
        onChange={(e) => setField('instructions', e.target.value)} className="w-full" />
      {form.type === 'choice' && (
        <textarea className={`${field} min-h-[44px]`} placeholder={'Options — one "id: description" per line'}
          value={form.options} onChange={(e) => setField('options', e.target.value)} />
      )}
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => void submit()} disabled={running} data-decisions-tester-run>
          {running ? 'Asking…' : 'Ask'}
        </Button>
        {run?.kind === 'form' && <span className="text-[10px] text-accent-red">{run.reason}</span>}
      </div>
      {view && !view.ok && (
        <div className="text-[10px] text-accent-red" data-decisions-tester-error>
          {view.code} — {view.message}
        </div>
      )}
      {view?.ok && (
        <div className="flex flex-col gap-1 rounded-[6px] bg-app-base p-2 text-[10px] text-text-secondary" data-decisions-tester-result>
          <div>
            Answer <span className="text-text-primary">{view.answer || '(none)'}</span> · band {view.band}
            {view.refused ? ` · refused: ${view.refused}` : ''}
          </div>
          <div className="text-text-dim">
            {view.provider} · {view.model} · {view.calibrated ? 'calibrated' : 'uncalibrated'} · {Math.round(view.latencyMs)} ms
            {view.cached ? ' · cached' : ''}
          </div>
          {view.probabilities.map((row) => (
            <div key={row.label} className="flex justify-between font-mono">
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
          {view.skipped.length > 0 && <div className="text-text-dim">Skipped: {view.skipped.join(' · ')}</div>}
        </div>
      )}
    </div>
  );
}
