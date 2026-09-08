// The interaction registry, keyed by kind (agents plan §1.3).
//
// One entry per kind, and only ever GROWS — decision 4, the same rule the
// viewer registry follows: an agent installed against an older app keeps
// working. Wave 2 (§13) adds `reorder` and `edit` here and nowhere else.
//
// Shared with Flows for its run checkpoints (docs/flows-plan.md 1.8): the
// agents feature imports this module rather than owning it.

import type { InteractionKind } from '../../../shared/types/agents';
import type { InteractionCard, InteractionCardRegistry } from './types';
import { ApproveCard } from './ApproveCard';
import { FormCard } from './FormCard';
import { PickCard } from './PickCard';

const CARDS: InteractionCardRegistry = {
  form: FormCard,
  pick: PickCard,
  approve: ApproveCard,
};

export function getInteractionCard(kind: InteractionKind): InteractionCard {
  return CARDS[kind];
}

export function listInteractionKinds(): InteractionKind[] {
  return Object.keys(CARDS) as InteractionKind[];
}

export type {
  InteractionCard,
  InteractionCardProps,
  InteractionPreview,
  InteractionValues,
} from './types';
