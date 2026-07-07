// One-shot migration: slice src/shared/ipc/types.ts into per-feature modules
// under src/shared/ipc/types/. Run once with `node scripts/split-ipc-types.mjs`.
// Safe to re-run; output dir is wiped each time.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcFile = path.join(repoRoot, 'src/shared/ipc/types.ts');
const outDir = path.join(repoRoot, 'src/shared/ipc/types');

const raw = fs.readFileSync(srcFile, 'utf8');
const lines = raw.split(/\r?\n/);

// Slice ranges are 1-indexed inclusive, matching `Read` line numbers.
const slice = (start, end) => lines.slice(start - 1, end).join('\n');

// Each module: filename, header (imports), and one or more line-range slices.
const modules = [
  {
    file: 'app-shell.ts',
    header: '',
    parts: [
      ['App operations', 3, 21],
      ['Dialog operations', 227, 249],
      ['Dialog: open folder', 709, 712],
      ['Context menu', 251, 264],
      ['Clipboard', 266, 269],
      ['Screenshot operations', 271, 297],
      ['Screenshot: capture HTML', 316, 326],
      ['Prototyper recording', 299, 314],
    ],
  },
  {
    file: 'creator.ts',
    header: '',
    parts: [
      ['Creator (dev-only) template push', 22, 86],
      ['Creator TSX archive — fire-and-forget on render', 88, 106],
    ],
  },
  {
    file: 'file.ts',
    header: '',
    parts: [
      ['Tree node types (shared with workspace)', 108, 126],
      ['File operations', 128, 183],
      ['File rename', 185, 194],
      ['File move', 196, 205],
      ['File: get projects dir', 207, 210],
      ['File: get assets dir', 212, 215],
      ['Binary file read (for GLB, images, etc.)', 217, 225],
    ],
  },
  {
    file: 'bundle.ts',
    header: '',
    parts: [
      ['Bundle operations', 328, 361],
      ['Module operations (native player)', 363, 390],
      ['TSX validation', 392, 405],
    ],
  },
  {
    file: 'render.ts',
    header: '',
    parts: [
      ['Render operations', 407, 499],
      ['Render queue persistence types', 501, 607],
      ['Render CPU usage', 633, 633],
    ],
  },
  {
    file: 'settings.ts',
    header: `import type { RenderCpuUsage, RenderGpuBackend, RenderHardwareAcceleration } from './render';`,
    parts: [
      ['Settings operations', 635, 707],
    ],
  },
  {
    file: 'whisper.ts',
    header: '',
    parts: [
      ['Whisper binary operations', 714, 731],
      ['Whisper model operations', 733, 763],
      ['Transcript segment from whisper output', 765, 771],
      ['Full transcription result', 773, 779],
      ['Whisper transcribe request', 781, 786],
      ['Whisper transcribe response', 788, 793],
      ['Transcription progress event (pushed via webContents.send)', 795, 800],
      ['Cancel transcription response', 802, 805],
    ],
  },
  {
    file: 'transcription.ts',
    header: `import type { TranscriptResult } from './whisper';`,
    parts: [['Transcription project types', 809, 865]],
  },
  {
    file: 'llm.ts',
    header: `import type { AiFeatureSource } from '@shared/types/ai-usage';`,
    parts: [
      ['LLM provider types', 869, 914],
      ['LLM usage stats (mirrors engine LLMUsage for IPC)', 917, 936],
      ['LLM image attachment', 939, 942],
      ['LLM generation', 945, 978],
      ['LLM chat generation (multi-turn)', 981, 1018],
    ],
  },
  {
    file: 'skills.ts',
    header: '',
    parts: [['Skills registry', 1022, 1034]],
  },
  {
    file: 'studio.ts',
    header: `import type { TranscriptSegment } from './whisper';\nimport type { TsxSuggestion, TsxSlot } from './tsx';`,
    parts: [
      ['Studio project types', 1038, 1110],
      ['Studio TSX save', 1762, 1781],
    ],
  },
  {
    file: 'whiteboard.ts',
    header: `import type { Scene, UserImageAsset, UserSvgAsset } from '@shared/types/whiteboard';`,
    parts: [
      ['Whiteboard Studio projects', 1113, 1154],
      ['Whiteboard Studio user SVG library', 1157, 1179],
      ['Whiteboard Studio user image library', 1182, 1210],
    ],
  },
  {
    file: 'design.ts',
    header: '',
    parts: [['Design (Canva-style single-canvas creator)', 1465, 1589]],
  },
  {
    file: 'flows.ts',
    header: '',
    parts: [['Flows (node-graph builder) — projects', 1595, 1658]],
  },
  {
    file: 'tsx.ts',
    header: `import type { TranscriptSegment } from './whisper';`,
    parts: [
      ['TSX Auto-Edit Analysis', 1715, 1746],
      ['TSX Slots (generated overlays)', 1749, 1760],
    ],
  },
  {
    file: 'image-studio.ts',
    header: '',
    parts: [
      ['Image generation types', 1785, 1882],
      ['Image Studio persistence types', 1886, 1896],
      ['Reference image library types', 1900, 1954],
      ['Image Studio entries', 1956, 2030],
      ['Image Studio folder types', 2034, 2072],
      ['Prompt presets', 2074, 2095],
    ],
  },
  {
    file: 'thumbnail.ts',
    header: '',
    parts: [['Thumbnail operations', 2098, 2112]],
  },
  {
    file: 'log.ts',
    header: '',
    parts: [['Logging types', 2116, 2126]],
  },
  {
    file: 'frame-extractor.ts',
    header: '',
    parts: [['Tools: Frame Extractor types', 2130, 2186]],
  },
  {
    file: 'audio.ts',
    header: '',
    parts: [['Audio Engine types', 2399, 2542]],
  },
  {
    file: 'sd-image.ts',
    header: '',
    parts: [['Local SD Image Engine types', 2546, 2703]],
  },
  {
    file: 'system.ts',
    header: '',
    parts: [
      ['System Resource Monitor types', 2707, 2719],
      ['PyTorch pip install', 2934, 2941],
      ['System info (Main tab dashboard)', 2944, 2970],
    ],
  },
  {
    file: 'local-llm.ts',
    header: '',
    parts: [['Local LLM Engine types', 2723, 2885]],
  },
  {
    file: 'download.ts',
    header: '',
    parts: [['Download manager operations', 2889, 2931]],
  },
  {
    file: 'ai-usage.ts',
    header: `import type { AiUsageSummary, AiUsagePeriod, AiUsageChartData, AiUsageEntry, AiFeatureSource } from '@shared/types/ai-usage';`,
    parts: [['AI Usage tracking', 2974, 3016]],
  },
  {
    file: 'embedding.ts',
    header: '',
    parts: [['Embedding Engine types', 3020, 3087]],
  },
  {
    file: 'license.ts',
    header: '',
    parts: [['License types', 3091, 3126]],
  },
  {
    file: 'updater.ts',
    header: '',
    parts: [['Updater types', 3130, 3162]],
  },
  {
    file: 'homepage.ts',
    header: '',
    parts: [['Homepage types', 3166, 3245]],
  },
  {
    file: 'moderation.ts',
    header: '',
    parts: [['Moderation types', 3249, 3264]],
  },
];

// Strip inline `import('../../shared/types/ai-usage').X` references that are now
// covered by named imports at the top of llm.ts and ai-usage.ts.
function rewriteAiUsageInlineImports(src) {
  return src.replace(
    /import\(['"][^'"]*ai-usage['"]\)\.(\w+)/g,
    (_, name) => name,
  );
}

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

const allExports = [];
for (const m of modules) {
  const sections = m.parts.map(([title, start, end]) => {
    const body = slice(start, end).replace(/^\s+|\s+$/g, '');
    return `// ─── ${title} ───\n${body}`;
  });
  let content = '';
  if (m.header) content += `${m.header}\n\n`;
  content += sections.join('\n\n');
  content = rewriteAiUsageInlineImports(content);
  // Tidy: ensure single trailing newline.
  content = content.replace(/\s*$/, '\n');
  fs.writeFileSync(path.join(outDir, m.file), content);
  allExports.push(m.file.replace(/\.ts$/, ''));
}

// Write index.ts barrel for the types/ folder.
const indexContent =
  '// Auto-generated by scripts/split-ipc-types.mjs.\n' +
  allExports
    .sort()
    .map((name) => `export * from './${name}';`)
    .join('\n') +
  '\n';
fs.writeFileSync(path.join(outDir, 'index.ts'), indexContent);

console.log(`Wrote ${modules.length} modules + index.ts to ${outDir}`);
