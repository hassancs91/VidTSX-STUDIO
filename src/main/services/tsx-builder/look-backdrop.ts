// What a transparent Studio shot is looked at over (P3 part 5, Hasan's 1(b)).
// An overlay or a title has no background of its own; a JPEG look of it alone
// shows whatever the page is behind it, never the talk it will play over. So
// `render_stills`, `contact_sheet` and `phone_view` render this wrapper
// instead of the piece: the footage frame at the SAME moment (the backdrop's
// start + frame / fps), or a grey checkerboard when no footage sits under the
// shot, with the piece mounted on top. `loop_seam` and `purity_check` keep
// rendering the piece alone: they measure the piece, not the footage.
//
// Like the contact sheet, the wrapper is the build's code with its exports
// renamed plus a default export that draws both layers; the footage arrives
// as a prop (`BACKDROP_PROP`, an asset-root URL on the bundle's own server,
// build-stills.ts), because its URL exists only once the bundle is served.

import type { CompositionConfig } from '../composition-config-parser';

/** The input prop that carries the footage URL (absent = checkerboard). */
export const BACKDROP_PROP = '__vidtsxBackdropSrc';
/** The look bundle's entry file, apart from the raw piece's `composition.tsx`, so the two bundles never replace each other. */
export const BACKDROP_ENTRY = 'look.tsx';

const CONFIG_EXPORT = /export\s+const\s+compositionConfig\s*=/;
const DEFAULT_FUNCTION = /export\s+default\s+function\s+([A-Za-z_$][\w$]*)\s*\(/;
const DEFAULT_EXPORT = /export\s+default\s+/;

/** A grey checkerboard = transparent, as an editor shows it. */
const CHECKERBOARD = {
  backgroundColor: '#c8c8c8',
  backgroundImage: 'repeating-conic-gradient(#9a9a9a 0% 25%, transparent 0% 50%)',
  backgroundSize: '64px 64px',
};

/**
 * The look's source. `startFrame`: the footage frame (at the piece's fps) shown
 * at the piece's frame 0; null = no footage, a checkerboard. Throws when the
 * build lacks the exports every gate requires.
 */
export function backdropLookSource(code: string, config: CompositionConfig, startFrame: number | null): string {
  if (!CONFIG_EXPORT.test(code)) throw new Error('The build has no `export const compositionConfig`.');
  // Its own names: a contact sheet of this look renames `compositionConfig` and the default export again.
  let piece = code.replace(/\bcompositionConfig\b/g, '__vidtsxLookPieceConfig');
  piece = piece.replace(/export\s+const\s+__vidtsxLookPieceConfig\s*=/, 'const __vidtsxLookPieceConfig =');
  let pieceRef = '__vidtsxLookPiece';
  const fn = DEFAULT_FUNCTION.exec(piece);
  if (fn) {
    pieceRef = fn[1];
    piece = piece.replace(DEFAULT_FUNCTION, `function ${fn[1]}(`);
  } else if (DEFAULT_EXPORT.test(piece)) {
    piece = piece.replace(DEFAULT_EXPORT, 'const __vidtsxLookPiece = ');
  } else {
    throw new Error('The build has no default export.');
  }

  const c = config;
  const backdrop = { trimBefore: startFrame === null ? null : Math.max(0, Math.round(startFrame)), checker: CHECKERBOARD };
  return `export const compositionConfig = { id: '${c.id}', durationInFrames: ${c.durationInFrames}, fps: ${c.fps}, width: ${c.width}, height: ${c.height} };
import __VidtsxLookReact from 'react';
import { AbsoluteFill as __VidtsxLookFill, OffthreadVideo as __VidtsxLookVideo } from 'remotion';
${piece}

const __vidtsxLookBackdrop = ${JSON.stringify(backdrop)};

export default function VidtsxBackdropLook(props) {
  const h = __VidtsxLookReact.createElement;
  const B = __vidtsxLookBackdrop;
  const { ${BACKDROP_PROP}: src, ...rest } = props || {};
  const under = src && B.trimBefore !== null
    ? h(__VidtsxLookVideo, { src, muted: true, trimBefore: B.trimBefore, style: { width: '100%', height: '100%', objectFit: 'contain' } })
    : h('div', { style: { position: 'absolute', inset: 0, ...B.checker } });
  return h(__VidtsxLookFill, { style: { backgroundColor: '#000' } },
    under,
    h(__VidtsxLookFill, null, h(${pieceRef}, rest)));
}
`;
}

/** The first message's line: what the builder will see behind the piece. */
export function backdropLine(label: string | null): string {
  return label
    ? `BEHIND THE PIECE: this is a transparent Studio shot. render_stills, contact_sheet and phone_view show it over the footage it plays over (${label}), frame for frame, as the editor will see it; leave the piece itself transparent. loop_seam and purity_check render it alone.`
    : 'BEHIND THE PIECE: this is a transparent Studio shot with no footage under it yet. render_stills, contact_sheet and phone_view show it over a grey checkerboard = transparent; leave the piece itself transparent.';
}
