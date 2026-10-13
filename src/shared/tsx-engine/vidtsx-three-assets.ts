// `@vidtsx/three-assets`: glTF models, HDR/EXR environment maps and image
// textures inside a <ThreeCanvas>, loaded so the frame that shows them is the
// frame Remotion screenshots (TSX_BUILDER_DESIGN.md P2 part 4).
//
// The trap (lab memory `remotion-three-asset-loading`): while rendering,
// @remotion/three runs R3F with frameloop "never" and draws only when the
// frame changes. A file that arrives later is committed to the scene but not
// DRAWN, so a still taken when its handle clears shows the scene without it.
// Each hook here keeps its delayRender handle (via @vidtsx/assets) until the
// commit that shows the file, then waits one task (so the piece's own effects,
// e.g. setting scene.environment, have run), draws with R3F's `advance()`, and
// only then lets the frame go.
//
// drei's Suspense loaders (useGLTF, useTexture, <Environment>) are not used: a
// Suspense loader remounts the canvas and drei's presets download from a CDN.
// Every loader here is local: Meshopt is decoded by three's bundled decoder;
// Draco and KTX2 (decoders fetched at run time) are refused by the build check.
//
// Every hook must run inside <ThreeCanvas> (it reads the R3F store).

import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
// Relative so the app's type check sees it; the bundle step maps it to the built-in '@vidtsx/assets'.
import { requireUrl, useLoaded } from './vidtsx-assets';

/** After the commit that shows a file: one task, one R3F draw, then release the frame. */
function useDrawThenRelease(): (done: () => void) => void {
  const advance = useThree((s) => s.advance);
  return useCallback(
    (done: () => void) => {
      setTimeout(() => {
        advance(performance.now(), true);
        done();
      }, 0);
    },
    [advance],
  );
}

let gltfLoader: GLTFLoader | null = null;
function getGltfLoader(): GLTFLoader {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }
  return gltfLoader;
}

/** The extension of a URL's path (`…/robot.glb?x` → `.glb`), lower case. */
function extensionOf(url: string): string {
  const pathname = (() => {
    try {
      return new URL(url, 'http://local/').pathname;
    } catch {
      return url;
    }
  })();
  const m = /\.[a-z0-9]+$/i.exec(pathname);
  return m ? m[0].toLowerCase() : '';
}

export interface LoadedModel {
  /** This component's own copy of the model (skinned meshes included): place it with <primitive object={scene} />. */
  scene: THREE.Group;
  /** The file's animation clips: play one with useModelAnimation. */
  animations: THREE.AnimationClip[];
  /** The loaded file, shared by every component that loads this URL. Do not add gltf.scene to the scene. */
  gltf: GLTF;
}

/**
 * A .glb (or a .gltf with its files beside it), loaded once per page. Each
 * component gets its own copy of the scene, so a model can be placed many
 * times. Null until it has arrived (the frame waits for it).
 */
export function useModel(url: string): LoadedModel | null {
  requireUrl(url, 'useModel');
  const settle = useDrawThenRelease();
  const gltf = useLoaded<GLTF>(`gltf\n${url}`, url, () => getGltfLoader().loadAsync(url), settle);
  // One object per loaded file and component, the same on every render: a piece's
  // useMemo([model]) (measuring it, a mixer) must run once, not on every frame.
  return useMemo(() => (gltf ? { scene: cloneSkinned(gltf.scene) as THREE.Group, animations: gltf.animations, gltf } : null), [gltf]);
}

/**
 * Poses a model on one of its clips at `seconds` (from the frame: frame / fps).
 * Frame-pure: the mixer is set to the time, never stepped by a delta.
 */
export function useModelAnimation(model: LoadedModel | null, clip: string | number, seconds: number): void {
  const mixer = useMemo(() => (model ? new THREE.AnimationMixer(model.scene) : null), [model]);
  const action = useMemo(() => {
    if (!model || !mixer) return null;
    const found = typeof clip === 'number' ? model.animations[clip] : THREE.AnimationClip.findByName(model.animations, clip);
    if (!found) {
      throw new Error(
        `useModelAnimation: no clip ${JSON.stringify(clip)} (the file has: ${model.animations.map((a) => a.name || '(unnamed)').join(', ') || 'none'})`,
      );
    }
    const a = mixer.clipAction(found);
    a.play();
    return a;
  }, [model, mixer, clip]);
  useLayoutEffect(() => {
    if (mixer && action) mixer.setTime(seconds);
  });
}

/**
 * An equirectangular .hdr or .exr as a texture ready for scene.environment
 * and scene.background (three prefilters it for reflections itself). Null
 * until it has arrived.
 */
export function useEnvironmentMap(url: string): THREE.Texture | null {
  requireUrl(url, 'useEnvironmentMap');
  const settle = useDrawThenRelease();
  return useLoaded<THREE.Texture>(
    `env\n${url}`,
    url,
    async () => {
      const ext = extensionOf(url);
      const loader = ext === '.exr' ? new EXRLoader() : new HDRLoader();
      if (ext !== '.exr' && ext !== '.hdr') throw new Error(`useEnvironmentMap takes .hdr or .exr (got "${ext || 'no extension'}")`);
      const texture = await loader.loadAsync(url);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      return texture;
    },
    settle,
  );
}

/**
 * An image file (.png .jpg .webp …) as a texture. `color: true` (the default)
 * for colour maps (sRGB); false for data maps (normal, roughness, AO).
 */
export function useImageTexture(url: string, options: { color?: boolean; flipY?: boolean } = {}): THREE.Texture | null {
  requireUrl(url, 'useImageTexture');
  const settle = useDrawThenRelease();
  const color = options.color ?? true;
  const flipY = options.flipY ?? true;
  return useLoaded<THREE.Texture>(
    `tex\n${color ? 'srgb' : 'linear'}\n${flipY ? 'flip' : 'noflip'}\n${url}`,
    url,
    async () => {
      const texture = await new THREE.TextureLoader().loadAsync(url);
      texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.flipY = flipY;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      return texture;
    },
    settle,
  );
}

export interface FileEnvironmentProps {
  /** The staticFile URL of an equirectangular .hdr or .exr. */
  url: string;
  /** Also show it behind the scene (default false: lighting and reflections only). */
  background?: boolean;
  /** scene.environmentIntensity (default 1). */
  intensity?: number;
  /** Blur of the background, 0-1 (default 0). */
  backgroundBlurriness?: number;
  /** Turn the environment about the vertical axis, radians (default 0). */
  rotationY?: number;
}

/** Lights the scene (and optionally fills its background) from a local HDRI. Inside <ThreeCanvas>. */
export function FileEnvironment(props: FileEnvironmentProps): null {
  const texture = useEnvironmentMap(props.url);
  const scene = useThree((s) => s.scene);
  const { background = false, intensity = 1, backgroundBlurriness = 0, rotationY = 0 } = props;
  useLayoutEffect(() => {
    if (!texture) return undefined;
    const before = {
      environment: scene.environment,
      background: scene.background,
      environmentIntensity: scene.environmentIntensity,
      backgroundBlurriness: scene.backgroundBlurriness,
    };
    scene.environment = texture;
    scene.environmentIntensity = intensity;
    scene.environmentRotation.set(0, rotationY, 0);
    if (background) {
      scene.background = texture;
      scene.backgroundBlurriness = backgroundBlurriness;
      scene.backgroundRotation.set(0, rotationY, 0);
    }
    return () => {
      scene.environment = before.environment;
      scene.background = before.background;
      scene.environmentIntensity = before.environmentIntensity;
      scene.backgroundBlurriness = before.backgroundBlurriness;
    };
  }, [texture, scene, background, intensity, backgroundBlurriness, rotationY]);
  return null;
}
