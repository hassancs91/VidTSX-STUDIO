import { StatusBadge } from '@shared/components';

const FAMILY_LABELS: Record<string, string> = {
  sd15: 'SD 1.5',
  sdxl: 'SDXL',
  sd3: 'SD 3.x',
  flux1: 'FLUX.1',
  flux2: 'FLUX.2',
  wan21: 'Wan 2.1',
  wan22: 'Wan 2.2',
  ltx: 'LTX-2.3',
  lingbot: 'LingBot',
};

/** Model-family tag (SD 1.5 / SDXL / FLUX…) shown on library rows. */
export function FamilyBadge({ family }: { family: string }) {
  return <StatusBadge tone="info">{FAMILY_LABELS[family] ?? family.toUpperCase()}</StatusBadge>;
}
