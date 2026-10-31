import { useCallback, useState } from 'react';
import { runDecisionsTester, type TesterRun } from '@shared/decisions-client';
import { EMPTY_TESTER_FORM, type DecisionsTesterForm } from '@shared/decisions-tester-form';

export interface DecisionsTester {
  form: DecisionsTesterForm;
  setField: <K extends keyof DecisionsTesterForm>(key: K, value: DecisionsTesterForm[K]) => void;
  running: boolean;
  run: TesterRun | null;
  submit: () => Promise<void>;
}

/** The dev-preview Decisions tester's state (DECISION_MODELS_DESIGN.md §8 / §12): a typed form → one `decisions:decide` `{ request }`. */
export function useDecisionsTester(): DecisionsTester {
  const [form, setForm] = useState<DecisionsTesterForm>(EMPTY_TESTER_FORM);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<TesterRun | null>(null);

  const setField = useCallback(<K extends keyof DecisionsTesterForm>(key: K, value: DecisionsTesterForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const submit = useCallback(async () => {
    setRunning(true);
    setRun(await runDecisionsTester(window.api, form));
    setRunning(false);
  }, [form]);

  return { form, setField, running, run, submit };
}
