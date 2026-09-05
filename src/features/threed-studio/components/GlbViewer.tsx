import { Euler } from 'three';
import { GlbViewer as SharedGlbViewer, hasWebGL, type GlbViewerProps, type ViewerBackground } from '@shared/components/GlbViewer';

/**
 * TripoSR world → three.js: the runner's meshes are x-forward / y-right / z-up (Stage 0
 * orientation probe: camera forward ≈ −x, camera right = +y, up = +z), three.js is y-up
 * looking down −z. Rotate −90° about X (z→y) then −90° about Y (x→z): the photo's front
 * faces the default camera and viewer-left stays on the left.
 */
export const TRIPOSR_TO_THREE = new Euler(-Math.PI / 2, -Math.PI / 2, 0, 'YXZ');

export { hasWebGL };
export type { ViewerBackground };

/** 3D Studio's viewer: the shared component with TripoSR's axis remap applied. */
export function GlbViewer(props: Omit<GlbViewerProps, 'rotation'>) {
  return <SharedGlbViewer {...props} rotation={TRIPOSR_TO_THREE} />;
}
