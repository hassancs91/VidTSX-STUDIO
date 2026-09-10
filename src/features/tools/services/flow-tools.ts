// The Tools hub's "Flows" group (flows plan §0.1 item 3, W8 Stage 6): the
// built-in flows listed beside the Thumbnail Generator and Frame Extractor
// screens, each opening its run form on the Flows screen. Pure over the
// flows list so the hub needs no per-flow code and the group is testable.

import type { FlowProjectSummary } from '@shared/ipc/types';

export interface FlowToolCard {
  /** The flow id (`vidtsx/<name>`), what the hop names. */
  flowId: string;
  name: string;
  description: string;
  /** The screen this flow stands beside, when it replaces one (§1.7). */
  besides?: 'thumbnail-generator' | 'frame-extractor';
}

const BESIDES: Record<string, FlowToolCard['besides']> = {
  'vidtsx/thumbnail': 'thumbnail-generator',
  'vidtsx/frame-strip': 'frame-extractor',
};

/** The hub order: the two that replace a screen first, then the rest by name. */
const ORDER = ['vidtsx/thumbnail', 'vidtsx/frame-strip', 'vidtsx/explainer-30s', 'vidtsx/product-ad', 'vidtsx/add-effect'];

export function builtinFlowTools(flows: readonly FlowProjectSummary[]): FlowToolCard[] {
  const rank = (id: string): number => {
    const at = ORDER.indexOf(id);
    return at === -1 ? ORDER.length : at;
  };
  return flows
    .filter((f) => f.source === 'builtin')
    .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name))
    .map((f) => ({
      flowId: f.id,
      name: f.name,
      description: f.description ?? '',
      ...(BESIDES[f.id] ? { besides: BESIDES[f.id] } : {}),
    }));
}
