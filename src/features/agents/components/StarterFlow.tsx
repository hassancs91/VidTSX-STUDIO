// The guided first questions an agent package ships (agents plan §1.9).
//
// It runs entirely here: no provider, no tokens, offline, instant. The walker
// (`nextNode`) and the template (`renderOpening`) are pure and shared; the card
// for each step is the SAME registry card `ask_user` uses, so the user sees no
// seam between the questions the package ships and the ones the model asks.
//
// The rules §1.9 sets, and where each one lives:
//   - every step offers "Skip and chat"  → the card's own Cancel, which finishes
//     the flow with the answers so far (they still reach the prompt, marked
//     partial by `prompt-compose.ts`)
//   - Back restores the previous answer  → the trail below plus the cards'
//     `initialValues`
//   - `opening` PREFILLS the chat box and is never auto-sent → the caller's job
//   - a returning user goes straight to chat → the workspace never mounts this
//     for a session that already exists

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { StarterAnswers } from '@shared/types/agents';
import {
  STARTER_END,
  isStarterTextNode,
  nextNode,
  type StarterAnswer,
  type StarterTree,
} from '@shared/agents/starter';
import { getInteractionCard } from '@renderer/components/interactions/registry';
import type { InteractionValues } from '@renderer/components/interactions/types';
import {
  needsOtherStep,
  starterAnswerFrom,
  starterInitialValues,
  starterRequest,
  stepsRemaining,
  type StarterStep,
} from '../services/starter-cards';

interface Props {
  tree: StarterTree;
  /** True while the session is being created, so the card locks once. */
  busy?: boolean;
  /** Finished or skipped — the answers so far, which may be partial or empty. */
  onFinish: (answers: StarterAnswers) => void;
  /** W4: the brand picker rendered above the questions — the session is
   *  created with this choice. */
  brandPicker?: ReactNode;
}

export function StarterFlow({ tree, busy, onFinish, brandPicker }: Props) {
  const [step, setStep] = useState<StarterStep>({ nodeId: tree.entry, phase: 'node' });
  const [trail, setTrail] = useState<StarterStep[]>([]);
  const [answers, setAnswers] = useState<StarterAnswers>({});

  const node = tree.nodes[step.nodeId];

  const answer = useCallback(
    (values: InteractionValues) => {
      if (!node) return;
      const prior: StarterAnswer | undefined = answers[step.nodeId];
      const given = starterAnswerFrom(step.nodeId, node, step.phase, values, prior);
      const merged: StarterAnswers = { ...answers, [step.nodeId]: given };
      setAnswers(merged);

      if (needsOtherStep(node, step.phase, given)) {
        setTrail((t) => [...t, step]);
        setStep({ nodeId: step.nodeId, phase: 'other' });
        return;
      }

      const target = nextNode(tree, step.nodeId, given);
      if (!target || target === STARTER_END || !(target in tree.nodes)) {
        onFinish(merged);
        return;
      }
      setTrail((t) => [...t, step]);
      setStep({ nodeId: target, phase: 'node' });
    },
    [answers, node, onFinish, step, tree],
  );

  const back = useCallback(() => {
    const previous = trail[trail.length - 1];
    if (!previous) return;
    setStep(previous);
    setTrail(trail.slice(0, -1));
  }, [trail]);

  const request = useMemo(
    () => (node ? starterRequest(step.nodeId, node, step.phase) : null),
    [node, step],
  );
  const initialValues = node
    ? starterInitialValues(step.nodeId, node, step.phase, answers[step.nodeId])
    : undefined;

  // A tree whose entry node is missing cannot happen — the validator refuses it
  // at install — but the session must not be trapped if one ever does.
  if (!node || !request) {
    return null;
  }

  const Card = getInteractionCard(request.payload.kind);
  const index = trail.length + 1;
  const total = trail.length + stepsRemaining(tree, step.nodeId);

  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-[440px]" data-starter-flow>
      <div className="flex items-center justify-between w-full px-0.5">
        <button
          onClick={back}
          disabled={trail.length === 0 || busy}
          data-starter-back
          className="flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[10px] text-text-muted hover:bg-app-hover disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={11} strokeWidth={1.75} />
          Back
        </button>
        <span className="text-[10px] text-text-dim">
          Step {index} of {Math.max(total, index)}
        </span>
      </div>

      {brandPicker ? (
        <div className="flex items-center gap-2 w-full px-0.5" data-starter-brand>
          <span className="text-[10px] text-text-muted shrink-0">Brand</span>
          <div className="flex-1 min-w-0">{brandPicker}</div>
        </div>
      ) : null}

      <Card
        key={`${step.nodeId}:${step.phase}`}
        request={request}
        {...(initialValues ? { initialValues } : {})}
        {...(busy !== undefined ? { busy } : {})}
        onAnswer={answer}
        onCancel={() => onFinish(answers)}
      />

      {node.hint && step.phase === 'node' && !isStarterTextNode(node) ? (
        <span className="text-[10px] text-text-dim text-center leading-snug px-2">{node.hint}</span>
      ) : null}
    </div>
  );
}
