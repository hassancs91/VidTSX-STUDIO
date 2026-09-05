import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF } from '@react-three/drei';
import type { Group, Mesh, Material } from 'three';

export type ViewerBackground = 'dark' | 'light' | 'grid';

interface GlbViewerProps {
  /** file:// URL of the GLB. */
  url: string;
  className?: string;
  /** Show the wireframe / background toggles (lightbox); cards render bare. */
  controls?: boolean;
  autoRotate?: boolean;
}

/** WebGL availability check, memoised per page (jsdom / RDP sessions have none). */
let webglSupported: boolean | null = null;
export function hasWebGL(): boolean {
  if (webglSupported !== null) return webglSupported;
  try {
    const canvas = document.createElement('canvas');
    webglSupported = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    webglSupported = false;
  }
  return webglSupported;
}

function applyWireframe(scene: Group, wireframe: boolean): void {
  scene.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const mats: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      (m as Material & { wireframe?: boolean }).wireframe = wireframe;
    }
  });
}

function Model({ url, wireframe }: { url: string; wireframe: boolean }) {
  const { scene } = useGLTF(url);
  useEffect(() => {
    applyWireframe(scene, wireframe);
  }, [scene, wireframe]);
  return <primitive object={scene} />;
}

const BG: Record<ViewerBackground, string> = { dark: '#15151a', light: '#e8e8ec', grid: '#1d1d24' };

/**
 * The first in-app three.js consumer (plan §5 step 3): drei Canvas + useGLTF +
 * OrbitControls + Stage. TripoSR GLBs carry vertex colours (no textures), which the
 * GLTF loader maps to vertexColors automatically.
 */
export function GlbViewer({ url, className, controls = false, autoRotate = false }: GlbViewerProps) {
  const [wireframe, setWireframe] = useState(false);
  const [background, setBackground] = useState<ViewerBackground>('dark');
  const supported = useMemo(() => hasWebGL(), []);

  if (!supported) {
    return (
      <div className={`flex items-center justify-center text-[11px] text-text-dim bg-app-deep ${className ?? ''}`}>
        3D preview needs WebGL, which this window cannot provide.
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ''}`} style={{ background: BG[background] }} data-testid="glb-viewer">
      <Canvas camera={{ position: [0, 0.6, 2.4], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: false }}>
        <Suspense fallback={null}>
          <Stage adjustCamera={1.1} intensity={0.6} environment="city" shadows={false}>
            <Model url={url} wireframe={wireframe} />
          </Stage>
        </Suspense>
        {background === 'grid' && <gridHelper args={[4, 16, '#3a3a48', '#26262f']} position={[0, -0.6, 0]} />}
        <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={1.2} enableDamping />
      </Canvas>
      {controls && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWireframe((w) => !w)}
            className={`px-1.5 h-[22px] rounded text-[10px] border transition-colors ${wireframe ? 'bg-accent/20 border-accent text-accent-light' : 'bg-black/40 border-white/20 text-white/70 hover:text-white'}`}
            title="Toggle wireframe"
          >
            Wireframe
          </button>
          {(['dark', 'light', 'grid'] as ViewerBackground[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBackground(b)}
              className={`px-1.5 h-[22px] rounded text-[10px] border transition-colors ${background === b ? 'bg-accent/20 border-accent text-accent-light' : 'bg-black/40 border-white/20 text-white/70 hover:text-white'}`}
              title={`${b} background`}
            >
              {b}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
