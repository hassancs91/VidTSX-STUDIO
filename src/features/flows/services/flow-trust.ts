// The trust tag on a packaged flow (flows plan §1.7, W8 Stage 6) — the
// agents' three states, with `builtin` outranking the signature: a built-in
// ships inside the signed installer and carries no signature.json of its own
// (it reads `unsigned` on disk), so it says "Built-in", never "Unsigned".

import type { FlowProjectSummary } from '@shared/ipc/types';

export interface FlowTrustTag {
  id: 'builtin' | 'verified' | 'signed-unknown' | 'unsigned' | 'none';
  label: string;
  tone: 'accent' | 'warning' | 'muted';
  notice?: string;
}

const UNVERIFIED_NOTICE = 'VidTSX has not reviewed this flow. It runs with your providers and credits.';

export function trustTagForFlow(project: Pick<FlowProjectSummary, 'source' | 'package'>): FlowTrustTag {
  if (!project.package) return { id: 'none', label: 'Your flow', tone: 'muted' };
  if (project.source === 'builtin') return { id: 'builtin', label: 'Built-in', tone: 'accent' };
  switch (project.package.signature) {
    case 'verified':
      return { id: 'verified', label: `Verified by ${project.package.publisher ?? 'VidTSX'}`, tone: 'accent' };
    case 'signed-unknown':
      return { id: 'signed-unknown', label: 'Signed, unverified publisher', tone: 'warning', notice: UNVERIFIED_NOTICE };
    default:
      return { id: 'unsigned', label: 'Unsigned', tone: 'warning', notice: UNVERIFIED_NOTICE };
  }
}
