// One-shot migration: split src/features/tools/components/AIChatScreen.tsx
// into a focused folder. The import path `./AIChatScreen` keeps working via
// a folder + index.ts barrel.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcFile = path.join(repoRoot, 'src/features/tools/components/AIChatScreen.tsx');
const outDir = path.join(repoRoot, 'src/features/tools/components/AIChatScreen');

const raw = fs.readFileSync(srcFile, 'utf8');
const lines = raw.split(/\r?\n/);
const slice = (start, end) => lines.slice(start - 1, end).join('\n');
const exportify = (body) => body.replace(/^function (\w+)/gm, 'export function $1');

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// ─── utils/format.ts ───
// formatFileSize (10-14), formatDuration (32-36), getLoadingLabel (38-67), formatTimestamp (69-71).
fs.mkdirSync(path.join(outDir, 'utils'), { recursive: true });
const formatUtils =
  `import type { ThinkingLevel } from '@shared/tsx-engine';\n\n` +
  `${exportify(slice(10, 14))}\n\n` +
  `${exportify(slice(32, 36))}\n\n` +
  `${exportify(slice(38, 67))}\n\n` +
  `${exportify(slice(69, 71))}\n`;
fs.writeFileSync(path.join(outDir, 'utils/format.ts'), formatUtils);

// ─── constants.ts ───
// THINKING_LEVELS (16-23), AGENT_TOOLS (25-30).
const constants =
  `import type { ThinkingLevel } from '@shared/tsx-engine';\n\n` +
  `export ${slice(16, 23)}\n\n` +
  `export ${slice(25, 30)}\n`;
fs.writeFileSync(path.join(outDir, 'constants.ts'), constants);

// ─── MessageBubble.tsx (lines 73-147) ───
const messageBubble =
  `import Markdown from 'react-markdown';\n` +
  `import remarkGfm from 'remark-gfm';\n` +
  `import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';\n` +
  `import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';\n` +
  `import type { AIChatMessage } from '../../hooks/useAIChat';\n` +
  `import { formatDuration } from './utils/format';\n\n` +
  `${exportify(slice(73, 147))}\n`;
fs.writeFileSync(path.join(outDir, 'MessageBubble.tsx'), messageBubble);

// ─── DebugPanel.tsx (lines 149-385) ───
const debugPanel =
  `import type { AIChatMessage } from '../../hooks/useAIChat';\n` +
  `import { formatDuration, formatFileSize, formatTimestamp } from './utils/format';\n\n` +
  `${exportify(slice(149, 385))}\n`;
fs.writeFileSync(path.join(outDir, 'DebugPanel.tsx'), debugPanel);

// ─── AIChatScreen.tsx (main, lines 387-784) ───
// Main needs: useState/useRef/useEffect/useCallback, useAIChat, AIChatMessage type,
// ThinkingLevel type, MessageBubble, DebugPanel, formatDuration, getLoadingLabel,
// THINKING_LEVELS, AGENT_TOOLS.
const main =
  `import { useState, useRef, useEffect, useCallback } from 'react';\n` +
  `import { useAIChat } from '../../hooks/useAIChat';\n` +
  `import type { AIChatMessage } from '../../hooks/useAIChat';\n` +
  `import type { ThinkingLevel } from '@shared/tsx-engine';\n` +
  `import { MessageBubble } from './MessageBubble';\n` +
  `import { DebugPanel } from './DebugPanel';\n` +
  `import { THINKING_LEVELS, AGENT_TOOLS } from './constants';\n` +
  `import { formatDuration, formatFileSize, getLoadingLabel } from './utils/format';\n\n` +
  `${slice(387, 784)}\n`;
fs.writeFileSync(path.join(outDir, 'AIChatScreen.tsx'), main);

// ─── index.ts barrel ───
fs.writeFileSync(
  path.join(outDir, 'index.ts'),
  `export { AIChatScreen } from './AIChatScreen';\n`,
);

fs.unlinkSync(srcFile);
console.log(`Wrote AIChatScreen folder with sub-components`);
