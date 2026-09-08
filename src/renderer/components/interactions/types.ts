// Interaction cards — the shared contract (agents plan §1.3, §7).
//
// These live under `src/renderer/components/` rather than inside the agents
// feature for the same reason the artifact viewers do: Flows renders the same
// cards for its run checkpoints (docs/flows-plan.md 1.8). §7's file list says
// `src/features/agents/interactions/`; §1.3 says here, and §1.3 is the one that
// gives the reason. Recorded as a delta in the Stage 4 outcome.
//
// So a card is a PLAIN component: typed props, no IPC, no knowledge of
// sessions. The host resolves any artifact a candidate names and hands the
// preview down, exactly as it hands a viewer its `ResolvedArtifact`.

import type { ComponentType } from 'react';
import type {
  ArtifactKind,
  InteractionKind,
  InteractionRequest,
} from '../../../shared/types/agents';

/** What the host resolved about the artifact a candidate stands for. */
export interface InteractionPreview {
  kind: ArtifactKind;
  title: string;
  /** A servable url, when the artifact has a picture worth showing large. */
  imageUrl?: string;
}

/**
 * The answer, in the shape `InteractionReply.values` takes. The KEY carries the
 * model's own id and the VALUE the human-readable choice, because the broker
 * renders them as `key: value` into the fixed `[Answer to question <id>] …`
 * message — so the model gets both the id it can act on and the words the user
 * actually saw, in one line, with no extra convention to learn.
 */
export type InteractionValues = Record<string, string[]>;

export interface InteractionCardProps {
  request: InteractionRequest;
  /** Keyed by artifact id; absent for candidates that name no artifact. */
  previews?: Record<string, InteractionPreview>;
  /** True while the answer is in flight, so the card locks rather than double-sends. */
  busy?: boolean;
  /**
   * The question was read back from `session.json` rather than seen arriving on
   * this run's stream — i.e. it was asked before the app was closed. It is
   * still answerable (the non-blocking form replies as an ordinary message), so
   * this only changes what the card SAYS.
   */
  restored?: boolean;
  onAnswer: (values: InteractionValues) => void;
  onCancel: () => void;
}

export type InteractionCard = ComponentType<InteractionCardProps>;

export type InteractionCardRegistry = Record<InteractionKind, InteractionCard>;
