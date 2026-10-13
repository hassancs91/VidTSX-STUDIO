// `check` refuses drei helpers that download files at render time
// (TSX_BUILDER_DESIGN.md T4 Rev 2 item 5, P2 part 5; Hasan's pick 10-13: "check
// blocks them"). Online they work; offline, behind a firewall, or when the CDN
// moves a file, the render hangs or draws nothing. The prompt already said
// never; this makes it a check error the builder fixes in the same run.
//
// What fetches (read in @react-three/drei 10.7.7): <Environment preset> /
// useEnvironment({ preset }) (HDRIs from raw.githack), <Clouds> without
// `texture` and a bare <Cloud> (it wraps itself in a default <Clouds>), matcap /
// normal textures (jsDelivr), <Text> (troika's font resolver on jsDelivr), KTX2
// (a transcoder from a CDN), FaceLandmarker (MediaPipe). <Text3D> is refused
// with them: it suspends on its font, so a still is taken before it draws.
//
// The scan reads the piece's OWN files (the entry and the local files it
// imports), never the libraries: drei's source names every URL.

/** Each helper: the drei export names, when it fetches, and the error. */
interface NetworkHelper {
  names: string[];
  /**
   * Only some uses fetch: true when this file's use does. `local` is one name the
   * helper goes by here; `localsOf(exportName)` gives any drei export's names.
   */
  fetches?: (source: string, local: string, localsOf: (exportName: string) => string[]) => boolean;
  message: string;
}

const NETWORK_HELPERS: NetworkHelper[] = [
  {
    names: ['Environment', 'EnvironmentCube', 'EnvironmentMap', 'useEnvironment'],
    fetches: (source, local) =>
      openingTags(source, local).some((tag) => /\bpreset\s*=/.test(tag)) ||
      new RegExp(`(?<![\\w$.])${escapeRegExp(local)}\\s*\\(\\s*\\{[^)]*\\bpreset\\b`).test(source),
    message:
      "drei's Environment `preset` downloads its HDRI from a CDN while the frame renders, so the piece breaks offline. Light with `<FileEnvironment url={staticFile('studio.hdr')} />` from @vidtsx/three-assets and an .hdr in assets/ (library_search for one), or with lights / Lightformers inside <Environment> (no preset).",
  },
  {
    names: ['Cloud', 'Clouds'],
    fetches: (source, _local, localsOf) =>
      !localsOf('Clouds').some((clouds) => openingTags(source, clouds).some((tag) => /\btexture\s*=/.test(tag))),
    message:
      "drei's clouds download their cloud image from a CDN unless <Clouds texture={…}> wraps them (a bare <Cloud> makes its own default <Clouds>). Put a cloud .png in assets/ and pass texture={staticFile('cloud.png')} on <Clouds>, or build the cloud from soft spheres / sprites.",
  },
  {
    names: ['MatcapTexture', 'useMatcapTexture', 'NormalTexture', 'useNormalTexture'],
    message:
      "drei's matcap / normal texture helpers download their image from a CDN at render. Put the image in assets/ and load it with `useImageTexture(staticFile('matcap.png'))` from @vidtsx/three-assets (a matcap goes on meshMatcapMaterial's `matcap`).",
  },
  {
    names: ['Text'],
    message:
      "drei's <Text> (troika) fetches fonts from a CDN at render and lays out text asynchronously. Put words in an HTML layer over the <ThreeCanvas>, or make glyph shapes with opentype.js from a font file in assets/ (ShapeGeometry / ExtrudeGeometry).",
  },
  {
    names: ['Text3D'],
    message:
      "drei's <Text3D> suspends on its font file, so a still can be taken before the letters draw. Extrude glyph shapes from opentype.js (a font file in assets/) with ExtrudeGeometry, or put words in an HTML layer.",
  },
  {
    names: ['Ktx2', 'useKTX2'],
    message:
      'KTX2 textures need a transcoder downloaded from a CDN at render. Use a .png / .jpg / .webp texture in assets/ (useImageTexture from @vidtsx/three-assets).',
  },
  {
    names: ['FaceLandmarker', 'useFaceLandmarker', 'FaceControls'],
    message: "drei's face tracking downloads MediaPipe models from a CDN and needs a camera: not for a rendered piece.",
  },
];

const DREI = /^@react-three\/drei(?:\/[^'"]*)?$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface DreiImports {
  /** local name → drei export name */
  named: Map<string, string>;
  namespaces: string[];
}

/** Every `import … from '@react-three/drei'` in the file (named, aliased, namespace). */
export function dreiImports(source: string): DreiImports {
  const named = new Map<string, string>();
  const namespaces: string[] = [];
  const statement = /import\s+(?!type\s)([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(statement)) {
    if (!DREI.test(match[2])) continue;
    const clause = match[1];
    const ns = /\*\s*as\s+([A-Za-z_$][\w$]*)/.exec(clause);
    if (ns) namespaces.push(ns[1]);
    const braces = /\{([^}]*)\}/.exec(clause);
    if (!braces) continue;
    for (const part of braces[1].split(',')) {
      const spec = part.trim().replace(/^type\s+/, '');
      if (!spec || part.trim().startsWith('type ')) continue;
      const [imported, local] = spec.split(/\s+as\s+/).map((s) => s.trim());
      named.set(local ?? imported, imported);
    }
  }
  return { named, namespaces };
}

/**
 * The text of every opening JSX tag `<name …>` in the file, up to its closing
 * `>` outside braces and quotes (an attribute may hold `=>`).
 */
export function openingTags(source: string, name: string): string[] {
  const tags: string[] = [];
  const start = new RegExp(`<${escapeRegExp(name)}(?![\\w$.])`, 'g');
  for (const match of source.matchAll(start)) {
    let depth = 0;
    let quote: string | null = null;
    let i = match.index + match[0].length;
    for (; i < source.length; i++) {
      const c = source[i];
      if (quote) {
        if (c === '\\') i++;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    tags.push(source.slice(match.index, i + 1));
  }
  return tags;
}

/** The check errors for one of the piece's own files: one per helper that fetches. */
export function findNetworkHelpers(source: string, file: string): string[] {
  const imports = dreiImports(source);
  if (imports.named.size === 0 && imports.namespaces.length === 0) return [];
  const localsOf = (exportName: string): string[] => [
    ...[...imports.named].filter(([, imported]) => imported === exportName).map(([local]) => local),
    ...imports.namespaces
      .filter((ns) => new RegExp(`(?<![\\w$])${escapeRegExp(ns)}\\.${exportName}(?![\\w$])`).test(source))
      .map((ns) => `${ns}.${exportName}`),
  ];
  const errors: string[] = [];
  for (const helper of NETWORK_HELPERS) {
    const locals = helper.names.flatMap(localsOf);
    if (locals.length === 0) continue;
    const fetches = helper.fetches ? locals.some((local) => helper.fetches!(source, local, localsOf)) : true;
    if (fetches) errors.push(`${file}: ${helper.message}`);
  }
  return errors;
}
