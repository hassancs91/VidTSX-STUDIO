// One-shot migration: slice src/preload/preload.ts into per-feature modules
// under src/preload/api/. Master preload.ts becomes a thin shim that merges
// each feature object and exposes it via contextBridge.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcFile = path.join(repoRoot, 'src/preload/preload.ts');
const outDir = path.join(repoRoot, 'src/preload/api');

const raw = fs.readFileSync(srcFile, 'utf8');
const lines = raw.split(/\r?\n/);

const slice = (start, end) => lines.slice(start - 1, end).join('\n');

// Pull the master type-import names so we can dedupe per-file imports.
// Block runs from line 3 to line 419 (last name before `} from`).
const knownTypes = new Set();
for (let i = 3; i <= 419; i++) {
  const m = lines[i - 1].match(/^\s*([A-Z]\w*),?$/);
  if (m) knownTypes.add(m[1]);
}

// Each feature: name, sections [[start,end], ...]. Lines are inclusive.
// Note: dead stubs (templatesList, templatesDownload, apiVerify, apiSetKey)
// are intentionally excluded — they target unused channels.
const features = [
  {
    name: 'app-shell',
    constName: 'appShellApi',
    parts: [
      ['App operations', 423, 429],
      ['Dialog operations', 467, 471],
      ['Context menu operations', 473, 475],
      ['Clipboard operations', 477, 479],
      ['Screenshot operations', 481, 489],
      ['Prototyper operations', 491, 495],
    ],
  },
  {
    name: 'creator',
    constName: 'creatorApi',
    parts: [['Creator (dev-only) template push', 431, 441]],
  },
  {
    name: 'file',
    constName: 'fileApi',
    parts: [['File operations', 443, 465]],
  },
  {
    name: 'bundle',
    constName: 'bundleApi',
    parts: [
      ['Bundle operations', 497, 506],
      ['Module operations (native player)', 508, 512],
      ['TSX validation', 514, 516],
    ],
  },
  {
    name: 'render',
    constName: 'renderApi',
    parts: [
      ['Render operations', 518, 538],
      ['Render event listeners', 540, 555],
    ],
  },
  {
    name: 'license',
    constName: 'licenseApi',
    parts: [['License operations', 563, 576]],
  },
  {
    name: 'updater',
    constName: 'updaterApi',
    parts: [['Updater operations', 578, 611]],
  },
  {
    name: 'settings',
    constName: 'settingsApi',
    parts: [['Settings operations', 617, 635]],
  },
  {
    name: 'whisper',
    constName: 'whisperApi',
    parts: [
      ['Whisper operations', 637, 651],
      ['Whisper transcription progress event listener', 653, 660],
      ['Whisper progress event listener', 661, 666],
      ['Transcription project operations', 668, 676],
    ],
  },
  {
    name: 'llm',
    constName: 'llmApi',
    parts: [['LLM operations', 678, 690]],
  },
  {
    name: 'skills',
    constName: 'skillsApi',
    parts: [['Skills registry', 692, 694]],
  },
  {
    name: 'studio',
    constName: 'studioApi',
    parts: [
      ['Studio operations', 696, 706],
      ['Studio TSX analysis & generation', 708, 714],
    ],
  },
  {
    name: 'whiteboard',
    constName: 'whiteboardApi',
    parts: [
      ['Whiteboard projects', 716, 724],
      ['Whiteboard user SVG library', 726, 732],
      ['Whiteboard user image library', 734, 740],
    ],
  },
  {
    name: 'design',
    constName: 'designApi',
    parts: [
      ['Design (Canva-style) projects', 792, 802],
      ['Design — designs (per project)', 804, 812],
    ],
  },
  {
    name: 'flows',
    constName: 'flowsApi',
    parts: [['Flows (node-graph builder) projects', 814, 824]],
  },
  {
    name: 'image-studio',
    constName: 'imageStudioApi',
    parts: [
      ['Image generation operations', 826, 838],
      ['Image Studio operations', 840, 860],
      ['Reference image library', 862, 879],
    ],
  },
  {
    name: 'thumbnail',
    constName: 'thumbnailApi',
    parts: [['Thumbnail operations', 881, 888]],
  },
  {
    name: 'frame-extractor',
    constName: 'frameExtractorApi',
    parts: [['Tools: Frame Extractor', 890, 904]],
  },
  {
    name: 'log',
    constName: 'logApi',
    parts: [['Logging', 906, 908]],
  },
  {
    name: 'audio',
    constName: 'audioApi',
    parts: [
      ['Audio engine operations', 942, 955],
      ['Audio STT', 957, 977],
      ['Audio TTS', 979, 983],
      ['Audio settings', 985, 989],
    ],
  },
  {
    name: 'sd-image',
    constName: 'sdImageApi',
    parts: [['Local SD image engine operations', 991, 1035]],
  },
  {
    name: 'system',
    constName: 'systemApi',
    parts: [
      ['System resource monitor (always-on, push events only)', 1037, 1042],
      ['System info', 1087, 1091],
    ],
  },
  {
    name: 'local-llm',
    constName: 'localLlmApi',
    parts: [['Local LLM engine operations', 1044, 1085]],
  },
  {
    name: 'download',
    constName: 'downloadApi',
    parts: [['Download manager operations', 1093, 1108]],
  },
  {
    name: 'embedding',
    constName: 'embeddingApi',
    parts: [['Embedding engine operations', 1110, 1127]],
  },
  {
    name: 'moderation',
    constName: 'moderationApi',
    parts: [['Moderation engine', 1129, 1131]],
  },
  {
    name: 'ai-usage',
    constName: 'aiUsageApi',
    parts: [['AI Usage tracking', 1133, 1141]],
  },
  {
    name: 'homepage',
    constName: 'homepageApi',
    parts: [['Homepage content', 1143, 1145]],
  },
];

function detectTypeNames(body) {
  const found = new Set();
  for (const id of body.matchAll(/\b([A-Z]\w*)\b/g)) {
    if (knownTypes.has(id[1])) found.add(id[1]);
  }
  return [...found].sort();
}

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

const featureImports = [];
for (const f of features) {
  const sections = f.parts.map(([title, start, end]) => {
    return `  // ─── ${title} ───\n${slice(start, end)}`;
  });
  const body = sections.join('\n\n');
  const typeNames = detectTypeNames(body);
  const typeImport = typeNames.length
    ? `import type {\n${typeNames.map((n) => `  ${n},`).join('\n')}\n} from '../../shared/ipc/types';\n`
    : '';
  const content =
    `import { ipcRenderer } from 'electron';\n` +
    `import { IPC } from '../../shared/ipc/channels';\n` +
    typeImport +
    `\n` +
    `export const ${f.constName} = {\n` +
    body +
    (body.endsWith('\n') ? '' : '\n') +
    `};\n`;
  fs.writeFileSync(path.join(outDir, `${f.name}.ts`), content);
  featureImports.push({ name: f.name, constName: f.constName });
}

// Write index.ts barrel.
const indexContent =
  `// Auto-generated by scripts/split-preload.mjs.\n` +
  featureImports
    .map((f) => `export { ${f.constName} } from './${f.name}';`)
    .join('\n') +
  `\n`;
fs.writeFileSync(path.join(outDir, 'index.ts'), indexContent);

// Rewrite preload.ts to merge all api objects.
const preloadContent =
  `import { contextBridge } from 'electron';\n` +
  featureImports
    .map((f) => `import { ${f.constName} } from './api/${f.name}';`)
    .join('\n') +
  `\n\nconst api = {\n` +
  featureImports.map((f) => `  ...${f.constName},`).join('\n') +
  `\n};\n\n` +
  `contextBridge.exposeInMainWorld('api', api);\n\n` +
  `export type ElectronAPI = typeof api;\n\n` +
  `console.log('Preload script loaded');\n`;
fs.writeFileSync(path.join(repoRoot, 'src/preload/preload.ts'), preloadContent);

console.log(`Wrote ${features.length} feature modules + index.ts to ${outDir}`);
console.log(`Rewrote preload.ts (${preloadContent.split('\n').length} lines)`);
