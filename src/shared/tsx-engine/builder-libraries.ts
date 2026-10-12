// The builder's library set (TSX_BUILDER_DESIGN.md T4 Rev 2, P2 part 1): the ONE list of
// packages a builder artifact may use. Every package here is installed in the app and is
// inlined into the single-file artifact by the bundle step (shot-bundle.ts), so it works in
// every consumer that takes the artifact (Creator preview + export, Studio shots, agents).
// The bundle step's allowlist, the builder prompt's catalogue and the tests all read it.
//
// Adding a package = one entry here + `npm install --save-exact` + a release.
// The `use` line is what the builder reads: what the package is for and the one rule
// that keeps it frame-pure (Remotion renders frames out of order and in parallel).

export type BuilderLibraryArea = '2d' | 'data' | '3d' | 'physics';

export interface BuilderLibrary {
  /** npm name; its subpaths are allowed too (`d3-scale` style modules: see `family`). */
  name: string;
  area: BuilderLibraryArea;
  /** One line for the builder prompt: what to use it for, and how to keep it frame-pure. */
  use: string;
  /** Also allow `<name>-<module>` packages (the d3 modules). */
  family?: boolean;
}

export const BUILDER_LIBRARY_AREAS: Record<BuilderLibraryArea, string> = {
  '2d': '2D drawing, text and motion',
  data: 'Data, maps, maths and code',
  '3d': '3D',
  physics: 'Physics',
};

export const BUILDER_LIBRARIES: readonly BuilderLibrary[] = [
  { name: '@remotion/paths', area: '2d', use: 'SVG path maths: evolvePath (draw a line on), getLength, getPointAtLength, interpolatePath.' },
  { name: '@remotion/shapes', area: '2d', use: '<Circle>, <Rect>, <Triangle>, <Star>, <Pie>, <Polygon> as SVG, or makeX() for the path string.' },
  { name: '@remotion/noise', area: '2d', use: 'noise2D / noise3D (seed, x, y[, z]): seeded organic wobble, grain, drift. Prefer it over simplex-noise.' },
  { name: '@remotion/transitions', area: '2d', use: '<TransitionSeries> with fade / slide / wipe / flip / clockWipe between scenes.' },
  { name: '@remotion/layout-utils', area: '2d', use: 'measureText, fitText, fitTextOnNLines, fillTextBox: size text to a box instead of guessing.' },
  { name: '@remotion/motion-blur', area: '2d', use: '<Trail> (echo trails) and <CameraMotionBlur> (real motion blur over fast movement).' },
  { name: '@remotion/light-leaks', area: '2d', use: '<LightLeak>: a filmic light-leak overlay.' },
  { name: '@remotion/google-fonts', area: '2d', use: "@remotion/google-fonts/<Family>: loadFont('normal', { weights, subsets: ['latin'] }) at module scope." },
  { name: 'roughjs', area: '2d', use: "Hand-drawn, sketch, chalk strokes: rough.generator() → shapes → gen.toPaths(shape) → SVG <path>s. ALWAYS pass a fixed `seed` in the options, or every frame redraws differently." },
  { name: 'simplex-noise', area: '2d', use: 'createNoise2D(prng): only with a seeded PRNG you write (never Math.random).' },
  { name: 'chroma-js', area: '2d', use: 'Colour scales, mixing, contrast.' },
  { name: 'lucide-react', area: '2d', use: 'Icons as React components (<Database />, <Server />…).' },
  { name: 'd3', area: 'data', family: true, use: "scales, shapes (line, area, arc, pie, stack), hierarchy (tree, pack, treemap), geo projections, force layouts. Never d3-transition or d3-timer; a forceSimulation must be .stop()ped at once and stepped with .tick(n) inside useMemo." },
  { name: 'topojson-client', area: 'data', use: 'feature(topology, topology.objects.countries) → GeoJSON for a d3-geo projection.' },
  { name: 'world-atlas', area: 'data', use: "Offline world maps: import world from 'world-atlas/countries-110m.json' (50m / 10m for detail; land-*.json for coastlines)." },
  { name: 'katex', area: 'data', use: "Maths: katex.renderToString(tex, { output: 'mathml', throwOnError: false }) into a div (MathML needs no stylesheet)." },
  { name: 'prism-react-renderer', area: 'data', use: 'Syntax-highlighted code: <Highlight theme={themes.vsDark} code language> rendering your own <span>s.' },
  { name: 'three', area: '3d', use: 'The 3D engine (geometries, materials, maths). Draw it through @remotion/three.' },
  { name: '@remotion/three', area: '3d', use: '<ThreeCanvas width height> hosts the scene; it ties R3F to the current frame.' },
  { name: '@react-three/fiber', area: '3d', use: 'React for three.js. Drive every change from useCurrentFrame(); never useFrame\'s clock or delta.' },
  { name: '@react-three/drei', area: '3d', use: 'Helpers: RoundedBox, Line, OrbitControls-free cameras, ContactShadows, MeshTransmissionMaterial… Not Environment presets, Text or Text3D: they download files at render.' },
  { name: '@react-three/postprocessing', area: '3d', use: '<EffectComposer> with Bloom, DepthOfField, N8AO (ambient occlusion), Vignette, ToneMapping.' },
  { name: 'postprocessing', area: '3d', use: 'The effect passes under @react-three/postprocessing (import it only for a custom effect).' },
  { name: '@dimforge/rapier3d-compat', area: 'physics', use: "Rigid-body 3D physics (WASM inlined). await RAPIER.init() once inside delayRender/continueRender, then step a world at a fixed dt from frame 0." },
  { name: '@dimforge/rapier2d-compat', area: 'physics', use: 'The 2D version of Rapier: same init and stepping rules.' },
  { name: 'cannon-es', area: 'physics', use: 'Pure-JS 3D physics: world.step(1 / fps) from frame 0, never world.fixedStep with a clock.' },
  { name: 'matter-js', area: 'physics', use: 'Pure-JS 2D physics: Engine.update(engine, 1000 / fps) from frame 0; never Runner (it runs on a clock).' },
  { name: 'planck', area: 'physics', use: 'Box2D for JS: world.step(1 / fps) from frame 0.' },
];

/** Refused by name with the reason, before anything else: each animates on its own clock. */
export const BANNED_LIBRARIES: readonly { name: string; why: string }[] = [
  { name: 'gsap', why: 'it animates on its own clock' },
  { name: 'framer-motion', why: 'it animates on its own clock' },
  { name: 'motion', why: 'it animates on its own clock (framer-motion)' },
  { name: 'react-spring', why: 'it animates on its own clock' },
  { name: '@react-spring', why: 'it animates on its own clock' },
  { name: 'animejs', why: 'it animates on its own clock' },
  { name: 'popmotion', why: 'it animates on its own clock' },
  { name: 'd3-transition', why: 'it animates on its own clock (use interpolate on the frame)' },
  { name: 'd3-timer', why: 'it runs on a clock (step simulations with .tick(n))' },
];

const matches = (spec: string, name: string): boolean => spec === name || spec.startsWith(`${name}/`);

/** The package name of a bare specifier: `@scope/pkg/sub` → `@scope/pkg`, `pkg/sub` → `pkg`. */
export function packageNameOf(spec: string): string {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Why a bare import is refused outright, or null. */
export function bannedLibraryReason(spec: string): string | null {
  // `@react-spring` is a whole scope: `matches` covers `@react-spring/web` through the slash.
  const hit = BANNED_LIBRARIES.find((b) => matches(spec, b.name));
  return hit ? hit.why : null;
}

/**
 * May the bundle step inline this bare import? The set above, its subpaths, the d3
 * modules, every @remotion/* package (Import TSX has always allowed them) and
 * remotion's own subpaths (`remotion/no-react`). react / remotion stay external.
 */
export function isBuilderLibrary(spec: string): boolean {
  if (bannedLibraryReason(spec)) return false;
  if (/^@remotion\/[^/]+(\/.*)?$/.test(spec) || /^remotion\/.+/.test(spec)) return true;
  return BUILDER_LIBRARIES.some(
    (lib) => matches(spec, lib.name) || (lib.family === true && new RegExp(`^${lib.name}-[a-z][a-z0-9-]*(/.*)?$`).test(spec)),
  );
}

/** The builder prompt's catalogue, grouped by area, one line per package. */
export function builderLibraryCatalogue(): string {
  return (Object.keys(BUILDER_LIBRARY_AREAS) as BuilderLibraryArea[])
    .map((area) => {
      const lines = BUILDER_LIBRARIES.filter((lib) => lib.area === area).map((lib) => `- \`${lib.name}\`: ${lib.use}`);
      return `### ${BUILDER_LIBRARY_AREAS[area]}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}
