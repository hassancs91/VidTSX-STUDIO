import type { HandConfig } from '../types';

const DEFAULT_PEN_SVG = `
<g stroke="#1f2937" stroke-width="0.5" stroke-linejoin="round" stroke-linecap="round">
  <polygon points="0,0 8,-2.5 8,2.5" fill="#111827" />
  <polygon points="8,-2.5 16,-3.5 16,3.5 8,2.5" fill="#fde68a" />
  <rect x="16" y="-3.5" width="38" height="7" fill="#facc15" />
  <rect x="54" y="-3.5" width="6" height="7" fill="#9ca3af" />
  <rect x="60" y="-3.5" width="6" height="7" fill="#fb7185" />
</g>
`.trim();

export const DEFAULT_PEN: HandConfig = {
  svg: DEFAULT_PEN_SVG,
  tipOffset: { x: 0, y: 0 },
  rotation: 28,
};
